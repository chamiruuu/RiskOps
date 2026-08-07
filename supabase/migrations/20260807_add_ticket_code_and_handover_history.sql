alter table public.tickets
  add column if not exists ticket_code text,
  add column if not exists handover_history jsonb not null default '[]'::jsonb;

with numbered as (
  select
    id,
    'RO' || lpad(row_number() over (order by created_at asc, id asc)::text, 4, '0') as code
  from public.tickets
  where ticket_code is null or btrim(ticket_code) = ''
)
update public.tickets t
set ticket_code = numbered.code
from numbered
where t.id = numbered.id;

create sequence if not exists public.ticket_code_seq;

select setval(
  'public.ticket_code_seq',
  coalesce(
    (
      select max((substring(ticket_code from 3))::bigint)
      from public.tickets
      where ticket_code ~ '^RO[0-9]+$'
    ),
    1
  ),
  exists (
    select 1
    from public.tickets
    where ticket_code ~ '^RO[0-9]+$'
  )
);

alter table public.tickets
  alter column ticket_code set default (
    'RO' || lpad(nextval('public.ticket_code_seq')::text, 4, '0')
  );

create unique index if not exists idx_tickets_ticket_code_unique
  on public.tickets (ticket_code);

create index if not exists idx_tickets_handover_history_gin
  on public.tickets using gin (handover_history);
