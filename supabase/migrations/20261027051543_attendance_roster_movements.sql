-- NFC v2. Preserve device bindings and original arrival timestamps.
-- Enrollment end dates are inclusive. School years run March through February.
create function public.nfc_year(p_date date) returns integer language sql immutable
set search_path=public as $$ select extract(year from p_date - interval '2 months')::integer $$;

alter table public.students add column student_uid uuid not null default gen_random_uuid();
alter table public.attendance add column student_uid uuid;
update public.attendance a set student_uid=s.student_uid from public.students s where s.student_id=a.student_id;
alter table public.attendance drop constraint attendance_student_id_fkey;
alter table public.attendance drop constraint attendance_student_id_att_date_key;
alter table public.students drop constraint students_pkey;
alter table public.students add primary key(student_uid);
alter table public.attendance alter column student_uid set not null;
alter table public.attendance add foreign key(student_uid) references public.students(student_uid) on delete restrict;
alter table public.attendance add unique(student_uid,att_date);
alter table public.attendance alter column checked_at drop not null;
alter table public.attendance alter column checked_at drop default;
alter table public.attendance drop constraint attendance_status_check;
alter table public.attendance add check(status in ('present','late','excused','absent','unconfirmed'));
alter table public.attendance add column version integer not null default 1;

create table public.enrollments (
  student_uid uuid not null references public.students(student_uid) on delete restrict,
  school_year integer not null check(school_year between 2020 and 2100),
  student_id text not null check(student_id ~ '^[0-9]{3,10}$'),
  name text not null check(length(name) between 2 and 40),
  grade smallint, class_no smallint, number smallint,
  starts_on date not null, ends_on date not null,
  revision integer not null default 1,
  state text not null default 'active' check(state in ('active','pending','inactive','transferred','graduated')),
  primary key(student_uid,school_year), unique(school_year,student_id),
  check(starts_on<=ends_on),
  check(starts_on>=make_date(school_year,3,1) and ends_on<make_date(school_year+1,3,1))
);
-- Preserve historical years if the existing database contains older attendance.
insert into public.enrollments(student_uid,school_year,student_id,name,grade,class_no,number,starts_on,ends_on,state)
select distinct s.student_uid,y.yr,s.student_id,s.name,s.grade,s.class_no,s.number,
 make_date(y.yr,3,1),(make_date(y.yr+1,3,1)-1),case when s.self_registered then 'pending' else 'active' end
from public.students s cross join lateral (
 select public.nfc_year((now() at time zone 'Asia/Seoul')::date) yr
 union select public.nfc_year(a.att_date) from public.attendance a where a.student_uid=s.student_uid
) y;

create table public.school_days (
 day date not null, grade smallint not null default 0 check(grade between 0 and 12),
 is_school_day boolean not null, note text not null default '',
 primary key(day,grade)
);
create table public.attendance_audit (
 id bigint generated always as identity primary key,
 student_uid uuid references public.students(student_uid) on delete restrict,
 att_date date, action text not null, before_value jsonb, after_value jsonb,
 reason text not null, actor uuid, created_at timestamptz not null default now()
);
create index on public.attendance_audit(student_uid,att_date,id);
create table public.movements (
 seq bigint generated always as identity unique, id uuid primary key, student_uid uuid not null references public.students(student_uid) on delete restrict,
 att_date date not null, kind text not null check(kind in ('out','return','early','void')),
 happened_at timestamptz not null, expected_return_at timestamptz,
 reason text not null check(length(trim(reason)) between 1 and 200),
 voids_id uuid unique references public.movements(id) on delete restrict,
actor uuid not null, created_at timestamptz not null default now(),
 check((happened_at at time zone 'Asia/Seoul')::date=att_date),
 check(expected_return_at is null or ((expected_return_at at time zone 'Asia/Seoul')::date=att_date and expected_return_at>happened_at))
);
create index on public.movements(student_uid,att_date,created_at,id);
create table public.nfc_tag_events (
 id bigint generated always as identity primary key,
 student_uid uuid not null references public.students(student_uid) on delete restrict,
 att_date date not null, tagged_at timestamptz not null default now(), status text not null, whereabouts text not null
);
create index on public.nfc_tag_events(student_uid,att_date,id);
alter table public.nfc_tag_events enable row level security;
create policy teacher_read on public.nfc_tag_events for select to authenticated using(public.is_teacher());
revoke all on public.nfc_tag_events from anon,authenticated;
grant select on public.nfc_tag_events to authenticated;
create table public.roster_previews (
 id uuid primary key default gen_random_uuid(), school_year integer not null,
 rows jsonb not null, base_hash text not null, actor uuid,
 created_at timestamptz not null default now(), result jsonb
);

