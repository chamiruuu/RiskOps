-- Destructive reset: deletes all existing RiskOps tickets and restarts ticket_code at RO0001.
-- Run only when you are sure existing ticket records are no longer needed.

begin;

delete from public.tickets;

alter sequence public.ticket_code_seq restart with 1;

commit;
