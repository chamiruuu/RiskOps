# RiskOps SOP Deck Script (0 to 100)

Version: 0.0.6  
Audience: Duty Officers (TM) and Admin/Leader  
Format: Figma slide deck with screenshot + short explanation + presenter notes

## How To Use This File
- Each section below represents one slide.
- Use the slide title as the Figma frame title.
- Use the On-slide Text as visible content.
- Replace Screenshot Placeholder with your screenshot.
- Add annotation arrows using Annotation Callouts.
- Use Speaker Notes for presenter narration.

---

## Section A: Intro and Orientation

### Slide 1 - Cover
Purpose: Introduce training module
On-slide Text:
- RiskOps Ticket Management SOP
- End-to-end workflow from login to handover
- For TM and Admin/Leader
Screenshot Placeholder:
- None (cover design)
Annotation Callouts:
- None
Speaker Notes:
- This SOP teaches full operations from first login to shift handover and exception handling.

### Slide 2 - What RiskOps Is
Purpose: Explain system mission in plain language
On-slide Text:
- RiskOps is the IC duty ticket system for member betting investigations.
- Teams use it to submit provider checks, track outcomes, and hand over pending work between shifts.
- Everything updates in real time through Supabase.
Screenshot Placeholder:
- Dashboard overview with Header + Ticket Form + Ticket Table visible
Annotation Callouts:
- Header = shift + online team visibility
- Left panel = ticket creation and SOP scripts
- Main table = ticket tracking and actions
Speaker Notes:
- Emphasize this is an operations system, not just a note tool.

### Slide 3 - Roles and Access
Purpose: Set role boundaries early
On-slide Text:
- TM users: work inside selected duties (IC1, IC2, IC3, IC5)
- Admin/Leader: IC0 view and wider operational control
- Access and action scope are governed by profile role and selected duty
Screenshot Placeholder:
- Login success state and duty cards
Annotation Callouts:
- Duty cards available to TM
- Admin/Leader auto-routing behavior
Speaker Notes:
- Clarify that role and selected duty affect what tickets users can see and create.

### Slide 4 - Shift Model and Handover Windows
Purpose: Explain time-based behavior
On-slide Text:
- Active shifts:
- Morning: 07:00 to 14:30 (GMT+8)
- Afternoon: 14:30 to 22:30 (GMT+8)
- Night: 22:30 to 07:00 (GMT+8)
- Handover windows:
- 14:15 to 14:45
- 22:15 to 22:45
- 06:45 to 07:15
Screenshot Placeholder:
- Header showing current shift and assigned shift
Annotation Callouts:
- Current active shift indicator
- Your assigned shift indicator
Speaker Notes:
- Permission to create and handover depends on shift logic.

---

## Section B: First-Time Access (From Zero)

### Slide 5 - Prerequisites Before First Login
Purpose: Prevent common onboarding failure
On-slide Text:
- You must have:
- Valid work email and password
- User profile in database with role and work name
- Shift assignment in current cycle
- Internet access to Supabase and merchant sheet source
Screenshot Placeholder:
- Login page
Annotation Callouts:
- Email and password fields
- Error box area
Speaker Notes:
- Missing profile or assignment causes downstream permission confusion.

### Slide 6 - Login Flow
Purpose: Show exactly how to sign in
On-slide Text:
- Step 1: Enter work email
- Step 2: Enter password
- Step 3: Click Sign In
- If credentials fail, error appears on the same screen
Screenshot Placeholder:
- Login form filled with sample non-sensitive values
Annotation Callouts:
- Sign In button
- Inline error message panel
Speaker Notes:
- If login fails, user remains on login screen until valid sign in.

### Slide 7 - Post-Login Routing Rules
Purpose: Explain what screen appears after login
On-slide Text:
- Admin/Leader: auto-redirect to dashboard
- TM user: must select one or more duties first
- Continue button appears only when at least one duty is selected
Screenshot Placeholder:
- Duty selection screen with multiple cards selected
Annotation Callouts:
- Selected card state
- Continue to Dashboard button
Speaker Notes:
- TM can multi-select duties for the session.

