-- Preserve arrival and class records; student movement tags do not grant permission.
alter table public.settings add column departure_time time;
alter table public.movements drop constraint movements_kind_check;
alter table public.movements add constraint movements_kind_check check(kind in ('out','return','early','home','void'));
alter table public.movements alter column actor drop not null;
alter table public.movements add column source text not null default 'teacher' check(source in ('teacher','student'));
alter table public.movements add constraint movements_actor_source_check check((source='teacher' and actor is not null) or (source='student' and actor is null));
CREATE OR REPLACE FUNCTION public._nfc_day(p_date date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.student_id),'[]') from (
 select e.*, s.device_bound_at,
 (p_date between e.starts_on and e.ends_on and e.state<>'pending' and public._nfc_school_day(p_date,e.grade)) eligible,
 coalesce(a.status,'unconfirmed') status,a.checked_at,a.source,coalesce(a.version,0) version,a.note,
 case when m.kind='out' then 'out' when m.kind='early' then 'early' when m.kind='home' then 'home' else 'inside' end whereabouts,
 (select id from public.movements where student_uid=e.student_uid and att_date=p_date order by seq desc limit 1) movement_id,m.id effective_movement_id,m.happened_at movement_time,m.expected_return_at,m.source movement_source,
 (m.kind='out' and m.expected_return_at<now()) overdue,
 (select max(tagged_at) from public.nfc_tag_events t where t.student_uid=e.student_uid and t.att_date=p_date and t.status<>'pending') last_exception_tag,
 (select max(tagged_at) from public.nfc_tag_events t where t.student_uid=e.student_uid and t.att_date=p_date and t.status='pending') last_pending_tag
 from public.enrollments e join public.students s using(student_uid)
 left join public.attendance a on a.student_uid=e.student_uid and a.att_date=p_date
 left join lateral public._nfc_current_move(e.student_uid,p_date) m on true
 where e.school_year=public.nfc_year(p_date) and e.state<>'rejected') r
$function$;

CREATE OR REPLACE FUNCTION public.check_in(p_token text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_acc double precision DEFAULT NULL::double precision)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 if (a.status in ('absent','excused') or m.kind in ('out','early','home')) and not exists(select 1 from public.nfc_tag_events where student_uid=s.student_uid and att_date=d and tagged_at>now()-interval '30 seconds') then
  insert into public.nfc_tag_events(student_uid,att_date,status,whereabouts) values(s.student_uid,d,a.status,coalesce(m.kind,'inside'));
 end if;
 return json_build_object('ok',true,'already',was,'name',e.name,'student_id',e.student_id,'status',a.status,
 'time',to_char(a.checked_at at time zone 'Asia/Seoul','HH24:MI:SS'),'deadline',to_char(cfg.deadline,'HH24:MI'),
 'whereabouts',case when m.kind='out' then 'out' when m.kind='early' then 'early' when m.kind='home' then 'home' else 'inside' end);
end $function$;

CREATE OR REPLACE FUNCTION public.get_public_settings()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'school_name', school_name,
    'geo_required', geo_required,
    'allow_self_signup', allow_self_signup and coalesce(signup_code, '') <> '',
    'open_time', to_char(open_time, 'HH24:MI'),
    'deadline',  to_char(deadline,  'HH24:MI'),
    'close_time', to_char(close_time, 'HH24:MI'),
    'departure_time', to_char(departure_time, 'HH24:MI'))
  from public.settings where id = 1;
$function$;

