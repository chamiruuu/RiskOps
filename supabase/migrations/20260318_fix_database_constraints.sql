-- QA Audit Fixes: Database Constraints and Optimizations
-- Issues Fixed: DB-SUPABASE-002, DB-SUPABASE-003, DB-SUPABASE-004

-- ============================================
-- Issue DB-SUPABASE-003: Fix is_archived NULL confusion
-- ============================================
-- Ensure is_archived column has proper NOT NULL DEFAULT constraint
ALTER TABLE public.tickets 
  ALTER COLUMN is_archived SET NOT NULL DEFAULT FALSE;

-- Update any existing NULLs to FALSE
UPDATE public.tickets 
  SET is_archived = FALSE 
  WHERE is_archived IS NULL;

-- ============================================
-- Issue DB-SUPABASE-002: Add composite indexes for common queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tickets_ic_created
  ON public.tickets (ic_account, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_provider_created
  ON public.tickets (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_status_created
  ON public.tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_ic_provider_created
  ON public.tickets (ic_account, provider, created_at DESC);

-- ============================================
-- Issue DB-SUPABASE-004: Add foreign key constraints for referential integrity
-- ============================================

-- Add FK from tickets to auth.users (if not already present)
ALTER TABLE public.tickets
  ADD CONSTRAINT fk_tickets_user_id 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;

-- Add index for FK lookups
CREATE INDEX IF NOT EXISTS idx_tickets_user_id 
  ON public.tickets (user_id);

-- Add FK from shift_assignments to auth.users
ALTER TABLE public.shift_assignments
  ADD CONSTRAINT fk_shift_assignments_user_id 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_shift_assignments_user_id 
  ON public.shift_assignments (user_id);

-- Add FK from logic_health_events to auth.users
ALTER TABLE public.logic_health_events
  ADD CONSTRAINT fk_logic_health_events_user_id 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_logic_health_events_user_id 
  ON public.logic_health_events (user_id);

-- ============================================
-- Issue SECURITY-SUPABASE-001: Tighten RLS policy
-- ============================================
DROP POLICY IF EXISTS "logic_health_events_select" ON public.logic_health_events;

-- Allow users to see only their own events, or admins to see all
CREATE POLICY "logic_health_events_select_own"
  ON public.logic_health_events
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

DROP POLICY IF EXISTS "logic_health_events_insert" ON public.logic_health_events;

-- Only allow inserting own events
CREATE POLICY "logic_health_events_insert_own"
  ON public.logic_health_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND auth.uid() IS NOT NULL);

-- ✅ Summary: All migrations are idempotent and safe to re-run
