Handover Times
N -> M = 06:45 - 07:30
M -> A = 14:15 - 15:00
A -> N = 22:15 - 23:00

Shift Times
M = 07:10 - 15:00
A = 14:40 - 23:00
N = 22:40 - 07:30

Shift Lock
M = 15:00 - 07:10
A = 23:00 - 14:40
N = 07:30 - 22:40



Night to Morning Handover Process

06:40 = If there are tickets with no tracking ID's filled in remind night shift user to fill it in if provider has already given a tracking ID, cause in 5mins handover will enable, If all tickets tracking ID's have been filled then remind night shift user to make sure that all the tickets have been created, cause in 5mins handover will enable.

06:45 - 07:10 = Handover button will be enable only for night shift user's, they can click and handover manually from clicking the handover button. When the button is clicked it will alert night shift user if there are tickets with no tracking ID's to go back and fill them and handover again or proceed with handover. when handover is success the pending tickets will be moving to morning shift user's screen meanwhile writing them in the google sheet also (only pending tickets), while the completed tickets wont be displayed in morning shift user's screen still night shift user can see the completed tickets till 07:30. BTW night shift user only can press handover button once when the handover is success the handover button will be blocked when pressed it says successfully handover all existing pending tickets no new tickets are their to handover. If a ticket is created after pressing on the handover and greying it out then the handover button will be reenable to handover the new tickets created since they are new and didn't handover before. If any pending tickets which was handover was edited by the user it will change the morning shift user's screen values and will edit the google sheet values as well.

07:06 = If night shift user didn't pressed the handover button alert user to press the handover button and handover to morning shift.

07:08 = If user didn't still press the handover button manually, then the auto handover process begins which will automatically handover the pending tickets and if there are tickets with it will alert both user's night and morning user's that these tickets have no tickets please fill in, when this auto handover does pending tickets will show in morning shift screen and same time google sheet will also writes if ticket fields are edited then it will edit in morning shift user screen and google sheet too. Until night shift user manually handover or auto handover triggers morning shift user wont see any tickets morning shift will see a message that says to which duty account's he selected it will show related duty is working by night shift which user please wait for them to handover. only when manual or auto handover triggers morning shift see the tickets

07:10 = Morning shift, shift lock disables and morning shift user can create new tickets now while night shift user can still create tickets and coverup their shift.

07:10 - 07:30 = Hanover button disbales cause, the tickets created by night shift user's will automatically writes in google sheet cause they are considered as handover tickets.

07:30 = Night shift user's will get shift lock and displayed tickets will be vanish and the also see the message that says this is currently morning shift please wait night shift starts.

*the tickets that were written in google sheet will be completed when the user completes it any time.