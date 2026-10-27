import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite({extensions:{pgcrypto}});
const file=p=>readFile(new URL(p,import.meta.url),'utf8');
const q=async(s,a=[]) => (await db.query(s,a)).rows;
const one=async(s,a=[])=>Object.values((await q(s,a))[0])[0];
const call=(f,a=[])=>one(`select public.${f}(${a.map((_,i)=>'$'+(i+1)).join(',')})`,a);
let passed=0;
async function test(name,fn){await fn();console.log('PASS',name);passed++;}
try {
 for (const f of ['baseline.sql','baseline-functions.sql',...(await readdir(new URL('../../supabase/migrations',import.meta.url))).sort().map(f=>'../../supabase/migrations/'+f)]) await db.exec(await file(f));
 const teacher=crypto.randomUUID(); await q('insert into auth.users values($1,$2)',[teacher,'teacher@example.invalid']);await q('insert into teachers(user_id,email) values($1,$2)',[teacher,'teacher@example.invalid']);await q("select set_config('request.jwt.claim.sub',$1,false)",[teacher]);
 const today=await one("select (now() at time zone 'Asia/Seoul')::date::text"),year=await call('nfc_year',[today]);
 const day=await one("select extract(isodow from now() at time zone 'Asia/Seoul')::int");
 const end=`${year+1}-02-28`;
 await call('nfc_calendar',[today,today,0,true,'가상 검증']);
 const p=await call('nfc_roster_preview',[year,[{student_id:'30101',name:'수업학생'},{student_id:'30102',name:'다른학생'},{student_id:'30201',name:'이동학생'}]]);await call('nfc_roster_apply',[p.preview_id]);
 const [a,b,c]=p.rows.map(x=>x.student_uid);
 await q("update students set device_hash=encode(extensions.digest($1,'sha256'),'hex'),device_bound_at=now() where student_uid=$2",['a'.repeat(64),a]);
 const template={id:crypto.randomUUID(),school_year:year,title:'화학',period_label:'1교시',weekdays:[day],opens:'00:00',late:'23:59',closes:'23:59:59',valid_from:today,valid_to:end,enabled:true,members:[a,b].map(student_uid=>({student_uid,valid_from:today,valid_to:end}))};
 let session,second;
 await test('template creation, token-scoped lazy generation, idempotence and no arrival mutation',async()=>{
  await call('nfc_class_save',[template,0,'시간표 생성']);
  const opts=await call('nfc_attendance_options',['a'.repeat(64)]);assert.equal(opts.sessions.length,1);assert.equal(opts.sessions[0].title,'화학');assert(!JSON.stringify(opts).includes(b));
  session=opts.sessions[0].id;
  await call('nfc_attendance_options',['a'.repeat(64)]);assert.equal((await call('nfc_session_day',[today])).length,1);
  assert.equal(await one('select count(*)::int from attendance'),0);
  assert.equal((await call('nfc_session_detail',[session])).rows.length,2);
 });
 await test('template edits do not alter generated session snapshots; stale revision blocked',async()=>{
  await call('nfc_class_save',[{...template,title:'변경 화학',members:[{student_uid:c,valid_from:today,valid_to:end}]},1,'다음 회차 수정']);
  const detail=await call('nfc_session_detail',[session]);assert.equal(detail.session.title,'화학');assert.equal(detail.rows.length,2);assert(detail.rows.some(x=>x.student_uid===a));
  await assert.rejects(()=>call('nfc_class_save',[template,1,'충돌']),/바뀌었/);
 });
 await test('extra overlapping session is independent and dashboard flags overlap',async()=>{
  second=crypto.randomUUID();await call('nfc_session_save',[{id:second,att_date:today,title:'점심 확인',period_label:'확인 2',opens:'00:00',late:'23:59',closes:'23:59:59',students:[a]},0,'별도 확인']);
  const list=await call('nfc_session_day',[today]);assert.equal(list.length,2);assert(list.every(s=>s.overlap_count===1));
  const answer=await call('nfc_session_check_in',['a'.repeat(64),session]);assert.equal(answer.ok,true);assert.equal(answer.daily_unconfirmed,true);
  assert.equal((await call('nfc_session_detail',[second])).rows[0].status,'unconfirmed');
  assert.equal(await one('select count(*)::int from attendance'),0);
 });
 await test('retag preserves first time; manual decisions and version conflicts preserved',async()=>{
  const before=(await call('nfc_session_detail',[session])).rows.find(x=>x.student_uid===a);
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),session])).already,true);
  await call('nfc_session_correct',[session,a,'absent','교사 확인',1,1]);
  const answer=await call('nfc_session_check_in',['a'.repeat(64),session]);assert.equal(answer.status,'absent');
  const after=(await call('nfc_session_detail',[session])).rows.find(x=>x.student_uid===a);assert.equal(after.first_tag_at,before.first_tag_at);assert(after.corrected_at);
  await assert.rejects(()=>call('nfc_session_correct',[session,a,'late','충돌',1,1]),/다른 출석/);
  assert.equal((await call('nfc_session_history',[session,a])).length,2);
 });
 await test('recorded sessions cannot change time; closed/cancelled do not mark absence',async()=>{
  await assert.rejects(()=>call('nfc_session_save',[{id:session,att_date:today,title:'화학',period_label:'1',opens:'00:01',late:'23:59',closes:'23:59:59'},1,'시간 변경']),/시간을 바꿀/);
  await call('nfc_session_state',[session,'closed',1,'확인 종료']);
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),session])).error,'session_closed');
  assert.equal((await call('nfc_session_detail',[session])).rows.find(x=>x.student_uid===b).status,'unconfirmed');
  await call('nfc_session_state',[session,'cancelled',2,'휴강']);
  await call('nfc_session_day',[today]);assert.equal(await one('select count(*)::int from class_sessions where template_id=$1',[template.id]),1);
  await call('nfc_session_state',[session,'open',3,'휴강 취소']);
 });
 await test('remove/readd roster retains attendance and audits; nonmembers rejected',async()=>{
  await call('nfc_session_member',[session,a,false,4,'수강 대상 제외']);
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),session])).error,'not_enrolled');
  assert.equal((await call('nfc_session_detail',[session])).rows.find(x=>x.student_uid===a).status,'absent');
  await call('nfc_session_member',[session,a,true,5,'대상 복원']);
  assert.equal((await call('nfc_session_detail',[session])).rows.find(x=>x.student_uid===a).status,'absent');
  await assert.rejects(()=>call('nfc_session_member',[session,c,true,5,'충돌']),/바뀌었/);
 });
 await test('out/early/daily absence block class check-in without changing movements',async()=>{
  await call('nfc_correct',[a,today,'present','등교 확인',0]);
  const now=await one('select now()::text');const expected=await one("select ((now() at time zone 'Asia/Seoul')::date+time '23:59:59') at time zone 'Asia/Seoul'");
  const move=crypto.randomUUID();await call('nfc_move',[a,today,'out',now,expected,'외출',null,move]);
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),second])).error,'movement_out');
  assert.equal((await call('nfc_session_detail',[second])).rows[0].status,'unconfirmed');
  const ret=crypto.randomUUID();await call('nfc_move',[a,today,'return',now,null,'복귀',move,ret]);
  await q("update attendance set status='absent' where student_uid=$1",[a]);
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),second])).error,'daily_confirmed');
  await q("update attendance set status='present' where student_uid=$1",[a]);
  const early=crypto.randomUUID();await call('nfc_move',[a,today,'early',now,null,'조퇴',ret,early]);
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),second])).error,'movement_early');
  await call('nfc_move',[a,today,'void',now,null,'취소',early,crypto.randomUUID()]);
 });
 await test('location and time checks run even after previous check-in',async()=>{
  await db.exec('update settings set geo_required=true,school_lat=37,school_lng=127,radius_m=100;');
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),second])).error,'need_location');
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),second,0,0,1])).error,'too_far');
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),second,37,127,5])).ok,true);
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),second])).error,'need_location');
  await db.exec('update settings set geo_required=false;');
  await q("update class_sessions set closes_at=now()-interval '1 second',late_at=opens_at where id=$1",[second]);
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),second])).error,'session_closed');
 });
 await test('holiday and pending enrollment prevent automatic sessions; no past generation',async()=>{
  await call('nfc_calendar',[today,today,0,false,'휴업']);
  const temp2={...template,id:crypto.randomUUID(),title:'휴업일 수업'};await call('nfc_class_save',[temp2,0,'휴업일 검증']);
  await call('nfc_session_day',[today]);assert.equal(await one('select count(*)::int from class_sessions where template_id=$1',[temp2.id]),0);
  const prev=await one("select ((now() at time zone 'Asia/Seoul')::date-1)::text");await call('nfc_session_day',[prev]);assert.equal(await one('select count(*)::int from class_sessions where att_date=$1',[prev]),0);
  assert.equal((await call('nfc_session_check_in',['a'.repeat(64),session])).error,'not_school_day');
 });
 await test('reports retain removed/cancelled rows, bounded range, read-only sheet access',async()=>{
  const rows=await call('nfc_session_report',[today,today]);assert.equal(rows.length,3);
  await assert.rejects(()=>call('nfc_session_report',['2026-01-01','2026-12-31']),/62일/);
  const secret='e'.repeat(48);await q("insert into sync_config(id,secret_hash) values(1,encode(extensions.digest($1,'sha256'),'hex')) on conflict(id) do update set secret_hash=excluded.secret_hash",[secret]);
  await db.exec("select set_config('request.jwt.claim.sub','',false);set role anon;");
  assert.equal((await call('sync_pull_sessions',[secret,today,today])).rows.length,3);
  await assert.rejects(()=>call('sync_pull_sessions',['wrong',today,today]),/권한/);
  for (const f of ['nfc_session_day','nfc_class_list']) await assert.rejects(()=>call(f,[f==='nfc_class_list'?year:today]),/permission denied/);
  await assert.rejects(()=>q('select * from class_records'),/permission denied/);
  await assert.rejects(()=>call('_nfc_sessions_ensure',[today]),/permission denied/);
  await db.exec('reset role;set role authenticated;');await assert.rejects(()=>call('nfc_session_day',[today]),/교사 권한/);
  assert.equal(await one('select count(*)::int from class_records'),0);
  await assert.rejects(()=>q("update class_records set status='present'"),/permission denied/);
  await db.exec('reset role;');
 });
 console.log(`${passed} session test groups passed`);
} catch(e) {console.error(e.message,e.where||'',e.internalQuery||'');process.exitCode=1;} finally {await db.close();}
