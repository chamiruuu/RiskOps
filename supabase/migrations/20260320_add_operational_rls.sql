-- Security hardening for operational tables touched by authenticated users.
-- This migration intentionally keeps collaborative ticket editing working,
-- while moving profile access behind stricter self/admin rules.

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

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_work_name() from public;
revoke all on function public.is_admin_or_leader() from public;
revoke all on function public.list_profile_directory() from public;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_work_name() to authenticated;
grant execute on function public.is_admin_or_leader() to authenticated;
grant execute on function public.list_profile_directory() to authenticated;

do $$
declare
  tickets_insert_check text := 'auth.uid() is not null';
  tickets_update_check text := 'public.is_admin_or_leader() or (auth.uid() is not null';
begin
  if to_regclass('public.tickets') is not null then
    alter table public.tickets enable row level security;
    alter table public.tickets force row level security;

    drop policy if exists "tickets_select_authenticated" on public.tickets;
    drop policy if exists "tickets_insert_authenticated" on public.tickets;
    drop policy if exists "tickets_update_authenticated" on public.tickets;
    drop policy if exists "tickets_delete_admin" on public.tickets;
    drop policy if exists "tickets_delete_authenticated" on public.tickets;
    drop policy if exists "tickets_read_policy" on public.tickets;
    drop policy if exists "tickets_create_policy" on public.tickets;
    drop policy if exists "tickets_update_policy" on public.tickets;
    drop policy if exists "tickets_delete_policy" on public.tickets;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'created_by'
    ) then
      tickets_insert_check := tickets_insert_check || ' and (created_by is null or created_by = auth.uid())';
      tickets_update_check := tickets_update_check || ' and (created_by is null or created_by = auth.uid())';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'user_id'
    ) then
      tickets_insert_check := tickets_insert_check || ' and (user_id is null or user_id = auth.uid())';
      tickets_update_check := tickets_update_check || ' and (user_id is null or user_id = auth.uid())';
    end if;

    tickets_update_check := tickets_update_check || ')';

    execute 'create policy "tickets_select_authenticated" on public.tickets for select to authenticated using (auth.uid() is not null)';
    execute format(
      'create policy "tickets_insert_authenticated" on public.tickets for insert to authenticated with check (%s)',
      tickets_insert_check
    );
    execute format(
      'create policy "tickets_update_authenticated" on public.tickets for update to authenticated using (auth.uid() is not null) with check (%s)',
      tickets_update_check
    );
    -- Allow deletes for admins/leaders or the original creator of the ticket.
    execute 'create policy "tickets_delete_authenticated" on public.tickets for delete to authenticated using (public.is_admin_or_leader() or (created_by is not null and created_by = auth.uid()))';
  end if;
end $$;

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

do $$
begin
  if to_regclass('public.shift_notifications') is not null then
    alter table public.shift_notifications enable row level security;
    alter table public.shift_notifications force row level security;

    drop policy if exists "shift_notifications_select_authenticated" on public.shift_notifications;
    drop policy if exists "shift_notifications_insert_authenticated" on public.shift_notifications;
    drop policy if exists "shift_notifications_update_admin" on public.shift_notifications;
    drop policy if exists "shift_notifications_delete_admin" on public.shift_notifications;

    create policy "shift_notifications_select_authenticated"
      on public.shift_notifications
      for select
      to authenticated
      using (auth.uid() is not null);

    create policy "shift_notifications_insert_authenticated"
      on public.shift_notifications
      for insert
      to authenticated
      with check (auth.uid() is not null);

    create policy "shift_notifications_update_admin"
      on public.shift_notifications
      for update
      to authenticated
      using (public.is_admin_or_leader())
      with check (public.is_admin_or_leader());

    create policy "shift_notifications_delete_admin"
      on public.shift_notifications
      for delete
      to authenticated
      using (public.is_admin_or_leader());
  end if;
end $$;

do $$
begin
  if to_regclass('public.handover_requests') is not null then
    alter table public.handover_requests enable row level security;
    alter table public.handover_requests force row level security;

    drop policy if exists "handover_requests_select_admin" on public.handover_requests;
    drop policy if exists "handover_requests_insert_authenticated" on public.handover_requests;
    drop policy if exists "handover_requests_update_admin" on public.handover_requests;
    drop policy if exists "handover_requests_delete_admin" on public.handover_requests;

    create policy "handover_requests_select_admin"
      on public.handover_requests
      for select
      to authenticated
      using (public.is_admin_or_leader());

    create policy "handover_requests_insert_authenticated"
      on public.handover_requests
      for insert
      to authenticated
      with check (auth.uid() is not null);

    create policy "handover_requests_update_admin"
      on public.handover_requests
      for update
      to authenticated
      using (public.is_admin_or_leader())
      with check (public.is_admin_or_leader());

    create policy "handover_requests_delete_admin"
      on public.handover_requests
      for delete
      to authenticated
      using (public.is_admin_or_leader());
  end if;
end $$;

do $$
begin
  if to_regclass('public.logic_health_events') is not null then
    alter table public.logic_health_events force row level security;
  end if;
end $$;