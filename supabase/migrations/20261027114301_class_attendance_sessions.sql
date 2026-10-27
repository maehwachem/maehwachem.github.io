-- Repeated class attendance is independent of daily arrival and movements.
create table public.class_templates (
 id uuid primary key, school_year integer not null check(school_year between 2020 and 2100),
 title text not null check(length(trim(title)) between 1 and 80), period_label text not null default '' check(length(period_label)<=40),
 weekdays integer[] not null check(cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]),
 opens time not null, late time not null, closes time not null, valid_from date not null, valid_to date not null,
 enabled boolean not null default true, revision integer not null default 1,
 created_by uuid not null, created_at timestamptz not null default now(),
 check(opens<=late and late<closes), check(valid_from<=valid_to),
 check(valid_from>=make_date(school_year,3,1) and valid_to<make_date(school_year+1,3,1))
);
create table public.class_members (
 template_id uuid not null references public.class_templates(id) on delete restrict,
 student_uid uuid not null references public.students(student_uid) on delete restrict,
 valid_from date not null, valid_to date not null, enabled boolean not null default true,
 primary key(template_id,student_uid), check(valid_from<=valid_to)
);
create index class_members_student_idx on public.class_members(student_uid,template_id);
create table public.class_sessions (
 id uuid primary key, template_id uuid references public.class_templates(id) on delete restrict,
 att_date date not null, title text not null check(length(trim(title)) between 1 and 80), period_label text not null default '' check(length(period_label)<=40),
 opens_at timestamptz not null, late_at timestamptz not null, closes_at timestamptz not null,
 state text not null default 'open' check(state in ('open','closed','cancelled')),
 allow_non_school_day boolean not null default false,
 revision integer not null default 1, created_by uuid, created_at timestamptz not null default now(),
 unique(template_id,att_date), check(opens_at<=late_at and late_at<closes_at),
 check((opens_at at time zone 'Asia/Seoul')::date=att_date and (closes_at at time zone 'Asia/Seoul')::date=att_date)
);
create index class_sessions_day_idx on public.class_sessions(att_date,opens_at);
-- Snapshot and attendance share a composite key; removed students keep all values.
create table public.class_records (
 session_id uuid not null references public.class_sessions(id) on delete restrict,
 student_uid uuid not null references public.students(student_uid) on delete restrict,
 student_id text not null, name text not null, grade smallint, class_no smallint, number smallint,
 enrolled boolean not null default true,
 status text not null default 'unconfirmed' check(status in ('present','late','excused','absent','unconfirmed')),
 first_tag_at timestamptz, source text check(source in ('nfc','manual')), note text,
 version integer not null default 0, corrected_at timestamptz, corrected_by uuid,
 primary key(session_id,student_uid)
);
create index class_records_student_idx on public.class_records(student_uid,session_id);
create table public.class_audit (
 id bigint generated always as identity primary key,
 session_id uuid references public.class_sessions(id) on delete restrict,
 template_id uuid references public.class_templates(id) on delete restrict,
 student_uid uuid references public.students(student_uid) on delete restrict,
 action text not null, before_value jsonb, after_value jsonb, reason text not null,
 actor uuid, created_at timestamptz not null default now()
);
create index class_audit_session_idx on public.class_audit(session_id,student_uid,id);
create index class_audit_template_idx on public.class_audit(template_id);
create table public.class_tag_events (
 id bigint generated always as identity primary key,
 session_id uuid not null references public.class_sessions(id) on delete restrict,
 student_uid uuid not null references public.students(student_uid) on delete restrict,
 result text not null, tagged_at timestamptz not null default now()
);
create index class_tag_events_student_idx on public.class_tag_events(session_id,student_uid,tagged_at);
create index class_tag_events_uid_idx on public.class_tag_events(student_uid);

do $$ declare t text; begin
 foreach t in array array['class_templates','class_members','class_sessions','class_records','class_audit','class_tag_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy teacher_read on public.%I for select to authenticated using ((select public.is_teacher()))',t);
 end loop;
