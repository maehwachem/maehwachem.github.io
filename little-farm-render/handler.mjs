import { FarmError as Failure } from './google.mjs';
const CODE = /^[a-f0-9]{32}$/;
const HASH = /^[a-f0-9]{64}$/;
const APPROVAL_STATES=['pending','approved','rejected','revoked'];
const REVIEW_DECISIONS={pending:['approved','rejected'],approved:['revoked'],rejected:['approved'],revoked:['approved']};
const FILE_ID = /^[A-Za-z0-9_-]{10,150}$/;
const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,'0')).join('');
const hash = async text => hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
const nonce = () => hex(crypto.getRandomValues(new Uint8Array(16)));
const bridgePattern = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

async function requestBody(req) {
  const reader=req.body?.getReader();
  if (!reader) throw new Failure(400,'invalid');
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let count=0,text='';
  try {
    for (;;) {
      const {done,value}=await reader.read();
      if (done) break;
      count+=value.byteLength;
      if (count>16000) { await reader.cancel(); throw new Failure(413,'invalid'); }
      text+=decoder.decode(value,{stream:true});
    }
    const data=JSON.parse(text+decoder.decode());
    if (!data||typeof data!=='object'||Array.isArray(data)) throw Error();
    return data;
  } catch (error) {
    if (error instanceof Failure) throw error;
    throw new Failure(400,'invalid');
  }
}

