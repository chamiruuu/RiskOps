-- Backfill legacy handover_history string arrays into structured entries.
-- This preserves the original shift and role for old tickets so H.F colors
-- stay stable even if shift windows change in the future.

create or replace function public.resolve_active_shift_from_timestamp(input_ts timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when ((extract(hour from timezone('Asia/Manila', input_ts))::int * 60)
      + extract(minute from timezone('Asia/Manila', input_ts))::int) between 430 and 879
      then 'Morning'
    when ((extract(hour from timezone('Asia/Manila', input_ts))::int * 60)
      + extract(minute from timezone('Asia/Manila', input_ts))::int) between 880 and 1359
      then 'Afternoon'
    else 'Night'
  end
$$;

create or replace function public.next_shift(shift_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case shift_name
    when 'Morning' then 'Afternoon'
    when 'Afternoon' then 'Night'
    else 'Morning'
  end
$$;

create or replace function public.resolve_handover_shift(
  input_ts timestamptz,
  entry_index integer
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  resolved_shift text;
  remaining_steps integer;
begin
  resolved_shift := public.resolve_active_shift_from_timestamp(input_ts);
  remaining_steps := greatest(entry_index - 1, 0);

  while remaining_steps > 0 loop
    resolved_shift := public.next_shift(resolved_shift);
    remaining_steps := remaining_steps - 1;
  end loop;

  return resolved_shift;
end;
$$;

with handover_entries as (
  select
    t.id,
    t.created_at,
    t.handover_history,
    e.ordinality,
    case
      when jsonb_typeof(e.value) = 'object' then coalesce(
        nullif(btrim(e.value->>'name'), ''),
        nullif(btrim(e.value->>'by'), ''),
        nullif(btrim(e.value->>'user'), ''),
        nullif(btrim(e.value->>'workName'), ''),
        ''
      )
      else nullif(btrim(e.value #>> '{}'), '')
    end as entry_name,
    case
      when jsonb_typeof(e.value) = 'object' then nullif(btrim(e.value->>'shift'), '')
      else null
    end as entry_shift,
    case
      when jsonb_typeof(e.value) = 'object' then nullif(btrim(coalesce(e.value->>'kind', e.value->>'role', e.value->>'type')), '')
      else null
    end as entry_kind
  from public.tickets t
  cross join lateral jsonb_array_elements(t.handover_history) with ordinality as e(value, ordinality)
  where jsonb_typeof(t.handover_history) = 'array'
    and jsonb_array_length(t.handover_history) > 0
),
rebuilt as (
  select
    id,
    jsonb_agg(
      jsonb_build_object(
        'name', entry_name,
        'shift', coalesce(entry_shift, public.resolve_handover_shift(created_at, ordinality::int)),
        'kind', coalesce(
          entry_kind,
          case
            when ordinality = 1 then 'creator'
            when ordinality = jsonb_array_length(handover_history) then 'completer'
            else 'handover'
          end
        )
      )
      order by ordinality
    ) as new_handover_history
  from handover_entries
  where entry_name is not null and entry_name <> ''
  group by id, created_at, handover_history
)
update public.tickets t
set handover_history = rebuilt.new_handover_history
from rebuilt
where t.id = rebuilt.id;