alter table public.enrollments enable row level security;
alter table public.school_days enable row level security;
alter table public.attendance_audit enable row level security;
alter table public.movements enable row level security;
alter table public.roster_previews enable row level security;
create policy teacher_read on public.enrollments for select to authenticated using(public.is_teacher());
create policy teacher_read on public.school_days for select to authenticated using(public.is_teacher());
create policy teacher_read on public.attendance_audit for select to authenticated using(public.is_teacher());
create policy teacher_read on public.movements for select to authenticated using(public.is_teacher());
revoke all on public.enrollments,public.school_days,public.attendance_audit,public.movements,public.roster_previews from anon,authenticated;
grant select on public.enrollments,public.school_days,public.attendance_audit,public.movements to authenticated;
revoke insert,update,delete,truncate on public.students,public.attendance from anon,authenticated;

create function public._nfc_teacher() returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_teacher() then raise exception '교사 권한이 필요합니다' using errcode='42501'; end if; end $$;
create function public._nfc_school_day(p_date date,p_grade integer) returns boolean language sql stable
set search_path=public as $$
 select coalesce((select is_school_day from public.school_days where day=p_date and grade in (0,coalesce(p_grade,0)) order by grade desc limit 1),extract(isodow from p_date)<6)
$$;
create function public._nfc_roster(p_year integer) returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.student_id),'[]') from (
 select e.*,s.reg_code,s.device_bound_at,s.failed_attempts,s.self_registered from public.enrollments e
 join public.students s using(student_uid) where school_year=p_year) r
$$;
create function public.nfc_roster(p_year integer) returns jsonb language plpgsql security definer set search_path=public as $$
begin perform public._nfc_teacher(); return public._nfc_roster(p_year); end $$;

create function public._nfc_current_move(p_uid uuid,p_date date) returns public.movements language sql stable set search_path=public as $$
 select m from public.movements m where m.student_uid=p_uid and m.att_date=p_date and m.kind<>'void'
 and not exists(select 1 from public.movements v where v.voids_id=m.id) order by m.seq desc limit 1
$$;
create function public._nfc_day(p_date date) returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.student_id),'[]') from (
 select e.*, s.device_bound_at,
 (p_date between e.starts_on and e.ends_on and e.state<>'pending' and public._nfc_school_day(p_date,e.grade)) eligible,
 coalesce(a.status,'unconfirmed') status,a.checked_at,a.source,coalesce(a.version,0) version,a.note,
 case when m.kind='out' then 'out' when m.kind='early' then 'early' else 'inside' end whereabouts,
 (select id from public.movements where student_uid=e.student_uid and att_date=p_date order by seq desc limit 1) movement_id,m.id effective_movement_id,m.happened_at movement_time,m.expected_return_at,
 (m.kind='out' and m.expected_return_at<now()) overdue,
 (select max(tagged_at) from public.nfc_tag_events t where t.student_uid=e.student_uid and t.att_date=p_date) last_exception_tag
 from public.enrollments e join public.students s using(student_uid)
 left join public.attendance a on a.student_uid=e.student_uid and a.att_date=p_date
 left join lateral public._nfc_current_move(e.student_uid,p_date) m on true
 where e.school_year=public.nfc_year(p_date)) r
$$;
create function public.nfc_day(p_date date) returns jsonb language plpgsql security definer set search_path=public as $$
begin perform public._nfc_teacher(); return public._nfc_day(p_date); end $$;