CREATE OR REPLACE FUNCTION public.nfc_attendance_options(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 return jsonb_build_object('ok',true,'name',e.name,'student_id',e.student_id,'sessions',items,'att_date',d,
 'movement_id',(select id from public.movements where student_uid=uid and att_date=d order by seq desc limit 1),
 'movement',(select jsonb_build_object('kind',m.kind,'happened_at',m.happened_at,'expected_return_at',m.expected_return_at,'source',m.source) from public._nfc_current_move(uid,d) m),
 'movements',coalesce((select jsonb_agg(jsonb_build_object('kind',m.kind,'happened_at',m.happened_at,'source',m.source,'voided',exists(select 1 from public.movements v where v.voids_id=m.id)) order by m.seq) from public.movements m where m.student_uid=uid and m.att_date=d),'[]'),
 'daily',coalesce((select jsonb_build_object('status',a.status,'checked_at',a.checked_at) from public.attendance a where a.student_uid=uid and a.att_date=d),jsonb_build_object('status','unconfirmed','checked_at',null)));
end $function$;

CREATE OR REPLACE FUNCTION public.nfc_move(p_uid uuid, p_date date, p_kind text, p_at timestamp with time zone, p_expected timestamp with time zone, p_reason text, p_previous uuid, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 if p_kind is null or p_kind not in ('out','return','early','home','void') or length(trim(coalesce(p_reason,''))) not between 1 and 200 then raise exception '이동 종류와 사유를 확인하세요'; end if;
 select * into a from public.attendance where student_uid=p_uid and att_date=p_date;
 if not found or a.status not in ('present','late') then raise exception '먼저 출석 또는 지각을 확인하세요'; end if;
 select * into prev from public.movements where student_uid=p_uid and att_date=p_date order by seq desc limit 1;
 if prev.id is distinct from p_previous then raise exception '이동 상태가 바뀌었습니다. 새로고침하세요'; end if;
 select * into eff from public._nfc_current_move(p_uid,p_date);
 if p_kind<>'void' and a.checked_at is not null and date_trunc('minute',a.checked_at)>p_at then raise exception '등교 시각 이후의 이동을 입력하세요'; end if;
 if p_kind<>'void' and eff.happened_at>p_at then raise exception '이전 이동 이후 시각을 입력하세요'; end if;
 if p_kind<>'void' and eff.kind in ('early','home') then raise exception '조퇴·하교 이후에는 교사가 직전 이동을 취소한 뒤 다시 처리하세요'; end if;
 if p_kind='home' and coalesce(eff.kind,'inside')='out' then raise exception '외출 복귀를 먼저 확인하세요'; end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.nfc_session_check_in(p_token text, p_session uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_acc double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if m.kind in ('out','early','home') then failure:='movement_'||m.kind;
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
 perform public._nfc_session_event(p_session,uid,case when was and r.source='manual' then 'after_manual' when overlapping then 'overlap' when was then 'duplicate' else 'accepted' end);
 return jsonb_build_object('ok',true,'already',was,'name',e.name,'student_id',e.student_id,'status',r.status,'time',to_char(r.first_tag_at at time zone 'Asia/Seoul','HH24:MI:SS'),'title',s.title,'period_label',s.period_label,'daily_unconfirmed',daily is null or daily='unconfirmed','source',r.source,'overlap',overlapping);
end $function$;

CREATE OR REPLACE FUNCTION public.nfc_session_detail(p_session uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.class_sessions%rowtype; rows jsonb; begin
 perform public._nfc_teacher(); select * into s from public.class_sessions where id=p_session;
 if not found then raise exception '수업 회차가 없습니다'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('daily_status',coalesce(a.status,'unconfirmed'),'whereabouts',case when m.kind in ('out','early','home') then m.kind else 'inside' end,'movement_time',m.happened_at,
 'overlap_attendance',r.enrolled and r.status in ('present','late') and s.state<>'cancelled' and exists(select 1 from public.class_records z join public.class_sessions k on k.id=z.session_id where z.student_uid=r.student_uid and z.session_id<>s.id and z.enrolled and z.status in ('present','late') and k.state<>'cancelled' and k.att_date=s.att_date and k.opens_at<s.closes_at and s.opens_at<k.closes_at),
 'roster_warning',not coalesce(e.state not in ('pending','rejected') and s.att_date between e.starts_on and e.ends_on and (s.allow_non_school_day or public._nfc_school_day(s.att_date,e.grade)),false),
 'last_attempt',(select jsonb_build_object('result',ev.result,'at',ev.tagged_at) from public.class_tag_events ev where ev.session_id=s.id and ev.student_uid=r.student_uid and ev.result not in ('accepted','duplicate') order by ev.id desc limit 1)) order by r.student_id),'[]') into rows
 from public.class_records r left join public.enrollments e on e.student_uid=r.student_uid and e.school_year=public.nfc_year(s.att_date)
 left join public.attendance a on a.student_uid=r.student_uid and a.att_date=s.att_date
 left join lateral public._nfc_current_move(r.student_uid,s.att_date) m on true where r.session_id=p_session;
 return jsonb_build_object('session',to_jsonb(s),'rows',rows);
end $function$;

-- This endpoint identifies only the token owner; no client-supplied student/time/actor.
create function public.nfc_student_move(p_token text,p_kind text,p_expected timestamptz,p_reason text,p_previous uuid,p_request uuid,p_lat double precision default null,p_lng double precision default null,p_acc double precision default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid; e public.enrollments%rowtype; a public.attendance%rowtype; cfg public.settings%rowtype; m public.movements%rowtype; prev public.movements%rowtype; eff public.movements%rowtype;
 d date:=(now() at time zone 'Asia/Seoul')::date; t time:=(now() at time zone 'Asia/Seoul')::time; dist double precision;
begin
 perform pg_advisory_xact_lock(7212026);
 if p_token is null or length(p_token) not between 32 and 256 then return jsonb_build_object('ok',false,'error','unknown_device'); end if;
 select student_uid into uid from public.students where device_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if uid is null then return jsonb_build_object('ok',false,'error','unknown_device'); end if;
 select * into e from public.enrollments where student_uid=uid and school_year=public.nfc_year(d);
 if not found or e.state='rejected' or d not between e.starts_on and e.ends_on then return jsonb_build_object('ok',false,'error','inactive'); end if;
 if e.state='pending' then return jsonb_build_object('ok',false,'error','pending'); end if;
 if p_kind is null or p_kind not in ('out','return','early','home') or p_request is null or length(trim(coalesce(p_reason,''))) not between 1 and 200 then return jsonb_build_object('ok',false,'error','bad_input'); end if;
 select * into m from public.movements where id=p_request;
 if found then
  if m.student_uid<>uid or m.att_date<>d or m.kind<>p_kind or m.source<>'student' or m.reason is distinct from trim(p_reason) or m.expected_return_at is distinct from p_expected then return jsonb_build_object('ok',false,'error','request_conflict'); end if;
  return jsonb_build_object('ok',true,'already',true,'kind',m.kind,'time',to_char(m.happened_at at time zone 'Asia/Seoul','HH24:MI:SS'),'name',e.name,'student_id',e.student_id);
 end if;
 if not public._nfc_school_day(d,e.grade) then return jsonb_build_object('ok',false,'error','not_school_day'); end if;
 select * into a from public.attendance where student_uid=uid and att_date=d;
 if not found or a.status not in ('present','late') then return jsonb_build_object('ok',false,'error','arrival_required'); end if;
 select * into prev from public.movements where student_uid=uid and att_date=d order by seq desc limit 1;
 if prev.id is distinct from p_previous then return jsonb_build_object('ok',false,'error','state_changed'); end if;
 select * into eff from public._nfc_current_move(uid,d);
 if eff.kind in ('early','home') or (p_kind in ('out','home') and eff.kind='out') then return jsonb_build_object('ok',false,'error','movement_locked'); end if;
 if p_kind='return' and coalesce(eff.kind,'inside')<>'out' then return jsonb_build_object('ok',false,'error','not_out'); end if;
 if p_kind='out' and (p_expected is null or p_expected<=now() or (p_expected at time zone 'Asia/Seoul')::date<>d) then return jsonb_build_object('ok',false,'error','expected_return_required'); end if;
 if p_kind<>'out' and p_expected is not null then return jsonb_build_object('ok',false,'error','bad_input'); end if;
 if a.checked_at>now() or eff.happened_at>now() then return jsonb_build_object('ok',false,'error','state_changed'); end if;
 select * into cfg from public.settings where id=1;
 if p_kind='home' then
  if cfg.departure_time is null then return jsonb_build_object('ok',false,'error','departure_not_configured'); end if;
  if t<cfg.departure_time then return jsonb_build_object('ok',false,'error','before_departure','departure_time',to_char(cfg.departure_time,'HH24:MI')); end if;
 end if;
 if cfg.geo_required then
  if cfg.school_lat is null or cfg.school_lng is null then return jsonb_build_object('ok',false,'error','geo_not_configured'); end if;
  if p_lat is null or p_lng is null or not(p_lat between -90 and 90 and p_lng between -180 and 180) or (p_acc is not null and not(p_acc>=0 and p_acc<100000)) then return jsonb_build_object('ok',false,'error','need_location'); end if;
  dist:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(p_lat-cfg.school_lat)/2),2)+cos(radians(cfg.school_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-cfg.school_lng)/2),2))));
  if dist>cfg.radius_m+least(coalesce(p_acc,0),150) then return jsonb_build_object('ok',false,'error','too_far','distance',round(dist)); end if;
 end if;
 insert into public.movements(id,student_uid,att_date,kind,happened_at,expected_return_at,reason,actor,source)
 values(p_request,uid,d,p_kind,now(),p_expected,trim(p_reason),null,'student') returning * into m;
 insert into public.attendance_audit(student_uid,att_date,action,before_value,after_value,reason,actor)
 values(uid,d,'movement',case when prev.id is null then null else to_jsonb(prev) end,to_jsonb(m),trim(p_reason),null);
 return jsonb_build_object('ok',true,'already',false,'kind',m.kind,'time',to_char(m.happened_at at time zone 'Asia/Seoul','HH24:MI:SS'),'name',e.name,'student_id',e.student_id);
end $$;
revoke all on function public.nfc_student_move(text,text,timestamptz,text,uuid,uuid,double precision,double precision,double precision) from public,anon,authenticated;
grant execute on function public.nfc_student_move(text,text,timestamptz,text,uuid,uuid,double precision,double precision,double precision) to anon,authenticated;
