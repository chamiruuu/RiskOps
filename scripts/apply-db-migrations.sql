-- =============================================================================
-- RiskOps: Apply missing migrations to live Supabase project
-- Run this in: https://supabase.com/dashboard/project/zcwqwzrphbmxgvlduqeh/sql/new
-- Safe to re-run (all statements are idempotent).
-- =============================================================================

-- ─── 1. logic_health_events table + RLS ──────────────────────────────────────

create table if not exists public.logic_health_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  code text not null,
  title text not null,
  detail text not null,
  level text not null check (level in ('error', 'warning', 'success', 'info')),
  source text not null default 'ui',
  correlation_id text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_logic_health_events_created_at
  on public.logic_health_events (created_at desc);

create index if not exists idx_logic_health_events_code_created_at
  on public.logic_health_events (code, created_at desc);

alter table public.logic_health_events enable row level security;

drop policy if exists "logic_health_events_select" on public.logic_health_events;
create policy "logic_health_events_select"
  on public.logic_health_events
  for select
  to authenticated
  using (true);

drop policy if exists "logic_health_events_insert" on public.logic_health_events;
create policy "logic_health_events_insert"
  on public.logic_health_events
  for insert
  to authenticated
  with check (auth.uid() is not null);

-- ─── 2. Security-definer helper functions ────────────────────────────────────

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_work_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.work_name
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.is_admin_or_leader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('Admin', 'Leader'), false)
$$;

-- Fixes the 404: list_profile_directory RPC
create or replace function public.list_profile_directory()
returns table (id uuid, work_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.work_name
  from public.profiles p
  order by coalesce(p.work_name, ''), p.id
$$;

-- Restrict execution to authenticated users only
revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_work_name() from public;
revoke all on function public.is_admin_or_leader() from public;
revoke all on function public.list_profile_directory() from public;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_work_name() to authenticated;
grant execute on function public.is_admin_or_leader() to authenticated;
grant execute on function public.list_profile_directory() to authenticated;

-- ─── 3. profiles RLS (uses is_admin_or_leader helper above) ─────────────────

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;
    alter table public.profiles force row level security;

    drop policy if exists "profiles_select_self_or_admin" on public.profiles;
    drop policy if exists "profiles_insert_admin_only" on public.profiles;
    drop policy if exists "profiles_update_admin_only" on public.profiles;
    drop policy if exists "profiles_delete_admin_only" on public.profiles;

    create policy "profiles_select_self_or_admin"
      on public.profiles
      for select
      to authenticated
      using (id = auth.uid() or public.is_admin_or_leader());

    create policy "profiles_insert_admin_only"
      on public.profiles
      for insert
      to authenticated
      with check (public.is_admin_or_leader());

    create policy "profiles_update_admin_only"
      on public.profiles
      for update
      to authenticated
      using (public.is_admin_or_leader())
      with check (public.is_admin_or_leader());

    create policy "profiles_delete_admin_only"
      on public.profiles
      for delete
      to authenticated
      using (public.is_admin_or_leader());
  end if;
end $$;

-- ─── 4. shift_assignments RLS ────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.shift_assignments') is not null then
    alter table public.shift_assignments enable row level security;
    alter table public.shift_assignments force row level security;

    drop policy if exists "shift_assignments_select_authenticated" on public.shift_assignments;
    drop policy if exists "shift_assignments_insert_admin" on public.shift_assignments;
    drop policy if exists "shift_assignments_update_admin" on public.shift_assignments;
    drop policy if exists "shift_assignments_delete_admin" on public.shift_assignments;

    create policy "shift_assignments_select_authenticated"
      on public.shift_assignments
      for select
      to authenticated
      using (auth.uid() is not null);

    create policy "shift_assignments_insert_admin"
      on public.shift_assignments
      for insert
      to authenticated
      with check (public.is_admin_or_leader());

    create policy "shift_assignments_update_admin"
      on public.shift_assignments
      for update
      to authenticated
      using (public.is_admin_or_leader())
      with check (public.is_admin_or_leader());

    create policy "shift_assignments_delete_admin"
      on public.shift_assignments
      for delete
      to authenticated
      using (public.is_admin_or_leader());
  end if;
end $$;
