import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const [html,helper]=await Promise.all([read('../index.html'),read('../registration.js')]);
const base='https://kjelab.kr/attend/index.html',key='nfc_attend_token_v1';
const original='a'.repeat(64),tick=()=>new Promise(r=>setTimeout(r,0));
const identity={ok:true,name:'가상학생',student_id:'30101',sessions:[],daily:{status:'unconfirmed'}};
async function page(mode,{existing=false,personalQR=false,pending=false}={}){
  let bound=existing?original:null;
  const calls=[],alerts=[];
  const seed=new JSDOM('',{url:base,runScripts:'outside-only'});seed.window.eval(helper);
  const address=personalQR?seed.window.NFCRegistration.url(base,{id:'30102',name:'다른학생',code:'test-code',year:seed.window.NFCRegistration.schoolYear()}):base;
  seed.window.close();
  const dom=new JSDOM(html,{url:address,runScripts:'dangerously',beforeParse(w){
    // External scripts are not loaded. All RPCs below are isolated test doubles;
    // inline retry buttons execute normally in this suite.
    w.ATTEND_CONFIG={};w.alert=m=>alerts.push(m);
    if(existing)w.localStorage.setItem(key,original);
    w.eval(helper);
    w.supabase={createClient:()=>({rpc:async(name,args)=>{
      calls.push({name,args});
      if(name==='get_public_settings')return {data:{school_name:'가상학교'}};
      if(name==='nfc_attendance_options')return {data:args.p_token!==bound?{ok:false,error:'unknown_device'}:pending?{ok:false,error:'pending'}:identity};
      if(name==='register_device'){
        if(mode==='rejected')return {data:{ok:false,error:'mismatch'}};
        if(mode==='lost-after-commit')bound=args.p_token;
        if(mode==='success'){bound=args.p_token;return {data:{ok:true}};}
        return {data:null,error:{message:'connection lost'}};
      }
      throw Error('Unexpected RPC: '+name);
    }})};
  }});
  await tick();
  return {dom,w:dom.window,d:dom.window.document,calls,alerts,setBound:value=>{bound=value;}};
}
async function submit(p){
  for(const [id,value] of Object.entries({fId:'30101',fName:'가상학생',fCode:'test-code'}))p.d.getElementById(id).value=value;
  p.d.getElementById('regForm').dispatchEvent(new p.w.Event('submit',{cancelable:true}));await tick();
}
const committed=await page('lost-after-commit');await submit(committed);
const candidate=committed.calls.find(c=>c.name==='register_device').args.p_token;
assert.equal(committed.w.localStorage.getItem(key),candidate);
assert.match(committed.d.getElementById('resultStatus').textContent,/연결/);
committed.d.getElementById('btnRetry').click();await tick();
assert(!committed.d.getElementById('vChoices').classList.contains('hidden'));
assert.equal(committed.calls.filter(c=>c.name==='register_device').length,1);
assert(!committed.calls.some(c=>['check_in','nfc_session_check_in'].includes(c.name)));
committed.dom.window.close();
const notCommitted=await page('lost-before-commit');await submit(notCommitted);
notCommitted.d.getElementById('btnRetry').click();await tick();
assert.equal(notCommitted.w.localStorage.getItem(key),null);
assert(!notCommitted.d.getElementById('vRegister').classList.contains('hidden'));
notCommitted.dom.window.close();
const rejected=await page('rejected');await submit(rejected);
assert.equal(rejected.w.localStorage.getItem(key),null);assert.equal(rejected.alerts.length,1);rejected.dom.window.close();
const preserve=await page('lost-before-commit');
assert(!preserve.d.getElementById('vRegister').classList.contains('hidden'));
// A second tab finishes registration while the first tab's form is still open.
preserve.setBound(original);preserve.w.localStorage.setItem(key,original);
await submit(preserve);
assert.equal(preserve.w.localStorage.getItem(key),original);
assert(!preserve.calls.some(c=>c.name==='register_device'));
assert(!preserve.d.getElementById('vChoices').classList.contains('hidden'));
assert(!preserve.d.getElementById('btnReg').disabled);
assert(!preserve.d.getElementById('btnReg').textContent.includes('확인 중'));
preserve.dom.window.close();
const stale=await page('success');stale.w.localStorage.setItem(key,'b'.repeat(64));
await submit(stale);assert.equal(stale.w.localStorage.getItem(key),null);
assert(!stale.calls.some(c=>c.name==='register_device'));
await submit(stale);assert.equal(stale.calls.filter(c=>c.name==='register_device').length,1);stale.dom.window.close();
const duplicate=await page('success');await Promise.all([submit(duplicate),submit(duplicate)]);
assert.equal(duplicate.calls.filter(c=>c.name==='register_device').length,1);duplicate.dom.window.close();
const pendingQR=await page('success',{existing:true,personalQR:true,pending:true});
assert.match(pendingQR.d.getElementById('resultStatus').textContent,/기기를 먼저 확인/);
assert.match(pendingQR.d.getElementById('resultMsg').textContent,/같은 학생인지 확인하지 못/);
assert(!pendingQR.d.getElementById('resultStatus').textContent.includes('다른 학생'));
assert.equal(pendingQR.w.localStorage.getItem(key),original);
assert(!pendingQR.calls.some(c=>c.name==='register_device'));pendingQR.dom.window.close();
const pending=await page('success',{existing:true,pending:true});
assert.match(pending.d.getElementById('resultStatus').textContent,/승인 대기/);pending.dom.window.close();
console.log('PASS lost response recovery via inline retry, uncommitted rollback, rejected cleanup, stale-tab registration preservation, invalid-token recovery, duplicate-submit guard and identity-free pending QR guidance');