end $$;

create function public.nfc_class_list(p_year integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb; begin
 perform public._nfc_teacher();
 select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(m) order by m.student_uid) from public.class_members m where m.template_id=t.id and m.enabled),'[]')) order by t.opens,t.title),'[]') into answer from public.class_templates t where t.school_year=p_year;
 return answer;
end $$;

create function public.nfc_class_save(p_data jsonb,p_revision integer,p_reason text) returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.class_templates%rowtype; before_t jsonb; r jsonb; uid uuid; y integer; d1 date; d2 date; ids uuid[]:='{}'; days integer[]; v_id uuid;
begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 if length(trim(coalesce(p_reason,''))) not between 1 and 200 then raise exception '사유를 입력하세요'; end if;
 v_id:=(p_data->>'id')::uuid; y:=(p_data->>'school_year')::integer; d1:=(p_data->>'valid_from')::date; d2:=(p_data->>'valid_to')::date;
 select * into t from public.class_templates where class_templates.id=v_id;
 if (found and t.revision is distinct from p_revision) or (not found and p_revision is distinct from 0) then raise exception '시간표가 바뀌었습니다. 다시 불러오세요'; end if;
 if t.id is not null and t.school_year<>y then raise exception '학년도가 다른 시간표는 새로 만드세요'; end if;
 before_t:=case when t.id is null then null else to_jsonb(t)||jsonb_build_object('members',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.class_members m where m.template_id=v_id)) end;
 if p_data->'members' is null or jsonb_typeof(p_data->'members')<>'array' or jsonb_array_length(p_data->'members') not between 1 and 1000 then raise exception '수강생을 1명 이상 선택하세요'; end if;
 select array_agg(distinct value::integer) into days from jsonb_array_elements_text(p_data->'weekdays');
 insert into public.class_templates(id,school_year,title,period_label,weekdays,opens,late,closes,valid_from,valid_to,enabled,created_by)
 values(v_id,y,trim(p_data->>'title'),trim(coalesce(p_data->>'period_label','')),days,(p_data->>'opens')::time,(p_data->>'late')::time,(p_data->>'closes')::time,d1,d2,coalesce((p_data->>'enabled')::boolean,true),auth.uid())
 on conflict(id) do update set title=excluded.title,period_label=excluded.period_label,weekdays=excluded.weekdays,opens=excluded.opens,late=excluded.late,closes=excluded.closes,valid_from=excluded.valid_from,valid_to=excluded.valid_to,enabled=excluded.enabled,revision=class_templates.revision+1;
 update public.class_members set enabled=false where template_id=v_id;
 for r in select value from jsonb_array_elements(p_data->'members') loop
  uid:=(r->>'student_uid')::uuid;
  if uid=any(ids) then raise exception '수강생이 중복되었습니다'; end if; ids:=array_append(ids,uid);
  if not exists(select 1 from public.enrollments e where e.student_uid=uid and e.school_year=y and e.state not in ('pending','rejected')) then raise exception '승인된 학생 명단에서 수강생을 선택하세요'; end if;
  if (r->>'valid_from')::date<d1 or (r->>'valid_to')::date>d2 then raise exception '수강 기간은 시간표 적용 기간 안이어야 합니다'; end if;
  insert into public.class_members(template_id,student_uid,valid_from,valid_to) values(v_id,uid,(r->>'valid_from')::date,(r->>'valid_to')::date)
  on conflict(template_id,student_uid) do update set valid_from=excluded.valid_from,valid_to=excluded.valid_to,enabled=true;
 end loop;
 insert into public.class_audit(template_id,action,before_value,after_value,reason,actor) values(v_id,'template',before_t,p_data,trim(p_reason),auth.uid());
 return jsonb_build_object('ok',true,'id',v_id);
end $$;

