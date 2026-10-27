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
    'close_time', to_char(close_time, 'HH24:MI'))
  from public.settings where id = 1;
$function$
;
CREATE OR REPLACE FUNCTION public.check_in(p_token text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_acc double precision DEFAULT NULL::double precision)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s public.students%rowtype; cfg public.settings%rowtype; a public.attendance%rowtype;
  v_now timestamp; v_date date; v_time time; v_dist double precision; v_status text;
begin
  select * into s from public.students
   where device_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if not found then return json_build_object('ok', false, 'error', 'unknown_device'); end if;

  select * into cfg from public.settings where id = 1;
  v_now := now() at time zone 'Asia/Seoul';
  v_date := v_now::date; v_time := v_now::time;

  select * into a from public.attendance where student_id = s.student_id and att_date = v_date;
  if found then
    return json_build_object('ok', true, 'already', true, 'name', s.name, 'student_id', s.student_id,
      'status', a.status, 'time', to_char(a.checked_at at time zone 'Asia/Seoul', 'HH24:MI:SS'));
  end if;

  if v_time < cfg.open_time or v_time > cfg.close_time then
    return json_build_object('ok', false, 'error', 'closed', 'name', s.name,
      'open_time', to_char(cfg.open_time, 'HH24:MI'), 'close_time', to_char(cfg.close_time, 'HH24:MI'));
  end if;

  if cfg.geo_required then
    if cfg.school_lat is null or cfg.school_lng is null then
      return json_build_object('ok', false, 'error', 'geo_not_configured', 'name', s.name);
    end if;
    if p_lat is null or p_lng is null then
      return json_build_object('ok', false, 'error', 'need_location', 'name', s.name);
    end if;
    v_dist := 6371000 * 2 * asin(sqrt(
        power(sin(radians(p_lat - cfg.school_lat) / 2), 2)
      + cos(radians(cfg.school_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - cfg.school_lng) / 2), 2)));
    if v_dist > cfg.radius_m + least(coalesce(p_acc, 0), 150) then
      return json_build_object('ok', false, 'error', 'too_far', 'name', s.name, 'distance', round(v_dist));
    end if;
  end if;

  v_status := case when v_time < cfg.deadline + interval '1 minute' then 'present' else 'late' end;
  insert into public.attendance(student_id, att_date, status, distance_m)
  values (s.student_id, v_date, v_status, round(v_dist))
  on conflict (student_id, att_date) do nothing
  returning * into a;
  if not found then
    select * into a from public.attendance where student_id = s.student_id and att_date = v_date;
    return json_build_object('ok', true, 'already', true, 'name', s.name, 'student_id', s.student_id,
      'status', a.status, 'time', to_char(a.checked_at at time zone 'Asia/Seoul', 'HH24:MI:SS'));
  end if;
  return json_build_object('ok', true, 'already', false, 'name', s.name, 'student_id', s.student_id,
    'status', a.status, 'time', to_char(a.checked_at at time zone 'Asia/Seoul', 'HH24:MI:SS'),
    'deadline', to_char(cfg.deadline, 'HH24:MI'));
