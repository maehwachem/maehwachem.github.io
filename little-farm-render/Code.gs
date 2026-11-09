const FARM_DRIVE_FOLDER = '오늘도, 작은 농장 저장';
const FARM_DRIVE_API = 'https://www.googleapis.com/drive/v3/files/';
const FARM_HASH = /^[0-9a-f]{64}$/;
const FARM_NONCE = /^[0-9a-f]{32}$/;
const FARM_FILE = /^[a-zA-Z0-9_-]{10,150}$/;
const FARM_WINDOW_MS = 120000;

function farmLocked_(action) {
  const lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try { return action(); }
  finally { lock.releaseLock(); }
}

function authorizeFarmDrive() {
  return farmLocked_(() => {
    const properties = PropertiesService.getScriptProperties();
    const previous = properties.getProperty('FARM_FOLDER_ID');
    if (previous) {
      const folder = Drive.Files.get(previous, {fields: 'id,trashed,mimeType'});
      if (!folder.trashed && folder.mimeType === 'application/vnd.google-apps.folder') return folder.id;
      throw new Error('농장 저장 폴더를 확인해 주세요.');
    }
    const folder = Drive.Files.create({name: FARM_DRIVE_FOLDER, mimeType: 'application/vnd.google-apps.folder'});
    properties.setProperty('FARM_FOLDER_ID', folder.id);
    return folder.id;
  });
}

function farmHex_(bytes) {
  return bytes.map(byte => ('0' + (byte & 255).toString(16)).slice(-2)).join('');
}

function farmHash_(value) {
  return farmHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8));
}

function farmProofMatches_(a, b) {
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function farmUseNonce_(properties, request) {
  return farmLocked_(() => {
    const now = Date.now();
    if (Math.abs(now - request.time) > FARM_WINDOW_MS) return false;
    const slot = 'FARM_REQUESTS_' + request.nonce[0];
    const recent = JSON.parse(properties.getProperty(slot) || '{}');
    for (const nonce of Object.keys(recent)) if (recent[nonce] < now) delete recent[nonce];
    if (Object.prototype.hasOwnProperty.call(recent, request.nonce) || Object.keys(recent).length >= 128) return false;
    recent[request.nonce] = request.time + FARM_WINDOW_MS;
    properties.setProperty(slot, JSON.stringify(recent));
    return true;
  });
}

function farmResult_(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function farmPut_(folderId, input) {
  if (typeof input.key !== 'string' || !FARM_HASH.test(input.key) ||
      typeof input.operation !== 'string' || !FARM_NONCE.test(input.operation) ||
      typeof input.stateHash !== 'string' || !FARM_HASH.test(input.stateHash) || input.state?.v !== 1) return {error: 'invalid'};
  const state = JSON.stringify(input.state);
  const file = Utilities.newBlob(state, 'application/json');
  if (file.getBytes().length > 12000 || farmHash_(state) !== input.stateHash) return {error: 'invalid'};
  const name = 'farm-' + input.key + '-' + input.operation + '.json';
  return farmLocked_(() => {
    const matches = Drive.Files.list({
      q: "'" + folderId + "' in parents and name = '" + name + "' and trashed = false",
      fields: 'files(id,appProperties),nextPageToken', pageSize: 2
    });
    if (matches.nextPageToken || matches.files?.length > 1) return {error: 'operation_reused'};
    const previous = matches.files?.[0];
    if (previous) {
      return previous.appProperties?.stateHash === input.stateHash ? {ok: true, data: previous.id} : {error: 'operation_reused'};
    }
    const row = Drive.Files.create({name, mimeType: 'application/json', parents: [folderId],
      appProperties: {farmSave: '1', stateHash: input.stateHash}}, file, {fields: 'id'});
    return {ok: true, data: row.id};
  });
}

function farmFile_(folderId, input) {
  if (typeof input.id !== 'string' || !FARM_FILE.test(input.id)) return {error: 'invalid'};
  const response = UrlFetchApp.fetch(FARM_DRIVE_API + input.id + '?fields=id,parents,appProperties,trashed', {
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true
  });
  if (response.getResponseCode() === 404) return {error: 'missing'};
  if (response.getResponseCode() !== 200) return {error: 'unavailable'};
  const file = JSON.parse(response.getContentText());
  if (file.trashed || !file.parents?.includes(folderId) || file.appProperties?.farmSave !== '1') return {error: 'missing'};
  if (input.action === 'trash') {
    Drive.Files.update({trashed: true}, input.id);
    return {ok: true, data: null};
  }
  const media = UrlFetchApp.fetch(FARM_DRIVE_API + input.id + '?alt=media', {
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true
  });
  if (media.getResponseCode() === 404) return {error: 'missing'};
  if (media.getResponseCode() !== 200) return {error: 'unavailable'};
  const state = media.getContentText('UTF-8');
  if (farmHash_(state) !== file.appProperties.stateHash) return {error: 'unavailable'};
  return {ok: true, data: JSON.parse(state)};
}

function doPost(event) {
  try {
    const contents = event?.postData?.contents;
    if (!contents || contents.length > 24000) return farmResult_({error: 'invalid'});
    const request = JSON.parse(contents);
    const properties = PropertiesService.getScriptProperties();
    const key = properties.getProperty('FARM_BRIDGE_KEY');
    if (!key || !FARM_HASH.test(key) || !Number.isSafeInteger(request?.time) ||
        Math.abs(Date.now() - request.time) > FARM_WINDOW_MS ||
        typeof request.nonce !== 'string' || !FARM_NONCE.test(request.nonce) ||
        typeof request.signature !== 'string' || !FARM_HASH.test(request.signature) ||
        typeof request.payload !== 'string') return farmResult_({error: 'unauthorized'});
    const message = request.time + '.' + request.nonce + '.' + farmHash_(request.payload);
    const proof = farmHex_(Utilities.computeHmacSha256Signature(message, key, Utilities.Charset.UTF_8));
    if (!farmProofMatches_(proof, request.signature) || !farmUseNonce_(properties, request)) return farmResult_({error: 'unauthorized'});
    const input = JSON.parse(request.payload);
    const folderId = properties.getProperty('FARM_FOLDER_ID');
    if (!folderId || !FARM_FILE.test(folderId)) return farmResult_({error: 'unavailable'});
    if (input.action === 'put') return farmResult_(farmPut_(folderId, input));
    if (input.action === 'get' || input.action === 'trash') return farmResult_(farmFile_(folderId, input));
    return farmResult_({error: 'invalid'});
  } catch (_) {
    return farmResult_({error: 'unavailable'});
  }
}

function verifyFarmDriveRoundTrip() {
  const folder = authorizeFarmDrive();
  const state = {v: 1, day: 2, test: '농장 저장 검증'};
  const operation = Utilities.getUuid().replace(/-/g, '').toLowerCase();
  const input = {key: farmHash_('verification-' + operation), operation,
    state, stateHash: farmHash_(JSON.stringify(state))};
  const saved = farmPut_(folder, input);
  if (saved.ok !== true) throw new Error('테스트 농장을 저장하지 못했어요.');
  try {
    const read = farmFile_(folder, {action: 'get', id: saved.data});
    if (read.ok !== true || JSON.stringify(read.data) !== JSON.stringify(state)) {
      throw new Error('저장한 테스트 농장을 확인하지 못했어요.');
    }
    console.log('테스트 농장 저장과 불러오기 확인');
  } finally {
    if (farmFile_(folder, {action: 'trash', id: saved.data}).ok !== true) {
      throw new Error('테스트 파일 정리를 확인해 주세요.');
    }
  }
}