create function public.nfc_correct(p_uid uuid,p_date date,p_status text,p_reason text,p_version integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.attendance%rowtype; b jsonb; e public.enrollments%rowtype;
begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 if p_status is null or p_status not in ('present','late','excused','absent','unconfirmed') or length(trim(coalesce(p_reason,''))) not between 1 and 200 then raise exception '상태와 정정 사유를 확인하세요'; end if;
 if p_date is null or p_date>(now() at time zone 'Asia/Seoul')::date then raise exception '미래 날짜는 처리할 수 없습니다'; end if;
 select * into e from public.enrollments where student_uid=p_uid and school_year=public.nfc_year(p_date);
 if not found or p_date not between e.starts_on and e.ends_on or e.state='pending' or not public._nfc_school_day(p_date,e.grade) then raise exception '출석 대상일이 아닙니다'; end if;
 select * into a from public.attendance where student_uid=p_uid and att_date=p_date for update;
 if coalesce(a.version,0) is distinct from p_version then raise exception '다른 변경이 있습니다. 새로고침 후 다시 처리하세요'; end if;
 if p_status in ('absent','unconfirmed','excused') and exists(select 1 from public.movements m where student_uid=p_uid and att_date=p_date and kind<>'void' and not exists(select 1 from public.movements v where v.voids_id=m.id)) then raise exception '이동 기록이 있는 날은 출석 또는 지각을 유지하세요'; end if;
 b:=case when a.id is null then null else to_jsonb(a) end;
 insert into public.attendance(student_uid,student_id,att_date,status,source,note,version)
 values(p_uid,e.student_id,p_date,p_status,'manual',trim(p_reason),1)
 on conflict(student_uid,att_date) do update set status=excluded.status,source='manual',note=excluded.note,version=attendance.version+1
 returning * into a;
 insert into public.attendance_audit(student_uid,att_date,action,before_value,after_value,reason,actor)
 values(p_uid,p_date,'correction',b,to_jsonb(a),trim(p_reason),auth.uid());
 return jsonb_build_object('ok',true,'version',a.version);
end $$;

create function public.nfc_move(p_uid uuid,p_date date,p_kind text,p_at timestamptz,p_expected timestamptz,p_reason text,p_previous uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare m public.movements%rowtype; prev public.movements%rowtype; eff public.movements%rowtype; a public.attendance%rowtype;
begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 if p_request is null then raise exception '요청 식별자가 필요합니다'; end if;
 select * into m from public.movements where id=p_request;
 if found then
   if m.student_uid<>p_uid or m.att_date<>p_date or m.kind<>p_kind or m.happened_at<>p_at or m.expected_return_at is distinct from p_expected or m.reason is distinct from trim(p_reason) then raise exception '요청 식별자 충돌'; end if;
   return jsonb_build_object('ok',true,'already',true);
 end if;
 if p_at is null or p_at>now()+interval '1 minute' or p_date is distinct from (p_at at time zone 'Asia/Seoul')::date then raise exception '이동 날짜와 시각을 확인하세요'; end if;
 if p_kind is null or p_kind not in ('out','return','early','void') or length(trim(coalesce(p_reason,''))) not between 1 and 200 then raise exception '이동 종류와 사유를 확인하세요'; end if;
 select * into a from public.attendance where student_uid=p_uid and att_date=p_date;
 if not found or a.status not in ('present','late') then raise exception '먼저 출석 또는 지각을 확인하세요'; end if;
 select * into prev from public.movements where student_uid=p_uid and att_date=p_date order by seq desc limit 1;
 if prev.id is distinct from p_previous then raise exception '이동 상태가 바뀌었습니다. 새로고침하세요'; end if;
 select * into eff from public._nfc_current_move(p_uid,p_date);
 if p_kind<>'void' and a.checked_at is not null and date_trunc('minute',a.checked_at)>p_at then raise exception '등교 시각 이후의 이동을 입력하세요'; end if;
 if prev.happened_at>p_at then raise exception '이전 이동 이후 시각을 입력하세요'; end if;
 if p_kind='return' and coalesce(eff.kind,'inside')<>'out' then raise exception '외출 중일 때만 복귀할 수 있습니다'; end if;
 if p_kind='out' and coalesce(eff.kind,'inside') in ('out','early') then raise exception '이미 외출 또는 조퇴 상태입니다'; end if;
 if p_kind='early' and eff.kind='early' then raise exception '이미 조퇴 상태입니다'; end if;
 if p_kind='void' and eff.id is null then raise exception '취소할 이동 기록이 없습니다'; end if;
 if p_kind='out' and (p_expected is null or p_expected<=p_at or (p_expected at time zone 'Asia/Seoul')::date<>p_date) then raise exception '같은 날의 복귀 예정 시각을 입력하세요'; end if;
 if p_kind<>'out' and p_expected is not null then raise exception '외출일 때만 복귀 예정 시각을 입력하세요'; end if;
 insert into public.movements(id,student_uid,att_date,kind,happened_at,expected_return_at,reason,actor,voids_id)
 values(p_request,p_uid,p_date,p_kind,p_at,p_expected,trim(p_reason),auth.uid(),case when p_kind='void' then eff.id end) returning * into m;
 insert into public.attendance_audit(student_uid,att_date,action,before_value,after_value,reason,actor)
 values(p_uid,p_date,'movement',case when prev.id is null then null else to_jsonb(prev) end,to_jsonb(m),trim(p_reason),auth.uid());
 return jsonb_build_object('ok',true);
end $$;

create function public.nfc_calendar(p_from date,p_to date,p_grade integer,p_school boolean,p_note text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>370 or p_grade is null or p_grade not between 0 and 12 or p_school is null then raise exception '기간·학년을 확인하세요 (최대 371일)'; end if;
 insert into public.attendance_audit(action,before_value,after_value,reason,actor)
 values('calendar',(select jsonb_agg(to_jsonb(d)) from public.school_days d where day between p_from and p_to and grade=p_grade),jsonb_build_object('from',p_from,'to',p_to,'grade',p_grade,'school',p_school),coalesce(p_note,''),auth.uid());
 insert into public.school_days(day,grade,is_school_day,note)
 select d::date,p_grade,p_school,left(coalesce(p_note,''),200) from generate_series(p_from,p_to,'1 day'::interval) d
 on conflict(day,grade) do update set is_school_day=excluded.is_school_day,note=excluded.note;
 return jsonb_build_object('ok',true);
end $$;

create function public.nfc_student_action(p_uid uuid,p_year integer,p_action text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b jsonb;
begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 select jsonb_build_object('bound',device_bound_at,'pending',self_registered) into b from public.students where student_uid=p_uid;
 if not found then raise exception '학생을 찾을 수 없습니다'; end if;
 if p_action='reset' then update public.students set device_hash=null,device_bound_at=null where student_uid=p_uid;
 elsif p_action='code' then update public.students set reg_code=encode(extensions.gen_random_bytes(4),'hex'),failed_attempts=0 where student_uid=p_uid;
 elsif p_action='confirm' then
   update public.enrollments set state='active',revision=revision+1 where student_uid=p_uid and school_year=p_year and state='pending';
   update public.students set self_registered=false where student_uid=p_uid;
 else raise exception '지원하지 않는 처리입니다'; end if;
 insert into public.attendance_audit(student_uid,action,before_value,reason,actor) values(p_uid,'student_'||p_action,b,p_action,auth.uid());
 return jsonb_build_object('ok',true);
end $$;

create function public.nfc_roster_preview(p_year integer,p_rows jsonb,p_secret text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; normalized jsonb:='[]'; changes jsonb:='[]'; e public.enrollments%rowtype;
 uid uuid; sid text; nm text; st text; d1 date; d2 date; plan uuid; oldrow jsonb; proposed jsonb;
begin
 if not public.is_teacher() and not coalesce(public._sync_ok(p_secret),false) then raise exception '연결 권한을 확인하세요' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(7212026);
 if p_year is null or p_year not between 2020 and 2100 or p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>5000 then raise exception '명단 형식을 확인하세요'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  sid:=trim(r->>'student_id'); nm:=trim(r->>'name');
  if sid is null or sid!~'^[0-9]{3,10}$' or nm is null or length(nm) not between 2 and 40 then raise exception '학번(3~10자리)과 이름을 확인하세요'; end if;
  uid:=nullif(r->>'student_uid','')::uuid;
  e:=null;
  if uid is not null then
   if not exists(select 1 from public.students where student_uid=uid) then raise exception '학생 식별자가 없습니다: %',sid; end if;
   select * into e from public.enrollments where student_uid=uid and school_year=p_year;
  else
   select * into e from public.enrollments where school_year=p_year and student_id=sid;
   if e.student_uid is not null then
    if e.name<>nm then raise exception '같은 학번의 이름이 다릅니다. 학생 식별자로 대상을 확인하세요: %',sid; end if;
    uid:=e.student_uid;
   else uid:=gen_random_uuid(); end if;
  end if;
  if exists(select 1 from jsonb_array_elements(normalized) n where n->>'student_id'=sid or n->>'student_uid'=uid::text) then raise exception '중복 학번 또는 학생 식별자가 있습니다: %',sid; end if;
  if exists(select 1 from public.enrollments where school_year=p_year and student_id=sid and student_uid<>uid) then raise exception '학번이 다른 학생에게 사용 중입니다: %',sid; end if;
  st:=coalesce(nullif(r->>'state',''),e.state,'active');
  d1:=coalesce(nullif(r->>'starts_on','')::date,e.starts_on,make_date(p_year,3,1));
  d2:=coalesce(nullif(r->>'ends_on','')::date,e.ends_on,make_date(p_year+1,3,1)-1);
  if st not in ('active','pending','inactive','transferred','graduated') or d1>d2 or d1<make_date(p_year,3,1) or d2>=make_date(p_year+1,3,1) then raise exception '재적 상태와 기간을 확인하세요: %',sid; end if;
  if st in ('inactive','transferred','graduated') and (nullif(r->>'ends_on','') is null and e.state is distinct from st) then raise exception '재적 종료일을 명시하세요: %',sid; end if;
  proposed:=jsonb_build_object('student_uid',uid,'school_year',p_year,'revision',coalesce(e.revision,1),'student_id',sid,'name',nm,'state',st,'starts_on',d1,'ends_on',d2,
   'grade',coalesce(nullif(r->>'grade','')::smallint,case when length(sid)=5 then substr(sid,1,1)::smallint end),
   'class_no',coalesce(nullif(r->>'class_no','')::smallint,case when length(sid)=5 then substr(sid,2,2)::smallint end),
   'number',coalesce(nullif(r->>'number','')::smallint,case when length(sid)=5 then substr(sid,4,2)::smallint end));
  oldrow:=case when e.student_uid is null then null else to_jsonb(e) end;
  if oldrow is not null and oldrow is distinct from proposed and coalesce((r->>'revision')::integer,0)<>e.revision then raise exception '명단 버전이 다릅니다. 서버 명단 사본을 받아 대조하세요: %',sid; end if;
  if oldrow is not null and oldrow is distinct from proposed then proposed:=jsonb_set(proposed,'{revision}',to_jsonb(e.revision+1)); end if;
  normalized:=normalized||jsonb_build_array(proposed);
  if oldrow is distinct from proposed then changes:=changes||jsonb_build_array(jsonb_build_object('type',case when oldrow is null then 'new' else 'change' end,'before',oldrow,'after',proposed)); end if;
 end loop;
 select changes||coalesce(jsonb_agg(jsonb_build_object('type','missing','before',to_jsonb(e2))) filter(where e2.student_uid is not null),'[]') into changes
 from public.enrollments e2 where e2.school_year=p_year and not exists(select 1 from jsonb_array_elements(normalized) n where n->>'student_uid'=e2.student_uid::text);
 insert into public.roster_previews(school_year,rows,base_hash,actor) values(p_year,normalized,md5(public._nfc_roster(p_year)::text),auth.uid()) returning id into plan;
 return jsonb_build_object('ok',true,'preview_id',plan,'changes',changes,'rows',normalized,'expires_minutes',30);
end $$;

create function public.nfc_roster_apply(p_preview uuid,p_secret text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.roster_previews%rowtype; r jsonb; uid uuid; e public.enrollments%rowtype; v_result jsonb;
begin
 if not public.is_teacher() and not coalesce(public._sync_ok(p_secret),false) then raise exception '연결 권한을 확인하세요' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(7212026);
 select * into p from public.roster_previews where id=p_preview for update;
 if not found then raise exception '미리보기를 다시 실행하세요'; end if;
 if p.actor is not null and p.actor is distinct from auth.uid() then raise exception '미리보기를 만든 계정으로 적용하세요'; end if;
 if p.result is not null then return p.result; end if;
 if p.created_at<now()-interval '30 minutes' or p.base_hash<>md5(public._nfc_roster(p.school_year)::text) then raise exception '명단이 바뀌었거나 미리보기가 만료되었습니다. 다시 확인하세요'; end if;
 for r in select value from jsonb_array_elements(p.rows) loop
  uid:=(r->>'student_uid')::uuid;
  select * into e from public.enrollments where student_uid=uid and school_year=p.school_year;
  insert into public.students(student_uid,student_id,name,grade,class_no,number,self_registered)
  values(uid,r->>'student_id',r->>'name',(r->>'grade')::smallint,(r->>'class_no')::smallint,(r->>'number')::smallint,r->>'state'='pending')
  on conflict(student_uid) do nothing;
  insert into public.enrollments select * from jsonb_populate_record(null::public.enrollments,r)
  on conflict(student_uid,school_year) do update set student_id=excluded.student_id,name=excluded.name,grade=excluded.grade,class_no=excluded.class_no,number=excluded.number,starts_on=excluded.starts_on,ends_on=excluded.ends_on,state=excluded.state,revision=excluded.revision;
  if to_jsonb(e) is distinct from r then
   insert into public.attendance_audit(student_uid,action,before_value,after_value,reason,actor)
   values(uid,'roster',case when e.student_uid is null then null else to_jsonb(e) end,r,'명단 미리보기 적용',auth.uid());
  end if;
 end loop;
 update public.sync_config set last_push_at=now() where id=1 and p_secret is not null;
 v_result:=jsonb_build_object('ok',true,'count',jsonb_array_length(p.rows),'rows',p.rows);
 update public.roster_previews set result=v_result where id=p_preview;
 return v_result;
end $$;

-- Legacy push cannot bypass the reviewed snapshot workflow.
create or replace function public.sync_push_roster(p_secret text,p_rows json) returns json language plpgsql security definer set search_path=public as $$
begin return json_build_object('ok',false,'error','preview_required','message','새 스크립트의 명단 미리보기 → 적용을 사용하세요'); end $$;

create or replace function public.register_device(p_student_id text,p_name text,p_code text,p_token text)
returns json language plpgsql security definer set search_path=public as $$
declare s public.students%rowtype; e public.enrollments%rowtype; cfg public.settings%rowtype;
 h text; d date:=(now() at time zone 'Asia/Seoul')::date; y integer; uid uuid;
begin
 perform pg_advisory_xact_lock(7212026); y:=public.nfc_year(d);
 if p_token is null or length(p_token)<32 or length(p_token)>256 or p_student_id is null or trim(p_student_id)!~'^[0-9]{3,10}$' or length(trim(coalesce(p_name,''))) not between 2 and 40 then return json_build_object('ok',false,'error','bad_input'); end if;
 h:=encode(extensions.digest(p_token,'sha256'),'hex');
 select * into e from public.enrollments where school_year=y and student_id=trim(p_student_id);
 if not found then
  select * into cfg from public.settings where id=1;
  if not cfg.allow_self_signup or coalesce(cfg.signup_code,'')='' then return json_build_object('ok',false,'error','not_on_roster'); end if;
  if trim(coalesce(p_code,''))<>cfg.signup_code then return json_build_object('ok',false,'error','bad_signup_code'); end if;
  if exists(select 1 from public.students where device_hash=h) then return json_build_object('ok',false,'error','device_in_use'); end if;
  insert into public.students(student_id,name,self_registered,device_hash,device_bound_at) values(trim(p_student_id),trim(p_name),true,h,now()) returning student_uid into uid;
  insert into public.enrollments(student_uid,school_year,student_id,name,grade,class_no,number,starts_on,ends_on,state)
  values(uid,y,trim(p_student_id),trim(p_name),case when length(trim(p_student_id))=5 then substr(trim(p_student_id),1,1)::smallint end,
  case when length(trim(p_student_id))=5 then substr(trim(p_student_id),2,2)::smallint end,case when length(trim(p_student_id))=5 then substr(trim(p_student_id),4,2)::smallint end,d,make_date(y+1,3,1)-1,'pending');
  return json_build_object('ok',true,'self_registered',true);
 end if;
 select * into s from public.students where student_uid=e.student_uid for update;
 if d not between e.starts_on and e.ends_on then return json_build_object('ok',false,'error','inactive'); end if;
 if s.failed_attempts>=5 then return json_build_object('ok',false,'error','locked'); end if;
 if e.name<>trim(p_name) or s.reg_code<>trim(coalesce(p_code,'')) then
  update public.students set failed_attempts=failed_attempts+1 where student_uid=s.student_uid;
  return json_build_object('ok',false,'error','mismatch','left',4-s.failed_attempts);
 end if;
 if s.device_hash is not null then return json_build_object('ok',false,'error','already_bound'); end if;
 if exists(select 1 from public.students where device_hash=h) then return json_build_object('ok',false,'error','device_in_use'); end if;
 update public.students set device_hash=h,device_bound_at=now(),failed_attempts=0 where student_uid=s.student_uid;
 return json_build_object('ok',true,'student_id',e.student_id,'name',e.name);
end $$;

create or replace function public.check_in(p_token text,p_lat double precision default null,p_lng double precision default null,p_acc double precision default null)
returns json language plpgsql security definer set search_path=public as $$
declare s public.students%rowtype; e public.enrollments%rowtype; cfg public.settings%rowtype; a public.attendance%rowtype; m public.movements%rowtype;
 d date:=(now() at time zone 'Asia/Seoul')::date; t time:=(now() at time zone 'Asia/Seoul')::time; dist double precision; was boolean:=false; before_a jsonb;
begin
 perform pg_advisory_xact_lock(7212026);
 if p_token is null or length(p_token) not between 32 and 256 then return json_build_object('ok',false,'error','unknown_device'); end if;
 select * into s from public.students where device_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if not found then return json_build_object('ok',false,'error','unknown_device'); end if;
 select * into e from public.enrollments where student_uid=s.student_uid and school_year=public.nfc_year(d);
 if not found or d not between e.starts_on and e.ends_on then return json_build_object('ok',false,'error','inactive'); end if;
 if e.state='pending' then return json_build_object('ok',false,'error','pending'); end if;
 select * into cfg from public.settings where id=1;
 select * into a from public.attendance where student_uid=s.student_uid and att_date=d;
 was:=found;
 if not was or a.status='unconfirmed' then
  before_a:=case when was then to_jsonb(a) end;
  if not public._nfc_school_day(d,e.grade) then return json_build_object('ok',false,'error','not_school_day'); end if;
  if t<cfg.open_time or t>cfg.close_time then return json_build_object('ok',false,'error','closed','open_time',to_char(cfg.open_time,'HH24:MI'),'close_time',to_char(cfg.close_time,'HH24:MI')); end if;
  if cfg.geo_required then
   if cfg.school_lat is null or cfg.school_lng is null then return json_build_object('ok',false,'error','geo_not_configured'); end if;
   if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then return json_build_object('ok',false,'error','need_location'); end if;
   dist:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(p_lat-cfg.school_lat)/2),2)+cos(radians(cfg.school_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-cfg.school_lng)/2),2))));
   if dist>cfg.radius_m+least(greatest(coalesce(p_acc,0),0),150) then return json_build_object('ok',false,'error','too_far','distance',round(dist)); end if;
  end if;
  insert into public.attendance(student_uid,student_id,att_date,status,checked_at,distance_m)
  values(s.student_uid,e.student_id,d,case when t<cfg.deadline+interval '1 minute' then 'present' else 'late' end,now(),round(dist))
  on conflict(student_uid,att_date) do update set status=excluded.status,source='nfc',checked_at=coalesce(attendance.checked_at,excluded.checked_at),distance_m=excluded.distance_m,version=attendance.version+1 returning * into a;
  if was then insert into public.attendance_audit(student_uid,att_date,action,before_value,after_value,reason) values(s.student_uid,d,'correction',before_a,to_jsonb(a),'미확인 상태에서 NFC 재확인'); end if;
  was:=false;
 end if;
 select * into m from public._nfc_current_move(s.student_uid,d);
 if (a.status in ('absent','excused') or m.kind in ('out','early')) and not exists(select 1 from public.nfc_tag_events where student_uid=s.student_uid and att_date=d and tagged_at>now()-interval '30 seconds') then
  insert into public.nfc_tag_events(student_uid,att_date,status,whereabouts) values(s.student_uid,d,a.status,coalesce(m.kind,'inside'));
 end if;
 return json_build_object('ok',true,'already',was,'name',e.name,'student_id',e.student_id,'status',a.status,
 'time',to_char(a.checked_at at time zone 'Asia/Seoul','HH24:MI:SS'),'deadline',to_char(cfg.deadline,'HH24:MI'),
 'whereabouts',case when m.kind='out' then 'out' when m.kind='early' then 'early' else 'inside' end);
