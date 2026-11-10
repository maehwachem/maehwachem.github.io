import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const JSON_HEADERS = {'Content-Type': 'application/json'};

export class FarmError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

export function firebaseIdentity(projectId, fetcher = fetch) {
  let cached, refreshing;
  async function refreshKeys() {
    const response = await fetcher(CERTS_URL, {signal: AbortSignal.timeout(6500), redirect: 'error'});
    if (!response.ok) throw new FarmError(503, 'network');
    const keys = new Map(Object.entries(await response.json()).map(([kid, pem]) => [kid, createPublicKey(pem)]));
    if (!keys.size) throw new FarmError(503, 'network');
    const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? 0);
    cached = {keys, expires: Date.now() + maxAge * 1000};
    return keys;
  }
  return async token => {
    let parts, header, claims;
    try {
      parts = token.split('.');
      if (parts.length !== 3 || token.length > 6000 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) {
        throw new Error();
      }
      header = JSON.parse(Buffer.from(parts[0], 'base64url'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
    } catch {
      throw new FarmError(401, 'signin');
    }
    const now = Math.floor(Date.now() / 1000);
    if (header?.alg !== 'RS256' || typeof header.kid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(header.kid) ||
        claims?.aud !== projectId || claims.iss !== 'https://securetoken.google.com/' + projectId ||
        typeof claims.sub !== 'string' || !SAFE_UID.test(claims.sub) ||
        !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
        !Number.isSafeInteger(claims.iat) || claims.iat > now ||
        !Number.isSafeInteger(claims.auth_time) || claims.auth_time > claims.iat ||
        claims.firebase?.sign_in_provider !== 'google.com') {
      throw new FarmError(401, 'signin');
    }
    if (!cached || cached.expires <= Date.now()) {
      refreshing ??= refreshKeys().finally(() => { refreshing = null; });
    }
    const keys = refreshing ? await refreshing : cached.keys;
    const key = keys.get(header.kid);
    if (!key || !verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), key, Buffer.from(parts[2], 'base64url'))) {
      throw new FarmError(401, 'signin');
    }
    const email = claims.email_verified === true && typeof claims.email === 'string' &&
      claims.email.length <= 320 && /^[^\s@]+@[^\s@]+$/.test(claims.email) ? claims.email.toLowerCase() : '';
    return {uid: claims.sub, email};
  };
}

function datastoreAccess(projectId, credentials, fetcher) {
  const email = credentials?.client_email;
  if (credentials?.project_id !== projectId || credentials?.type !== 'service_account' ||
      email !== 'farm-save@' + projectId + '.iam.gserviceaccount.com') {
    throw new Error('Use the dedicated farm-save service account.');
  }
  const key = createPrivateKey(credentials.private_key);
  if (key.asymmetricKeyType !== 'rsa') throw new Error('Expected a Google RSA service account key.');
  let cached, renewing;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  async function refresh() {
    const iat = Math.floor(Date.now() / 1000);
    const assertion = encode({alg: 'RS256', typ: 'JWT'}) + '.' +
      encode({iss: email, aud: TOKEN_URL, scope: 'https://www.googleapis.com/auth/datastore', iat, exp: iat + 3600});
    const response = await fetcher(TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: assertion + '.' + sign('RSA-SHA256', Buffer.from(assertion), key).toString('base64url')}),
      signal: AbortSignal.timeout(6500), redirect: 'error'
    });
    if (!response.ok) throw new FarmError(503, 'network');
    const result = await response.json();
    if (typeof result.access_token !== 'string' || !Number.isFinite(result.expires_in)) {
      throw new FarmError(503, 'network');
    }
    cached = {token: result.access_token, expires: iat + result.expires_in};
    return cached.token;
  }
  return async () => {
    if (cached && cached.expires > Date.now() / 1000 + 60) return cached.token;
    renewing ??= refresh().finally(() => { renewing = null; });
    return renewing;
  };
}

