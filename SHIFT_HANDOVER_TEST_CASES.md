# Shift Handover Test Cases with Timings

All times in **GMT+8**

---

## NIGHT TO MORNING HANDOVER (06:45 - 07:10)

### Pre-Handover Window

#### TC-N2M-01: T+06:40 - Tracking ID Reminder (5 min before handover)
- **Time**: 06:40
- **Precondition**: Night shift user has pending tickets with missing tracking IDs
- **Action**: System displays reminder to fill tracking IDs
- **Expected**: Alert shown "If provider has already given tracking ID, please fill in. Handover will enable in 5 minutes"
- **Verify**: Handover button remains disabled

#### TC-N2M-02: T+06:40 - All Tracking IDs Complete
- **Time**: 06:40
- **Precondition**: All pending tickets have tracking IDs filled
- **Action**: System displays reminder to verify all tickets created
- **Expected**: Alert shown "Make sure all tickets have been created. Handover will enable in 5 minutes"
- **Verify**: Handover button remains disabled

### Manual Handover Window

#### TC-N2M-03: T+06:45 - Handover Button Enabled
- **Time**: 06:45 (handover window opens)
- **Precondition**: Within handover window, night shift user, pending tickets exist
- **Action**: Check handover button state
- **Expected**: Handover button is ENABLED and clickable
- **Verify**: Only night shift users see enabled button

#### TC-N2M-04: T+06:50 - Manual Handover with Missing Tracking IDs
- **Time**: 06:50 (during window)
- **Precondition**: User clicks handover, some tickets missing tracking IDs
- **Action**: Click handover button
- **Expected**: Alert shows tickets with missing tracking IDs, asks to fill or proceed
- **Verify**: User can confirm proceed or go back

#### TC-N2M-05: T+06:55 - Successful Manual Handover
- **Time**: 06:55 (during window)
- **Precondition**: User clicks handover with complete tracking IDs
- **Action**: Click handover button, confirm
- **Expected**: 
  - Pending tickets transfer to morning shift screen
  - Google Sheets updated with pending tickets
  - Handover button greys out (blocked)
  - Alert: "Successfully handover all existing pending tickets. No new tickets to handover"
- **Verify**: 
  - Morning shift user sees tickets
  - Completed tickets still visible to night shift till 07:30
  - Database logs handover event

#### TC-N2M-06: T+07:00 - Manual Handover Completion Lock
- **Time**: 07:00
- **Precondition**: Manual handover already completed at 06:55
- **Action**: Night shift user attempts to click handover button again
- **Expected**: Handover button disabled/greyed out with message
- **Verify**: Cannot perform duplicate handover

#### TC-N2M-07: T+07:02 - New Ticket Created After Handover (Re-enable)
- **Time**: 07:02
- **Precondition**: Manual handover completed, new ticket created after handover timestamp
- **Action**: Night shift user creates new ticket
- **Expected**: Handover button RE-ENABLES
- **Verify**: 
  - Only new tickets eligible for re-handover
  - Timestamp-based eligibility works

#### TC-N2M-08: T+07:05 - Pending Ticket Edited After Handover
- **Time**: 07:05
- **Precondition**: Handovered pending ticket edited by night shift user
- **Action**: Night shift user edits ticket field
- **Expected**: 
  - Morning shift user sees updated values
  - Google Sheet updated with new values
- **Verify**: Edit propagates to morning shift screen and sheet

### Auto Handover Window

#### TC-N2M-09: T+07:06 - Auto Handover Alert (2 minutes before)
- **Time**: 07:06
- **Precondition**: Manual handover NOT completed
- **Action**: System triggers alert
- **Expected**: Alert to night shift user "Please press handover button and handover to morning shift"
- **Verify**: Alert visible, can still do manual handover

#### TC-N2M-10: T+07:08 - Auto Handover Initiates
- **Time**: 07:08
- **Precondition**: Manual handover NOT completed, 07:06 alert ignored
- **Action**: System automatically starts auto-handover process
- **Expected**: 
  - All pending tickets auto-handover
  - Tickets with missing tracking IDs trigger alert to BOTH shifts
  - Morning shift gets tickets on their screen
  - Google Sheets written to
- **Verify**: 
  - No manual action required
  - Both users alerted about missing tracking IDs
  - Transactional write to sheets

#### TC-N2M-11: T+07:08 - Auto Handover Duplicate Check
- **Time**: 07:08
- **Precondition**: Manual handover already completed at 06:50
- **Action**: System reaches auto-handover time
- **Expected**: DO NOTHING (manual handover already completed check passes)
- **Verify**: No duplicate handover tickets written

