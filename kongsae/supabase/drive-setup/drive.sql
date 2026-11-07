begin;

alter table public.ks_submissions add column drive_pending boolean not null default false;
alter policy ks_submissions_read on public.ks_submissions using (
  not drive_pending and withdrawn_at is null and (
    public.ks_is_teacher(class_id)
    or (author_id = (select auth.uid()) and public.ks_is_member(class_id))
  )
);

-- The queue outlives class and account deletion so Drive cleanup can retry.
create table kongsae_private.drive_jobs (
  submission_id uuid primary key,
  file_ids text[] not null check (cardinality(file_ids) between 1 and 3),
  photo_hashes text[] not null check (cardinality(photo_hashes) = cardinality(file_ids)),
  expires_at timestamptz default (now() + interval '1 hour'),
  delete_after timestamptz
);
create table kongsae_private.drive_tickets (
  token_hash bytea primary key,
  payload_hash text not null,
  expires_at timestamptz not null default (now() + interval '2 minutes')
);
create index ks_drive_cleanup_due on kongsae_private.drive_jobs(delete_after) where delete_after is not null;
create index ks_drive_pending_expiry on kongsae_private.drive_jobs(expires_at) where expires_at is not null;
revoke all on kongsae_private.drive_jobs, kongsae_private.drive_tickets from public, anon, authenticated;

create function kongsae_private.queue_drive_cleanup()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update kongsae_private.drive_jobs j
    set delete_after = coalesce(j.delete_after, now() + interval '10 minutes')
    where j.submission_id = old.id;
  return null;
end;
$$;
revoke all on function kongsae_private.queue_drive_cleanup() from public, anon, authenticated;

create trigger ks_queue_drive_cleanup_after_delete after delete on public.ks_submissions
  for each row execute function kongsae_private.queue_drive_cleanup();
create trigger ks_queue_drive_cleanup_after_withdrawal after update of withdrawn_at on public.ks_submissions
  for each row when (old.withdrawn_at is null and new.withdrawn_at is not null)
  execute function kongsae_private.queue_drive_cleanup();

