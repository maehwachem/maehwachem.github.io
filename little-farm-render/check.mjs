import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createHmac,randomBytes,generateKeyPairSync,verify as verifySignature,sign as makeSignature} from 'node:crypto';
import vm from 'node:vm';
import {createHandler} from './handler.mjs';
import {firebaseIdentity,farmStore} from './google.mjs';

const html = readFileSync(new URL('./index.html',import.meta.url),'utf8');
assert.ok(!/AIza[A-Za-z0-9_-]{35}/.test(html), 'Remove the embedded Google API key before publishing the farm HTML.');
assert.ok(html.includes('const FIREBASE_CONFIG=/* __FARM_FIREBASE_CONFIG__ */ {};'), 'Keep Firebase web config as a placeholder in the farm HTML.');

const sampleKey='01'.repeat(32);
const folder='sampleFolder012345';
const props=new Map([['FARM_BRIDGE_KEY',sampleKey],['FARM_FOLDER_ID',folder]]);
const files=new Map();
let apiCalls=0, sequence=0;
const sha=s=>createHash('sha256').update(s).digest('hex');
const digest=s=>Array.from(createHash('sha256').update(s).digest());
const mac=(message,key)=>Array.from(createHmac('sha256',key).update(message).digest());
const output=text=>({text,setMimeType(){return this;}});
const gs=vm.createContext({
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},
  ContentService:{createTextOutput:output,MimeType:{JSON:'json'}},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ScriptApp:{getOAuthToken:()=> 'mock'},
  Utilities:{computeDigest:(_,s)=>digest(s),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
    computeHmacSha256Signature:mac,newBlob:text=>({text,getBytes:()=>Buffer.from(text)})},
  Drive:{Files:{
    list({q}){ apiCalls++; const name=q.split("'")[3]; return {files:[...files.values()].filter(file=>file.name===name&&!file.trashed)}; },
    create(meta,blob){ apiCalls++; const id='sampleFileId'+(++sequence); files.set(id,{id,...meta,text:blob.text}); return {id}; },
    update({trashed},id){ apiCalls++; files.get(id).trashed=trashed; }
  }},
  UrlFetchApp:{fetch(url){
    apiCalls++;
    const parsed=new URL(url), file=files.get(parsed.pathname.split('/').at(-1));
    return {getResponseCode:()=>file?200:404,getContentText:()=>parsed.searchParams.has('alt')?file.text:JSON.stringify(file)};
  }}
});
vm.runInContext(readFileSync(new URL('./Code.gs',import.meta.url),'utf8'),gs);
function drive(body){return JSON.parse(gs.doPost({postData:{contents:body}}).text);}
function sign(data,time=Date.now()){
  const payload=JSON.stringify(data),nonce=randomBytes(16).toString('hex');
  return JSON.stringify({payload,nonce,time,signature:createHmac('sha256',sampleKey).update(time+'.'+nonce+'.'+sha(payload)).digest('hex')});
}
assert.equal(drive('{}').error,'unauthorized');
assert.equal(drive(sign({action:'get',id:'sampleUnknownFile'},Date.now()-121000)).error,'unauthorized');
assert.equal(apiCalls,0);
const repeated=sign({action:'get',id:'sampleUnknownFile'});
assert.equal(drive(repeated).error,'missing');
assert.equal(drive(repeated).error,'unauthorized');
assert.equal(apiCalls,1);

const rows=new Map(), background=[];
const project='kjelab-little-farm';
const farmId='31'.repeat(16), scriptUrl='https://script.google.com/macros/s/sample/exec';
const operatorEmail='farmer@example.test';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const kid='1'.repeat(40);
const token=(sub,aud=project,options={})=>{
  const now=Math.floor(Date.now()/1000);
  const payload={aud,sub,iss:'https://securetoken.google.com/'+aud,exp:now+3600,iat:now,auth_time:now,
    email:sub+'@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'},...options};
  const body=[{alg:'RS256',kid},payload].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
  return body+'.'+makeSignature('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');
};
const users={farmer:token('farmer'),alice:token('alice'),bob:token('bob'),guest:token('guest',project,{firebase:{sign_in_provider:'anonymous'}})};
const account={type:'service_account',project_id:project,client_email:'farm-save@'+project+'.iam.gserviceaccount.com',
  private_key:privateKey.export({type:'pkcs8',format:'pem'})};