### Slide 8 - Duty Selection Best Practice
Purpose: Reduce wrong-duty incidents
On-slide Text:
- Select only duties you are actively responsible for this shift.
- Avoid selecting unrelated duties to prevent accidental handling.
- You can sign out and re-enter if selection is incorrect.
Screenshot Placeholder:
- Duty selection with 2 duties selected
Annotation Callouts:
- Selected count in Continue button
- Sign Out control
Speaker Notes:
- Explain operational responsibility and audit clarity.

---

## Section C: Dashboard and Core Navigation

### Slide 9 - Dashboard Layout Map
Purpose: Build orientation before action steps
On-slide Text:
- Header: alerts, shift info, online users
- Left panel: New Investigation generator and SOP guide
- Main panel: searchable ticket table and actions
Screenshot Placeholder:
- Full dashboard, no modal open
Annotation Callouts:
- Header zone
- Generator tab
- SOP tab
- Search bar and ticket rows
Speaker Notes:
- Users should learn where to act before creating tickets.

### Slide 10 - Visibility Rules for Ticket Table
Purpose: Explain why tickets may not appear
On-slide Text:
- You can view tickets when:
- Your assigned shift is currently active
- Or you are in valid handover pair during handover window
- Or you are Admin/Leader
Screenshot Placeholder:
- Example state showing ticket list visible
Annotation Callouts:
- Shift-related indicator in header
- Ticket area state
Speaker Notes:
- If users report empty table, check shift and duty context first.

### Slide 11 - Search and Filtering
Purpose: Speed up daily operations
On-slide Text:
- Search supports partial matching by:
- Member ID
- Provider Account
- Tracking Number
- Search is case-insensitive
Screenshot Placeholder:
- Ticket table with search term entered
Annotation Callouts:
- Search field
- Filtered results list
Speaker Notes:
- This is the fastest way to locate existing cases before creating duplicates.

---

## Section D: Ticket Creation SOP

### Slide 12 - Create Ticket Gate Conditions
Purpose: Prevent confusion when button is disabled
On-slide Text:
- Ticket creation allowed when:
- Your shift is active
- Or during handover window
- Or Admin/Leader override
- After outgoing handover is completed, TM is locked until next valid window
Screenshot Placeholder:
- Generator with locked badge state
Annotation Callouts:
- Shift Locked badge
- Tooltip/help message area
Speaker Notes:
- Most creation issues are permission timing issues, not form bugs.

### Slide 13 - Step 1: Choose Provider
Purpose: Show provider-first workflow
On-slide Text:
- Open Provider Source field
- Search provider name
- Select correct provider before filling details
- Required fields change by provider config
Screenshot Placeholder:
- Provider dropdown expanded
Annotation Callouts:
- Search input
- Provider list
- Selected provider state
Speaker Notes:
- Provider selection controls validation and generated script structure.

### Slide 14 - Step 2: Fill Required Inputs
Purpose: Standardize data entry quality
On-slide Text:
- Always fill required fields marked by provider rules
- Member ID is mandatory for ticket creation
- Common required fields include Provider Account and Time Range
Screenshot Placeholder:
- Form with required fields visible
Annotation Callouts:
- Member ID field
- Provider Account field
- Time Range field
Speaker Notes:
- Do not submit partial records; missing required fields block create.

### Slide 15 - Time Range Picker
Purpose: Show quick and custom date usage
On-slide Text:
- Use quick presets for common checks
- Use custom from/to for precise period
- Ensure provider date-limit rules are respected
Screenshot Placeholder:
- Date dropdown open with quick options and custom inputs
Annotation Callouts:
- Quick date options
- Custom date selectors
Speaker Notes:
- Mention that some providers allow only recent windows.

