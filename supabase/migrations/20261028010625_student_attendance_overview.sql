-- Show the owner separate daily and per-session results. No attendance is written.
create or replace function public.nfc_attendance_options(p_token text) returns jsonb language plpgsql security definer set search_path=public as $$
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
 return jsonb_build_object('ok',true,'name',e.name,'student_id',e.student_id,'sessions',items,'daily',coalesce((select jsonb_build_object('status',a.status,'checked_at',a.checked_at) from public.attendance a where a.student_uid=uid and a.att_date=d),jsonb_build_object('status','unconfirmed','checked_at',null)));
end $$;
revoke all on function public.nfc_attendance_options(text) from public;
grant execute on function public.nfc_attendance_options(text) to anon,authenticated;