#### TC-N2M-12: T+07:09 - Sheet Write Failure Retry
- **Time**: 07:09
- **Precondition**: Auto handover triggered, Google Sheet write fails initially
- **Action**: System detects write failure
- **Expected**: System retries for up to 2 hours, alert sent if still failing
- **Verify**: Retry loop works, admin/leader alerted if tickets not in sheets

### Post-Handover Window

#### TC-N2M-13: T+07:10 - Shift Lock Disabled for Morning, New Ticket Creation
- **Time**: 07:10 (morning shift lock disables)
- **Precondition**: Morning shift starts
- **Action**: Morning shift user attempts to create new ticket
- **Expected**: Morning shift can create new tickets immediately
- **Verify**: Shift lock state verified in database

#### TC-N2M-14: T+07:10-07:30 - Auto-Write for Night Shift Coverup Tickets
- **Time**: 07:10 - 07:30
- **Precondition**: Night shift user creates new ticket at 07:15 during this window
- **Action**: Night shift user creates new ticket after 07:10
- **Expected**: Ticket automatically written to Google Sheets (considered handover ticket)
- **Verify**: Sheet contains ticket without manual handover

#### TC-N2M-15: T+07:30 - Night Shift Lock Enabled, Tickets Vanish
- **Time**: 07:30 (night shift lock enables)
- **Precondition**: Night shift ending
- **Action**: Check night shift user screen
- **Expected**: 
  - All handovered pending tickets disappear
  - Night shift gets shift lock
  - Message: "This is currently morning shift. Please wait, night shift starts at 22:40"
  - Completed tickets still visible to night shift in UI (if any)
- **Verify**: Ticket visibility rules correct

---

## MORNING TO AFTERNOON HANDOVER (14:15 - 14:40)

### Pre-Handover Window

#### TC-M2A-01: T+14:10 - Tracking ID Reminder (5 min before)
- **Time**: 14:10
- **Precondition**: Morning shift user has pending tickets with missing tracking IDs
- **Action**: System displays reminder
- **Expected**: Alert shown to morning shift user
- **Verify**: Handover button remains disabled

#### TC-M2A-02: T+14:10 - All Tracking IDs Complete
- **Time**: 14:10
- **Precondition**: All pending tickets have tracking IDs
- **Action**: System displays verification reminder
- **Expected**: Alert shown accordingly
- **Verify**: Handover button remains disabled

### Manual Handover Window

#### TC-M2A-03: T+14:15 - Handover Button Enabled
- **Time**: 14:15 (handover window opens)
- **Precondition**: Morning shift user, pending tickets exist
- **Action**: Check handover button
- **Expected**: Handover button ENABLED (only for morning shift)
- **Verify**: Afternoon shift cannot see enabled button

#### TC-M2A-04: T+14:20 - Manual Handover without Tracking ID Fill
- **Time**: 14:20
- **Precondition**: User clicks handover despite missing tracking IDs
- **Action**: Click handover, choose "proceed without filling"
- **Expected**: Tickets transfer anyway, alert alerted both users about missing tracking IDs
- **Verify**: Handover proceeds, alert sent to both shifts

#### TC-M2A-05: T+14:25 - Successful Manual Handover
- **Time**: 14:25
- **Precondition**: Click handover button with valid data
- **Action**: Confirm handover
- **Expected**: 
  - Pending tickets move to afternoon shift
  - Google Sheets updated
  - Handover button blocked
- **Verify**: Afternoon shift sees tickets, morning shift sees completed tickets till 15:00

#### TC-M2A-06: T+14:30 - Pending Ticket Edited Post-Handover
- **Time**: 14:30
- **Precondition**: Morning shift edits a handovered pending ticket
- **Action**: Edit ticket field
- **Expected**: Afternoon shift screen updates, Google Sheet updates
- **Verify**: Changes propagate across shifts and sheets

### Auto Handover Window

#### TC-M2A-07: T+14:36 - Auto Handover Alert
- **Time**: 14:36 (4 minutes before auto)
- **Precondition**: Manual handover NOT completed
- **Action**: Alert triggered
- **Expected**: Morning shift alerted to press handover button
- **Verify**: Can still perform manual handover

#### TC-M2A-08: T+14:38 - Auto Handover Processes
- **Time**: 14:38
- **Precondition**: Manual handover not done, alert ignored
- **Action**: Auto-handover triggers
- **Expected**: 
  - All pending tickets auto-handover
  - Both shifts alerted about missing tracking IDs
  - Tickets visible to afternoon shift
  - Google Sheets written