### Slide 16 - Merchant and Duty Validation
Purpose: Explain automatic access guard
On-slide Text:
- System parses Member ID suffix after @ for merchant mapping
- If no suffix, default merchant behavior applies
- TM users are blocked if merchant belongs to unselected duty
- Admin/Leader bypasses this duty restriction
Screenshot Placeholder:
- Form showing Access Denied warning for merchant-duty mismatch
Annotation Callouts:
- Member ID sample format user@017
- Access denied warning text
Speaker Notes:
- This prevents cross-duty mistakes.

### Slide 17 - Script Generator and SOP Tab
Purpose: Teach script workflow
On-slide Text:
- Generator tab creates provider-ready message from form data
- SOP Guide tab shows provider rules and process notes
- Copy buttons speed response handling
Screenshot Placeholder:
- Split capture of Generator and SOP tab states
Annotation Callouts:
- Generated script box
- Copy script button
- SOP rule panel
Speaker Notes:
- Encourage users to verify script values before sending.

### Slide 18 - PG Soft 7-Day Duplicate Check
Purpose: Highlight high-risk duplicate prevention
On-slide Text:
- For PG Soft, system checks past 7 days for same member and provider account
- If match exists, confirmation modal appears
- User decides whether to proceed
Screenshot Placeholder:
- PG Soft duplicate check modal
Annotation Callouts:
- Duplicate warning title
- Continue or cancel controls
Speaker Notes:
- This is an intentional quality gate, not an error.

### Slide 19 - Final Create Action and Success
Purpose: Close creation loop
On-slide Text:
- Click Create Ticket after validation
- Ticket status starts as Pending
- Success toast appears and form resets
- New ticket appears in table immediately
Screenshot Placeholder:
- Success toast with newly inserted ticket visible
Annotation Callouts:
- Success toast
- New row at top of table
Speaker Notes:
- Explain optimistic update behavior for speed.

---

## Section E: Ticket Lifecycle Management

### Slide 20 - Inline Edit Basics
Purpose: Teach safe editing
On-slide Text:
- Click editable fields to modify data in-row
- Press Enter or blur to save
- UI updates immediately; database updates in background
Screenshot Placeholder:
- Row in edit mode
Annotation Callouts:
- Editable field input
- Save trigger behavior
Speaker Notes:
- If update fails, user sees alert and data refresh fallback occurs.

### Slide 21 - Realtime Collaboration Conflict Alert
Purpose: Reduce overwrite mistakes
On-slide Text:
- If another user edits same ticket during your edit window, conflict alert appears
- Review latest values before continuing
Screenshot Placeholder:
- Ownership conflict alert toast
Annotation Callouts:
- Conflict alert text
- Edited row reference
Speaker Notes:
- This protects against silent data clashes.

### Slide 22 - Add Notes to Ticket
Purpose: Standardize timeline logging
On-slide Text:
- Open ticket note modal
- Add concise operational note
- Note is stamped with author and shift marker
Screenshot Placeholder:
- Notes modal with timeline and input
Annotation Callouts:
- Existing notes timeline
- New note input and send control
Speaker Notes:
- Encourage objective notes that help next shift continue quickly.

### Slide 23 - Complete Ticket as Normal
Purpose: Define normal closure path
On-slide Text:
- Open Complete action
- Choose Normal
- Copy generated response script
- Confirm completion to set status as Normal
- Status sync is sent to sheet updater
Screenshot Placeholder:
- Complete modal in Normal step
Annotation Callouts:
- Normal option
- Copy and complete button
Speaker Notes:
- Teach users to copy response before finalizing status.

### Slide 24 - Complete Ticket as Abnormal
Purpose: Define abnormal closure path
On-slide Text:
- Open Complete action
- Choose Abnormal
- Select abnormal category
- Copy generated abnormal response and confirm
- Ticket status becomes selected abnormal code
Screenshot Placeholder:
- Abnormal flow with category selection
Annotation Callouts:
- Abnormal type selector
- Final status result in table
Speaker Notes:
- The abnormal category should match provider-confirmed outcome.