-- Pausing must remain possible even when the previous roster is no longer valid.
create function public.nfc_class_pause(p_template uuid,p_revision integer,p_reason text) returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.class_templates%rowtype; begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 if length(trim(coalesce(p_reason,''))) not between 1 and 200 then raise exception '사유를 입력하세요'; end if;
 select * into t from public.class_templates where id=p_template;
 if not found or t.revision is distinct from p_revision then raise exception '시간표가 바뀌었습니다. 다시 불러오세요'; end if;
 update public.class_templates set enabled=false,revision=revision+1 where id=p_template;
 insert into public.class_audit(template_id,action,before_value,after_value,reason,actor) values(p_template,'template_pause',to_jsonb(t),jsonb_build_object('enabled',false),trim(p_reason),auth.uid());
 return jsonb_build_object('ok',true);
end $$;

-- Only today is materialized implicitly. No retrospective phantom attendance.
create function public._nfc_sessions_ensure(p_date date,p_uid uuid default null) returns void language plpgsql set search_path=public as $$
declare t public.class_templates%rowtype; sid uuid;
begin
 if p_date is distinct from (now() at time zone 'Asia/Seoul')::date then return; end if;
 perform pg_advisory_xact_lock(7212026);
 for t in select c.* from public.class_templates c where c.enabled and p_date between c.valid_from and c.valid_to and extract(isodow from p_date)::integer=any(c.weekdays)
 and not exists(select 1 from public.class_sessions s where s.template_id=c.id and s.att_date=p_date)
 and (p_uid is null or exists(select 1 from public.class_members m where m.template_id=c.id and m.student_uid=p_uid and m.enabled and p_date between m.valid_from and m.valid_to)) loop
  if not exists(select 1 from public.class_members m join public.enrollments e on e.student_uid=m.student_uid and e.school_year=t.school_year where m.template_id=t.id and m.enabled and p_date between m.valid_from and m.valid_to and p_date between e.starts_on and e.ends_on and e.state not in ('pending','rejected') and public._nfc_school_day(p_date,e.grade)) then continue; end if;
  sid:=gen_random_uuid();
  insert into public.class_sessions(id,template_id,att_date,title,period_label,opens_at,late_at,closes_at)
  values(sid,t.id,p_date,t.title,t.period_label,(p_date+t.opens) at time zone 'Asia/Seoul',(p_date+t.late) at time zone 'Asia/Seoul',(p_date+t.closes) at time zone 'Asia/Seoul');
  insert into public.class_records(session_id,student_uid,student_id,name,grade,class_no,number)
  select sid,e.student_uid,e.student_id,e.name,e.grade,e.class_no,e.number from public.class_members m join public.enrollments e on e.student_uid=m.student_uid and e.school_year=t.school_year
  where m.template_id=t.id and m.enabled and p_date between m.valid_from and m.valid_to and p_date between e.starts_on and e.ends_on and e.state not in ('pending','rejected') and public._nfc_school_day(p_date,e.grade);
  insert into public.class_audit(session_id,template_id,action,after_value,reason) values(sid,t.id,'generated',to_jsonb(t),'시간표에서 오늘 회차 자동 생성');
 end loop;
end $$;

create function public.nfc_session_day(p_date date) returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb; begin
 perform public._nfc_teacher(); perform public._nfc_sessions_ensure(p_date);
 select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('counts',(select jsonb_build_object('total',count(*) filter(where enrolled),'present',count(*) filter(where enrolled and status='present'),'late',count(*) filter(where enrolled and status='late'),'unconfirmed',count(*) filter(where enrolled and status='unconfirmed'),'excused',count(*) filter(where enrolled and status='excused'),'absent',count(*) filter(where enrolled and status='absent')) from public.class_records r where r.session_id=s.id),
 'overlap_count',(select count(distinct r.student_uid) from public.class_records r join public.class_records r2 on r2.student_uid=r.student_uid and r2.session_id<>r.session_id and r2.enrolled join public.class_sessions s2 on s2.id=r2.session_id where r.session_id=s.id and r.enrolled and s.state<>'cancelled' and s2.state<>'cancelled' and s2.att_date=s.att_date and s.opens_at<s2.closes_at and s2.opens_at<s.closes_at)) order by s.opens_at,s.title),'[]') into answer from public.class_sessions s where s.att_date=p_date;
 return answer;
