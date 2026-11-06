begin;

create table public.ks_submissions (
  id uuid primary key,
  class_id uuid not null references public.ks_classes(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  note text not null check (char_length(note) <= 500),
  photo_count smallint not null,
  byte_size integer not null,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  check (
    (withdrawn_at is null and photo_count between 1 and 3 and byte_size between 5 and 1572864)
    or (withdrawn_at is not null and photo_count = 0 and byte_size = 0 and note = '' and author_name = '')
  )
);

create index ks_submissions_class_created_idx
  on public.ks_submissions (class_id, created_at desc, id desc);
create index ks_submissions_author_idx on public.ks_submissions (author_id);

create table public.ks_submission_photos (
  submission_id uuid not null references public.ks_submissions(id) on delete cascade,
  photo_number smallint not null check (photo_number between 1 and 3),
  photo bytea not null check (
    octet_length(photo) between 5 and 524288
    and substring(photo, 1, 3) = decode('ffd8ff', 'hex')
    and substring(photo, octet_length(photo) - 1, 2) = decode('ffd9', 'hex')
  ),
  primary key (submission_id, photo_number)
);

alter table public.ks_submissions enable row level security;
alter table public.ks_submission_photos enable row level security;
revoke all on public.ks_submissions, public.ks_submission_photos from public, anon, authenticated;

grant select (id, class_id, author_id, author_name, note, photo_count, created_at)
  on public.ks_submissions to authenticated;

create policy ks_submissions_read on public.ks_submissions
  for select to authenticated using (
    withdrawn_at is null and (public.ks_is_teacher(class_id)
      or (author_id = (select auth.uid()) and public.ks_is_member(class_id)))
  );

create function public.ks_submit_photos(p_class uuid, p_id uuid, p_note text, p_photos text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  author text;
  locked boolean;
  note text := btrim(coalesce(p_note, ''));
  item text;
  image bytea;
  images bytea[] := array[]::bytea[];
  bytes integer := 0;
  total_bytes bigint;
  class_bytes bigint;
  actor_bytes bigint;
  previous public.ks_submissions%rowtype;
begin
  if actor is null or p_class is null or p_id is null then
    raise exception '로그인과 반 정보를 확인해 주세요.' using errcode = 'P0001';
  end if;
  if char_length(note) > 500 or coalesce(cardinality(p_photos), 0) not between 1 and 3
      or array_ndims(p_photos) is distinct from 1 then
    raise exception '사진 1~3장과 500자 이하의 메모를 제출할 수 있어요.' using errcode = 'P0001';
  end if;

  -- Coordinate with class deletion, membership removal and write-lock changes.
  select c.locked into locked from public.ks_classes c where c.id = p_class for share;
  select m.display_name into author from public.ks_members m
    where m.class_id = p_class and m.user_id = actor and m.role = 'student' for share;
  if not found then
    raise exception '이 반에 참여 중인 학생만 제출할 수 있어요.' using errcode = 'P0001';
  end if;

  -- Serialize quota checks and retries, including retries from another tab.
  perform pg_advisory_xact_lock(192787031, 1);
  select * into previous from public.ks_submissions s where s.id = p_id;
  if found then
    if previous.class_id <> p_class or previous.author_id <> actor or previous.withdrawn_at is not null then
      raise exception '이미 사용한 제출 요청이에요. 새로 선택해서 제출해 주세요.' using errcode = 'P0001';
    end if;
    return p_id;
  end if;
  if locked then
    raise exception '선생님이 글쓰기와 사진 제출을 잠가 두었어요.' using errcode = 'P0001';
  end if;

  foreach item in array p_photos loop
    if item is null or char_length(item) > 699052
        or item !~ '^[A-Za-z0-9+/]+={0,2}$' then
      raise exception '사진 형식이나 용량을 확인해 주세요.' using errcode = 'P0001';
    end if;
    begin
      image := decode(item, 'base64');
    exception when invalid_parameter_value then
      raise exception '사진 형식이나 용량을 확인해 주세요.' using errcode = 'P0001';
    end;
    if octet_length(image) not between 5 and 524288
        or substring(image, 1, 3) <> decode('ffd8ff', 'hex')
        or substring(image, octet_length(image) - 1, 2) <> decode('ffd9', 'hex') then
      raise exception '사진은 JPEG 형식으로 장당 512KB까지 저장할 수 있어요.' using errcode = 'P0001';
    end if;
    bytes := bytes + octet_length(image);
    images := array_append(images, image);
  end loop;

  select coalesce(sum(s.byte_size), 0),
         coalesce(sum(s.byte_size) filter (where s.class_id = p_class), 0),
         coalesce(sum(s.byte_size) filter (where s.author_id = actor), 0)
    into total_bytes, class_bytes, actor_bytes from public.ks_submissions s where s.withdrawn_at is null;
  if total_bytes + bytes > 104857600 then
    raise exception '콩새의 사진 저장 공간이 가득 찼어요. 선생님에게 알려 주세요.' using errcode = 'P0001';
  end if;
  if class_bytes + bytes > 41943040 then
    raise exception '이 반의 사진 저장 공간이 가득 찼어요. 선생님에게 알려 주세요.' using errcode = 'P0001';
  end if;
  if actor_bytes + bytes > 12582912 then
    raise exception '내 사진 저장 공간이 가득 찼어요. 필요 없는 제출물을 취소한 뒤 다시 시도해 주세요.' using errcode = 'P0001';
  end if;

  insert into public.ks_submissions (id, class_id, author_id, author_name, note, photo_count, byte_size)
    values (p_id, p_class, actor, author, note, cardinality(images), bytes);
  insert into public.ks_submission_photos (submission_id, photo_number, photo)
    select p_id, n, data from unnest(images) with ordinality as photos(data, n);
  return p_id;
end;
$$;

create function public.ks_submission_images(p_submission uuid)
returns table (photo_number smallint, jpeg text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.photo_number, replace(encode(i.photo, 'base64'), E'\n', '')
  from public.ks_submission_photos i
  join public.ks_submissions s on s.id = i.submission_id
  where s.id = p_submission and s.withdrawn_at is null and (select auth.uid()) is not null and (
    public.ks_is_teacher(s.class_id)
    or (s.author_id = (select auth.uid()) and public.ks_is_member(s.class_id))
  )
  order by i.photo_number;
$$;

create function public.ks_withdraw_submission(p_submission uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(192787031, 1);
  update public.ks_submissions s
    set withdrawn_at = coalesce(s.withdrawn_at, now()), note = '', author_name = '', photo_count = 0, byte_size = 0
    where s.id = p_submission and s.author_id = (select auth.uid()) and public.ks_is_member(s.class_id);
  if not found then
    raise exception '이 반에 참여 중인 작성자만 제출을 취소할 수 있어요.' using errcode = 'P0001';
  end if;
  delete from public.ks_submission_photos where submission_id = p_submission;
end;
$$;

revoke all on function public.ks_submit_photos(uuid, uuid, text, text[]),
  public.ks_submission_images(uuid), public.ks_withdraw_submission(uuid) from public, anon, authenticated;
grant execute on function public.ks_submit_photos(uuid, uuid, text, text[]),
  public.ks_submission_images(uuid), public.ks_withdraw_submission(uuid) to authenticated;

commit;
