-- Follow-up to the independent source review. No student/history rows are deleted.
-- Rejected self-signups retain their original identity and audit trail, but free their school number.
alter table public.enrollments drop constraint enrollments_state_check;
alter table public.enrollments add constraint enrollments_state_check check(state in ('active','pending','inactive','transferred','graduated','rejected'));
alter table public.enrollments drop constraint enrollments_school_year_student_id_key;
create unique index enrollments_live_school_number on public.enrollments(school_year,student_id) where state<>'rejected';

-- Only roster fields participate: device registration must not invalidate a preview.
create function public._nfc_roster_hash(p_year integer) returns text language sql stable set search_path=public as $$
 select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.student_uid),'[]')::text)
 from public.enrollments e where school_year=p_year and state<>'rejected'
$$;
revoke all on function public._nfc_roster_hash(integer) from public,anon,authenticated;


create or replace function public._nfc_roster(p_year integer) returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.student_id),'[]') from (
 select e.*,(select max(tagged_at) from public.nfc_tag_events t where t.student_uid=e.student_uid and t.status='pending' and public.nfc_year(t.att_date)=e.school_year) last_pending_tag,s.reg_code,s.device_bound_at,s.failed_attempts,s.self_registered from public.enrollments e
 join public.students s using(student_uid) where school_year=p_year and e.state<>'rejected') r
$$;

create or replace function public._nfc_day(p_date date) returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.student_id),'[]') from (
 select e.*, s.device_bound_at,
 (p_date between e.starts_on and e.ends_on and e.state<>'pending' and public._nfc_school_day(p_date,e.grade)) eligible,
 coalesce(a.status,'unconfirmed') status,a.checked_at,a.source,coalesce(a.version,0) version,a.note,
 case when m.kind='out' then 'out' when m.kind='early' then 'early' else 'inside' end whereabouts,
 (select id from public.movements where student_uid=e.student_uid and att_date=p_date order by seq desc limit 1) movement_id,m.id effective_movement_id,m.happened_at movement_time,m.expected_return_at,
 (m.kind='out' and m.expected_return_at<now()) overdue,
 (select max(tagged_at) from public.nfc_tag_events t where t.student_uid=e.student_uid and t.att_date=p_date and t.status<>'pending') last_exception_tag,
 (select max(tagged_at) from public.nfc_tag_events t where t.student_uid=e.student_uid and t.att_date=p_date and t.status='pending') last_pending_tag
 from public.enrollments e join public.students s using(student_uid)
 left join public.attendance a on a.student_uid=e.student_uid and a.att_date=p_date
 left join lateral public._nfc_current_move(e.student_uid,p_date) m on true
 where e.school_year=public.nfc_year(p_date) and e.state<>'rejected') r
$$;

create or replace function public.nfc_move(p_uid uuid,p_date date,p_kind text,p_at timestamptz,p_expected timestamptz,p_reason text,p_previous uuid,p_request uuid)
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
 if p_kind<>'void' and eff.happened_at>p_at then raise exception '이전 이동 이후 시각을 입력하세요'; end if;
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

