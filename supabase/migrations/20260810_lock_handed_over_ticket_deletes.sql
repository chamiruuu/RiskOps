-- Prevent deleting tickets after they have been handed over and written to Google Sheets.

do $$
begin
  if to_regclass('public.tickets') is not null then
    alter table public.tickets enable row level security;
    alter table public.tickets force row level security;

    drop policy if exists "tickets_delete_authenticated" on public.tickets;

    execute '
      create policy "tickets_delete_authenticated"
      on public.tickets
      for delete
      to authenticated
      using (
        (
          public.is_admin_or_leader()
          or (created_by is not null and created_by = auth.uid())
        )
        and case
          when jsonb_typeof(handover_history) = ''array'' then jsonb_array_length(handover_history) = 0
          else true
        end
      )
    ';
  end if;
end $$;