export function createHandler({identity, store, bridgeUrl, bridgeKey, operatorEmail,
  origins = ['https://kjelab.kr'], fetcher = fetch, waitUntil = promise => promise}) {
  const allowedOrigins = new Set(origins);
  let signingKey;
  const recent = new Map();
  let minute, requestCount = 0;
  function admit(user) {
    const window = Math.floor(Date.now() / 60000);
    if (window !== minute) { minute = window; recent.clear(); requestCount = 0; }
    const count = recent.get(user) || 0;
    if (count >= 24 || requestCount >= 80) throw new Failure(429,'rate');
    recent.set(user,count+1);
    requestCount++;
  }
  async function owner(request) {
    const token=request.headers.get('authorization');
    if (!token || !/^Bearer [\w.-]+$/.test(token)) throw new Failure(401,'signin');
    return identity(token.slice(7));
  }
  async function takeBudget(key,action) {
    if (!await store.takeBudget(key,action)) throw new Failure(429,'rate');
  }
  async function drive(data) {
    if (!HASH.test(bridgeKey||'')||!bridgePattern.test(bridgeUrl||'')) throw new Failure(503,'network');
    signingKey??=crypto.subtle.importKey('raw',encoder.encode(bridgeKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const time=Date.now(), requestNonce=nonce(), payload=JSON.stringify(data);
    const signature=hex(await crypto.subtle.sign('HMAC',await signingKey,encoder.encode(time+'.'+requestNonce+'.'+await hash(payload))));
    const r=await fetcher(bridgeUrl,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({time,nonce:requestNonce,payload,signature}),signal:AbortSignal.timeout(20000)});
    const result=await r.json();
    if (result?.error==='missing') throw new Failure(410,'missing_file');
    if (result?.error==='operation_reused') throw new Failure(409,'conflict');
    if (!r.ok||result?.ok!==true) throw new Failure(503,'network');
    return result.data;
  }
  function tidy(id) {
    void waitUntil(drive({action:'trash',id}).catch(()=>{}));
  }
  const publicSave=(row,state)=>({name:row.name,state,revision:row.revision,operation:row.operation,updatedAt:Date.parse(row.updated_at)});
  async function read(row,user,id) {
    try {
      const state=await drive({action:'get',id:row.file_id});
      if (state?.v!==1) throw new Failure(503,'network');
      return publicSave(row,state);
    } catch (error) {
      if (error.status!==410) throw error;
      const current=await store.get(user,id);
      if (!current||current.file_id===row.file_id) throw error;
      const state=await drive({action:'get',id:current.file_id});
      if (state?.v!==1) throw new Failure(503,'network');
      return publicSave(current,state);
    }
  }

  return async req=>{
    const origin=req.headers.get('origin');
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',Vary:'Origin'};
    if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin']=origin;
    const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
    if (origin&&!allowedOrigins.has(origin)) return reply(403,{error:'invalid'});
    if (req.method==='OPTIONS') {
      headers['Access-Control-Allow-Methods']='POST, OPTIONS';
      headers['Access-Control-Allow-Headers']='authorization, content-type';
      return new Response(null,{status:204,headers});
    }
    if (req.method!=='POST') return reply(405,{error:'invalid'});
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||'')) return reply(415,{error:'invalid'});
    try {
      const data=await requestBody(req);
      const {uid: user, email}=await owner(req);
      const isOperator=!!operatorEmail&&email===operatorEmail;
      const accountKey=await hash(user);
      admit(user);
      if (!HASH.test(bridgeKey||'')||!bridgePattern.test(bridgeUrl||'')) throw new Failure(503,'network');
      if (data.action==='list') {
        await takeBudget(accountKey,'list');
        const approvalStatus=isOperator?'approved':store.getApproval(accountKey)
          .then(request=>request?.status??'none').catch(()=>'unavailable');
        const [rows, approval]=await Promise.all([store.list(user),approvalStatus]);
        return reply(200,{approval,isOperator,
          farms:rows.map(row=>({id:row.save_id,name:row.name,revision:row.revision,updatedAt:Date.parse(row.updated_at)}))});
      }
      if (data.action==='request-approval') {
        if (!email) throw new Failure(403,'verified');
        if (!operatorEmail) throw new Failure(503,'network');
        if (isOperator) return reply(200,{approval:'approved'});
        const current=await store.getApproval(accountKey);
        if (current) return reply(200,{approval:current.status});
        if (await store.setApproval(accountKey,{status:'pending',email},null)) return reply(200,{approval:'pending'});
        const existing=await store.getApproval(accountKey);
        if (!existing) throw new Failure(503,'network');
        return reply(200,{approval:existing.status});
      }
      if (['review-list','review','review-delete'].includes(data.action)) {
        if (!isOperator) throw new Failure(403,'forbidden');
        if (data.action==='review-list') {
          const {status='pending',after}=data;
          if (!APPROVAL_STATES.includes(status)||(after!==undefined&&
              (typeof after!=='string'||!HASH.test(after)))) throw new Failure(400,'invalid');
          return reply(200,await store.listApprovals(status,after));
        }
        const {id,decision,version}=data;
        if (typeof id!=='string'||!HASH.test(id)||typeof version!=='string'||!version||version.length>50) {
          throw new Failure(400,'invalid');
        }
        const current=await store.getApproval(id);
        if (!current) throw new Failure(409,'reviewed');
        if (current.etag!==version) throw new Failure(409,'reviewed');
        if (data.action==='review-delete') {
          if (current.status==='approved'||!await store.deleteApproval(id,current)) throw new Failure(409,'reviewed');
          return reply(200,{deleted:true});
        }
        if (!REVIEW_DECISIONS[current.status]?.includes(decision)) throw new Failure(409,'reviewed');
        const next={status:decision,...(current.email?{email:current.email}:{})};
        if (!await store.setApproval(id,next,current)) throw new Failure(409,'reviewed');
        return reply(200,{approval:decision});
      }
      if (typeof data.id!=='string'||!CODE.test(data.id)||!['create','read','write'].includes(data.action)) throw new Failure(400,'invalid');
      const key=await hash(user+':'+data.id), row=await store.get(user,data.id);
      if (data.action==='read'||(data.action==='create'&&row)) {
        if (!row) throw new Failure(404,'missing');
        await takeBudget(await hash(user),'read');
        return reply(200,await read(row,user,data.id));
      }
      const stateText=JSON.stringify(data.state??null);
      if (data.state?.v!==1||Array.isArray(data.state)||encoder.encode(stateText).byteLength>12000) throw new Failure(400,'invalid');
      if (typeof data.operation!=='string'||!CODE.test(data.operation)) throw new Failure(400,'invalid');
      let approval=null;
      if (data.action==='create') {
        if (typeof data.name!=='string'||!data.name.trim()||data.name.trim().length>24) throw new Failure(400,'invalid');
        if (!isOperator){
          const current=await store.getApproval(accountKey);
          if (current?.status!=='approved') throw new Failure(403,'approval');
          approval={id:accountKey,etag:current.etag};
        }
        await takeBudget(accountKey,'create');
      } else {
        if (!row) throw new Failure(404,'missing');
        if (!Number.isSafeInteger(data.revision)||data.revision<0) throw new Failure(400,'invalid');
        if (row.operation===data.operation) {
          await takeBudget(await hash(user),'read'); return reply(200,await read(row,user,data.id));
        }
        if (row.revision!==data.revision) throw new Failure(409,'conflict');
        await takeBudget(await hash(user),'write');
      }

      // A retry under a new approval must get its own file while the stale attempt is cleaned up.
      const operation=approval?(await hash(approval.etag+':'+data.operation)).slice(0,32):data.operation;
      const candidate=await drive({action:'put',key,operation,
        stateHash:await hash(stateText),state:data.state});
      if (typeof candidate!=='string'||!FILE_ID.test(candidate)) throw new Failure(503,'network');
      const updated_at=new Date().toISOString();
      const next={save_id:data.id,name:row?.name??data.name.trim(),file_id:candidate,
        revision:row?row.revision+1:0,operation:data.operation,updated_at};
      if (!await store.set(user,data.id,next,row,approval)) {
        const current=await store.get(user,data.id);
        if (current?.file_id!==candidate) tidy(candidate);
        if (current&&(data.action==='create'||current.operation===data.operation)) return reply(200,await read(current,user,data.id));
        if (approval&&(await store.getApproval(accountKey))?.status!=='approved') throw new Failure(403,'approval');
        throw new Failure(409,'conflict');
      }
      if (row&&row.file_id!==candidate) tidy(row.file_id);
      return reply(200,publicSave(next,data.state));
    } catch (error) {
      return error instanceof Failure?reply(error.status,{error:error.message}):reply(503,{error:'network'});
    }
  };
}