### Slide 25 - Delete Ticket Rules
Purpose: Prevent accidental data loss
On-slide Text:
- Delete is permanent after confirmation
- Ticket is removed from UI immediately
- If server delete fails, data is refetched
Screenshot Placeholder:
- Delete confirmation prompt
Annotation Callouts:
- Delete icon
- Confirmation action
Speaker Notes:
- Use delete only for true invalid entries, not for normal closure.

---

## Section F: Handover SOP (Critical)

### Slide 26 - Why Handover Matters
Purpose: Set operational importance
On-slide Text:
- Handover ensures pending tickets continue across shifts
- System enforces handover windows and readiness checks
- Incomplete handover increases response risk and delays
Screenshot Placeholder:
- Handover action area on table
Annotation Callouts:
- Handover entry point
- Pending ticket count area
Speaker Notes:
- Frame handover as shift safety control.

### Slide 27 - Pre-Handover Checklist
Purpose: Prevent blocked handover
On-slide Text:
- Verify all Pending tickets have Tracking Number
- Confirm critical notes are added
- Re-check duty assignment for outgoing shift
Screenshot Placeholder:
- Ticket table with tracking number column highlighted
Annotation Callouts:
- Pending rows
- Missing tracking indicators
Speaker Notes:
- Missing tracking values are the top blocker.

### Slide 28 - Reminder Alerts Before Handover
Purpose: Show proactive prompts
On-slide Text:
- Pre-window reminder appears at configured times
- Post-start reminders repeat during active handover period
- Alerts include missing tracking count when applicable
Screenshot Placeholder:
- Header notification bell and reminder toast
Annotation Callouts:
- Reminder toast text
- Bell notification state
Speaker Notes:
- Operators should treat repeated reminders as urgent action cues.

### Slide 29 - Eligibility Check and Blocker Modal
Purpose: Explain mandatory validation
On-slide Text:
- Complete Handover runs eligibility check
- If pending tickets miss tracking number, blocker modal appears
- User must fix listed tickets before proceeding
Screenshot Placeholder:
- Missing tickets handover modal
Annotation Callouts:
- Missing ticket list
- Required fix instruction
Speaker Notes:
- Handover cannot proceed until all required data is present.

### Slide 30 - Manual Handover Success Flow
Purpose: Show exact successful behavior
On-slide Text:
- Handover during valid window triggers:
- Shift notification for incoming shift
- Pending ticket append to handover sheet
- Archive completed tickets
- Handover completed event and outgoing lock behavior
Screenshot Placeholder:
- Handover success modal
Annotation Callouts:
- Success message
- Shift notification confirmation
Speaker Notes:
- This is the expected normal closure for each shift.

### Slide 31 - Auto-Handover Fallback
Purpose: Explain safety net behavior
On-slide Text:
- If outgoing shift misses manual handover and window closes
- System can auto-handover pending tickets
- Notifications and sync still occur to protect continuity
Screenshot Placeholder:
- Evidence of handover notification entry and archived behavior
Annotation Callouts:
- Auto handover indicator in logs/notifications
- Pending transfer result
Speaker Notes:
- Auto mode is fallback only; manual handover remains required standard.

### Slide 32 - Incoming Shift Responsibilities
Purpose: Define receiving-side SOP
On-slide Text:
- Review incoming handover notifications immediately
- Open pending tickets and continue investigations
- Confirm notes and tracking details are sufficient
- Request clarification quickly when context is missing
Screenshot Placeholder:
- Shift notification panel plus pending tickets
Annotation Callouts:
- Notification item
- Pending tickets requiring action
Speaker Notes:
- Receiving team should validate handover quality at shift start.

---

## Section G: Admin and Leader Operations