end $$;

create function public._nfc_report(p_from date,p_to date) returns jsonb language plpgsql set search_path=public as $$
declare r jsonb;
begin
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>370 then raise exception '최대 371일 범위를 지정하세요'; end if;
 select coalesce(jsonb_agg(x||jsonb_build_object('date',d::date) order by d,x->>'student_id'),'[]') into r
 from generate_series(p_from,p_to,'1 day'::interval) d cross join lateral jsonb_array_elements(public._nfc_day(d::date)) x
 where (x->>'eligible')::boolean or (x->>'version')::integer>0;
 return r;
end $$;
create function public.nfc_report(p_from date,p_to date) returns jsonb language plpgsql security definer set search_path=public as $$
begin perform public._nfc_teacher(); return public._nfc_report(p_from,p_to); end $$;
create or replace function public.sync_pull(p_secret text,p_from date,p_to date) returns json language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
 if not coalesce(public._sync_ok(p_secret),false) then return json_build_object('ok',false,'error','bad_secret'); end if;
 r:=public._nfc_report(p_from,p_to);
 update public.sync_config set last_pull_at=now() where id=1;
 return jsonb_build_object('ok',true,'version',2,'students',public._nfc_roster(public.nfc_year(p_to)),'attendance',r,
 'movements',coalesce((select jsonb_agg(to_jsonb(m) order by att_date,seq) from public.movements m where att_date between p_from and p_to),'[]'))::json;