end $$;

create function public.nfc_session_detail(p_session uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.class_sessions%rowtype; rows jsonb; begin
 perform public._nfc_teacher(); select * into s from public.class_sessions where id=p_session;
 if not found then raise exception '수업 회차가 없습니다'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('daily_status',coalesce(a.status,'unconfirmed'),'whereabouts',case when m.kind in ('out','early') then m.kind else 'inside' end,'movement_time',m.happened_at,
 'overlap_attendance',r.enrolled and r.status in ('present','late') and s.state<>'cancelled' and exists(select 1 from public.class_records z join public.class_sessions k on k.id=z.session_id where z.student_uid=r.student_uid and z.session_id<>s.id and z.enrolled and z.status in ('present','late') and k.state<>'cancelled' and k.att_date=s.att_date and k.opens_at<s.closes_at and s.opens_at<k.closes_at),
 'roster_warning',not coalesce(e.state not in ('pending','rejected') and s.att_date between e.starts_on and e.ends_on and (s.allow_non_school_day or public._nfc_school_day(s.att_date,e.grade)),false),
 'last_attempt',(select jsonb_build_object('result',ev.result,'at',ev.tagged_at) from public.class_tag_events ev where ev.session_id=s.id and ev.student_uid=r.student_uid and ev.result not in ('accepted','duplicate') order by ev.id desc limit 1)) order by r.student_id),'[]') into rows
 from public.class_records r left join public.enrollments e on e.student_uid=r.student_uid and e.school_year=public.nfc_year(s.att_date)
 left join public.attendance a on a.student_uid=r.student_uid and a.att_date=s.att_date
 left join lateral public._nfc_current_move(r.student_uid,s.att_date) m on true where r.session_id=p_session;
 return jsonb_build_object('session',to_jsonb(s),'rows',rows);
end $$;

