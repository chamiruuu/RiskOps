Handover Times
Night -> Morning = 06:45 - 07:30
Morning -> Afternoon = 14:15 - 15:00
Afternoon -> Night = 22:15 - 23:00

Shift Times
Morning = 07:10 - 15:00
Afternoon = 14:40 - 23:00
Night = 22:40 - 07:30

Shift Lock
Morning = 15:00 - 07:10
Afternoon = 23:00 - 14:40
Night = 07:30 - 22:40

    -All time-based logic must GMT+8
    -Pending tickets = ticket.status === "pending"
    -Completed tickets = ticket.status !== "pending"
    -Handover does NOT duplicate tickets.
    -Auto handover must check:
        :IF manual handover already completed → DO NOTHING
    -Handover button enabled IF: 
        - Current time within handover window (M->14:15-14:40 A->22:15-22:40 N->06:45-07:10) 
        - User shift = current active shift 
        - There are unhanded pending tickets
    -A ticket is considered "unhanded" if:
        ticket.created_at > last_handover_timestamp
    -Track handover batch using timestamp or version:
        - Tickets created AFTER last handover timestamp = eligible for re-handover
    - Each shift must store:
        - last_handover_timestamp
        - last_handover_by_user_id
    -Google Sheets must:
        - Use ticket ID as unique key
        - Perform UPSERT (update if exists, insert if not)
    -Handover must be transactional:
        - If sheet write fails → retry till it writes → try for 2 hrs if not alert admin/leader these arent written in google sheets





Night to Morning Handover Process

06:40 = If there are tickets with no tracking ID's filled in remind night shift user to fill it in if provider has already given a tracking ID, cause in 5mins handover will enable, If all tickets tracking ID's have been filled then remind night shift user to make sure that all the tickets have been created, cause in 5mins handover will enable.

06:45 - 07:10 = Handover button will be enable only for night shift user's, they can do the handover manually from clicking the handover button. When the button is clicked it will alert night shift user if there are tickets with no tracking ID's to go back and fill them and handover again or proceed with handover. when handover is success the pending tickets will be moving to morning shift user's screen meanwhile writing them in the google sheet also (only pending tickets), while the completed tickets wont be displayed in morning shift user's screen still night shift user can see the completed tickets till 07:30. BTW night shift user only can press handover button once when the handover is success the handover button will be blocked when pressed it says successfully handover all existing pending tickets no new tickets are their to handover. If a ticket is created after pressing on the handover and greying it out then the handover button will be reenable to handover the new tickets created since they are new and didn't handover before. If any pending tickets which was handover was edited by the user it will change the morning shift user's screen values and will edit the google sheet values as well.

07:06 = If night shift user didn't pressed the handover button alert user to press the handover button and handover to morning shift.

07:08 = If user didn't still press the handover button manually, then the auto handover process begins which will automatically handover the pending tickets and if there are tickets with no tracking ID's it will alert both user's night and morning user's that these tickets have no tracking ID's please fill in, when this auto handover does pending tickets will show in morning shift screen and same time google sheet will also writes if ticket fields are edited then it will edit in morning shift user screen and google sheet too. Until night shift user manually handover or auto handover triggers morning shift user wont see any tickets morning shift will see a message that says to which duty account's he selected it will show related duty is working by night shift which user please wait for them to handover. only when manual or auto handover triggers morning shift see the tickets

07:10 = Morning shift, shift lock disables and morning shift user can create new tickets now while night shift user can still create tickets and coverup their shift.

07:10 - 07:30 = Handover button disbales cause, the tickets created by night shift user's will automatically writes in google sheet cause they are considered as handover tickets.

07:30 = Night shift user's will get shift lock and displayed tickets will be vanish and the also see the message that says this is currently morning shift please wait night shift starts.

*the tickets that were written in google sheet will be completed when the user completes it any time.




Morning to Afternoon Handover Process

14:10 = If there are tickets with no tracking ID's filled in remind morning shift user to fill it in if provider has already given a tracking ID, cause in 5mins handover will enable, If all tickets tracking ID's have been filled then remind morning shift user to make sure that all the tickets have been created, cause in 5mins handover will enable.

