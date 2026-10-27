import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const file=p=>readFile(new URL(p,import.meta.url),'utf8');
const html=await file('../admin.html');
const dom=new JSDOM(html,{url:'https://example.invalid/attend/admin.html',runScripts:'outside-only'});
const w=dom.window;
w.ATTEND_CONFIG={SUPABASE_URL:'test',SUPABASE_KEY:'public-test'};
w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})},rpc:async()=>({data:[],error:null})})};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.eval((await file('../admin.js'))+';window.__setRows=rows=>{dayRows=rows;renderToday();};');
w.document.getElementById('dDate').value='2026-10-27';
const rows=[
 {student_uid:'a',student_id:'30101',name:'테스트외출',grade:3,class_no:1,number:1,status:'late',eligible:true,version:1,whereabouts:'out',movement_id:'event-a',effective_movement_id:'event-a',expected_return_at:'2026-10-27T11:00:00+09:00',overdue:true},
 {student_uid:'b',student_id:'30102',name:'테스트조퇴',grade:3,class_no:1,number:2,status:'present',eligible:true,version:1,whereabouts:'early',movement_id:'event-b',effective_movement_id:'event-b'},
 {student_uid:'c',student_id:'30103',name:'테스트미확인',grade:3,class_no:1,number:3,status:'unconfirmed',eligible:true,version:0,whereabouts:'inside'},
 {student_uid:'d',student_id:'30104',name:'테스트대상외',grade:3,class_no:1,number:4,status:'unconfirmed',eligible:false,version:0,whereabouts:'inside'}
];
w.__setRows(rows);
assert.equal(w.document.querySelectorAll('#todayBody tr').length,3);
assert(w.document.getElementById('todayBody').textContent.includes('복귀 지연'));
assert(!w.document.getElementById('todayBody').textContent.includes('테스트대상외'));
w.document.querySelector('[data-action="move"][data-uid="a"]').click();
assert.deepEqual([...w.document.querySelectorAll('#xKind option')].map(x=>x.value),['return','early','void']);
w.document.getElementById('editor').close();
w.document.querySelector('[data-action="move"][data-uid="b"]').click();
assert.deepEqual([...w.document.querySelectorAll('#xKind option')].map(x=>x.value),['void']);
assert(w.document.querySelector('[data-action="move"][data-uid="c"]').disabled);
const studentHtml=await file('../index.html');
const student=new JSDOM(studentHtml,{url:'https://example.invalid/attend/index.html',runScripts:'outside-only'});
student.window.ATTEND_CONFIG=w.ATTEND_CONFIG;
student.window.supabase={createClient:()=>({rpc:async()=>({data:{school_name:'테스트'},error:null})})};
const code=[...studentHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
student.window.eval(code);
student.window.eval("showCheckIn({ok:true,name:'가상학생',student_id:'30101',status:'late',whereabouts:'early'})");
assert(student.window.document.getElementById('resultStatus').textContent.includes('조퇴'));
student.window.eval("showCheckIn({ok:false,error:'pending'})");
assert(student.window.document.getElementById('resultStatus').textContent.includes('승인 대기'));
student.window.eval("showCheckIn({ok:true,status:'absent'})");
assert(student.window.document.getElementById('resultStatus').textContent.includes('확인'));
dom.window.close();student.window.close();
console.log('PASS teacher status filtering, movement choices, eligibility, student departure/pending/absence UI');