create function kongsae_private.drive_route(p_actor uuid, p_action text, p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  submission uuid := (p->>'id')::uuid;
  class_id_arg uuid := (p->>'classId')::uuid;
  class_locked boolean;
  student_name text;
  existing public.ks_submissions%rowtype;
  job kongsae_private.drive_jobs%rowtype;
  hashes text[];
  ids text[];
  body_note text := btrim(coalesce(p->>'note',''));
  total_bytes int := (p->>'bytes')::int;
  secret text;
  outcome jsonb;
begin
  if p_action in ('mint','consume') then
    if coalesce(p->>'digest','') !~ '^[0-9a-f]{64}$' then return null; end if;
    if p_action = 'mint' then
      secret := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
      delete from kongsae_private.drive_tickets where expires_at < now();
      insert into kongsae_private.drive_tickets(token_hash,payload_hash)
        values (sha256(convert_to(secret,'UTF8')),p->>'digest');
      return to_jsonb(secret);
    end if;
    if coalesce(p->>'ticket','') !~ '^[0-9a-f]{64}$' then return 'false'::jsonb; end if;
    delete from kongsae_private.drive_tickets
      where token_hash = sha256(convert_to(p->>'ticket','UTF8'))
        and payload_hash = p->>'digest' and expires_at >= now();
    return to_jsonb(found);
  end if;

  if p_action = 'cleanup' then
    update public.ks_submissions s
      set withdrawn_at = now(), note = '', author_name = '', photo_count = 0, byte_size = 0, drive_pending = false
      where s.drive_pending and s.withdrawn_at is null and exists (
        select from kongsae_private.drive_jobs j where j.submission_id = s.id and j.expires_at < now()
      );
    select coalesce(jsonb_agg(jsonb_build_object('id', rows.submission_id, 'ids', rows.file_ids)), '[]'::jsonb)
      into outcome from (
        select submission_id, file_ids from kongsae_private.drive_jobs
        where delete_after <= now() order by delete_after limit 8
      ) rows;
    return outcome;
  end if;

  if p_action = 'ack' then
    delete from kongsae_private.drive_jobs
      where delete_after <= now() and submission_id in (select value::uuid from jsonb_array_elements_text(p->'ids'));
    return 'true'::jsonb;
  end if;

  if p_actor is null or submission is null then return null; end if;
  if p_action = 'get' then
    select s.* into existing from public.ks_submissions s
      where s.id = submission and s.withdrawn_at is null and not s.drive_pending and exists (
        select from public.ks_members m where m.class_id = s.class_id and m.user_id = p_actor
          and (m.role = 'teacher' or s.author_id = p_actor)
      );
    if not found then return null; end if;
    select * into job from kongsae_private.drive_jobs j where j.submission_id = submission and j.delete_after is null;
    if not found then return jsonb_build_object('legacy',true); end if;
    return jsonb_build_object('ids',job.file_ids);
  end if;

  if p_action not in ('reserve','finish') or class_id_arg is null then return null; end if;
  select c.locked into class_locked from public.ks_classes c where c.id = class_id_arg for share;
  if not found then raise exception '참여 중인 반에서만 제출할 수 있어요.'; end if;
  select m.display_name into student_name from public.ks_members m
    where m.class_id = class_id_arg and m.user_id = p_actor and m.role = 'student' for share;
  if not found then raise exception '참여 중인 학생만 제출할 수 있어요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 6439));
  perform pg_advisory_xact_lock(hashtextextended(submission::text, 6438));
  select * into existing from public.ks_submissions s where s.id = submission for update;
  if found and (existing.class_id <> class_id_arg or existing.author_id <> p_actor or existing.withdrawn_at is not null) then
    raise exception '이미 사용한 제출 요청이에요. 사진을 다시 선택해 주세요.';
  end if;

  if existing.id is not null and not existing.drive_pending then
    return jsonb_build_object('state','ready');
  end if;
  if class_locked then raise exception '선생님이 사진 제출을 잠가 두었어요.'; end if;

  select array(select jsonb_array_elements_text(p->'hashes')) into hashes;
  if cardinality(hashes) not between 1 and 3 or char_length(body_note) > 500
     or total_bytes is null or total_bytes not between 5 and 1572864
     or exists (select from unnest(hashes) h where h !~ '^[0-9a-f]{64}$') then
    raise exception '사진과 메모를 다시 확인해 주세요.';
  end if;

  if existing.id is not null then
    select * into job from kongsae_private.drive_jobs j where j.submission_id = submission;
    if not found or job.delete_after is not null or job.expires_at < now() or
        job.photo_hashes <> hashes or existing.note <> body_note or existing.byte_size <> total_bytes then
      raise exception '제출 요청이 만료됐거나 내용이 달라졌어요. 사진을 다시 선택해 주세요.';
    end if;
    if p_action = 'finish' then
      update public.ks_submissions set drive_pending = false where id = submission;
      update kongsae_private.drive_jobs set expires_at = null where submission_id = submission;
      return jsonb_build_object('state','ready');
    end if;
    return jsonb_build_object('state','pending','ids',job.file_ids);
  end if;

  if p_action = 'finish' then raise exception '제출 요청을 찾을 수 없어요.'; end if;
  if (select count(*) from public.ks_submissions s
      where s.author_id = p_actor and s.created_at >= now() - interval '24 hours') >= 30 then
    raise exception '최근 24시간에 사진을 30번 제출했어요. 시간이 지난 뒤 다시 시도해 주세요.';
  end if;
  if not (p ? 'ids') then return jsonb_build_object('state','new'); end if;
  select array(select jsonb_array_elements_text(p->'ids')) into ids;
  if cardinality(ids) <> cardinality(hashes) or exists (
      select from unnest(ids) i where i !~ '^[A-Za-z0-9_-]{10,150}$'
  ) or (select count(distinct i) from unnest(ids) i) <> cardinality(ids) then
    raise exception '드라이브 파일을 준비하지 못했어요. 다시 시도해 주세요.';
  end if;
  insert into public.ks_submissions (id,class_id,author_id,author_name,note,photo_count,byte_size,drive_pending)
    values (submission,class_id_arg,p_actor,student_name,body_note,cardinality(hashes),total_bytes,true);
  insert into kongsae_private.drive_jobs(submission_id,file_ids,photo_hashes)
    values (submission,ids,hashes);
  return jsonb_build_object('state','pending','ids',ids);
end;
$$;

create function public.ks_drive_route(p_actor uuid, p_action text, p jsonb)
returns jsonb
language sql security invoker set search_path = ''
as $$
  select kongsae_private.drive_route(p_actor,p_action,p);
$$;

revoke all on function kongsae_private.drive_route(uuid,text,jsonb),
  public.ks_drive_route(uuid,text,jsonb) from public, anon, authenticated;
grant usage on schema kongsae_private to service_role;
grant execute on function kongsae_private.drive_route(uuid,text,jsonb),
  public.ks_drive_route(uuid,text,jsonb) to service_role;

commit;