end $$;

-- Deny default PUBLIC execution, then grant only guarded public entrypoints.
revoke all on function public._nfc_teacher(),public._nfc_school_day(date,integer),public._nfc_roster(integer),public._nfc_current_move(uuid,date),public._nfc_day(date),public._nfc_report(date,date) from public,anon,authenticated;
revoke all on function public.nfc_roster(integer),public.nfc_day(date),public.nfc_correct(uuid,date,text,text,integer),public.nfc_move(uuid,date,text,timestamptz,timestamptz,text,uuid,uuid),public.nfc_calendar(date,date,integer,boolean,text),public.nfc_student_action(uuid,integer,text),public.nfc_report(date,date) from public,anon,authenticated;
grant execute on function public.nfc_roster(integer),public.nfc_day(date),public.nfc_correct(uuid,date,text,text,integer),public.nfc_move(uuid,date,text,timestamptz,timestamptz,text,uuid,uuid),public.nfc_calendar(date,date,integer,boolean,text),public.nfc_student_action(uuid,integer,text),public.nfc_report(date,date) to authenticated;
revoke all on function public.nfc_roster_preview(integer,jsonb,text),public.nfc_roster_apply(uuid,text) from public,anon,authenticated;
grant execute on function public.nfc_roster_preview(integer,jsonb,text),public.nfc_roster_apply(uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