let dbCalls=0, versions=0, tokenExchanges=0, certRequests=0, failApprovalReads=false;
let beforeFarmCommit;
const simulatedFetch=async (input,options={})=>{
  const url=new URL(input);
  if(input===scriptUrl) return Response.json(drive(options.body));
  if(url.hostname==='www.googleapis.com'){
    certRequests++;
    assert(url.pathname.endsWith('/securetoken@system.gserviceaccount.com'));
    return Response.json({[kid]:publicKey.export({type:'spki',format:'pem'})},{headers:{'Cache-Control':'max-age=600'}});
  }
  if(url.hostname==='oauth2.googleapis.com'){
    tokenExchanges++;
    const [h,p,s]=options.body.get('assertion').split('.');
    assert(verifySignature('RSA-SHA256',Buffer.from(h+'.'+p),publicKey,Buffer.from(s,'base64url')));
    const claims=JSON.parse(Buffer.from(p,'base64url'));
    assert.equal(claims.iss,account.client_email);
    assert.equal(claims.scope,'https://www.googleapis.com/auth/datastore');
    return Response.json({access_token:'mock-datastore',expires_in:3600});
  }
  assert.equal(url.hostname,'firestore.googleapis.com');
  assert.equal(options.headers.Authorization,'Bearer mock-datastore');
  dbCalls++;
  const name=url.pathname.slice(4);
  if(name.endsWith(':commit')){
    const writes=JSON.parse(options.body).writes;
    if(writes.some(w=>w.update?.name.includes('/farms/'))) await beforeFarmCommit?.();
    for(const w of writes){
      const current=rows.get(w.update?.name??w.delete);
      if(w.currentDocument.exists===false?!!current:current?.updateTime!==w.currentDocument.updateTime){
        return Response.json({error:{status:'FAILED_PRECONDITION'}},{status:400});
      }
    }
    for(const w of writes){
      if(w.delete){ rows.delete(w.delete); continue; }
      const old=rows.get(w.update.name);
      const fields=w.updateMask?{...old?.fields,...w.update.fields}:w.update.fields;
      const unchanged=old&&JSON.stringify(old.fields)===JSON.stringify(fields);
      rows.set(w.update.name,{...w.update,fields,updateTime:unchanged?old.updateTime:'etag'+(++versions)});
    }
    return Response.json({});
  }
  if(name.endsWith(':runQuery')){
    const query=JSON.parse(options.body).structuredQuery;
    const filter=query.where.fieldFilter;
    const collection=name.slice(0,-':runQuery'.length)+'/'+query.from[0].collectionId+'/';
    const after=query.startAt?.values[0].referenceValue??'';
    return Response.json([...rows.values()].filter(row=>row.name.startsWith(collection)&&row.name>after&&
      row.fields[filter.field.fieldPath]?.stringValue===filter.value.stringValue)
      .sort((a,b)=>a.name.localeCompare(b.name)).slice(0,query.limit).map(document=>({document})));
  }
  if(name.endsWith('/farms')){
    return Response.json({documents:[...rows.values()].filter(row=>row.name.startsWith(name+'/'))});
  }
  if(failApprovalReads&&name.includes('/farmApprovals/')) return Response.json({}, {status:503});
  return rows.has(name)?Response.json(rows.get(name)):Response.json({}, {status:404});
};
const identity=firebaseIdentity(project,simulatedFetch);
const store=farmStore(project,account,simulatedFetch);
const handler=createHandler({identity,store,bridgeUrl:scriptUrl,operatorEmail,bridgeKey:sampleKey,
  fetcher:simulatedFetch,waitUntil:p=>background.push(p)});