- **Verify**: Transactional write, no duplicates if manual already done

### Post-Handover Window

#### TC-M2A-09: T+14:40 - Afternoon Shift Lock Disabled
- **Time**: 14:40
- **Precondition**: Afternoon shift begins
- **Action**: Afternoon shift user creates new ticket
- **Expected**: Can create immediately (lock disabled)
- **Verify**: Database shows shift lock state correct

#### TC-M2A-10: T+14:40-15:00 - Auto-Write for Morning Coverup Tickets
- **Time**: 14:40 - 15:00
- **Precondition**: Morning user creates ticket at 14:50 during window
- **Action**: Create new ticket
- **Expected**: Auto-written to Google Sheets
- **Verify**: Sheet updated without manual handover

#### TC-M2A-11: T+15:00 - Morning Shift Lock Enabled
- **Time**: 15:00 (morning shift ends)
- **Precondition**: Morning shift ending
- **Action**: Check morning shift user screen
- **Expected**: 
  - Handovered pending tickets vanish
  - Shift lock enabled
  - Message shown
- **Verify**: Ticket visibility correct

---

## AFTERNOON TO NIGHT HANDOVER (22:15 - 22:40)

### Pre-Handover Window

#### TC-A2N-01: T+22:10 - Tracking ID Reminder
- **Time**: 22:10
- **Precondition**: Afternoon shift has pending tickets with missing tracking IDs
- **Action**: System displays reminder
- **Expected**: Alert shown to afternoon shift user
- **Verify**: Handover button remains disabled

#### TC-A2N-02: T+22:10 - All Tracking IDs Complete
- **Time**: 22:10
- **Precondition**: All tickets have tracking IDs
- **Action**: System displays verification reminder
- **Expected**: Handover will enable in 5 minutes message
- **Verify**: Handover button remains disabled

### Manual Handover Window

#### TC-A2N-03: T+22:15 - Handover Button Enabled
- **Time**: 22:15 (handover window opens)
- **Precondition**: Afternoon user, pending tickets
- **Action**: Check button state
- **Expected**: Handover button ENABLED (only afternoon shift)
- **Verify**: Night shift cannot interact

#### TC-A2N-04: T+22:20 - Manual Handover Process
- **Time**: 22:20
- **Precondition**: Click handover button
- **Action**: Confirm handover
- **Expected**: 
  - Pending tickets move to night shift
  - Google Sheets updated
  - Button blocked
- **Verify**: Night shift sees tickets, afternoon sees completed till 23:00

#### TC-A2N-05: T+22:30 - Ticket Edited Post-Handover
- **Time**: 22:30
- **Precondition**: Afternoon shift edits handovered ticket
- **Action**: Edit field
- **Expected**: Night shift screen updates, Google Sheet updates
- **Verify**: Changes synchronized

### Auto Handover Window

#### TC-A2N-06: T+22:36 - Auto Handover Alert
- **Time**: 22:36
- **Precondition**: Manual handover not done
- **Action**: Alert triggered
- **Expected**: Afternoon shift alerted
- **Verify**: Can still perform manual handover

#### TC-A2N-07: T+22:38 - Auto Handover Processes
- **Time**: 22:38
- **Precondition**: Alert ignored
- **Action**: Auto-handover triggers
- **Expected**: 
  - All pending tickets handover
  - Missing tracking IDs alerted to both
  - Night shift gets tickets
  - Google Sheets written
- **Verify**: Correct propagation

### Post-Handover Window

#### TC-A2N-08: T+22:40 - Night Shift Lock Disabled
- **Time**: 22:40
- **Precondition**: Night shift begins
- **Action**: Night shift user creates ticket
- **Expected**: Can create immediately
- **Verify**: Shift lock disabled at correct time

#### TC-A2N-09: T+22:40-23:00 - Auto-Write for Afternoon Coverup
- **Time**: 22:40 - 23:00
- **Precondition**: Afternoon user creates ticket at 22:50
- **Action**: Create new ticket
- **Expected**: Auto-written to sheets
- **Verify**: Google Sheets updated

#### TC-A2N-10: T+23:00 - Afternoon Shift Lock Enabled
- **Time**: 23:00
- **Precondition**: Afternoon shift ending
- **Action**: Check afternoon shift screen
- **Expected**: 
  - Tickets vanish (shift lock)
  - Message shown
- **Verify**: Correct state at shift end

---

