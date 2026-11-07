begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create function kongsae_private.drive_cleanup_tick()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  ticket text;
  digest text := encode(sha256(convert_to('kongsae-drive-cleanup-v1','UTF8')),'hex');
begin
  if not exists (select from kongsae_private.drive_jobs j where j.delete_after <= now()
    or (j.delete_after is null and j.expires_at < now() and exists (
      select from public.ks_submissions s where s.id=j.submission_id and s.drive_pending
    ))) then return; end if;
  ticket := kongsae_private.drive_route(null,'mint',jsonb_build_object('digest',digest)) #>> '{}';
  perform net.http_post(
    url := 'https://emynsoshduocpermxlfg.supabase.co/functions/v1/ks-drive?action=cleanup',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('ticket',ticket),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function kongsae_private.drive_cleanup_tick() from public, anon, authenticated;
select cron.schedule('kongsae-drive-cleanup','*/10 * * * *',$cron$select kongsae_private.drive_cleanup_tick()$cron$);

commit;