### Slide 33 - Admin/Leader Scope
Purpose: Clarify elevated capability
On-slide Text:
- Admin/Leader routes to dashboard with IC0 context
- Can monitor across duties for supervision
- Can operate during timing constraints where policy allows
Screenshot Placeholder:
- Admin dashboard view with broad ticket visibility
Annotation Callouts:
- IC0 role indicator
- Multi-duty visibility cues
Speaker Notes:
- Stress governance and oversight responsibility.

### Slide 34 - Admin Oversight Checklist
Purpose: Add leadership control routine
On-slide Text:
- Verify outgoing shift completes handover on time
- Monitor pending volume and missing tracking trends
- Validate abnormal closures for policy consistency
- Intervene on stalled tickets and coordination gaps
Screenshot Placeholder:
- Dashboard with pending and alerts visible
Annotation Callouts:
- Pending concentration zones
- Alert and notification controls
Speaker Notes:
- This checklist can be run at each shift boundary.

---

## Section H: Troubleshooting Decision Slides

### Slide 35 - Login Failed
Purpose: Fast diagnosis path
On-slide Text:
- Symptom: Sign-in error shown on login page
- Check:
- Email/password correctness
- Account exists in auth system
- Profile role exists in profiles table
- Action: Retry with valid credentials or escalate to admin setup
Screenshot Placeholder:
- Login error banner
Annotation Callouts:
- Error location
- Inputs to recheck
Speaker Notes:
- Keep users focused on account state before app-level debugging.

### Slide 36 - Cannot Create Ticket
Purpose: Solve most common operator complaint
On-slide Text:
- Symptom: Create action unavailable or Shift Locked shown
- Check:
- Is your shift active?
- Are you in handover window?
- Has outgoing handover already been completed?
- Action: wait for valid window or use admin escalation path
Screenshot Placeholder:
- Shift Locked state
Annotation Callouts:
- Lock indicator
- Context message
Speaker Notes:
- Usually a policy-time condition, not a broken button.

### Slide 37 - Access Denied on Member/Merchant
Purpose: Explain duty mismatch clearly
On-slide Text:
- Symptom: Access denied warning during member entry
- Check:
- Member ID suffix after @
- Merchant mapped duty
- Your selected duty list
- Action: use correct duty session or route to authorized team
Screenshot Placeholder:
- Merchant duty mismatch warning
Annotation Callouts:
- Member ID input
- Warning message text
Speaker Notes:
- This prevents unauthorized cross-duty processing.

### Slide 38 - Realtime Not Updating
Purpose: Handle sync anxiety
On-slide Text:
- Symptom: ticket changes do not appear instantly
- System behavior:
- Realtime reconnect attempts automatically
- Fallback refresh runs periodically
- Action: wait briefly, then refresh view and verify network stability
Screenshot Placeholder:
- Realtime degraded or restored toast
Annotation Callouts:
- Degraded alert
- Restored alert
Speaker Notes:
- Explain that fallback polling keeps data moving even during temporary socket issues.

### Slide 39 - Handover Blocked
Purpose: Resolve final critical blocker
On-slide Text:
- Symptom: Handover cannot complete
- Check:
- Missing tracking numbers on pending tickets
- Attempt outside handover window
- Action: fill required fields and retry within valid handover window
Screenshot Placeholder:
- Handover blocker modal and early warning modal
Annotation Callouts:
- Missing ticket lines
- Timing warning text
Speaker Notes:
- Use this slide as live incident runbook during shift change.

---

## Section I: Quick Reference Appendix

### Slide 40 - Daily Start Checklist (TM)
Purpose: Standardize shift start
On-slide Text:
- Sign in and confirm assigned shift
- Select correct duty cards
- Verify dashboard visibility and active pending queue
- Confirm provider script workflow is ready
Screenshot Placeholder:
- Dashboard ready state
Annotation Callouts:
- Shift status
- Duty context
Speaker Notes:
- Run this in first 3 minutes of shift.