create function public.nfc_session_save(p_data jsonb,p_revision integer,p_reason text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.class_sessions%rowtype; uid uuid; v_id uuid; d date; op timestamptz; lt timestamptz; cl timestamptz; ids uuid[];
begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 if length(trim(coalesce(p_reason,''))) not between 1 and 200 then raise exception '사유를 입력하세요'; end if;
 v_id:=(p_data->>'id')::uuid; d:=(p_data->>'att_date')::date;
 op:=(d+(p_data->>'opens')::time) at time zone 'Asia/Seoul'; lt:=(d+(p_data->>'late')::time) at time zone 'Asia/Seoul'; cl:=(d+(p_data->>'closes')::time) at time zone 'Asia/Seoul';
 select * into s from public.class_sessions where class_sessions.id=v_id;
 if (found and s.revision is distinct from p_revision) or (not found and p_revision is distinct from 0) then raise exception '수업이 바뀌었습니다. 다시 불러오세요'; end if;
 if s.id is not null then
  if d is distinct from s.att_date then raise exception '날짜는 바꿀 수 없습니다. 새 회차로 만드세요'; end if;
  if (op,lt,cl) is distinct from (s.opens_at,s.late_at,s.closes_at) and exists(select 1 from public.class_records r where r.session_id=v_id and r.version>0) then raise exception '출석 처리된 회차는 시간을 바꿀 수 없습니다. 휴강 후 별도 회차를 만드세요'; end if;
  update public.class_sessions set title=trim(p_data->>'title'),period_label=trim(coalesce(p_data->>'period_label','')),opens_at=op,late_at=lt,closes_at=cl,revision=revision+1 where class_sessions.id=v_id;
 else
  if d is null or public.nfc_year(d) not between 2020 and 2100 then raise exception '날짜를 확인하세요'; end if;
  select array_agg(distinct value::uuid) into ids from jsonb_array_elements_text(p_data->'students');
  if coalesce(cardinality(ids),0) not between 1 and 1000 then raise exception '수강생을 선택하세요'; end if;
  if exists(select 1 from unnest(ids) u where not exists(select 1 from public.enrollments e where e.student_uid=u and e.school_year=public.nfc_year(d) and d between e.starts_on and e.ends_on and e.state not in ('pending','rejected'))) then raise exception '수업 날짜에 재적 중인 승인된 학생을 선택하세요'; end if;
  if not coalesce((p_data->>'allow_non_school_day')::boolean,false) and exists(select 1 from public.enrollments e where e.student_uid=any(ids) and e.school_year=public.nfc_year(d) and not public._nfc_school_day(d,e.grade)) then raise exception '출석 대상일이 아닙니다. 휴업일 수업 허용을 확인하세요'; end if;
  insert into public.class_sessions(id,att_date,title,period_label,opens_at,late_at,closes_at,created_by,allow_non_school_day)
  values(v_id,d,trim(p_data->>'title'),trim(coalesce(p_data->>'period_label','')),op,lt,cl,auth.uid(),coalesce((p_data->>'allow_non_school_day')::boolean,false));
  insert into public.class_records(session_id,student_uid,student_id,name,grade,class_no,number)
  select v_id,e.student_uid,e.student_id,e.name,e.grade,e.class_no,e.number from public.enrollments e where e.student_uid=any(ids) and e.school_year=public.nfc_year(d);
 end if;
 insert into public.class_audit(session_id,action,before_value,after_value,reason,actor) values(v_id,'session',case when s.id is null then null else to_jsonb(s) end,p_data,trim(p_reason),auth.uid());
 return jsonb_build_object('ok',true,'id',v_id);
end $$;

create function public.nfc_session_state(p_session uuid,p_state text,p_revision integer,p_reason text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.class_sessions%rowtype; begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 if p_state is null or p_state not in ('open','closed','cancelled') or length(trim(coalesce(p_reason,''))) not between 1 and 200 then raise exception '상태와 사유를 확인하세요'; end if;
 select * into s from public.class_sessions where id=p_session;
 if not found or s.revision is distinct from p_revision then raise exception '수업이 바뀌었습니다. 다시 불러오세요'; end if;
 update public.class_sessions set state=p_state,revision=revision+1 where id=p_session;
 insert into public.class_audit(session_id,action,before_value,after_value,reason,actor) values(p_session,'state',to_jsonb(s),jsonb_build_object('state',p_state),trim(p_reason),auth.uid());
 return jsonb_build_object('ok',true);
end $$;

create function public.nfc_session_member(p_session uuid,p_uid uuid,p_enrolled boolean,p_revision integer,p_reason text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.class_sessions%rowtype; r public.class_records%rowtype; e public.enrollments%rowtype; begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 if p_enrolled is null or length(trim(coalesce(p_reason,''))) not between 1 and 200 then raise exception '사유를 입력하세요'; end if;
 select * into s from public.class_sessions where id=p_session;
 if not found or s.revision is distinct from p_revision then raise exception '수업이 바뀌었습니다. 다시 불러오세요'; end if;
 if s.state='cancelled' then raise exception '휴강을 해제한 뒤 명단을 조정하세요'; end if;
 select * into r from public.class_records where session_id=p_session and student_uid=p_uid;
 if p_enrolled then
  select * into e from public.enrollments where student_uid=p_uid and school_year=public.nfc_year(s.att_date) and s.att_date between starts_on and ends_on and state not in ('pending','rejected');
  if not found or (not s.allow_non_school_day and not public._nfc_school_day(s.att_date,e.grade)) then raise exception '이 날짜의 출석 대상 학생이 아닙니다'; end if;
  insert into public.class_records(session_id,student_uid,student_id,name,grade,class_no,number) values(p_session,p_uid,e.student_id,e.name,e.grade,e.class_no,e.number)
  on conflict(session_id,student_uid) do update set enrolled=true;
 else
  if r.session_id is null then raise exception '수업 명단에 없는 학생입니다'; end if;
  update public.class_records set enrolled=false where session_id=p_session and student_uid=p_uid;
 end if;
 update public.class_sessions set revision=revision+1 where id=p_session;
 insert into public.class_audit(session_id,student_uid,action,before_value,after_value,reason,actor) values(p_session,p_uid,'member',case when r.session_id is null then null else to_jsonb(r) end,jsonb_build_object('enrolled',p_enrolled),trim(p_reason),auth.uid());
 return jsonb_build_object('ok',true);
end $$;

create function public.nfc_session_correct(p_session uuid,p_uid uuid,p_status text,p_reason text,p_version integer,p_revision integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.class_sessions%rowtype; r public.class_records%rowtype; new_r public.class_records%rowtype; begin
 perform public._nfc_teacher(); perform pg_advisory_xact_lock(7212026);
 if p_status is null or p_status not in ('present','late','excused','absent','unconfirmed') or length(trim(coalesce(p_reason,''))) not between 1 and 200 then raise exception '출석 상태와 사유를 입력하세요'; end if;
 select * into s from public.class_sessions where id=p_session;
 if not found or s.revision is distinct from p_revision then raise exception '수업이 바뀌었습니다. 다시 불러오세요'; end if;
 if s.state='cancelled' then raise exception '휴강 회차는 출석을 정정할 수 없습니다'; end if;
 select * into r from public.class_records where session_id=p_session and student_uid=p_uid;
 if not found or not r.enrolled then raise exception '이 회차의 대상 학생이 아닙니다'; end if;
 if r.version is distinct from p_version then raise exception '다른 출석 변경이 있습니다. 다시 불러오세요'; end if;
 update public.class_records set status=p_status,source='manual',note=trim(p_reason),version=version+1,corrected_at=now(),corrected_by=auth.uid() where session_id=p_session and student_uid=p_uid returning * into new_r;
 insert into public.class_audit(session_id,student_uid,action,before_value,after_value,reason,actor) values(p_session,p_uid,'correction',to_jsonb(r),to_jsonb(new_r),trim(p_reason),auth.uid());
 return jsonb_build_object('ok',true);
end $$;

create function public.nfc_session_history(p_session uuid,p_uid uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb; begin
 perform public._nfc_teacher();
 select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc),'[]') into answer from (select * from public.class_audit where session_id=p_session and (p_uid is null or student_uid=p_uid) order by id desc limit 100) a;
 return answer;
end $$;

create function public._nfc_session_event(p_session uuid,p_uid uuid,p_result text) returns void language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from public.class_tag_events where session_id=p_session and student_uid=p_uid and result=p_result and tagged_at>now()-interval '30 seconds') then
  insert into public.class_tag_events(session_id,student_uid,result) values(p_session,p_uid,p_result);
 end if;
end $$;

-- A token only reveals its owner's choices; listing never checks attendance in.
create function public.nfc_attendance_options(p_token text) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid; e public.enrollments%rowtype; d date:=(now() at time zone 'Asia/Seoul')::date; items jsonb; begin
 if p_token is null or length(p_token) not between 32 and 256 then return jsonb_build_object('ok',false,'error','unknown_device'); end if;
 select student_uid into uid from public.students where device_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if uid is null then return jsonb_build_object('ok',false,'error','unknown_device'); end if;
 select * into e from public.enrollments where student_uid=uid and school_year=public.nfc_year(d);
 if not found or e.state='rejected' or d not between e.starts_on and e.ends_on then return jsonb_build_object('ok',false,'error','inactive'); end if;
 if e.state='pending' then
  perform pg_advisory_xact_lock(7212026);
  if not exists(select 1 from public.nfc_tag_events where student_uid=uid and att_date=d and status='pending' and tagged_at>now()-interval '30 seconds') then
   insert into public.nfc_tag_events(student_uid,att_date,status,whereabouts) values(uid,d,'pending','unverified');
  end if;
  return jsonb_build_object('ok',false,'error','pending');
 end if;
 perform public._nfc_sessions_ensure(d,uid);
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'period_label',s.period_label,'opens_at',s.opens_at,'late_at',s.late_at,'closes_at',s.closes_at,'state',s.state,'status',r.status,'first_tag_at',r.first_tag_at,'available',s.state='open' and now()>=s.opens_at and now()<s.closes_at) order by s.opens_at,s.title),'[]') into items
 from public.class_sessions s join public.class_records r on r.session_id=s.id where s.att_date=d and r.student_uid=uid and r.enrolled;
 return jsonb_build_object('ok',true,'name',e.name,'student_id',e.student_id,'sessions',items);
