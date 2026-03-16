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

-- Keep table compact by deleting entries older than 14 days during migration run.
delete from public.logic_health_events
where created_at < timezone('utc', now()) - interval '14 days';
