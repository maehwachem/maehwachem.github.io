const MAX_PAYLOAD = 2200000;
const ORIGINS = new Set(['https://kjelab.kr','https://maehwachem.github.io']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX = /^[0-9a-f]{64}$/;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function digest(input) {
  const hash = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
}

async function jsonBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, '요청 내용이 없어요.');
  const decoder = new TextDecoder('utf-8', {fatal:true});
  let size = 0, body = '';
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PAYLOAD) {
        await reader.cancel();
        throw new RequestError(413,'첨부 사진의 용량을 확인해 주세요.');
      }
      body += decoder.decode(value,{stream:true});
    }
    const data = JSON.parse(body + decoder.decode());
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
    return data;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400,'요청 내용을 확인해 주세요.');
  }
}

async function photoPayload(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 3) {
    throw new RequestError(400,'사진을 1~3장 선택해 주세요.');
  }
  const hashes = [];
  let bytes = 0;
  for (const photo of input) {
    try {
      if (typeof photo !== 'string' || photo.length > 699052 ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(photo)) throw Error();
      const raw = Uint8Array.from(atob(photo), ch => ch.charCodeAt(0));
      if (raw.length < 5 || raw.length > 524288 || raw[0] !== 255 ||
          raw[1] !== 216 || raw[2] !== 255 || raw.at(-2) !== 255 || raw.at(-1) !== 217) throw Error();
      hashes.push(await digest(raw));
      bytes += raw.length;
    } catch { throw new RequestError(400,'JPEG 사진은 장당 512KB까지 제출할 수 있어요.'); }
  }
  return { hashes,bytes };
}

export function createHandler({ url, anonKey, serviceKey, driveUrl, fetcher = fetch }) {
  const token = key => ({apikey:key, Authorization:'Bearer ' + key, 'Content-Type':'application/json'});
  const cleanupDigest = digest(new TextEncoder().encode('kongsae-drive-cleanup-v1'));
  const checkDigest = digest(new TextEncoder().encode('kongsae-drive-check-v1'));

  async function route(actor, action, params) {
    const res = await fetcher(url + '/rest/v1/rpc/ks_drive_route', {
      method:'POST', headers:token(serviceKey), body:JSON.stringify({p_actor:actor,p_action:action,p:params}),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === 'P0001') throw new RequestError(409,data.message);
      throw new RequestError(503,'사진 제출 정보를 불러오지 못했어요.');
    }
    return data;
  }

  async function drive(data) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(driveUrl || '')) {
      throw new RequestError(503,'구글 드라이브 연결을 준비하는 중이에요.');
    }
    const payload = JSON.stringify(data);
    const ticket = await route(null,'mint',{digest:await digest(new TextEncoder().encode(payload))});
    try {
      const res = await fetcher(driveUrl, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ticket,payload}), signal:AbortSignal.timeout(50000),
      });
      const reply = await res.json();
      if (!res.ok || reply.ok !== true) throw Error();
      return reply.data;
    } catch {
      throw new RequestError(503,'구글 드라이브에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    }
  }

  return async request => {
    const origin = request.headers.get('origin');
    const headers = {
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      Vary:'Origin',
    };
    if (ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status,body) => new Response(JSON.stringify(body),{status,headers});
    if (origin && !ORIGINS.has(origin)) return reply(403,{message:'허용되지 않은 요청이에요.'});
    if (request.method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
      return new Response(null,{status:204,headers});
    }
    if (request.method !== 'POST') return reply(405,{message:'허용되지 않은 요청이에요.'});

    try {
      const action = new URL(request.url).searchParams.get('action');
      if (action === 'consume') {
        const {ticket,digest:hash} = await jsonBody(request);
        if (!HEX.test(ticket) || !HEX.test(hash)) return reply(403,{ok:false});
        const ok = await route(null,'consume',{ticket,digest:hash});
        return reply(ok ? 200 : 403,{ok:ok === true});
      }
      if (action === 'cleanup' || action === 'check') {
        const {ticket} = await jsonBody(request);
        if (!HEX.test(ticket) || !await route(null,'consume',{
          ticket,digest:await (action === 'cleanup' ? cleanupDigest : checkDigest),
        })) return reply(403,{ok:false});
        if (action === 'check') return reply(200,{ok:true,drive:await drive({action:'ping'})});
        const jobs = await route(null,'cleanup',{});
        const ids = jobs.length ? await drive({action:'trash',jobs}) : [];
        if (ids.length) await route(null,'ack',{ids});
        return reply(200,{ok:true,count:ids.length});
      }

      const authorization = request.headers.get('authorization') || '';
      if (!/^Bearer [\w.-]+$/.test(authorization)) return reply(401,{message:'먼저 로그인해 주세요.'});
      const userResponse = await fetcher(url + '/auth/v1/user', {headers:{apikey:anonKey,Authorization:authorization}});
      if (!userResponse.ok) return reply(401,{message:'로그인이 만료됐어요. 다시 로그인해 주세요.'});
      const user = await userResponse.json();
      if (!UUID.test(user.id)) return reply(401,{message:'먼저 로그인해 주세요.'});

      const body = await jsonBody(request);
      if (!UUID.test(body.id)) throw new RequestError(400,'제출 정보를 다시 확인해 주세요.');
      if (body.action === 'get') {
        const record = await route(user.id,'get',{id:body.id});
        if (!record) return reply(404,{message:'사진을 볼 수 없어요.'});
        if (!record.legacy) return reply(200,await drive({action:'get',id:body.id,ids:record.ids}));
        const old = await fetcher(url + '/rest/v1/rpc/ks_submission_images', {
          method:'POST',headers:{apikey:anonKey,Authorization:authorization,'Content-Type':'application/json'},
          body:JSON.stringify({p_submission:body.id}),
        });
        if (!old.ok) return reply(404,{message:'사진을 볼 수 없어요.'});
        return reply(200,await old.json());
      }

      if (body.action !== 'submit' || !UUID.test(body.classId) || typeof body.note !== 'string' ||
          [...body.note.trim()].length > 500) throw new RequestError(400,'제출 정보를 다시 확인해 주세요.');
      const data = {id:body.id,classId:body.classId,note:body.note,...await photoPayload(body.photos)};
      let job = await route(user.id,'reserve',data);
      if (job.state === 'new') {
        const ids = await drive({action:'ids',count:body.photos.length});
        job = await route(user.id,'reserve',{...data,ids});
      }
      if (job.state !== 'ready') {
        await drive({action:'put',id:body.id,ids:job.ids,photos:body.photos});
        await route(user.id,'finish',data);
      }
      return reply(200,{id:body.id});
    } catch (error) {
      return error instanceof RequestError
        ? reply(error.status,{message:error.message})
        : reply(503,{message:'사진 처리 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.'});
    }
  };
}