end $function$
;
CREATE OR REPLACE FUNCTION public.is_teacher()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.teachers where user_id = auth.uid());
$function$
;
CREATE OR REPLACE FUNCTION public.claim_first_teacher()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.teachers where user_id = auth.uid()) then return true; end if;
  lock table public.teachers in exclusive mode;
  if exists (select 1 from public.teachers) then return false; end if;
  insert into public.teachers(user_id, email) values (auth.uid(), auth.jwt()->>'email');
  return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.add_teacher(p_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v uuid;
begin
  if not public.is_teacher() then return json_build_object('ok', false, 'error', 'not_allowed'); end if;
  select id into v from auth.users where lower(email) = lower(trim(p_email));
  if v is null then return json_build_object('ok', false, 'error', 'user_not_found'); end if;
  insert into public.teachers(user_id, email) values (v, lower(trim(p_email))) on conflict do nothing;
  return json_build_object('ok', true);
end $function$
;
CREATE OR REPLACE FUNCTION public.register_device(p_student_id text, p_name text, p_code text, p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.students%rowtype; cfg public.settings%rowtype; v_hash text; v_id text; v_name text;
begin
  if p_token is null or length(p_token) < 32 then
    return json_build_object('ok', false, 'error', 'bad_token');
  end if;
  v_id := trim(p_student_id); v_name := trim(p_name);
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select * into s from public.students where student_id = v_id for update;

  -- 명단에 없는 학번
  if not found then
    select * into cfg from public.settings where id = 1;
    if not cfg.allow_self_signup or coalesce(cfg.signup_code, '') = '' then
      return json_build_object('ok', false, 'error', 'not_on_roster');
    end if;
    if v_id !~ '^\d{3,10}$' or length(v_name) < 2 or length(v_name) > 20 then
      return json_build_object('ok', false, 'error', 'bad_input');
    end if;
    if trim(p_code) <> cfg.signup_code then
      return json_build_object('ok', false, 'error', 'bad_signup_code');
    end if;
    if exists (select 1 from public.students where device_hash = v_hash) then
      return json_build_object('ok', false, 'error', 'device_in_use');
    end if;
    insert into public.students(student_id, name, grade, class_no, number, self_registered, device_hash, device_bound_at)
    values (v_id, v_name,
      case when length(v_id) = 5 then substr(v_id,1,1)::smallint end,
      case when length(v_id) = 5 then substr(v_id,2,2)::smallint end,
      case when length(v_id) = 5 then substr(v_id,4,2)::smallint end,
      true, v_hash, now());
    return json_build_object('ok', true, 'student_id', v_id, 'name', v_name, 'self_registered', true);
  end if;

  -- 명단에 있는 학번: 개인 등록코드 필요
  if s.failed_attempts >= 5 then return json_build_object('ok', false, 'error', 'locked'); end if;
  if s.name <> v_name or s.reg_code <> trim(p_code) then
    update public.students set failed_attempts = failed_attempts + 1 where student_id = s.student_id;
    return json_build_object('ok', false, 'error', 'mismatch', 'left', 4 - s.failed_attempts);
  end if;
  if s.device_hash is not null then
    return json_build_object('ok', false, 'error', 'already_bound');
  end if;
  if exists (select 1 from public.students where device_hash = v_hash) then
    return json_build_object('ok', false, 'error', 'device_in_use');
  end if;
  update public.students
     set device_hash = v_hash, device_bound_at = now(), failed_attempts = 0
   where student_id = s.student_id;
  return json_build_object('ok', true, 'student_id', s.student_id, 'name', s.name);
end $function$
;
CREATE OR REPLACE FUNCTION public._sync_ok(p_secret text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(length(p_secret) >= 32, false) and exists (
    select 1 from public.sync_config
     where id = 1 and secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex'));
$function$
;
CREATE OR REPLACE FUNCTION public.create_sync_secret()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v text;
begin
  if not public.is_teacher() then return json_build_object('ok', false, 'error', 'not_allowed'); end if;
  v := encode(extensions.gen_random_bytes(24), 'hex');
  update public.sync_config set secret_hash = encode(extensions.digest(v, 'sha256'), 'hex'), created_at = now() where id = 1;
  return json_build_object('ok', true, 'secret', v);
end $function$
;
CREATE OR REPLACE FUNCTION public.sync_status()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when public.is_teacher() then json_build_object(
    'connected', secret_hash is not null, 'created_at', created_at,
    'last_pull_at', last_pull_at, 'last_push_at', last_push_at) end
  from public.sync_config where id = 1;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_pull(p_secret text, p_from date, p_to date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r json;
begin
  if not public._sync_ok(p_secret) then return json_build_object('ok', false, 'error', 'bad_secret'); end if;
  if p_to - p_from > 400 then return json_build_object('ok', false, 'error', 'range_too_long'); end if;
  update public.sync_config set last_pull_at = now() where id = 1;
  select json_build_object('ok', true,
    'school_name', (select school_name from public.settings where id = 1),
    'students', coalesce((select json_agg(json_build_object(
        'student_id', student_id, 'name', name, 'grade', grade, 'class_no', class_no, 'number', number,
        'reg_code', reg_code, 'bound', device_hash is not null, 'locked', failed_attempts >= 5,
        'self_registered', self_registered) order by student_id) from public.students), '[]'::json),
    'attendance', coalesce((select json_agg(json_build_object(
        'date', att_date, 'student_id', student_id, 'status', status, 'source', source,
        'time', to_char(checked_at at time zone 'Asia/Seoul', 'HH24:MI:SS')) order by att_date, student_id)
      from public.attendance where att_date between p_from and p_to), '[]'::json))
  into r;
  return r;
end $function$
;
CREATE OR REPLACE FUNCTION public.sync_push_roster(p_secret text, p_rows json)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n_up int := 0; n_bad int := 0; rec json; v_id text; v_name text;
begin
  if not public._sync_ok(p_secret) then return json_build_object('ok', false, 'error', 'bad_secret'); end if;
  if json_array_length(p_rows) > 5000 then return json_build_object('ok', false, 'error', 'too_many'); end if;
  for rec in select * from json_array_elements(p_rows) loop
    v_id := trim(rec->>'student_id'); v_name := trim(rec->>'name');
    if coalesce(v_id, '') !~ '^\d{3,10}$' or coalesce(v_name, '') = '' or length(v_name) > 40 then n_bad := n_bad + 1; continue; end if;
    insert into public.students(student_id, name, grade, class_no, number, self_registered)
    values (v_id, v_name,
      case when length(v_id) = 5 then substr(v_id,1,1)::smallint end,
      case when length(v_id) = 5 then substr(v_id,2,2)::smallint end,
      case when length(v_id) = 5 then substr(v_id,4,2)::smallint end, false)
    on conflict (student_id) do update
      set name = excluded.name, grade = excluded.grade, class_no = excluded.class_no,
          number = excluded.number, self_registered = false;
    n_up := n_up + 1;
  end loop;
  update public.sync_config set last_push_at = now() where id = 1;
  return json_build_object('ok', true, 'upserted', n_up, 'skipped', n_bad);
end $function$
;