const call=async (token,body,origin='https://kjelab.kr')=>{
  const response=await handler(new Request('https://project.invalid/farm-cloud-auth',{
    method:'POST',headers:{origin,'content-type':'application/json',...(token?{authorization:'Bearer '+(users[token]||token)}:{})},body:JSON.stringify(body)
  }));
  return [response.status,await response.json()];
};
const empty={v:1,day:1};
assert.equal((await call(null,{action:'list'}))[0],401);
assert.equal((await call('guest',{action:'list'}))[0],401);
assert.equal((await call('alice',{action:'list'},'https://unrelated.invalid'))[0],403);
assert.equal((await call(token('alice','other-project'),{action:'list'}))[0],401);
const good=users.alice.split('.');
const tampered=good.slice(0,2).join('.')+'.'+(good[2][0]==='a'?'b':'a')+good[2].slice(1);
assert.equal((await call(tampered,{action:'list'}))[0],401);
assert.equal((await call(token('alice',project,{exp:1}),{action:'list'}))[0],401);
assert.equal(dbCalls,0);
const create={action:'create',id:farmId,operation:'33'.repeat(16),name:'콩 농장',state:empty};
assert.deepEqual(await call('alice',create),[403,{error:'approval'}]);
assert.equal((await call('alice',{...create,operation:null}))[0],400);
assert.equal((await call('alice',{action:'list'}))[1].approval,'none');
assert.equal((await call('farmer',{action:'list'}))[1].isOperator,true);
assert.equal((await call('alice',{action:'review-list'}))[0],403);
assert.equal((await call(token('impostor',project,{email:operatorEmail,email_verified:false}),{action:'review-list'}))[0],403);
assert.equal((await call(token('impostor',project,{email_verified:false}),{action:'request-approval'}))[0],403);
assert.deepEqual(await call('alice',{action:'request-approval',email:operatorEmail}),[200,{approval:'pending'}]);
assert.deepEqual(await call('alice',{action:'request-approval'}),[200,{approval:'pending'}]);
assert.equal((await call('alice',create))[0],403);
const [queueStatus,queue]=await call('farmer',{action:'review-list'});
assert.equal(queueStatus,200);
assert.deepEqual(queue.requests.map(({id,email})=>({id,email})),[{id:sha('alice'),email:'alice@example.test'}]);
const accept={action:'review',id:sha('alice'),version:queue.requests[0].version,decision:'approved'};
assert.equal((await call('bob',accept))[0],403);
const [approved,rejected]=await Promise.all([call('farmer',accept),call('farmer',{...accept,decision:'rejected'})]);
assert.deepEqual([approved[0],rejected[0]].sort(),[200,409]);
if(approved[0]!==200){
  const deniedAlice=(await call('farmer',{action:'review-list',status:'rejected'}))[1].requests.find(row=>row.id===accept.id);
  assert.equal((await call('farmer',{...accept,version:deniedAlice.version}))[0],200);
}
assert.equal((await call('alice',{action:'list'}))[1].approval,'approved');
assert.equal((await call('bob',{action:'request-approval'}))[1].approval,'pending');
const bob=(await call('farmer',{action:'review-list'}))[1].requests[0];
assert.equal((await call('farmer',{...accept,id:bob.id,version:bob.version,decision:'rejected'}))[0],200);
assert.equal((await call('bob',{action:'request-approval'}))[1].approval,'rejected');
assert.equal((await call('bob',create))[0],403);
assert.deepEqual((await call('farmer',{action:'review-list'}))[1].requests,[]);
const [createdStatus,created]=await call('alice',create);
assert.equal(createdStatus,200);
assert.equal(created.revision,0);
assert.equal(created.name,'콩 농장');
const [approvedStatus,approvedList]=await call('farmer',{action:'review-list',status:'approved'});
assert.equal(approvedStatus,200);
const alice=approvedList.requests.find(record=>record.id===sha('alice'));
assert.equal(alice?.email,'alice@example.test');
assert.equal((await call('farmer',{action:'review-delete',id:alice.id,version:alice.version}))[0],409);
assert.equal((await call('bob',{action:'review-delete',id:alice.id,version:alice.version}))[0],403);
assert.equal((await call('farmer',{action:'review',id:alice.id,version:alice.version,decision:'revoked'}))[0],200);
assert.equal((await call('alice',{action:'list'}))[1].approval,'revoked');
assert.equal((await call('alice',{...create,id:'32'.repeat(16)}))[0],403);
assert.equal((await call('alice',{action:'read',id:farmId}))[0],200);
const [revoked]=(await call('farmer',{action:'review-list',status:'revoked'}))[1].requests;
assert.equal((await call('farmer',{action:'review',id:revoked.id,version:alice.version,decision:'approved'}))[0],409);
assert.equal((await call('farmer',{action:'review',id:revoked.id,version:revoked.version,decision:'approved'}))[0],200);
const [denied]=(await call('farmer',{action:'review-list',status:'rejected'}))[1].requests;
assert.equal((await call('farmer',{action:'review-delete',id:denied.id,version:denied.version}))[0],200);
assert.equal((await call('bob',{action:'list'}))[1].approval,'none');
assert.equal((await call('bob',{action:'request-approval'}))[1].approval,'pending');
failApprovalReads=true;
const [legacyStatus,legacyList]=await call('alice',{action:'list'});
assert.equal(legacyStatus,200);
assert.equal(legacyList.approval,'unavailable');
assert.equal(legacyList.farms[0].id,farmId);
failApprovalReads=false;
for(const name of rows.keys()) if(name.endsWith('/farmApprovals/'+sha('alice'))) rows.delete(name);
assert.equal((await call('alice',{action:'list'}))[1].approval,'none');
assert.deepEqual((await call('bob',{action:'list'}))[1],{farms:[],approval:'pending',isOperator:false});
assert.equal((await call('bob',{action:'read',id:farmId}))[0],404);
assert.equal((await call('alice',{action:'list'}))[1].farms[0].id,farmId);
assert.deepEqual((await call('alice',{action:'read',id:farmId}))[1].state,empty);
const next={action:'write',id:farmId,revision:0,operation:'41'.repeat(16),state:{v:1,day:2}};
const [first,second]=await Promise.all([call('alice',next),call('alice',{...next,operation:'42'.repeat(16)})]);
assert.equal([first[0],second[0]].filter(status=>status===200).length,1);
assert([409,429].includes(first[0]===200?second[0]:first[0]));
const saved=first[0]===200?first[1]:second[1];
assert.equal((await call('alice',{...next,operation:saved.operation}))[1].revision,1);
assert.deepEqual((await call('alice',{action:'read',id:farmId}))[1].state,{v:1,day:2});
assert.equal(tokenExchanges,1);
assert.equal(certRequests,1);
await Promise.all(background);
assert.equal([...files.values()].filter(file=>!file.trashed).length,1);