## EDGE CASES & CRITICAL SCENARIOS

### EC-01: Manual Handover Already Done Check
- **Precondition**: Manual handover completed at 06:55
- **Action**: Auto-handover triggers at 07:08
- **Expected**: System checks `IF manual handover already completed → DO NOTHING`
- **Verify**: No duplicate tickets in Google Sheets, database shows single handover event

### EC-02: Transactional Sheet Write Failure
- **Precondition**: Handover triggered, Google Sheets API returns timeout
- **Action**: Monitor retry mechanism
- **Expected**: System retries for 2 hours, alerts admin/leader if still failing
- **Verify**: Tickets can be manually verified in sheets after retry

### EC-03: Ticket Created After Handover (Eligibility)
- **Precondition**: Handover completes at 06:55, new ticket created at 06:58
- **Action**: New ticket created after handover timestamp
- **Expected**: 
  - New ticket only visible to current shift
  - Handover button re-enables
  - New ticket eligible for re-handover
- **Verify**: `ticket.created_at > last_handover_timestamp`

### EC-04: Session End During Handover Window
- **Precondition**: User session expires during 14:20 (handover window)
- **Action**: Monitor what happens
- **Expected**: Handover state is NOT lost, can resume when user logs back in
- **Verify**: Database has consistent state

### EC-05: Multiple Users in Same Shift
- **Precondition**: 2 night shift users logged in, one does manual handover at 06:55
- **Action**: Second night shift user tries to handover again at 07:00
- **Expected**: Handover button blocked for all night shift users (session-wide lock)
- **Verify**: Prevents duplicate handovers

### EC-06: Zero Pending Tickets (No Handover Needed)
- **Precondition**: No pending tickets at handover window
- **Action**: Handover button behavior
- **Expected**: Handover button disabled (no tickets to handover)
- **Verify**: Message: "No pending tickets to handover"

### EC-07: Google Sheets UPSERT Logic
- **Precondition**: Ticket ID "TK-001" exists in sheet from previous day
- **Action**: Ticket "TK-001" handovered again with new values
- **Expected**: Sheet UPDATES existing row (not duplicate insert)
- **Verify**: Ticket ID as unique key works, no duplicate rows

### EC-08: Completed Tickets Post-Handover
- **Precondition**: Morning shift user completes a ticket at 14:30
- **Action**: Check Google Sheets
- **Expected**: Sheet updates completion status immediately
- **Verify**: Sheets reflects completed status any time after completion

---

## TIMING VALIDATION TEST MATRIX

| Test | Time | Action | Expected Result |
|------|------|--------|-----------------|
| Night-06:40 | 06:40 | Check reminder | Alert shown, button disabled |
| Night-06:45 | 06:45 | Check button | Button ENABLED |
| Night-06:55 | 06:55 | Manual handover | Tickets transfer, button blocked |
| Night-07:06 | 07:06 | System alert | Alert shown if not done |
| Night-07:08 | 07:08 | Auto-handover | Auto process if manual not done |
| Night-07:10 | 07:10 | Shift change | Morning lock off, night lock management |
| Night-07:30 | 07:30 | End window | Night shift lock on |
| Morning-14:10 | 14:10 | Check reminder | Alert shown, button disabled |
| Morning-14:15 | 14:15 | Check button | Button ENABLED |
| Morning-14:40 | 14:40 | Shift change | Afternoon lock off |
| Morning-15:00 | 15:00 | End window | Morning lock on |
| Afternoon-22:10 | 22:10 | Check reminder | Alert shown, button disabled |
| Afternoon-22:15 | 22:15 | Check button | Button ENABLED |
| Afternoon-22:40 | 22:40 | Shift change | Night lock off |
| Afternoon-23:00 | 23:00 | End window | Afternoon lock on |

---

## ACCEPTANCE CRITERIA

- [ ] All timing triggers within +/- 30 seconds of specified times
- [ ] Handover button state changes exactly as specified per timing
- [ ] Manual handover blocks duplicate attempts
- [ ] Auto-handover checks for prior completion (no duplicates)
- [ ] Google Sheets writes transactionally (all-or-nothing)
- [ ] Sheet write failures retry for 2 hours with admin alert
- [ ] Shift locks enable/disable at exact times
- [ ] Tickets visible only to correct shifts at correct times
- [ ] Ticket edits propagate across shifts and sheets
- [ ] Time-based eligibility (created_at > last_handover_timestamp) works correctly
- [ ] Each shift stores last_handover_timestamp and last_handover_by_user_id
