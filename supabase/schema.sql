-- Relationship Management System™
-- FIXED SUPABASE SCHEMA
--
-- This version avoids infinite-recursion errors in RLS.
-- Run the entire script in Supabase SQL Editor.

create extension if not exists pgcrypto;


-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.relationship_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);


create table if not exists public.dates (
  id uuid primary key default gen_random_uuid(),
  date_on date not null,
  title text not null,
  location text,
  category text not null default 'Other',

  overall_rating numeric(3,1) not null
    check (overall_rating >= 0 and overall_rating <= 10),

  food_rating numeric(3,1)
    check (
      food_rating is null
      or (food_rating >= 0 and food_rating <= 10)
    ),

  activity_rating numeric(3,1)
    check (
      activity_rating is null
      or (activity_rating >= 0 and activity_rating <= 10)
    ),

  romance_rating numeric(3,1)
    check (
      romance_rating is null
      or (romance_rating >= 0 and romance_rating <= 10)
    ),

  thoughts text,
  funny_moment text,

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.date_photos (
  id uuid primary key default gen_random_uuid(),

  date_id uuid not null
    references public.dates(id)
    on delete cascade,

  storage_path text not null,
  caption text,

  uploaded_by uuid not null
    references auth.users(id),

  created_at timestamptz not null default now()
);


create index if not exists dates_date_on_idx
  on public.dates(date_on desc);

create index if not exists date_photos_date_id_idx
  on public.date_photos(date_id);


-- ============================================================
-- RELATIONSHIP MEMBERS
-- ============================================================

-- Insert the two users if they don't already exist.
insert into public.relationship_members (user_id, display_name)
values
  ('03ed33aa-3a1f-4ff2-93a2-a459727c38a7', 'Valle'),
  ('74e12d3a-3f60-43ee-88d4-f7c519adaa22', 'Álvaro')
on conflict (user_id)
do update set display_name = excluded.display_name;


-- ============================================================
-- SECURITY DEFINER FUNCTION
-- ============================================================
--
-- IMPORTANT:
-- This function checks membership without triggering the RLS
-- policy on relationship_members.
--

create or replace function public.is_relationship_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.relationship_members
    where user_id = auth.uid()
  );
$$;


-- Prevent normal users from executing the helper directly.
revoke all on function public.is_relationship_member()
from public;

grant execute on function public.is_relationship_member()
to authenticated;


-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.relationship_members
enable row level security;

alter table public.dates
enable row level security;

alter table public.date_photos
enable row level security;


-- ============================================================
-- REMOVE OLD POLICIES
-- ============================================================

drop policy if exists "members can read members"
on public.relationship_members;

drop policy if exists "Users can view their own membership"
on public.relationship_members;

drop policy if exists "Users can insert their own membership"
on public.relationship_members;


drop policy if exists "members can read dates"
on public.dates;

drop policy if exists "members can create dates"
on public.dates;

drop policy if exists "members can update dates"
on public.dates;

drop policy if exists "members can delete dates"
on public.dates;


drop policy if exists "members can read photos"
on public.date_photos;

drop policy if exists "members can add photos"
on public.date_photos;

drop policy if exists "members can delete photos"
on public.date_photos;


-- ============================================================
-- RELATIONSHIP MEMBERS POLICIES
-- ============================================================
--
-- The important difference:
-- We do NOT query relationship_members inside its own policy.
--

create policy "members can read members"
on public.relationship_members
for select
to authenticated
using (
  user_id = auth.uid()
);


-- ============================================================
-- DATES POLICIES
-- ============================================================

create policy "members can read dates"
on public.dates
for select
to authenticated
using (
  public.is_relationship_member()
);


create policy "members can create dates"
on public.dates
for insert
to authenticated
with check (
  public.is_relationship_member()
  and created_by = auth.uid()
);


create policy "members can update dates"
on public.dates
for update
to authenticated
using (
  public.is_relationship_member()
)
with check (
  public.is_relationship_member()
);


create policy "members can delete dates"
on public.dates
for delete
to authenticated
using (
  public.is_relationship_member()
);


-- ============================================================
-- DATE PHOTO RECORD POLICIES
-- ============================================================

create policy "members can read photos"
on public.date_photos
for select
to authenticated
using (
  public.is_relationship_member()
);


create policy "members can add photos"
on public.date_photos
for insert
to authenticated
with check (
  public.is_relationship_member()
  and uploaded_by = auth.uid()
);


create policy "members can delete photos"
on public.date_photos
for delete
to authenticated
using (
  public.is_relationship_member()
);


-- ============================================================
-- STORAGE BUCKET
-- ============================================================

insert into storage.buckets (id, name, public)
values (
  'date-photos',
  'date-photos',
  false
)
on conflict (id)
do nothing;


-- ============================================================
-- STORAGE POLICIES
-- ============================================================

drop policy if exists "members can read date photos"
on storage.objects;

drop policy if exists "members can upload date photos"
on storage.objects;

drop policy if exists "members can delete date photos"
on storage.objects;


create policy "members can read date photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'date-photos'
  and public.is_relationship_member()
);


create policy "members can upload date photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'date-photos'
  and public.is_relationship_member()
);


create policy "members can delete date photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'date-photos'
  and public.is_relationship_member()
);