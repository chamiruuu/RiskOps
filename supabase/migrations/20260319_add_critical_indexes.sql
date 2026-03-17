-- ✅ DB-SUPABASE-001: Add critical indexes for performance
-- These indexes optimize the main query paths used in the application

-- Index on is_archived: frequently filtered in fetchTickets
CREATE INDEX IF NOT EXISTS idx_tickets_is_archived_desc 
  ON public.tickets (is_archived DESC NULLS LAST);

-- Index on created_at for sorting: used in every fetchTickets call
CREATE INDEX IF NOT EXISTS idx_tickets_created_at_desc 
  ON public.tickets (created_at DESC);

-- Composite index on ic_account and created_at: used when filtering by IC account
CREATE INDEX IF NOT EXISTS idx_tickets_ic_account_created_at 
  ON public.tickets (ic_account, created_at DESC);

-- Compound index for the exact query pattern: WHERE NOT is_archived AND ic_account IN (...)
CREATE INDEX IF NOT EXISTS idx_tickets_archive_ic_account_created_at 
  ON public.tickets (is_archived, ic_account, created_at DESC) 
  WHERE is_archived IS NOT NULL OR is_archived IS NULL;

-- Index for owner/recorder lookups (for edit permission checks)
CREATE INDEX IF NOT EXISTS idx_tickets_recorder 
  ON public.tickets (recorder);

-- Index on member_id and id for lookups in sync-sheets function
CREATE INDEX IF NOT EXISTS idx_tickets_member_id 
  ON public.tickets (member_id);

-- Collect statistics on indexes for query planner
ANALYZE public.tickets;

-- Log the index creation for debugging
DO $$
BEGIN
  RAISE NOTICE 'Database indexes created/verified successfully at %', NOW();
  RAISE NOTICE 'Run EXPLAIN ANALYZE on slow queries to verify index usage';
END $$;
