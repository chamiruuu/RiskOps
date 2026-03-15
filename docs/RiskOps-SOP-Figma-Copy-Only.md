# RiskOps SOP - Figma Copy Only

Version: 0.0.6

Use this file for direct text paste into Figma.
Format per slide:
- Title
- Subtitle
- Body
- Action Strip

---

## Slide 1
Title: RiskOps Ticket Management SOP
Subtitle: End-to-end operator workflow
Body:
- From first login to shift handover
- Includes TM and Admin/Leader workflows
- Includes troubleshooting for critical issues
Action Strip: Start Here

## Slide 2
Title: What RiskOps Does
Subtitle: IC duty investigation workflow
Body:
- Create provider investigation tickets
- Track updates in real time
- Complete or hand over pending work across shifts
Action Strip: Understand The Mission

## Slide 3
Title: Roles
Subtitle: Who does what
Body:
- TM: Works within selected duties IC1, IC2, IC3, IC5
- Admin/Leader: IC0 visibility and wider supervision
- Role plus selected duty controls access behavior
Action Strip: Know Your Scope

## Slide 4
Title: Shift Timing
Subtitle: GMT+8 operational model
Body:
- Morning: 07:00 to 14:30
- Afternoon: 14:30 to 22:30
- Night: 22:30 to 07:00
- Handover windows: 14:15-14:45, 22:15-22:45, 06:45-07:15
Action Strip: Time Controls Access

## Slide 5
Title: Before First Login
Subtitle: Prerequisites checklist
Body:
- Active work account credentials
- Profile with role and work name
- Shift assignment in current cycle
- Network access to backend services
Action Strip: Validate Access First

## Slide 6
Title: Login Steps
Subtitle: Standard sign-in path
Body:
- Enter work email
- Enter password
- Click Sign In
- If invalid, error appears on same page
Action Strip: Sign In Securely

## Slide 7
Title: Routing After Login
Subtitle: What screen appears next
Body:
- Admin/Leader auto-routes to dashboard
- TM must select one or more duty cards
- Continue button appears after at least one duty is selected
Action Strip: Select Session Duties

## Slide 8
Title: Duty Selection Practice
Subtitle: Reduce wrong-duty handling
Body:
- Select only duties you actively handle this shift
- Avoid unrelated duties to prevent mistakes
- Re-enter session if duty selection is wrong
Action Strip: Keep Duty Scope Clean

## Slide 9
Title: Dashboard Map
Subtitle: Three primary work zones
Body:
- Header: shift and alerts
- Left panel: ticket generator and SOP tab
- Main panel: ticket table and actions
Action Strip: Learn The Layout

## Slide 10
Title: Ticket Visibility Rules
Subtitle: Why ticket list can be empty
Body:
- Visible when your shift is active
- Visible during valid handover pair window
- Always visible for Admin/Leader
Action Strip: Check Shift Context

## Slide 11
Title: Search Fast
Subtitle: Find existing tickets quickly
Body:
- Search by Member ID
- Search by Provider Account
- Search by Tracking Number
- Partial and case-insensitive matching
Action Strip: Search Before Creating

## Slide 12
Title: Create Permission Gate
Subtitle: Why create can be locked
Body:
- Create allowed in active shift, handover window, or admin override
- Outgoing TM may be locked after handover completion
- Lock state is expected policy behavior
Action Strip: Confirm Create Window

## Slide 13
Title: Step 1 Provider Selection
Subtitle: Provider drives workflow rules
Body:
- Open provider search field
- Select exact provider
- Required form fields change based on provider config
Action Strip: Choose Provider First

## Slide 14
Title: Step 2 Fill Required Fields
Subtitle: Minimum quality input
Body:
- Member ID is mandatory
- Fill provider-required fields only
- Typical requirements include Provider Account and Time Range
Action Strip: Complete Required Inputs

## Slide 15
Title: Time Range Input
Subtitle: Quick and custom date options
Body:
- Use quick ranges for speed
- Use custom range for precision
- Respect provider time limits
Action Strip: Set Accurate Period

