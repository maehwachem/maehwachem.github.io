import {JSDOM} from 'jsdom';
import jsQR from 'jsqr';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const helper=await read('../registration.js'), vendor=await read('../vendor/qrcode-2.0.4.js');
const html=await read('../index.html'), main=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const tick=()=>new Promise(r=>setTimeout(r,0));
const base='https://example.invalid/attend/index.html';
const seed=new JSDOM('',{url:base,runScripts:'outside-only'});
seed.window.eval(helper);seed.window.eval(vendor);
const api=seed.window.NFCRegistration,year=api.schoolYear();
assert.equal(api.schoolYear(new Date('2026-02-28T14:59:59Z')),2025);
assert.equal(api.schoolYear(new Date('2026-02-28T15:00:00Z')),2026);
const student={id:'30101',name:'가상학생',code:'test-code',year};
const url=api.url(base+'?ignored=1',student);
assert(!new URL(url).search);
assert(url.includes('#enroll=1'));
// Decode the actual generated module matrix independently, including long Korean names.
for (const person of [student,{...student,name:'가'.repeat(40),code:'x'.repeat(20)}]) {
  const input=api.url(base,person),qr=seed.window.qrcode(0,'M');qr.addData(input,'Byte');qr.make();
  const scale=4,quiet=4,n=qr.getModuleCount(),width=(n+quiet*2)*scale;
  const pixels=new Uint8ClampedArray(width*width*4).fill(255);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
      const at=(((y+quiet)*scale+dy)*width+(x+quiet)*scale+dx)*4;
      pixels[at]=pixels[at+1]=pixels[at+2]=0;
    }
  assert.equal(jsQR(pixels,width,width)?.data,input);
}
async function page(address=url,{token=false,identity=student,error=null}={}) {
  const dom=new JSDOM(html,{url:address,runScripts:'outside-only'}),w=dom.window,calls=[],alerts=[];
  if(token)w.localStorage.setItem('nfc_attend_token_v1','a'.repeat(64));
  w.ATTEND_CONFIG={};w.alert=m=>alerts.push(m);
  w.supabase={createClient:()=>({rpc:async(name,args)=>{
    calls.push({name,args});
    return {data:name==='get_public_settings'?{school_name:'가상학교'}:
      name==='register_device'?(error?{ok:false,error}:{ok:true}):
      {ok:true,student_id:identity.id,name:identity.name,sessions:[]},error:null};
  }})};
  w.eval(helper);
  assert.equal(w.location.hash,'','credential fragment removed before main script');
  w.eval(main);await tick();
  return {dom,w,d:w.document,calls,alerts};
}
const scanned=await page();
assert.equal(scanned.calls.filter(c=>c.name==='register_device').length,0);
assert.equal(scanned.d.getElementById('fId').value,student.id);
assert.equal(scanned.d.getElementById('fName').value,student.name);
assert.equal(scanned.d.getElementById('btnReg').textContent,'이 휴대폰 등록');
scanned.d.getElementById('regForm').dispatchEvent(new scanned.w.Event('submit',{cancelable:true}));await tick();
assert.equal(scanned.calls.filter(c=>c.name==='register_device').length,1);
const args=scanned.calls.find(c=>c.name==='register_device').args;
assert.equal(args.p_code,student.code);assert.equal(args.p_name,student.name);
assert.equal(scanned.w.localStorage.getItem('nfc_attend_token_v1'),args.p_token);
assert.equal(scanned.d.getElementById('fCode').value,'');
assert(!scanned.calls.some(c=>['check_in','nfc_session_check_in'].includes(c.name)));
assert(!scanned.d.getElementById('vChoices').classList.contains('hidden'));
scanned.dom.window.close();
for(const address of [api.url(base,{...student,year:year-1}),base+'#enroll=1&id=bad',url+'&id=30102']){
  const p=await page(address);assert.match(p.d.getElementById('qrInfo').textContent,/QR/);
  assert.equal(p.d.getElementById('fCode').value,'');assert(!p.calls.some(c=>c.name==='register_device'));p.dom.window.close();
}
const manual=await page();manual.d.getElementById('btnManual').click();await tick();
assert(!manual.d.getElementById('manualFields').classList.contains('hidden'));
assert.equal(manual.d.getElementById('fCode').value,'');manual.dom.window.close();
const other=await page(url,{token:true,identity:{id:'30102',name:'다른학생'}});
assert.match(other.d.getElementById('resultStatus').textContent,/이미 다른 학생/);
assert.equal(other.w.localStorage.getItem('nfc_attend_token_v1'),'a'.repeat(64));
assert(!other.calls.some(c=>c.name==='register_device'));other.dom.window.close();
const same=await page(url,{token:true});assert(!same.d.getElementById('vChoices').classList.contains('hidden'));
assert(!same.calls.some(c=>c.name==='register_device'));same.dom.window.close();
const stale=await page(url,{error:'mismatch'});
stale.d.getElementById('regForm').dispatchEvent(new stale.w.Event('submit',{cancelable:true}));await tick();
assert.match(stale.alerts[0],/등록코드/);assert.equal(stale.w.localStorage.getItem('nfc_attend_token_v1'),null);stale.dom.window.close();
// Teacher dialog/print use only locally generated SVG, with a manual fallback.
const admin=new JSDOM(await read('../admin.html'),{url:base.replace('index','admin'),runScripts:'outside-only'}),w=admin.window;
w.ATTEND_CONFIG={};w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.eval(helper);w.eval(vendor);w.eval((await read('../admin.js'))+`;students=[{student_uid:'fake-uid',student_id:'30101',name:'가상학생',reg_code:'test-code',school_year:${year},state:'active'}];renderRoster();`);
w.document.querySelector('[data-act="qr"]').click();await tick();
assert.equal(w.document.querySelectorAll('#editFields svg').length,1);
assert.equal(w.document.querySelectorAll('#editFields img').length,0);
assert.match(w.document.getElementById('editFields').textContent,/test-code/);
let printed=false;w.print=()=>{printed=true;};w.document.getElementById('btnPrint').click();await tick();
assert(printed);assert.equal(w.document.querySelectorAll('#printArea svg').length,1);
w.dispatchEvent(new w.Event('afterprint'));assert.equal(w.document.getElementById('printArea').textContent,'');
admin.window.close();seed.window.close();
console.log('PASS QR decode roundtrip, Korean names, year boundary, fragment removal, explicit registration, invalid QR, manual fallback, existing device protection, stale code and teacher print');
