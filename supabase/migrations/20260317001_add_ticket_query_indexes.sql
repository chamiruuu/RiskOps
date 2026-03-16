-- Ticket query performance indexes for active + archive views
-- Safe to re-run due to IF NOT EXISTS

create index if not exists idx_tickets_is_archived
  on public.tickets (is_archived);

create index if not exists idx_tickets_created_at_desc
  on public.tickets (created_at desc);

create index if not exists idx_tickets_ic_account
  on public.tickets (ic_account);

create index if not exists idx_tickets_provider
  on public.tickets (provider);

create index if not exists idx_tickets_member_id
  on public.tickets (member_id);

-- Common archive modal pattern: archived + date range + duty
create index if not exists idx_tickets_archive_created_ic
  on public.tickets (is_archived, created_at desc, ic_account);

-- Common search pattern: provider + member account lookups
create index if not exists idx_tickets_provider_member
  on public.tickets (provider, member_id);
