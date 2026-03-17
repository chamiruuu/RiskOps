# 🎓 RiskOps Development Guidance: High-Priority Remaining Issues

**Guide For:** Development Team  
**Priority Level:** Must address before next production release  
**Estimated Effort:** 3-5 days

---

## 🔴 CRITICAL REMAINING ISSUE: DB-SUPABASE-002

### Title: Row-Level Security Policies Incomplete

**Current Risk:** Data leakage, unauthorized access, permission bypass

### The Issue
Your Supabase tables have RLS enabled, but policies are incomplete. This means:
- Users can potentially see data they shouldn't
- Admin actions aren't properly isolated
- Concurrent access creates permission conflicts

### Where to Fix
**Supabase Dashboard → Database → Policies** (or SQL Editor)

### Current Repo State
- The repo now contains a concrete migration for this work: `supabase/migrations/20260320_add_operational_rls.sql`.
- Apply that migration first instead of hand-editing policies in the dashboard.
- Important limitation: ticket duty selection is still session-only client state (`localStorage`), so exact per-IC RLS cannot be enforced until duty grants are stored server-side.
- This migration still closes the main gap now by enforcing authenticated-only operational access, self-or-admin profile access, and admin-only writes on scheduling tables.

### Implementation Guide

```sql
-- ✅ STEP 1: Ensure RLS is enabled on tickets table
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- ✅ STEP 2: Drop old policies (if they exist)
DROP POLICY IF EXISTS "tickets_select_user" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert_user" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update_user" ON public.tickets;
DROP POLICY IF EXISTS "tickets_delete_user" ON public.tickets;

-- ✅ STEP 3: Add new comprehensive policies

-- Policy 1: SELECT - Users see only tickets for their assigned duties
CREATE POLICY "tickets_read_policy"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (
    -- Admins and Leaders see all tickets
    (
      SELECT role 
      FROM public.profiles 
      WHERE id = auth.uid()
    ) IN ('Admin', 'Leader')
    OR
    -- Regular users see only tickets for their assigned IC accounts
    EXISTS (
      SELECT 1
      FROM public.shift_assignments sa
      JOIN public.profiles p ON sa.user_id = p.id
      WHERE p.id = auth.uid()
      AND sa.shift_type IS NOT NULL
      AND tickets.ic_account = (
        -- Map shift type to IC account
        CASE 
          WHEN sa.shift_type = 'Morning' THEN 'IC1'
          WHEN sa.shift_type = 'Afternoon' THEN 'IC2'
          WHEN sa.shift_type = 'Night' THEN 'IC3'
          ELSE sa.shift_type
        END
      )
    )
  );

-- Policy 2: INSERT - Users can create tickets
CREATE POLICY "tickets_create_policy"
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Policy 3: UPDATE - Users can update tickets they created or if admin/leader
CREATE POLICY "tickets_update_policy"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin/Leader can update any ticket
    (
      SELECT role 
      FROM public.profiles 
      WHERE id = auth.uid()
    ) IN ('Admin', 'Leader')
    OR
    -- Creator can update their own tickets
    recorder = (
      SELECT work_name 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    -- Admin/Leader can update any ticket
    (
      SELECT role 
      FROM public.profiles 
      WHERE id = auth.uid()
    ) IN ('Admin', 'Leader')
    OR
    -- Creator can update their own tickets
    recorder = (
      SELECT work_name 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Policy 4: DELETE - Only admins/leaders can delete
CREATE POLICY "tickets_delete_policy"
  ON public.tickets
  FOR DELETE
  TO authenticated
  USING (
    (
      SELECT role 
      FROM public.profiles 
      WHERE id = auth.uid()
    ) IN ('Admin', 'Leader')
  );

-- ✅ VERIFICATION: Test policies work
-- This query should only return tickets the current user can see:
SELECT * FROM public.tickets;

-- ✅ VERIFICATION: Test insert works
INSERT INTO public.tickets (
  ic_account, login_id, member_id, provider, recorder, status, notes
) VALUES (
  'IC1', 'test_login', 'test_member', 'Test Provider', 'Test User', 'new', NULL
);
```

### Step-by-Step in Supabase Dashboard

1. **Go to:** SQL Editor
2. **Copy-paste** the complete policy code above
3. **Run** the query
4. **Test** by switching users in Dashboard
5. **Verify** each user can only see/edit their own data

### How to Test in Frontend

```javascript
// Add this temporary test in your Dashboard component
useEffect(() => {
  const testRLS = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('id, ic_account, recorder')
      .limit(5);
    
    console.log('RLS Test - Can user see these tickets?', {
      count: data?.length,
      error: error?.message,
      tickets: data,
    });
  };
  
  testRLS();
}, [user]);
```

---

## 🔴 CRITICAL REMAINING ISSUE: API-EDGE-001

### Title: Edge Function Lacks Retry Logic & Error Recovery