export function farmStore(projectId, credentials, fetcher = fetch) {
  const access = datastoreAccess(projectId, credentials, fetcher);
  const prefix = 'projects/' + projectId + '/databases/(default)/documents';
  const root = 'https://firestore.googleapis.com/v1/' + prefix;
  async function request(suffix, init = {}) {
    return fetcher(root + suffix, {...init, headers: {...JSON_HEADERS, Authorization: 'Bearer ' + await access()},
      signal: AbortSignal.timeout(6500), redirect: 'error'});
  }
  function decode(document) {
    const row = Object.fromEntries(Object.entries(document.fields || {}).map(([name, value]) => [
      name, 'integerValue' in value ? Number(value.integerValue) : value.stringValue
    ]));
    return {...row, etag: document.updateTime};
  }
  async function get(path) {
    const response = await request('/' + path);
    if (response.status === 404) return null;
    if (!response.ok) throw new FarmError(503, 'network');
    return decode(await response.json());
  }
  function write(path, row, old) {
    const fields = Object.fromEntries(Object.entries(row).map(([key, value]) => [
      key, typeof value === 'number' ? {integerValue: String(value)} : {stringValue: value}
    ]));
    return {update: {name: prefix + '/' + path, fields}, currentDocument: old ? {updateTime: old.etag} : {exists: false}};
  }
  async function commit(writes) {
    const response = await request(':commit', {method: 'POST', body: JSON.stringify({writes})});
    if (response.ok) return true;
    const problem = (await response.json().catch(() => null))?.error?.status;
    if (['FAILED_PRECONDITION', 'ALREADY_EXISTS', 'ABORTED', 'NOT_FOUND'].includes(problem)) return false;
    throw new FarmError(503, 'network');
  }
  const path = (owner, id) => 'players/' + owner + '/farms/' + id;
  const approvalPath = id => 'farmApprovals/' + id;
  return {
    get: (owner, id) => get(path(owner, id)),
    getApproval: id => get(approvalPath(id)),
    setApproval: (id, row, old) => commit([write(approvalPath(id), row, old)]),
    deleteApproval: (id, old) => commit([{
      delete: prefix+'/'+approvalPath(id), currentDocument: {updateTime: old.etag}
    }]),
    async listApprovals(status, after) {
      const pageSize=30;
      const structuredQuery = {
        from: [{collectionId: 'farmApprovals'}],
        where: {fieldFilter: {field: {fieldPath: 'status'}, op: 'EQUAL', value: {stringValue: status}}},
        orderBy: [{field: {fieldPath: '__name__'}, direction: 'ASCENDING'}],
        limit: pageSize+1
      };
      if(after) structuredQuery.startAt={values:[{referenceValue:prefix+'/'+approvalPath(after)}],before:false};
      const response = await request(':runQuery', {method: 'POST', body: JSON.stringify({structuredQuery})});
      if (!response.ok) throw new FarmError(503, 'network');
      const rows=(await response.json()).filter(row => row.document).map(({document}) => {
        const {email,etag}=decode(document);
        return {id:document.name.split('/').at(-1),email:email??null,version:etag};
      });
      const requests=rows.slice(0,pageSize);
      return {requests,next:rows.length>pageSize?requests.at(-1).id:null};
    },
    set(owner,id,row,old,approval) {
      const writes=[write(path(owner,id),row,old)];
      if(approval) writes.push({...write(approvalPath(approval.id),{status:'approved'},approval),
        updateMask:{fieldPaths:['status']}});
      return commit(writes);
    },
    async list(owner) {
      const response = await request('/players/' + owner + '/farms?pageSize=100&orderBy=updated_at%20desc');
      if (!response.ok) throw new FarmError(503, 'network');
      return ((await response.json()).documents || []).map(decode);
    },
    async takeBudget(key, action) {
      const now = Date.now();
      const span = action === 'write' ? 6000 : 60000;
      const limit = {read: 20, write: 1, create: 2, list: 12}[action];
      const accountWindow = Math.floor(now / span);
      const day = Math.floor(now / 86400000);
      const accountPath = 'requestLimits/' + action + '-' + key;
      const globalPath = 'requestLimits/drive-global';
      const dailyPath = 'requestLimits/drive-' + key;
      const usesDrive = action !== 'list';
      const count = (row, window) => row?.window === window ? row.count : 0;
      for (let i = 0; i < 4; i++) {
        const [account, global, daily] = await Promise.all([
          get(accountPath), usesDrive ? get(globalPath) : null, usesDrive ? get(dailyPath) : null
        ]);
        const accountCount = count(account, accountWindow);
        const globalCount = count(global, day);
        const dailyCount = count(daily, day);
        if (accountCount >= limit || (usesDrive && (globalCount >= 600 || dailyCount >= 120))) return false;
        const writes = [write(accountPath, {window: accountWindow, count: accountCount + 1}, account)];
        if (usesDrive) writes.push(
          write(globalPath, {window: day, count: globalCount + 1}, global),
          write(dailyPath, {window: day, count: dailyCount + 1}, daily)
        );
        if (await commit(writes)) return true;
      }
      return false;
    }
  };
}
