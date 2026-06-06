create unique index if not exists idx_tickets_active_provider_tracking_no_unique
  on public.tickets (
    lower(btrim(provider)),
    lower(btrim(tracking_no))
  )
  where coalesce(is_archived, false) = false
    and provider is not null
    and btrim(provider) <> ''
    and tracking_no is not null
    and btrim(tracking_no) <> ''
    and btrim(tracking_no) <> '-';