end $$;

create function public.nfc_session_check_in(p_token text,p_session uuid,p_lat double precision default null,p_lng double precision default null,p_acc double precision default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid; e public.enrollments%rowtype; s public.class_sessions%rowtype; r public.class_records%rowtype; before_r jsonb; cfg public.settings%rowtype; m public.movements%rowtype; daily text; failure text; dist double precision; was boolean; overlapping boolean;
 d date:=(now() at time zone 'Asia/Seoul')::date;
begin
 perform pg_advisory_xact_lock(7212026);
 if p_token is null or length(p_token) not between 32 and 256 then return jsonb_build_object('ok',false,'error','unknown_device'); end if;
 select student_uid into uid from public.students where device_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if uid is null then return jsonb_build_object('ok',false,'error','unknown_device'); end if;
 select * into e from public.enrollments where student_uid=uid and school_year=public.nfc_year(d);
 if not found or e.state='rejected' or d not between e.starts_on and e.ends_on then return jsonb_build_object('ok',false,'error','inactive'); end if;
 if e.state='pending' then return jsonb_build_object('ok',false,'error','pending'); end if;
 select * into s from public.class_sessions where id=p_session;
 select * into r from public.class_records where session_id=p_session and student_uid=uid;
 if s.id is null or r.session_id is null then return jsonb_build_object('ok',false,'error','not_enrolled'); end if;
 if not r.enrolled then perform public._nfc_session_event(p_session,uid,'not_enrolled'); return jsonb_build_object('ok',false,'error','not_enrolled'); end if;
 before_r:=to_jsonb(r);
 if s.att_date<>d or s.state<>'open' or now()<s.opens_at or now()>=s.closes_at then failure:='session_closed';
 elsif not s.allow_non_school_day and not public._nfc_school_day(d,e.grade) then failure:='not_school_day';
 end if;
 select * into m from public._nfc_current_move(uid,d);
 select status into daily from public.attendance where student_uid=uid and att_date=d;
 if failure is null then
  if m.kind in ('out','early') then failure:='movement_'||m.kind;
  elsif daily in ('absent','excused') then failure:='daily_confirmed'; end if;
 end if;
 select * into cfg from public.settings where id=1;
 if failure is null and cfg.geo_required then
  if cfg.school_lat is null or cfg.school_lng is null then failure:='geo_not_configured';
  elsif p_lat is null or p_lng is null or not (p_lat between -90 and 90 and p_lng between -180 and 180) or (p_acc is not null and not (p_acc>=0 and p_acc<100000)) then failure:='need_location';
  else
   dist:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(p_lat-cfg.school_lat)/2),2)+cos(radians(cfg.school_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-cfg.school_lng)/2),2))));
   if dist>cfg.radius_m+least(coalesce(p_acc,0),150) then failure:='too_far'; end if;
  end if;
 end if;
 if failure is not null then
  perform public._nfc_session_event(p_session,uid,failure);
  return jsonb_build_object('ok',false,'error',failure,'distance',round(dist),'title',s.title,'period_label',s.period_label);
 end if;
 -- All manual decisions, including a manual reset to unconfirmed, require the teacher.
 was:=r.version>0;
 if not was then
  update public.class_records set status=case when now()<s.late_at then 'present' else 'late' end,first_tag_at=now(),source='nfc',version=1 where session_id=p_session and student_uid=uid returning * into r;
  insert into public.class_audit(session_id,student_uid,action,before_value,after_value,reason) values(p_session,uid,'check_in',before_r,to_jsonb(r),'학생 수업 출석 확인');
 end if;
 select r.status in ('present','late') and exists(select 1 from public.class_records z join public.class_sessions k on k.id=z.session_id where z.student_uid=uid and z.session_id<>p_session and z.enrolled and z.status in ('present','late') and k.state<>'cancelled' and k.att_date=d and k.opens_at<s.closes_at and s.opens_at<k.closes_at) into overlapping;
 perform public._nfc_session_event(p_session,uid,case when was and r.source='manual' then 'after_manual' when was then 'duplicate' else 'accepted' end);
 if overlapping then perform public._nfc_session_event(p_session,uid,'overlap'); end if;
 return jsonb_build_object('ok',true,'already',was,'name',e.name,'student_id',e.student_id,'status',r.status,'time',to_char(r.first_tag_at at time zone 'Asia/Seoul','HH24:MI:SS'),'title',s.title,'period_label',s.period_label,'daily_unconfirmed',daily is null or daily='unconfirmed','source',r.source,'overlap',overlapping);