## Slide 16
Title: Merchant Duty Validation
Subtitle: Automatic access control
Body:
- Member ID suffix after @ maps merchant
- TM blocked when merchant is outside selected duty
- Admin/Leader bypasses duty mismatch
Action Strip: Resolve Duty Mismatch

## Slide 17
Title: Script and SOP Tabs
Subtitle: Message and policy helpers
Body:
- Generator tab builds provider message from form
- SOP tab shows provider conditions and process
- Copy actions accelerate operations
Action Strip: Generate Then Verify

## Slide 18
Title: PG Soft Duplicate Gate
Subtitle: 7-day repeated check protection
Body:
- System checks recent same member and provider account
- Duplicate warning modal appears when match exists
- User confirms whether to continue
Action Strip: Prevent Duplicate Queries

## Slide 19
Title: Create Success
Subtitle: Completion of create cycle
Body:
- Click create after validation
- Ticket enters Pending status
- Success toast appears and form resets
- New ticket appears immediately in table
Action Strip: Confirm New Pending Row

## Slide 20
Title: Inline Edit
Subtitle: Quick row-level updates
Body:
- Click editable field in row
- Edit value and press Enter or blur
- UI updates instantly then persists in backend
Action Strip: Edit With Intent

## Slide 21
Title: Edit Conflict Alert
Subtitle: Collaboration safety signal
Body:
- Alert appears if another user edits same ticket during your edit window
- Review latest row values before further changes
Action Strip: Reconcile Before Continuing

## Slide 22
Title: Notes Workflow
Subtitle: Build continuity context
Body:
- Open notes modal on target ticket
- Add concise operational note
- Note stores author and shift marker
Action Strip: Log Clear Notes

## Slide 23
Title: Complete as Normal
Subtitle: Normal resolution path
Body:
- Open complete action
- Select Normal
- Copy generated response text
- Confirm completion to set status Normal
Action Strip: Close Normal Cases

## Slide 24
Title: Complete as Abnormal
Subtitle: Abnormal resolution path
Body:
- Open complete action
- Select Abnormal and category
- Copy generated response
- Confirm completion to apply abnormal status
Action Strip: Close Abnormal Cases

## Slide 25
Title: Delete Ticket
Subtitle: Permanent removal policy
Body:
- Delete removes ticket permanently after confirmation
- UI removes row immediately
- Failed delete triggers data recovery via refresh path
Action Strip: Delete Only Invalid Cases

## Slide 26
Title: Handover Importance
Subtitle: Shift continuity control
Body:
- Pending tickets must be handed over across shifts
- Handover process is policy-critical
- Missing handover increases operational risk
Action Strip: Prioritize Handover

## Slide 27
Title: Pre-Handover Checklist
Subtitle: Mandatory readiness steps
Body:
- Ensure all Pending tickets have Tracking Number
- Add final continuity notes
- Confirm outgoing duty context
Action Strip: Prepare Before Submit

## Slide 28
Title: Handover Reminders
Subtitle: Time-based warning system
Body:
- Pre-handover reminder appears before window
- Repeating reminders appear during post-start period
- Missing tracking count is highlighted
Action Strip: Respond To Reminders

## Slide 29
Title: Handover Blocker
Subtitle: Missing tracking enforcement
Body:
- Eligibility check runs before handover
- Missing tracking numbers trigger blocker modal
- User must fix listed tickets first
Action Strip: Clear All Missing Items

## Slide 30
Title: Manual Handover Success
Subtitle: Expected normal handover result
Body:
- Shift notification sent to incoming shift
- Pending tickets appended to handover sheet
- Completed historical tickets archived
- Handover completion event applied
Action Strip: Confirm Success State

## Slide 31
Title: Auto-Handover Fallback
Subtitle: Safety net after window closes
Body:
- If manual handover is missed, system can auto-process pending tickets
- Notification and sync behavior still runs
- Manual handover remains standard expectation
Action Strip: Use Fallback As Backup

