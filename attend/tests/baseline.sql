-- Local-only snapshot of v1 schema. No production data or credentials.
create role anon;
create role authenticated;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.teachers(user_id uuid primary key references auth.users(id) on delete cascade,email text not null,created_at timestamptz default now());
create table public.students(student_id text primary key,name text not null,grade smallint,class_no smallint,number smallint,reg_code text not null default lpad(floor(random()*1000000)::int::text,6,'0'),device_hash text unique,device_bound_at timestamptz,failed_attempts smallint not null default 0,created_at timestamptz not null default now(),self_registered boolean not null default false);
create table public.attendance(id bigint generated always as identity primary key,student_id text not null references students(student_id) on update cascade on delete cascade,att_date date not null,checked_at timestamptz not null default now(),status text not null check(status in ('present','late','excused')),source text not null default 'nfc' check(source in ('nfc','manual')),distance_m integer,note text,unique(student_id,att_date));
create table public.settings(id integer primary key default 1 check(id=1),open_time time not null default '06:00',deadline time not null default '08:20',close_time time not null default '18:00',geo_required boolean not null default false,school_lat double precision,school_lng double precision,radius_m integer not null default 300,updated_at timestamptz not null default now(),allow_self_signup boolean not null default false,signup_code text,school_name text);
create table public.sync_config(id integer primary key default 1 check(id=1),secret_hash text,created_at timestamptz,last_pull_at timestamptz,last_push_at timestamptz);
insert into public.settings default values;
insert into public.sync_config default values;
alter table public.students enable row level security;
alter table public.attendance enable row level security;
grant usage on schema public,auth to anon,authenticated;
grant all on public.students,public.attendance to authenticated;