14:15 - 14:40 = Handover button will be enable only for morning shift user's, they can do the handover manually from clicing the handover button. When the button is clicked it will
alert morning shift user if there are tickets with no tracking ID's to go back and fill them and handover again or proceed without filling to handover. When handover is sucsess the pending tickets will be moving to afternoon shift user's screen meanwhile writing them in the google sheet also (only pending tickets). while the completed tickets wont be displayed in afternoon shift user's screen. still morning shift user can see the completed tickets till 15:00. BTW morning shift user only can press handover button once when the handover is success the handover button will be blocked when pressed it says successfully handover all existing pending tickets no new tickets are their to handover. If a ticket is created after pressing on the handover and greying it out then the handover button will be reenable to handover the new tickets created since they are new and didn't handover before. If any pending tickets which was handover was edited by the user it will change the afternoon shift user's screen values and will edit the google sheet values as well.

14:36 = If morning shift user didn't pressed the handover button alert user to press the handover button and handover to afternoon shift.

14:38 = If user didn't still press the handover button manually, then the auto handover process begins which will automatically handover the pending tickets and if there are tickets with no tracking ID's it will alert both user's morning and afternoon user's that these tickets have no tracking ID's please fill in, when this auto handover does pending tickets will show in afternoon shift screen and same time google sheet will also writes if ticket fields are edited then it will edit in afternoon shift user screen and google sheet too. Until morning shift user manually handover or auto handover triggers afternoon shift user wont see any tickets afternoon shift will see a message that says to which duty account's he selected it will show related duty is working by morning shift which user please wait for them to handover. only when manual or auto handover triggers afternoon shift see the tickets

14:40 = Afternoon shift, shift lock disables and afternoon shift user can create new tickets now while morning shift user can still create tickets and coverup their shift.

14:40 - 15:00 = Handover button disbales cause, the tickets created by morning shift user's will automatically writes in google sheet cause they are considered as handover tickets.

15:00 = morning shift user's will get shift lock and displayed tickets will be vanish and the also see the message that says this is currently afternoon shift please wait morning shift starts.

*the tickets that were written in google sheet will be completed when the user completes it any time.




Afternoon to Night Handover Process

22:10 = If there are tickets with no tracking ID's filled in remind afternoon shift user to fill it in if provider has already given a tracking ID, cause in 5mins handover will enable, If all tickets tracking ID's have been filled then remind afternoon shift user to make sure that all the tickets have been created, cause in 5mins handover will enable.

22:15 - 22:40 = Handover button will be enable only for afternoon shift user's, they can do the handover manually from clicing the handover button. When the button is clicked it will
alert afternoon shift user if there are tickets with no tracking ID's to go back and fill them and handover again or proceed without filling to handover. When handover is sucsess the pending tickets will be moving to night shift user's screen meanwhile writing them in the google sheet also (only pending tickets). while the completed tickets wont be displayed in night shift user's screen. still afternoon shift user can see the completed tickets till 23:00. BTW afternoon shift user only can press handover button once when the handover is success the handover button will be blocked when pressed it says successfully handover all existing pending tickets no new tickets are their to handover. If a ticket is created after pressing on the handover and greying it out then the handover button will be reenable to handover the new tickets created since they are new and didn't handover before. If any pending tickets which was handover was edited by the user it will change the night shift user's screen values and will edit the google sheet values as well.

22:36 = If afternoon shift user didn't pressed the handover button alert user to press the handover button and handover to night shift.

22:38 = If user didn't still press the handover button manually, then the auto handover process begins which will automatically handover the pending tickets and if there are tickets with no tracking ID's it will alert both user's afternoon and night user's that these tickets have no tracking ID's please fill in, when this auto handover does pending tickets will show in night shift screen and same time google sheet will also writes if ticket fields are edited then it will edit in night shift user screen and google sheet too. Until afternoon shift user manually handover or auto handover triggers night shift user wont see any tickets night shift will see a message that says to which duty account's he selected it will show related duty is working by afternon shift which user please wait for them to handover. only when manual or auto handover triggers night shift see the tickets

22:40 = night shift, shift lock disables and night shift user can create new tickets now while afternoon shift user can still create tickets and coverup their shift.

22:40 - 23:00 = Handover button disbales cause, the tickets created by afternoon shift user's will automatically writes in google sheet cause they are considered as handover tickets.

23:00 = night shift user's will get shift lock and displayed tickets will be vanish and the also see the message that says this is currently afternoon shift please wait afternoon shift starts.

*the tickets that were written in google sheet will be completed when the user completes it any time.