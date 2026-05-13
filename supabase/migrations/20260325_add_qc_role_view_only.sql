-- Add QC (Quality Control) role with view-only access
-- QC users can view all data like Admin/Leader but cannot create, edit, or delete

create or replace function public.can_write_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('Admin', 'Leader'), false)
$$;

grant execute on function public.can_write_data() to authenticated;

-- Update tickets RLS policies to use can_write_data for write operations
do $$
begin
  if to_regclass('public.tickets') is not null then
    -- Drop existing policies
    drop policy if exists "tickets_insert_authenticated" on public.tickets;
    drop policy if exists "tickets_update_authenticated" on public.tickets;
    
    -- Create new policies that prevent QC from writing
    create policy "tickets_insert_authenticated" 
      on public.tickets 
      for insert 
      to authenticated 
      with check (public.can_write_data() and auth.uid() is not null);
    
    create policy "tickets_update_authenticated" 
      on public.tickets 
      for update 
      to authenticated 
      using (auth.uid() is not null) 
      with check (public.can_write_data() or (auth.uid() is not null and created_by = auth.uid()));
  end if;
end $$;

-- Update profiles policies to prevent QC from modifying profiles
do $$
begin
  if to_regclass('public.profiles') is not null then
    drop policy if exists "profiles_insert_admin_only" on public.profiles;
    drop policy if exists "profiles_update_admin_only" on public.profiles;
    
    create policy "profiles_insert_admin_only"
      on public.profiles
      for insert
      to authenticated
      with check (public.can_write_data());
    
    create policy "profiles_update_admin_only"
      on public.profiles
      for update
      to authenticated
      using (public.can_write_data())
      with check (public.can_write_data());
  end if;
end $$;
