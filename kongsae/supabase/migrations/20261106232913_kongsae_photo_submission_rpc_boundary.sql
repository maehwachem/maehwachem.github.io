begin;

-- Expose only invoker RPCs in the Data API. Privileged implementations
-- retain their original narrow grants and membership checks.
create schema kongsae_private;
revoke all on schema kongsae_private from public, anon, authenticated;
grant usage on schema kongsae_private to authenticated;

alter function public.ks_submit_photos(uuid, uuid, text, text[]) set schema kongsae_private;
alter function public.ks_submission_images(uuid) set schema kongsae_private;
alter function public.ks_withdraw_submission(uuid) set schema kongsae_private;

create function public.ks_submit_photos(p_class uuid, p_id uuid, p_note text, p_photos text[])
returns uuid
language sql security invoker set search_path = ''
as $$
  select kongsae_private.ks_submit_photos(p_class, p_id, p_note, p_photos);
$$;

create function public.ks_submission_images(p_submission uuid)
returns table (photo_number smallint, jpeg text)
language sql stable security invoker set search_path = ''
as $$
  select photos.photo_number, photos.jpeg
  from kongsae_private.ks_submission_images(p_submission) as photos;
$$;

create function public.ks_withdraw_submission(p_submission uuid)
returns void
language sql security invoker set search_path = ''
as $$
  select kongsae_private.ks_withdraw_submission(p_submission);
$$;

revoke all on function public.ks_submit_photos(uuid, uuid, text, text[]),
  public.ks_submission_images(uuid), public.ks_withdraw_submission(uuid) from public, anon, authenticated;
grant execute on function public.ks_submit_photos(uuid, uuid, text, text[]),
  public.ks_submission_images(uuid), public.ks_withdraw_submission(uuid) to authenticated;

commit;
