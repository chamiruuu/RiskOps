-- Prevent deletion of any ticket that has already been handed over.

do $$
begin
  if to_regclass('public.tickets') is not null then
    drop policy if exists "tickets_delete_authenticated" on public.tickets;

    create policy "tickets_delete_authenticated"
      on public.tickets
      for delete
      to authenticated
      using (
        (
          public.is_admin_or_leader()
          or (created_by is not null and created_by = auth.uid())
        )
        and coalesce(jsonb_array_length(coalesce(handover_history, '[]'::jsonb)), 0) = 0
      );
  end if;
end $$;