end $$;

create function public._nfc_session_report(p_from date,p_to date) returns jsonb language plpgsql stable set search_path=public as $$
declare answer jsonb; begin
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>61 then raise exception '수업 조회 기간은 최대 62일입니다'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.att_date,x.opens_at,x.student_id),'[]') into answer from (
 select s.att_date,s.title,s.period_label,s.state session_state,s.opens_at,s.late_at,s.closes_at,r.* from public.class_sessions s join public.class_records r on r.session_id=s.id where s.att_date between p_from and p_to
 ) x;
 return answer;
end $$;
create function public.nfc_session_report(p_from date,p_to date) returns jsonb language plpgsql security definer set search_path=public as $$
begin perform public._nfc_teacher(); return public._nfc_session_report(p_from,p_to); end $$;
create function public.sync_pull_sessions(p_secret text,p_from date,p_to date) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not coalesce(public._sync_ok(p_secret),false) then raise exception '연결 권한을 확인하세요' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'rows',public._nfc_session_report(p_from,p_to));
end $$;

-- Explicit grants: helpers inaccessible, teacher actions guarded, student endpoints token-scoped.
do $$ declare p record; begin
 for p in select oid::regprocedure signature,proname from pg_proc where pronamespace='public'::regnamespace and proname in ('nfc_class_list','nfc_class_save','nfc_class_pause','_nfc_sessions_ensure','nfc_session_day','nfc_session_detail','nfc_session_save','nfc_session_state','nfc_session_member','nfc_session_correct','nfc_session_history','_nfc_session_event','nfc_attendance_options','nfc_session_check_in','_nfc_session_report','nfc_session_report','sync_pull_sessions') loop
  execute format('revoke all on function %s from public,anon,authenticated',p.signature);
  if left(p.proname,1)<>'_' then
   execute format('grant execute on function %s to authenticated',p.signature);
   if p.proname in ('nfc_attendance_options','nfc_session_check_in','sync_pull_sessions') then execute format('grant execute on function %s to anon',p.signature); end if;
  end if;
 end loop;
end $$;
notify pgrst,'reload schema';

-- Display manual confirmation time independently of the preserved original NFC time.
create or replace function public.nfc_day(p_date date) returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb; begin
 perform public._nfc_teacher();
 select coalesce(jsonb_agg(x||jsonb_build_object('corrected_at',(select max(a.created_at) from public.attendance_audit a where a.student_uid=(x->>'student_uid')::uuid and a.att_date=p_date and a.action='correction' and a.actor is not null)) order by x->>'student_id'),'[]') into answer from jsonb_array_elements(public._nfc_day(p_date)) x;
 return answer;
end $$;