const bobReview=async (status,decision)=>{
  const [row]=(await call('farmer',{action:'review-list',status}))[1].requests;
  assert.equal((await call('farmer',{action:'review',id:row.id,version:row.version,decision}))[0],200);
};
await bobReview('pending','approved');
const bobCreate={...create,id:'35'.repeat(16)};
let retry, releaseRetry;
beforeFarmCommit=async()=>{
  await bobReview('approved','revoked');
  await bobReview('revoked','approved');
  await new Promise(retryReachedCommit=>{
    beforeFarmCommit=()=>{
      beforeFarmCommit=undefined;
      return new Promise(resolve=>{ releaseRetry=resolve; retryReachedCommit(); });
    };
    retry=call('bob',bobCreate);
  });
};
assert.equal((await call('bob',bobCreate))[0],409);
await Promise.all(background);
releaseRetry();
assert.equal((await retry)[0],200);
assert.equal((await call('bob',{action:'read',id:bobCreate.id}))[0],200);
assert.equal([...files.values()].filter(file=>!file.trashed).length,2);
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(code);
console.log('PASS: Firebase identity and project validation, scoped Firestore access and Google assertion, sign-in required, owner isolation, account approval and concurrent review, HMAC replay protection, create/read/update, concurrent revision conflict, idempotent retry, file cleanup, and browser script syntax');