-- Explicit approval date and revision guard. Earlier tag attempts do not become attendance automatically.
create function public.nfc_confirm_signup(p_uid uuid,p_year integer,p_start date,p_reason text,p_revision integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.enrollments%rowtype; a public.enrollments%rowtype; d date:=(now() at time zone 'Asia/Seoul')::date;
begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 select * into e from public.enrollments where student_uid=p_uid and school_year=p_year for update;
 if not found or e.state<>'pending' then raise exception '승인 대기 학생이 아닙니다. 명단을 새로고침하세요'; end if;
 if e.revision is distinct from p_revision then raise exception '명단 버전이 다릅니다. 새로고침하세요'; end if;
 if p_start is null or p_start<make_date(p_year,3,1) or p_start>e.ends_on or p_start>d then raise exception '출석 시작일을 확인하세요'; end if;
 if length(trim(coalesce(p_reason,''))) not between 1 and 200 then raise exception '확정 사유를 입력하세요'; end if;
 update public.enrollments set state='active',starts_on=p_start,revision=revision+1 where student_uid=p_uid and school_year=p_year returning * into a;
 update public.students set self_registered=false where student_uid=p_uid;
 insert into public.attendance_audit(student_uid,action,before_value,after_value,reason,actor)
 values(p_uid,'student_confirm',to_jsonb(e),to_jsonb(a),trim(p_reason),auth.uid());
 return jsonb_build_object('ok',true,'revision',a.revision);
end $$;

create function public.nfc_reject_signup(p_uid uuid,p_year integer,p_reason text,p_revision integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.enrollments%rowtype; a public.enrollments%rowtype;
begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 select * into e from public.enrollments where student_uid=p_uid and school_year=p_year for update;
 if not found or e.state<>'pending' or not exists(select 1 from public.students where student_uid=p_uid and self_registered) then raise exception '자가가입 승인 대기 학생만 거절할 수 있습니다'; end if;
 if e.revision is distinct from p_revision then raise exception '명단 버전이 다릅니다. 새로고침하세요'; end if;
 if length(trim(coalesce(p_reason,''))) not between 1 and 200 then raise exception '거절 사유를 입력하세요'; end if;
 if exists(select 1 from public.attendance where student_uid=p_uid) or exists(select 1 from public.movements where student_uid=p_uid)
 or exists(select 1 from public.enrollments where student_uid=p_uid and school_year<>p_year and state<>'rejected') then raise exception '다른 재적 또는 출석 이력이 있어 거절할 수 없습니다. 명단 수정을 사용하세요'; end if;
 update public.enrollments set state='rejected',revision=revision+1 where student_uid=p_uid and school_year=p_year returning * into a;
 update public.students set device_hash=null,device_bound_at=null,failed_attempts=0,reg_code=encode(extensions.gen_random_bytes(4),'hex') where student_uid=p_uid;
 insert into public.attendance_audit(student_uid,action,before_value,after_value,reason,actor)
 values(p_uid,'student_reject',to_jsonb(e),to_jsonb(a),trim(p_reason),auth.uid());
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.nfc_confirm_signup(uuid,integer,date,text,integer),public.nfc_reject_signup(uuid,integer,text,integer) from public,anon,authenticated;
grant execute on function public.nfc_confirm_signup(uuid,integer,date,text,integer),public.nfc_reject_signup(uuid,integer,text,integer) to authenticated;


create or replace function public.nfc_student_action(p_uid uuid,p_year integer,p_action text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b jsonb;
begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 select jsonb_build_object('bound',device_bound_at,'pending',self_registered) into b from public.students where student_uid=p_uid;
 if not found then raise exception '학생을 찾을 수 없습니다'; end if;
 if p_action='reset' then update public.students set device_hash=null,device_bound_at=null where student_uid=p_uid;
 elsif p_action='code' then update public.students set reg_code=encode(extensions.gen_random_bytes(4),'hex'),failed_attempts=0 where student_uid=p_uid;
 elsif p_action='confirm' then
   raise exception '새 화면에서 출석 시작일과 사유를 확인해 명단을 확정하세요';
 else raise exception '지원하지 않는 처리입니다'; end if;
 insert into public.attendance_audit(student_uid,action,before_value,reason,actor) values(p_uid,'student_'||p_action,b,p_action,auth.uid());
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.nfc_roster_preview(p_year integer,p_rows jsonb,p_secret text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; normalized jsonb:='[]'; changes jsonb:='[]'; e public.enrollments%rowtype;
 uid uuid; sid text; nm text; st text; d1 date; d2 date; plan uuid; oldrow jsonb; proposed jsonb; warnings jsonb:='[]';
begin
 if not public.is_teacher() and not coalesce(public._sync_ok(p_secret),false) then raise exception '연결 권한을 확인하세요' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(7212026);
 if p_year is null or p_year not between 2020 and 2100 or p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>5000 then raise exception '명단 형식을 확인하세요'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  sid:=trim(r->>'student_id'); nm:=normalize(trim(r->>'name'),NFC);
  if sid is null or sid!~'^[0-9]{3,10}$' or nm is null or length(nm) not between 2 and 40 then raise exception '학번(3~10자리)과 이름을 확인하세요'; end if;
  uid:=nullif(r->>'student_uid','')::uuid;
  e:=null;
  if uid is not null then
   if not exists(select 1 from public.students where student_uid=uid) or exists(select 1 from public.enrollments where student_uid=uid and state='rejected') then raise exception '학생 식별자가 없습니다: %',sid; end if;
   select * into e from public.enrollments where student_uid=uid and school_year=p_year;
  else
   select * into e from public.enrollments where school_year=p_year and student_id=sid and state<>'rejected';
   if e.student_uid is not null then
    if normalize(e.name,NFC)<>nm then
     if e.state='pending' then raise exception '학번 %의 승인 대기 이름이 다릅니다. 교사 명단에서 잘못된 자가가입을 승인 거절한 뒤 다시 미리보기하세요',sid; end if;
     raise exception '같은 학번의 이름이 다릅니다. 학생 식별자로 대상을 확인하세요: %',sid;
    end if;
    uid:=e.student_uid;
   else uid:=gen_random_uuid(); end if;
  end if;
  if exists(select 1 from jsonb_array_elements(normalized) n where n->>'student_id'=sid or n->>'student_uid'=uid::text) then raise exception '중복 학번 또는 학생 식별자가 있습니다: %',sid; end if;
  if exists(select 1 from public.enrollments where school_year=p_year and student_id=sid and student_uid<>uid and state<>'rejected') then raise exception '학번이 다른 학생에게 사용 중입니다: %',sid; end if;
  st:=coalesce(nullif(r->>'state',''),e.state,'active');
  d1:=coalesce(nullif(r->>'starts_on','')::date,e.starts_on,make_date(p_year,3,1));
  d2:=coalesce(nullif(r->>'ends_on','')::date,e.ends_on,make_date(p_year+1,3,1)-1);
  if st not in ('active','pending','inactive','transferred','graduated') or d1>d2 or d1<make_date(p_year,3,1) or d2>=make_date(p_year+1,3,1) then raise exception '재적 상태와 기간을 확인하세요: %',sid; end if;
  if st in ('inactive','transferred','graduated') and (nullif(r->>'ends_on','') is null and e.state is distinct from st) then raise exception '재적 종료일을 명시하세요: %',sid; end if;
  if e.state='pending' and st='active' and nullif(r->>'starts_on','') is null then raise exception '승인 대기 학생의 출석 시작일을 명시하세요: %',sid; end if;
  if e.state='pending' and st='active' then warnings:=warnings||jsonb_build_array(sid||' '||nm||': 승인 전 태그는 출석 확정이 아닙니다. 시작일 '||d1||'부터 대상일로 집계됩니다.'); end if;
  if st in ('inactive','transferred','graduated') and e.state is distinct from st then warnings:=warnings||jsonb_build_array(sid||' '||nm||': 마지막 출석 대상일은 '||d2||'입니다. 상태만 바꿔도 종료일까지는 대상입니다.'); end if;
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
 from public.enrollments e2 where e2.school_year=p_year and e2.state<>'rejected' and not exists(select 1 from jsonb_array_elements(normalized) n where n->>'student_uid'=e2.student_uid::text);
 insert into public.roster_previews(school_year,rows,base_hash,actor) values(p_year,normalized,public._nfc_roster_hash(p_year),auth.uid()) returning id into plan;
 return jsonb_build_object('ok',true,'preview_id',plan,'changes',changes,'rows',normalized,'expires_minutes',30,'warnings',warnings);
end $$;

create or replace function public.nfc_roster_apply(p_preview uuid,p_secret text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.roster_previews%rowtype; r jsonb; uid uuid; e public.enrollments%rowtype; v_result jsonb;
begin
 if not public.is_teacher() and not coalesce(public._sync_ok(p_secret),false) then raise exception '연결 권한을 확인하세요' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(7212026);
 select * into p from public.roster_previews where id=p_preview for update;
 if not found then raise exception '미리보기를 다시 실행하세요'; end if;
 if p.actor is not null and p.actor is distinct from auth.uid() then raise exception '미리보기를 만든 계정으로 적용하세요'; end if;
 if p.result is not null then return p.result; end if;
 if p.created_at<now()-interval '30 minutes' or p.base_hash<>public._nfc_roster_hash(p.school_year) then raise exception '명단이 바뀌었거나 미리보기가 만료되었습니다. 다시 확인하세요'; end if;
 for r in select value from jsonb_array_elements(p.rows) loop
  uid:=(r->>'student_uid')::uuid;
  select * into e from public.enrollments where student_uid=uid and school_year=p.school_year;
  insert into public.students(student_uid,student_id,name,grade,class_no,number,self_registered)
  values(uid,r->>'student_id',r->>'name',(r->>'grade')::smallint,(r->>'class_no')::smallint,(r->>'number')::smallint,r->>'state'='pending')
  on conflict(student_uid) do nothing;
  insert into public.enrollments select * from jsonb_populate_record(null::public.enrollments,r)
  on conflict(student_uid,school_year) do update set student_id=excluded.student_id,name=excluded.name,grade=excluded.grade,class_no=excluded.class_no,number=excluded.number,starts_on=excluded.starts_on,ends_on=excluded.ends_on,state=excluded.state,revision=excluded.revision;
  if e.state='pending' and r->>'state'='active' then update public.students set self_registered=false where student_uid=uid; end if;
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

create or replace function public.register_device(p_student_id text,p_name text,p_code text,p_token text)
returns json language plpgsql security definer set search_path=public as $$
declare s public.students%rowtype; e public.enrollments%rowtype; cfg public.settings%rowtype;
 h text; d date:=(now() at time zone 'Asia/Seoul')::date; y integer; uid uuid;
begin
 perform pg_advisory_xact_lock(7212026); y:=public.nfc_year(d);
 if p_token is null or length(p_token)<32 or length(p_token)>256 or p_student_id is null or trim(p_student_id)!~'^[0-9]{3,10}$' or length(normalize(trim(coalesce(p_name,'')),NFC)) not between 2 and 40 then return json_build_object('ok',false,'error','bad_input'); end if;
 h:=encode(extensions.digest(p_token,'sha256'),'hex');
 select * into e from public.enrollments where school_year=y and student_id=trim(p_student_id) and state<>'rejected';
 if not found then
  select * into cfg from public.settings where id=1;
  if not cfg.allow_self_signup or coalesce(cfg.signup_code,'')='' then return json_build_object('ok',false,'error','not_on_roster'); end if;
  if trim(coalesce(p_code,''))<>cfg.signup_code then return json_build_object('ok',false,'error','bad_signup_code'); end if;
  if exists(select 1 from public.students where device_hash=h) then return json_build_object('ok',false,'error','device_in_use'); end if;
  insert into public.students(student_id,name,self_registered,device_hash,device_bound_at) values(trim(p_student_id),normalize(trim(p_name),NFC),true,h,now()) returning student_uid into uid;
  insert into public.enrollments(student_uid,school_year,student_id,name,grade,class_no,number,starts_on,ends_on,state)
  values(uid,y,trim(p_student_id),normalize(trim(p_name),NFC),case when length(trim(p_student_id))=5 then substr(trim(p_student_id),1,1)::smallint end,
  case when length(trim(p_student_id))=5 then substr(trim(p_student_id),2,2)::smallint end,case when length(trim(p_student_id))=5 then substr(trim(p_student_id),4,2)::smallint end,d,make_date(y+1,3,1)-1,'pending');
  return json_build_object('ok',true,'self_registered',true);
 end if;
 select * into s from public.students where student_uid=e.student_uid for update;
 if d not between e.starts_on and e.ends_on then return json_build_object('ok',false,'error','inactive'); end if;
 if s.failed_attempts>=5 then return json_build_object('ok',false,'error','locked'); end if;
 if normalize(e.name,NFC)<>normalize(trim(p_name),NFC) or s.reg_code<>trim(coalesce(p_code,'')) then
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
 if not found or e.state='rejected' or d not between e.starts_on and e.ends_on then return json_build_object('ok',false,'error','inactive'); end if;
 if e.state='pending' then
  if not exists(select 1 from public.nfc_tag_events where student_uid=s.student_uid and att_date=d and status='pending' and tagged_at>now()-interval '30 seconds') then
   insert into public.nfc_tag_events(student_uid,att_date,status,whereabouts) values(s.student_uid,d,'pending','unverified');
  end if;
  return json_build_object('ok',false,'error','pending');
 end if;
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
  values(s.student_uid,e.student_id,d,case when (coalesce(a.checked_at,now()) at time zone 'Asia/Seoul')::time<cfg.deadline+interval '1 minute' then 'present' else 'late' end,now(),round(dist))
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

notify pgrst,'reload schema';