**Current Risk:** Data loss during network failures, inconsistent sync state

### The Issue
Your `sync-sheets` function has no retry mechanism. If Google Sheets API times out:
- Ticket is saved to database ✅
- But NOT synced to Google Sheet ❌
- No automatic retry ❌
- User gets vague error message ❌

### Implementation Guide

**File to Modify:** `supabase/functions/sync-sheets/index.ts`

```typescript
// ✅ Add at the top of your file
const RETRY_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10000;

// ✅ Add this helper function
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = RETRY_ATTEMPTS
): Promise<Response> {
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create abort controller with 10-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        10000 // 10 second timeout
      );

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      lastResponse = response;

      // Success or client error (4xx) - don't retry
      if (response.ok || response.status < 500) {
        return response;
      }

      // Server error (5xx) - retry
      lastError = new Error(`HTTP ${response.status}`);
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      // Don't retry if this is the last attempt
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff between retries
      const backoffMs = Math.min(
        INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1),
        MAX_BACKOFF_MS
      );
      
      console.log(`Retrying in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('Max retries exceeded');
}

// ✅ Replace all fetch() calls with fetchWithRetry()
// Example for APPEND action:

if (action === 'APPEND') {
  const incomingTickets = Array.isArray(tickets) ? tickets : [];
  
  if (incomingTickets.length === 0) {
    return new Response(
      JSON.stringify({ 
        success: true, 
        appended: 0, 
        skipped: 0, 
        reason: 'No tickets provided',
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    // ✅ Use retry wrapper instead of plain fetch
    const idRange = encodeURIComponent(`${SHEET_NAME}!A:A`);
    const idRes = await fetchWithRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${idRange}`,
      { 
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        method: 'GET',
      }
    );

    const idJson = await idRes.json();
    
    if (idJson.error) {
      throw new Error(`Google Sheets API: ${idJson.error.message}`);
    }

    if (!validateReadResponse(idJson)) {
      throw new Error('Invalid Google Sheets response format');
    }

    // ... rest of your append logic ...

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        hint: 'Tickets saved to database. Sheet sync failed. Please check logs.',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
}
```

### Testing the Retry Logic

```bash
# Simulate network issues while testing
# You can use Playwright to throttle network in tests:

test('should retry on network timeout', async ({ page }) => {
  // Simulate slow 3G
  await page.route('**/*.googleapis.com/**', route => {
    setTimeout(() => route.continue(), 5000);
  });

  // Create ticket that triggers sync
  // Should succeed after retry
});
```

---

## 🟡 HIGH PRIORITY: PERF-RENDER-002

### Title: Excessive Polling Every 12 Seconds

**Current Impact:** 144,000 database queries/day per 20 users

### The Issue
```javascript
// INEFFICIENT: Fixed 12-second polling = 7,200 queries per user per day
const fallbackTimer = setInterval(() => {
  if (isComponentMounted) fetchTickets();
}, 12000);
```

### Solution: Adaptive Polling

```javascript
// ✅ IMPROVED: Start slow, speed up only on errors
let fallbackIntervalMs = 60000; // Start at 60 seconds

useEffect(() => {
  let fallbackTimer;
  let realtimeHealthy = !realtimeIssueRef.current;

  const startFallbackPolling = () => {
    fallbackTimer = setInterval(() => {
      if (!isComponentMounted) return;

      fetchTickets();

      // Adapt interval based on realtime health
      if (realtimeHealthy && !realtimeIssueRef.current) {
        // Realtime is working - reduce polling frequency
        fallbackIntervalMs = Math.min(fallbackIntervalMs + 10000, 300000); // Max 5 mins
      } else if (!realtimeHealthy && realtimeIssueRef.current) {
        // Realtime is broken - increase polling frequency
        fallbackIntervalMs = 12000; // Back to aggressive 12 seconds
        realtimeHealthy = false;
      }
    }, fallbackIntervalMs);
  };

  startFallbackPolling();

  // Listen for realtime status changes
  const handleRealtimeChange = () => {
    realtimeHealthy = !realtimeIssueRef.current;
    
    // If realtime just recovered, gradually reduce polling
    if (realtimeHealthy) {
      fallbackIntervalMs = 30000; // Reset to 30 seconds
    }
  };

  window.addEventListener('tickets-realtime-restored', handleRealtimeChange);
  window.addEventListener('tickets-realtime-error', handleRealtimeChange);

  return () => {
    clearInterval(fallbackTimer);
    window.removeEventListener('tickets-realtime-restored', handleRealtimeChange);
    window.removeEventListener('tickets-realtime-error', handleRealtimeChange);
  };
}, [emitRealtimeEvent, fetchTickets, user?.id]);
```

**Impact:**
- **Normal case:** 1 poll every 5 minutes = 288 queries/day per user (95% reduction!)
- **Error case:** 1 poll every 12 seconds = revert to current (until recovered)
- **Cost reduction:** From ~144M queries/year → ~10.5M queries/year (30 users)

---

## 🟡 HIGH PRIORITY: TEST-VITEST-001

### Title: Extremely Low Test Coverage (3 files, needs 50+ tests)

### Critical Test Cases Missing

```javascript
// ✅ CREATE: src/components/TicketTable.test.jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TicketTable from './TicketTable';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

// Mock useDuty context
vi.mock('../context/DutyContext', () => ({
  useDuty: () => ({
    user: { id: '123', email: 'test@example.com' },
    userRole: 'User',
    selectedDuty: ['IC1'],
    onlineUsers: [],
  }),
}));

describe('TicketTable', () => {
  const mockTickets = [
    {
      id: 1,
      member_id: 'M001',
      provider: 'Test Provider',
      tracking_no: 'TRK001',
      status: 'new',
      created_at: new Date().toISOString(),
    },
  ];

  it('renders ticket list', () => {
    render(
      <TicketTable
        tickets={mockTickets}
        onUpdateTicket={vi.fn()}
        onDeleteTicket={vi.fn()}
        dutyNumber={['IC1']}
        shortWorkName="TestUser"
      />
    );

    expect(screen.getByText('M001')).toBeInTheDocument();
  });

  it('allows user to edit tracking number', async () => {
    const onUpdate = vi.fn();
    render(
      <TicketTable
        tickets={mockTickets}
        onUpdateTicket={onUpdate}
        onDeleteTicket={vi.fn()}
        dutyNumber={['IC1']}
        shortWorkName="TestUser"
      />
    );

    // Find and click the edit button
    const editButton = screen.getByTitle(/edit/i);
    await userEvent.click(editButton);

    // Type new value
    const input = screen.getByDisplayValue('TRK001');
    await userEvent.clear(input);
    await userEvent.type(input, 'TRK002');

    // Verify update was called
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(1, 'tracking_no', 'TRK002');
    });
  });

  it('does not allow non-admin users to delete tickets', async () => {
    const onDelete = vi.fn();
    render(
      <TicketTable
        tickets={mockTickets}
        onUpdateTicket={vi.fn()}
        onDeleteTicket={onDelete}
        dutyNumber={['IC1']}
        shortWorkName="TestUser"
      />
    );

    // Delete button should not be visible for non-admin
    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
    expect(deleteButtons.length).toBe(0);
  });

  it('allowed admins to delete tickets', async () => {
    // Re-mock with admin role
    const onDelete = vi.fn();
    
    render(
      <TicketTable
        tickets={mockTickets}
        onUpdateTicket={vi.fn()}
        onDeleteTicket={onDelete}
        dutyNumber={['IC0']} // Admin
        shortWorkName="Admin"
      />
    );

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(1);
    });
  });
});
```

### Recommended Test Suite

```bash
# Unit Tests (src/**/*.test.js)
- src/components/TicketForm.test.jsx (15 tests)
- src/components/TicketTable.test.jsx (15 tests) 
- src/hooks/useTicketRealtime.test.js (10 tests) ← Create this
- src/hooks/useTicketMutations.test.js (10 tests) ← Create this
- src/context/DutyContext.test.jsx (10 tests)
- src/lib/logicHealth.test.js (Expand: 30 tests total)

Total: 90+ unit tests

# E2E Tests (tests/e2e/**/*.e2e.js)
- create-ticket.e2e.js
- edit-ticket.e2e.js  
- permissions-control.e2e.js
- realtime-sync.e2e.js
- handover-flow.e2e.js

Total: 20+ E2E tests
```

---

## 📋 Implementation Priority

### Week 1 (Most Critical)
1. [ ] Apply RLS policies (DB-SUPABASE-002)
2. [ ] Add retry logic to Edge Function (API-EDGE-001)
3. [ ] Test all database queries

### Week 2 (High Impact)
4. [ ] Implement adaptive polling (PERF-RENDER-002)
5. [ ] Create custom hooks (ARCH-REACT-001)
6. [ ] Start unit tests

### Week 3+ (Foundational)
7. [ ] Complete test coverage (TEST-VITEST-001)
8. [ ] E2E test suite
9. [ ] Performance profiling

---

## ✅ Deployment Verification Checklist

```bash
# Before deploying:
- [ ] npm run lint (should be 0 errors)
- [ ] npm run test:run (should pass)
- [ ] npm run build (should succeed)
- [ ] npm run electron:build (should complete)
- [ ] Database migration applied
- [ ] RLS policies active in Supabase
- [ ] Test with production database in staging
- [ ] Verify realtime subscription works
- [ ] Test sheet sync with real Google Sheets
- [ ] Performance profile: API calls per minute
```

---

**Questions?** Review the full audit at [AUDIT_SUMMARY.md](AUDIT_SUMMARY.md)
