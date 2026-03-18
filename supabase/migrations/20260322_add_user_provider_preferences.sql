-- Per-user provider preferences synced across devices.

create table if not exists public.user_provider_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorite_providers text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_provider_preferences enable row level security;
alter table public.user_provider_preferences force row level security;

drop policy if exists "user_provider_preferences_select_self" on public.user_provider_preferences;
create policy "user_provider_preferences_select_self"
  on public.user_provider_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_provider_preferences_insert_self" on public.user_provider_preferences;
create policy "user_provider_preferences_insert_self"
  on public.user_provider_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_provider_preferences_update_self" on public.user_provider_preferences;
create policy "user_provider_preferences_update_self"
  on public.user_provider_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_provider_preferences_delete_self" on public.user_provider_preferences;
create policy "user_provider_preferences_delete_self"
  on public.user_provider_preferences
  for delete
  to authenticated
  using (user_id = auth.uid());
