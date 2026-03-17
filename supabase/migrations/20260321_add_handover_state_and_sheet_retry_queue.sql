-- Persistent handover state + durable sheet retry queue + operational admin alerts

create table if not exists public.shift_handover_state (
  shift_name text not null check (shift_name in ('Morning', 'Afternoon', 'Night')),
  duty_key text not null default '',
  last_handover_timestamp timestamptz,
  last_handover_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint shift_handover_state_pk primary key (shift_name, duty_key)
);

create index if not exists idx_shift_handover_state_updated_at
  on public.shift_handover_state (updated_at desc);

create table if not exists public.sheet_sync_retry_queue (
  id uuid primary key default gen_random_uuid(),
  job_key text not null unique,
  handover_marker text not null,
  duty_key text not null,
  source_shift text not null check (source_shift in ('Morning', 'Afternoon', 'Night')),
  target_shift text not null check (target_shift in ('Morning', 'Afternoon', 'Night')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'retrying', 'processing', 'succeeded', 'escalated')),
  attempt_count integer not null default 0,
  first_failed_at timestamptz not null default timezone('utc', now()),
  last_attempt_at timestamptz,
  next_retry_at timestamptz not null default timezone('utc', now()),
  last_error text,
  escalated_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_sheet_sync_retry_queue_status_next_retry
  on public.sheet_sync_retry_queue (status, next_retry_at asc);

create index if not exists idx_sheet_sync_retry_queue_duty_status
  on public.sheet_sync_retry_queue (duty_key, status);

create table if not exists public.operational_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'error')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  context jsonb,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_operational_alerts_status_created_at
  on public.operational_alerts (status, created_at desc);

alter table public.shift_handover_state enable row level security;
alter table public.shift_handover_state force row level security;

drop policy if exists "shift_handover_state_select_authenticated" on public.shift_handover_state;
create policy "shift_handover_state_select_authenticated"
  on public.shift_handover_state
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "shift_handover_state_upsert_authenticated" on public.shift_handover_state;
create policy "shift_handover_state_upsert_authenticated"
  on public.shift_handover_state
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

alter table public.sheet_sync_retry_queue enable row level security;
alter table public.sheet_sync_retry_queue force row level security;

drop policy if exists "sheet_sync_retry_queue_select_authenticated" on public.sheet_sync_retry_queue;
create policy "sheet_sync_retry_queue_select_authenticated"
  on public.sheet_sync_retry_queue
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "sheet_sync_retry_queue_write_authenticated" on public.sheet_sync_retry_queue;
create policy "sheet_sync_retry_queue_write_authenticated"
  on public.sheet_sync_retry_queue
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

alter table public.operational_alerts enable row level security;
alter table public.operational_alerts force row level security;

drop policy if exists "operational_alerts_select_admin" on public.operational_alerts;
create policy "operational_alerts_select_admin"
  on public.operational_alerts
  for select
  to authenticated
  using (public.is_admin_or_leader());

drop policy if exists "operational_alerts_insert_authenticated" on public.operational_alerts;
create policy "operational_alerts_insert_authenticated"
  on public.operational_alerts
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "operational_alerts_update_admin" on public.operational_alerts;
create policy "operational_alerts_update_admin"
  on public.operational_alerts
  for update
  to authenticated
  using (public.is_admin_or_leader())
  with check (public.is_admin_or_leader());