### Slide 41 - Daily End Checklist (Outgoing Shift)
Purpose: Standardize shift close
On-slide Text:
- Complete all possible tickets
- Ensure every Pending ticket has tracking number
- Add final notes for continuity
- Execute handover within window
- Confirm handover success notification
Screenshot Placeholder:
- Table filtered to Pending and handover control
Annotation Callouts:
- Pending rows
- Handover button and success cue
Speaker Notes:
- This checklist directly reduces next-shift escalations.

### Slide 42 - Status and Terms Glossary
Purpose: Avoid interpretation mismatch
On-slide Text:
- Pending: still in progress, must be handed over if unresolved
- Normal: provider result indicates normal betting
- Abnormal code: provider-confirmed abnormal behavior category
- Tracking Number: required ID for pending handover continuity
Screenshot Placeholder:
- Ticket statuses in table badges
Annotation Callouts:
- Status badge examples
- Tracking number column
Speaker Notes:
- Keep terminology consistent across teams.

### Slide 43 - Script Usage Quick Guide
Purpose: Ensure message consistency
On-slide Text:
- Use generated scripts from selected provider context
- Use SOP tab for provider condition reminders
- Use quick-copy templates for hold, loss, strict-loss, and provider-specific notices
Screenshot Placeholder:
- Script generator and quick-copy controls
Annotation Callouts:
- Copy buttons
- Script output box
Speaker Notes:
- Consistent phrasing lowers miscommunication with provider teams.

### Slide 44 - Escalation Matrix
Purpose: Make support path explicit
On-slide Text:
- Login/account setup issue: escalate to admin account owner
- Duty/merchant permission mismatch: escalate to correct duty lead
- Handover critical blocker near cutoff: escalate to shift leader immediately
- Repeated sync instability: escalate to tech owner with timestamp evidence
Screenshot Placeholder:
- Optional simple matrix design slide
Annotation Callouts:
- Severity levels and response owner
Speaker Notes:
- Helps new operators decide quickly who to contact.

### Slide 45 - End Slide
Purpose: Close training session
On-slide Text:
- SOP complete
- Next: live simulation and supervised first shift
- Keep this deck open during handover windows
Screenshot Placeholder:
- None or branded closing visual
Annotation Callouts:
- None
Speaker Notes:
- Encourage practical shadow run immediately after training.

---

## Screenshot Capture Matrix (Implementation Checklist)

Use this list while capturing screenshots so deck production is complete and consistent.

1. Login screen default
2. Login error state
3. Duty selection with single duty
4. Duty selection with multiple duties
5. Dashboard clean state
6. Header showing shift and user state
7. Provider dropdown open
8. Form with required fields filled
9. Merchant access denied warning
10. SOP tab with provider process rules
11. Generated script with copy action
12. PG Soft duplicate warning modal
13. Ticket created success toast
14. Table search result state
15. Inline edit active field
16. Ownership conflict alert toast
17. Notes modal with timeline
18. Complete ticket modal normal path
19. Complete ticket modal abnormal path
20. Delete confirmation dialog
21. Handover reminder toast
22. Handover missing tracking blocker modal
23. Handover success modal
24. Notification view for incoming shift
25. Shift locked creation state
26. Realtime degraded alert
27. Realtime restored alert
28. Admin broad-visibility dashboard

---

## Presenter Timing Guide

- Slides 1 to 4: 4 minutes
- Slides 5 to 11: 6 minutes
- Slides 12 to 19: 9 minutes
- Slides 20 to 25: 7 minutes
- Slides 26 to 32: 9 minutes
- Slides 33 to 34: 3 minutes
- Slides 35 to 39: 7 minutes
- Slides 40 to 45: 5 minutes
- Total suggested walkthrough: 50 minutes

---

## Final Production Notes For Figma

- Use one visual style for all screenshots: same zoom level and crop ratio.
- Blur or mask real member and provider-sensitive information.
- Keep annotation labels short: What, Why, Next Action.
- Put version footer on every slide: RiskOps SOP v0.0.6.
- Maintain two lanes in training delivery:
- Golden Path (normal operation)
- Exception Path (error and handover blockers)