## Slide 32
Title: Incoming Shift SOP
Subtitle: Receiving-side responsibilities
Body:
- Review handover notifications immediately
- Continue pending tickets with provided context
- Escalate quickly if handover detail is insufficient
Action Strip: Validate Incoming Work

## Slide 33
Title: Admin and Leader Scope
Subtitle: Elevated oversight behavior
Body:
- IC0 context provides broad monitoring capability
- Supports cross-duty supervision
- Used for operational governance and intervention
Action Strip: Supervise Responsibly

## Slide 34
Title: Admin Oversight Checklist
Subtitle: Shift health monitoring
Body:
- Check handover completion timing
- Watch pending and missing tracking trends
- Verify abnormal outcomes align with policy
- Intervene on stuck queues
Action Strip: Run Shift Audit

## Slide 35
Title: Troubleshooting Login
Subtitle: First diagnosis branch
Body:
- Symptom: login error
- Check credentials and account state
- Confirm profile role exists
- Escalate account setup issues to admin owner
Action Strip: Fix Access Layer

## Slide 36
Title: Troubleshooting Create Lock
Subtitle: Creation not available
Body:
- Symptom: Shift Locked or disabled create action
- Check shift status and handover window
- Check post-handover lock condition
- Retry in valid window or escalate
Action Strip: Validate Timing Rules

## Slide 37
Title: Troubleshooting Access Denied
Subtitle: Merchant-duty mismatch
Body:
- Symptom: Access denied after Member ID entry
- Check member suffix and mapped duty
- Check your selected duties for this session
- Route to correct duty owner when mismatched
Action Strip: Route Correctly

## Slide 38
Title: Troubleshooting Realtime
Subtitle: Delayed updates
Body:
- Symptom: updates not instant
- Realtime reconnect attempts run automatically
- Fallback refresh continues synchronization
- Verify network stability
Action Strip: Trust Fallback Then Verify

## Slide 39
Title: Troubleshooting Handover Failure
Subtitle: Critical cutoff issue
Body:
- Symptom: handover cannot complete
- Check missing tracking values
- Check if outside valid handover window
- Fix data and retry in-window
Action Strip: Recover Before Cutoff

## Slide 40
Title: TM Start-of-Shift Checklist
Subtitle: First 3-minute routine
Body:
- Sign in and verify assigned shift
- Select correct duties
- Confirm dashboard and pending queue visibility
- Prepare script workflow for providers
Action Strip: Start Cleanly

## Slide 41
Title: Outgoing Shift Checklist
Subtitle: End-of-shift routine
Body:
- Resolve what can be completed
- Fill tracking numbers on all pending
- Add final notes
- Execute handover inside valid window
Action Strip: Close Shift Safely

## Slide 42
Title: Status Glossary
Subtitle: Shared terminology
Body:
- Pending: unresolved and must continue
- Normal: provider result indicates normal behavior
- Abnormal code: confirmed abnormal category
- Tracking Number: required handover reference
Action Strip: Speak One Language

## Slide 43
Title: Script Usage Quick Rules
Subtitle: Message quality and consistency
Body:
- Use provider-generated scripts from current form context
- Check SOP tab rules before sending
- Use quick templates for common responses
Action Strip: Send Standardized Messages

## Slide 44
Title: Escalation Matrix
Subtitle: Who to contact and when
Body:
- Account issues: admin account owner
- Duty mismatch issues: correct duty lead
- Handover blocker near cutoff: shift leader now
- Repeated sync instability: technical owner with timestamps
Action Strip: Escalate Fast

## Slide 45
Title: SOP Complete
Subtitle: Move to live simulation
Body:
- You are ready for supervised operations
- Keep this deck available during first shifts
- Focus on handover quality and clean notes
Action Strip: Operate With Confidence

---

## Suggested Footer (all slides)
RiskOps SOP v0.0.6 | Internal Use Only
