import {JSDOM, CookieJar} from 'jsdom';
import jsQR from 'jsqr';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const [poster,script,vendor,studentHtml,adminHtml]=await Promise.all([
  read('../qr.html'),read('../qr.js'),read('../vendor/qrcode-2.0.4.js'),read('../index.html'),read('../admin.html'),
]);
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
let attendanceAddress;
for(const address of ['https://kjelab.kr/attend/qr.html','https://example.invalid/school/attend/qr.html?token=private#enroll=1&id=30101&code=secret']){
  const dom=new JSDOM(poster,{url:address,runScripts:'outside-only'}),w=dom.window,d=w.document;
  w.eval(vendor);
  const real=w.qrcode;let matrix;
  w.qrcode=(...args)=>(matrix=real(...args));
  w.eval(script);
  const expected=new URL('index.html',address).href;
  assert.equal(d.getElementById('attendanceAddress').href,expected);
  assert.equal(d.getElementById('attendanceOpen').href,expected);
  assert.equal(d.querySelectorAll('#attendanceQr svg').length,1);
  assert(!d.getElementById('printQr').disabled);
  // Independently decode the matrix used for the displayed and saved SVG.
  const scale=6,quiet=4,n=matrix.getModuleCount(),size=(n+quiet*2)*scale;
  const pixels=new Uint8ClampedArray(size*size*4).fill(255);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(matrix.isDark(y,x)){
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
      const at=(((y+quiet)*scale+dy)*size+(x+quiet)*scale+dx)*4;
      pixels[at]=pixels[at+1]=pixels[at+2]=0;
    }
  }
  assert.equal(jsQR(pixels,size,size)?.data,expected);
  assert(!/[?#]/.test(expected),'common QR must never contain registration credentials');
  let printed=false,download,blob,revoked,cleanup,copied;
  w.print=()=>{printed=true;};d.getElementById('printQr').click();assert(printed);
  w.URL.createObjectURL=value=>{blob=value;return 'blob:qr-test';};
  w.URL.revokeObjectURL=value=>{revoked=value;};
  w.HTMLAnchorElement.prototype.click=function(){download={href:this.href,name:this.download};};
  w.setTimeout=fn=>{cleanup=fn;return 1;};
  d.getElementById('downloadQr').click();
  assert.equal(download.name,'출결용_QR.svg');
  assert.equal(blob.type,'image/svg+xml;charset=utf-8');
  const saved=await new Promise(resolve=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});
  const savedSvg=new w.DOMParser().parseFromString(saved,'image/svg+xml').documentElement;
  const displayed=d.querySelector('#attendanceQr svg');
  assert.equal(savedSvg.getAttribute('viewBox'),displayed.getAttribute('viewBox'));
  assert.equal(savedSvg.querySelector('path').getAttribute('d'),displayed.querySelector('path').getAttribute('d'));
  assert.equal(savedSvg.querySelector('rect').getAttribute('fill'),'white');
  cleanup();assert.equal(revoked,'blob:qr-test');
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}},configurable:true});
  await d.getElementById('copyQrUrl').onclick();assert.equal(copied,expected);
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied');}}});
  await d.getElementById('copyQrUrl').onclick();assert.match(d.getElementById('qrStatus').textContent,/길게/);
  if(address.startsWith('https://kjelab.kr/'))attendanceAddress=expected;
  dom.window.close();
}
const broken=new JSDOM(poster,{url:'https://kjelab.kr/attend/qr.html',runScripts:'outside-only'});
broken.window.eval(script);
assert(broken.window.document.getElementById('printQr').disabled);
assert(broken.window.document.getElementById('downloadQr').disabled);
assert.match(broken.window.document.getElementById('qrStatus').textContent,/만들지 못/);
assert.equal(broken.window.document.getElementById('attendanceOpen').href,attendanceAddress);
broken.window.close();
assert.equal(new JSDOM(adminHtml).window.document.querySelectorAll('a[href="qr.html"]').length,2);

// A registered tablet/phone retains the same token when NFC and the common QR
// open the same site. A different browser must not inherit that identity.
const main=[...studentHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const settings={school_name:'가상학교',open_time:'06:00',deadline:'08:20',close_time:'18:00',departure_time:'16:30',geo_required:false};
const identity={ok:true,student_id:'30101',name:'가상학생',att_date:'2026-11-03',daily:{status:'unconfirmed'},sessions:[]};
async function student(jar){
  const dom=new JSDOM(studentHtml,{url:attendanceAddress,cookieJar:jar,runScripts:'outside-only'}),w=dom.window,calls=[];
  w.ATTEND_CONFIG={};w.supabase={createClient:()=>({rpc:async(name,args)=>{
    calls.push({name,args});
    return {data:name==='get_public_settings'?settings:name==='register_device'?{ok:true}:
      name==='nfc_attendance_options'?identity:{ok:true,title:'화학',period_label:'1교시',status:'present',name:identity.name,student_id:identity.student_id},error:null};
  }})};
  w.eval(main);await tick();return {dom,w,d:w.document,calls};
}
const jar=new CookieJar(),first=await student(jar);
assert(!first.d.getElementById('vRegister').classList.contains('hidden'));
for(const [id,value] of Object.entries({fId:'30101',fName:'가상학생',fCode:'test-code'}))first.d.getElementById(id).value=value;
first.d.getElementById('regForm').dispatchEvent(new first.w.Event('submit',{cancelable:true}));await tick();
const token=first.calls.find(c=>c.name==='register_device').args.p_token;
assert.equal(token.length,64);
assert(!first.calls.some(c=>['check_in','nfc_session_check_in'].includes(c.name)));
first.dom.window.close();
const qr=await student(jar);
assert.equal(qr.calls.find(c=>c.name==='nfc_attendance_options').args.p_token,token);
assert.equal(qr.w.localStorage.getItem('nfc_attend_token_v1'),token);
assert(!qr.d.getElementById('vChoices').classList.contains('hidden'));
assert.match(qr.d.getElementById('choiceWho').textContent,/30101/);
assert(!qr.calls.some(c=>['register_device','check_in','nfc_session_check_in'].includes(c.name)));
await qr.w.chooseAttendance('class-one');
assert.equal(qr.calls.find(c=>c.name==='nfc_session_check_in').args.p_token,token);
assert.equal(qr.calls.find(c=>c.name==='nfc_session_check_in').args.p_session,'class-one');
qr.dom.window.close();
const other=await student(new CookieJar());
assert(!other.d.getElementById('vRegister').classList.contains('hidden'));
assert(!other.calls.some(c=>c.name==='nfc_attendance_options'));
other.dom.window.close();
console.log('PASS common QR independent decode, credential-free URL, SVG save, print, clipboard fallback, generator failure and shared browser registration with explicit attendance');
