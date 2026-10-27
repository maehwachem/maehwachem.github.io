import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite({extensions:{pgcrypto}});
const file=p=>readFile(new URL(p,import.meta.url),'utf8');
const q=async(s,a=[]) => (await db.query(s,a)).rows;
const one=async(s,a=[])=>Object.values((await q(s,a))[0])[0];
const call=(f,a=[])=>one(`select public.${f}(${a.map((_,i)=>'$'+(i+1)).join(',')})`,a);
let passed=0;
async function test(name,fn){await fn();console.log('PASS',name);passed++;}
try {
 for(const p of ['baseline.sql','baseline-functions.sql','../../supabase/migrations/20261027051543_attendance_roster_movements.sql','../../supabase/migrations/20261027070831_attendance_review_fixes.sql']) await db.exec(await file(p));
 const teacher=crypto.randomUUID();
 await q('insert into auth.users values($1,$2)',[teacher,'teacher@example.invalid']);
 await q('insert into teachers(user_id,email) values($1,$2)',[teacher,'teacher@example.invalid']);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[teacher]);
 const today=await one("select (now() at time zone 'Asia/Seoul')::date::text"), year=await call('nfc_year',[today]);
 const yesterday=await one("select ((now() at time zone 'Asia/Seoul')::date-1)::text");
 await db.exec("update settings set open_time='00:00',close_time='23:59:59',deadline='23:00',allow_self_signup=true,signup_code='test-code';");
 await call('nfc_calendar',[yesterday,today,0,true,'가상 검증']);
 async function add(sid,name){const p=await call('nfc_roster_preview',[year,[{student_id:sid,name,starts_on:yesterday}]]);await call('nfc_roster_apply',[p.preview_id]);return p.rows[0];}
 const base=await add('30101','기존학생');
 await test('device failure, binding, reset and code rotation do not invalidate roster preview',async()=>{
  const p=await call('nfc_roster_preview',[year,[{student_id:'30102',name:'새학생'}]]);
  const bad=await call('register_device',['30101','기존학생','wrong','a'.repeat(64)]);assert.equal(bad.error,'mismatch');
  const code=await one('select reg_code from students where student_uid=$1',[base.student_uid]);
  assert.equal((await call('register_device',['30101','기존학생',code,'a'.repeat(64)])).ok,true);
  await call('nfc_student_action',[base.student_uid,year,'reset']);
  await call('nfc_student_action',[base.student_uid,year,'code']);
  assert.equal((await call('nfc_roster_apply',[p.preview_id])).count,1);
 });
 await test('actual roster change still rejects a stale snapshot',async()=>{
  const p=await call('nfc_roster_preview',[year,[]]);await add('30103','다른학생');
  await assert.rejects(()=>call('nfc_roster_apply',[p.preview_id]),/명단이 바뀌었거나/);
 });
 let pending;
 await test('pending tag is retained and approval today excludes earlier waiting days',async()=>{
  assert.equal((await call('register_device',['30110','대기학생','test-code','b'.repeat(64)])).ok,true);
  pending=(await call('nfc_roster',[year])).find(x=>x.student_id==='30110');
  // Simulate a signup yesterday without changing the database clock.
  await q('update enrollments set starts_on=$1 where student_uid=$2',[yesterday,pending.student_uid]);
  assert.equal((await call('check_in',['b'.repeat(64)])).error,'pending');
  assert.equal((await call('check_in',['b'.repeat(64)])).error,'pending');
  assert.equal(await one("select count(*)::int from nfc_tag_events where student_uid=$1 and status='pending'",[pending.student_uid]),1);
  assert.equal(await one('select count(*)::int from attendance where student_uid=$1',[pending.student_uid]),0);
  assert((await call('nfc_roster',[year])).find(x=>x.student_uid===pending.student_uid).last_pending_tag);
  await assert.rejects(()=>call('nfc_student_action',[pending.student_uid,year,'confirm']),/출석 시작일/);
  await assert.rejects(()=>call('nfc_confirm_signup',[pending.student_uid,year,today,'확인',0]),/명단 버전/);
  await call('nfc_confirm_signup',[pending.student_uid,year,today,'교사가 시작일 확인',pending.revision]);
  assert.equal((await call('nfc_day',[yesterday])).find(x=>x.student_uid===pending.student_uid).eligible,false);
  assert.equal((await call('nfc_day',[today])).find(x=>x.student_uid===pending.student_uid).status,'unconfirmed');
  assert.equal((await call('check_in',['b'.repeat(64)])).ok,true);
  assert.equal(await one("select after_value->>'starts_on' from attendance_audit where student_uid=$1 and action='student_confirm'",[pending.student_uid]),today);
 });
 await test('wrong self-signup can be rejected without deleting identity or tag history, freeing number and device',async()=>{
  await call('register_device',['30111','오등록학생','test-code','c'.repeat(64)]);
  const s=(await call('nfc_roster',[year])).find(x=>x.student_id==='30111');
  await call('check_in',['c'.repeat(64)]);
  await assert.rejects(()=>call('nfc_roster_preview',[year,[{student_id:'30111',name:'정식학생'}]]),/승인 거절/);
  const stale=await call('nfc_roster_preview',[year,[]]);
  await assert.rejects(()=>call('nfc_reject_signup',[s.student_uid,year,'잘못 가입',0]),/명단 버전/);
  await call('nfc_reject_signup',[s.student_uid,year,'본인 아님 확인',s.revision]);
  assert.equal((await call('check_in',['c'.repeat(64)])).error,'unknown_device');
  assert.equal(await one('select count(*)::int from students where student_uid=$1',[s.student_uid]),1);
  assert.equal(await one('select count(*)::int from nfc_tag_events where student_uid=$1',[s.student_uid]),1);
  assert.equal(await one('select state from enrollments where student_uid=$1',[s.student_uid]),'rejected');
  assert(!(await call('nfc_roster',[year])).some(x=>x.student_uid===s.student_uid));
  assert(!(await call('nfc_report',[yesterday,today])).some(x=>x.student_uid===s.student_uid));
  await assert.rejects(()=>call('nfc_roster_apply',[stale.preview_id]),/명단이 바뀌었거나/);
  await assert.rejects(()=>call('nfc_roster_preview',[year,[{...s,state:'active',starts_on:today}]]),/학생 식별자/);
  const correct=await add('30111','정식학생');assert.notEqual(correct.student_uid,s.student_uid);
  const code=await one('select reg_code from students where student_uid=$1',[correct.student_uid]);
  assert.equal((await call('register_device',['30111','정식학생',code,'c'.repeat(64)])).ok,true);
  assert.equal(await one("select count(*)::int from attendance_audit where student_uid=$1 and action='student_reject'",[s.student_uid]),1);
  await assert.rejects(()=>call('nfc_reject_signup',[pending.student_uid,year,'불가',2]),/승인 대기/);
 });
 await test('sheet approval requires explicit date and shows a non-attendance warning',async()=>{
  await call('register_device',['30112','시트승인','test-code','d'.repeat(64)]);
  const s=(await call('nfc_roster',[year])).find(x=>x.student_id==='30112');
  await assert.rejects(()=>call('nfc_roster_preview',[year,[{...s,state:'active',starts_on:''}]]),/시작일을 명시/);
  const p=await call('nfc_roster_preview',[year,[{...s,state:'active',starts_on:today}]]);
  assert(p.warnings.some(x=>x.includes('승인 전 태그')));await call('nfc_roster_apply',[p.preview_id]);
  assert.equal((await call('nfc_roster',[year])).find(x=>x.student_id==='30112').self_registered,false);
 });
 await test('void permits correcting to earlier real time but keeps effective order and optimistic lock',async()=>{
  await call('nfc_correct',[base.student_uid,yesterday,'present','교사 확인',0]);
  let prev=null;
  const move=async(kind,time)=>{const id=crypto.randomUUID();await call('nfc_move',[base.student_uid,yesterday,kind,`${yesterday}T${time}:00+09:00`,kind==='out'?`${yesterday}T12:00:00+09:00`:null,'시각 확인',prev,id]);prev=id;};
  await move('out','09:00');await move('return','10:00');await move('void','11:00');
  const oldPrevious=prev;await move('return','09:30');
  assert.equal((await call('nfc_day',[yesterday])).find(x=>x.student_uid===base.student_uid).whereabouts,'inside');
  await assert.rejects(()=>call('nfc_move',[base.student_uid,yesterday,'void',`${yesterday}T11:00:00+09:00`,null,'중복',oldPrevious,crypto.randomUUID()]),/상태가 바뀌었/);
  await move('void','11:00');await assert.rejects(()=>move('return','08:30'),/이전 이동/);
  assert.equal(await one('select count(*)::int from movements where student_uid=$1',[base.student_uid]),5);
 });
 await test('terminal status previews explicitly warn about inclusive end date',async()=>{
  const s=(await call('nfc_roster',[year])).find(x=>x.student_id==='30102');
  const p=await call('nfc_roster_preview',[year,[{...s,state:'transferred'}]]);
  assert(p.warnings.some(x=>x.includes(s.ends_on)&&x.includes('마지막 출석 대상일')));
 });
 await test('visually identical Korean names in NFC and NFD register the same student',async()=>{
  const s=await add('30120','가학생'.normalize('NFD'));
  assert.equal(s.name,'가학생');
  const code=await one('select reg_code from students where student_uid=$1',[s.student_uid]);
  assert.equal((await call('register_device',['30120','가학생'.normalize('NFD'),code,'e'.repeat(64)])).ok,true);
  const p=await call('nfc_roster_preview',[year,[{student_id:'30120',name:'가학생'.normalize('NFD')}]]);
  assert.equal(p.changes.filter(x=>x.type!=='missing').length,0);
 });
 await test('retag after unconfirmed preserves first time and uses that same time to classify',async()=>{
  const s=(await call('nfc_roster',[year])).find(x=>x.student_id==='30120');
  await q("insert into attendance(student_uid,student_id,att_date,status,checked_at) values($1,$2,$3,'unconfirmed',$4)",[s.student_uid,s.student_id,today,`${today}T07:00:00+09:00`]);
  await db.exec("update settings set deadline='08:20';");
  const answer=await call('check_in',['e'.repeat(64)]);assert.equal(answer.status,'present');assert.equal(answer.time,'07:00:00');
 });
 await test('secret-based sheet preview/apply/pull and new teacher-only RPC boundaries',async()=>{
  const secret='f'.repeat(48);
  await q("insert into sync_config(id,secret_hash) values(1,encode(extensions.digest($1,'sha256'),'hex')) on conflict(id) do update set secret_hash=excluded.secret_hash",[secret]);
  await db.exec("select set_config('request.jwt.claim.sub','',false);set role anon;");
  await assert.rejects(()=>call('nfc_confirm_signup',[pending.student_uid,year,today,'無',2]),/permission denied/);
  await assert.rejects(()=>call('nfc_reject_signup',[pending.student_uid,year,'無',2]),/permission denied/);
  await assert.rejects(()=>call('nfc_roster_preview',[year,[],'wrong']),/권한/);
  const p=await call('nfc_roster_preview',[year,[],secret]);await call('nfc_roster_apply',[p.preview_id,secret]);
  const pull=await call('sync_pull',[secret,yesterday,today]);assert.equal(pull.version,2);assert(Array.isArray(pull.attendance));
  await db.exec('reset role;');
 });
 console.log(`${passed} review regression tests passed`);
} finally {await db.close();}
