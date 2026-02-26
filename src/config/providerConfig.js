export const PROVIDER_CONFIG = {
  // --- 1. PG SOFT ---
  "PG Soft": {
    channel: "QQ288- PG Soft Support交流群",
    sla: "At least 1 business day (excl. weekends/holidays)",
    conditions: [
      "The member's betting record must have a minimum of 5 bets.",
      "If a merchant asks about a member with loss, please inform them directly that the member has no profit and therefore does not meet the query conditions.",
    ],
    process: [
      "First, check if the member has betting records during the query period and if the profit is positive. If so, submit the query to the provider group.",
      "After waiting for the provider's response, notify the merchant according to the result:",
      " • Normal: Inform merchant that the member is normal.",
      " • Abnormal: Use the script 'Notifying merchants about abnormal betting members' to notify merchant.",
      {
        text: " • Already checked within 7 days: Use the following script to notify merchant:",
        // NEW: This text will appear in a copyable box!
        copyText:
          "Hi sir, this is [Your Name], please refer to the message from the provider:\n[ Paste the information from the provider here ]",
        image: "https://snipboard.io/BGqItb.jpg",
      },
    ],
    reminder:
      "Do not copy the provider's tracking number and signature to merchant.",

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nAgent Name：QQ288\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 2. EVOLUTION GAMING (UPDATED) ---
  "Evolution Gaming": {
    channel: "(v88_qq) Evolution [QQi] #EVD",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: (v88_qq) Evolution [QQi] #EVD",
    ],

    // I added timeRange here so the input box shows up for the script!
    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\nCategory：Casino\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 3. PRAGMATIC PLAY ---
  "Pragmatic Play": {
    channel: "[T1] PP - FP [A-BT-LC-S] & QQ288 TECH SUPPORT SLOTS",
    sla: "Refer to Group Pinned Message",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: [T1] PP - FP...", // Updated to "Teams Group"
      "Wait for provider feedback.",
    ],
    reminder:
      "Make sure to include the Provider Name 'Pragmatic Play' in the script.",
    requiredFields: ["memberId", "timeRange"],
    generateScript: (data, workName) => {
      const { memberId, timeRange } = data;
      if (memberId && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${memberId}\nTime period：${timeRange}\nProvider name：Pragmatic Play`;
      }
      return "// Waiting for Member ID and Time Period...";
    },
  },

  // --- 4. POKERQ ---
  PokerQ: {
    channel: "QQ288 - PKQ integration group",
    sla: "Standard",
    conditions: [
      "1. The member's withdrawal exceeds 50 times their deposit amount (e.g., a deposit of 50K followed by a withdrawal of 2.5M).",
      "2. It is the member's first withdrawal.",
      "3. Merchant suspect a player's betting has any suspicious aspects, so a screenshot is provided.",
    ],
    conditionScript: (workName) => {
      return `Hi there this is ${workName}, please be informed that there are some new rules about checking the players fraud transactions from PokerQ.\n1. Players withdraw over 50x with his last deposit amount ( example : deposit 50K and then withdraw 2.5M ).\n2. First time withdrawal\n3. Suspect of something suspicious about the players transactions and provide the screenshot proof for us.`;
    },
    process: [
      "Check the member's status on the provider's BO.",
      "If inactive: It is always due to chip dumping (Do not query).",
      "If Normal: Check the guidelines on the left before confirming with the provider.",
      "Submit to integration group based on the query condition standard script.",
    ],
    reminder:
      "Status 'inactive' is always chip dumping. Only query if status is 'Normal'.",
    requiredFields: [
      "memberId",
      "providerAccount",
      "currency",
      "reasonToCheck",
      "timeRange",
    ],
    options: {
      currencies: ["IDR", "THB", "VND", "MYR", "PHP", "SGD", "USD", "KRW"],
      reasons: [
        "1. The member's withdrawal exceeds 50 times their deposit amount (e.g., a deposit of 50K followed by a withdrawal of 2.5M).",
        "2. It is the member's first withdrawal.",
        "3. Merchant suspect a player's betting has any suspicious aspects, so a screenshot is provided.",
      ],
    },
    generateScript: (data, workName) => {
      const { providerAccount, currency, reasonToCheck, timeRange } = data;

      const currencyMap = {
        IDR: "ID",
        THB: "TH",
        VND: "VN",
        MYR: "MY",
        PHP: "PH",
        SGD: "SG",
        USD: "US",
        KRW: "KR",
      };

      const curSymbol = currencyMap[currency] || "";

      if (providerAccount && currency && reasonToCheck && timeRange) {
        const cleanReason = reasonToCheck.replace(/^\d+\.\s*/, "");
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${curSymbol}A000${providerAccount}\nTime period：${timeRange}\nReason：${cleanReason}`;
      }
      return "// Waiting for Provider Account, Currency, Reason, and Time Range...";
    },
  },

  // --- 5. BG CASINO ---
  "BG Casino": {
    channel: "(SH-SL BG)QQ 客服B-服务群詢問",
    sla: "Standard",
    conditions: [
      "The service for querying abnormal betting is only available for the last 7 days, calculated from the date the query is requested.",
    ],
    process: [
      "Ensure the query time period is strictly within the last 7 days.",
      "Select the appropriate currency to map to the correct Lobby Code.",
      "Generate and submit the script to the BG Casino support Teams group.", // Updated to Teams
    ],
    reminder: "Do not submit queries for dates older than 7 days from today.",
    requiredFields: ["memberId", "providerAccount", "currency", "timeRange"],
    options: {
      currencies: ["CNY", "THB", "IDR", "MYR", "VND"],
    },
    generateScript: (data, workName) => {
      const { providerAccount, currency, timeRange } = data;

      const lobbyMap = {
        CNY: "sh00",
        THB: "si00",
        IDR: "sj00",
        MYR: "sk00",
        VND: "sl00",
      };

      const lobbyCode = lobbyMap[currency] || "";

      if (providerAccount && currency && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nLobby Code：${lobbyCode}\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account, Currency, and Time Range...";
    },
  },

  // --- 6. OG PLUS ---
  "OG Plus": {
    channel: "东方─ mog313-QQ288- OG-[tw]v2",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Select the member's currency to generate the correct BO Account.",
      "Submit the query to the OG Plus integration group.",
    ],
    requiredFields: ["memberId", "providerAccount", "currency", "timeRange"],
    options: {
      currencies: ["CNY", "THB", "IDR", "MYR", "VND", "USD", "KRW"],
    },
    generateScript: (data, workName) => {
      const { providerAccount, currency, timeRange } = data;

      const boAccount = currency ? `OG288duty${currency}` : "";

      if (providerAccount && currency && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nBO account by currency：${boAccount}\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account, Currency, and Time Range...";
    },
  },

  // --- 7. PT CASINO (NEW) ---
  "PT Casino": {
    channel: "[TM] PT x QQ288 - [BT-S] or Email: cs@crossits.com",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: [TM] PT x QQ288 - [BT-S]",
      "If unavailable, send an email to the provider at cs@crossits.com.",
    ],
    // Note: I added timeRange here so the input box shows up for the script!
    requiredFields: ["memberId", "providerAccount", "timeRange"],
    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 8. WM (NEW) ---
  WM: {
    channel: "【WM242】QQ288-WM真人API",
    sla: "Standard",
    conditions: [
      "The service for querying abnormal betting is only available for the last seven days, calculated from the date the query is requested.",
    ],
    process: [
      "Check member details in BO.",
      "Ensure the query time period is strictly within the last 7 days.",
      "Submit query to the Teams Group: 【WM242】QQ288-WM真人API",
    ],
    reminder: "Do not submit queries for dates older than 7 days from today.",

    // I added timeRange here as well since it's in the script!
    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 9. SEXY CASINO ---
  "Sexy Casino": {
    channel: "Manual BO Check (No Teams Group)",
    sla: "Immediate (Manual)",
    conditions: [
      "Maximum range for a single query is 7 days (only data from the last 14 days is retained).",
      "A member is considered abnormal if the Hedging Round data accounts for at least 50% of the Repeat Round data.",
      "Bet cancellation is offered (completely voided, stake refunded). If a merchant asks, it's acceptable, but CS MUST create a Redmine specifying if it's a full or partial cancellation.",
    ],
    process: [
      // NEW: We changed this to an object so it can hold the image link!
      {
        text: "Log in to the provider's BO -> Fraud tools -> Sexy Hedging Detection -> Select [All Game].",
        image: "https://snipboard.io/xwYg7X.jpg",
      },
      "Set Date Range: Select the query period.",
      "Set User ID: Enter the member's game account (q28 + BO1.13 Provider ID).",
      "Set Repeat Rate: Set 50%, then click Search.",
      "Evaluate the search results based on the 50% Hedging/Repeat ratio.",
    ],
    reminder:
      "If BO is under maintenance, contact your leader. Late-night shift must fill out a handover for the morning shift leader.",
    requiredFields: [],
    isManualCheckOnly: true,
    generateScript: () => {
      return `// NO SCRIPT REQUIRED FOR SEXY CASINO.\n// \n// Please perform the check manually via the Provider Back Office.\n// Reference the SOP Guide tab for instructions.\n//\n// NOTE: If bet cancellation is requested, remember to create a Redmine.`;
    },
  },

  // --- 9. SEXY CASINO ---
  "Sexy Casino": {
    channel: "Manual BO Check (No Teams Group)",
    sla: "Immediate (Manual)",
    conditions: [
      "Maximum range for a single query is 7 days (only data from the last 14 days is retained).",
      "A member is considered abnormal if the Hedging Round data accounts for at least 50% of the Repeat Round data.",
      "Bet cancellation is offered (completely voided, stake refunded). If a merchant asks, it's acceptable, but CS MUST create a Redmine specifying if it's a full or partial cancellation.",
    ],
    process: [
      {
        text: "Log in to the provider's BO -> Fraud tools -> Sexy Hedging Detection -> Select [All Game].",
        image: "https://snipboard.io/xwYg7X.jpg",
      },
      "Set Date Range: Select the query period.",
      "Set User ID: Enter the member's game account (q28 + BO1.13 Provider ID).",
      "Set Repeat Rate: Set 50%, then click Search.",
      "Evaluate the search results based on the 50% Hedging/Repeat ratio.",
    ],
    reminder:
      "If BO is under maintenance, contact your leader. Late-night shift must fill out a handover for the morning shift leader.",

    requiredFields: [], // Completely empty!
    isManualCheckOnly: true,

    generateScript: () => {
      return `// NO SCRIPT REQUIRED FOR SEXY CASINO.\n// \n// Please perform the check manually via the Provider Back Office.\n// Reference the SOP Guide tab for instructions.\n//\n// NOTE: If bet cancellation is requested, remember to create a Redmine.`;
    },
  },

  // --- 10. DG CASINO ---
  "DG Casino": {
    channel: "Manual BO Check (No Teams Group)",
    sla: "Immediate (Manual)",
    conditions: [
      "Only data from the last 30 days is available for querying.",
      "If the query yields no data, it means the member's betting was normal during the period queried.",
    ],
    process: [
      "Log in to the provider's BO.",
      "Navigate to: Report Management > Opposite Censor.",
      "Enter the member's details and the query period (must be within 30 days).",
      "Check results: If no data is shown, the member's betting is normal.",
    ],
    reminder: "Data older than 30 days cannot be queried.",

    requiredFields: [], // Completely empty!
    isManualCheckOnly: true,

    generateScript: () => {
      return `// NO SCRIPT REQUIRED FOR DG CASINO. \n// Please perform the check manually via the Provider Back Office.\n// Reference the SOP Guide tab for instructions.\n// BO Path: Report Management > Opposite Censor`;
    },
  },

  // --- 11. OPUS CASINO ---
  "Opus Casino": {
    channel: "No Query Service Available",
    sla: "N/A",
    conditions: ["No query service is available for this provider."],
    process: [
      "Inform the merchant/requesting party that Opus Casino does not support abnormal betting queries using the standard rejection script.",
    ],
    reminder:
      "Do not attempt to contact the provider for abnormal betting checks.",

    requiredFields: [],
    isManualCheckOnly: true, // Keeps the inputs hidden and the ticket button disabled

    generateScript: (data, workName) => {
      // Returns the exact rejection script with the agent's name automatically inserted
      return `Hi Team, Please be informed that the Opus Casino provider doesn't provide to check the abnormality status of a member. Sorry for the inconvenience. Thank You - ${workName}`;
    },
  },

  // --- 12. PA CASINO ---
  "PA Casino": {
    channel: "Manual BO Check (No Teams Group)",
    sla: "Immediate (Manual)",
    conditions: [
      "Confirm that the member has placed bets within the specified period.",
      "Profit/loss must be a positive number (Do not query if negative).",
    ],
    process: [
      "Log in to the provider's BO.",
      "Select Member > Bet Record. Enter the Member ID, Bet Time, and Timezone (Beijing).",
      "If criteria are met (positive P/L), select Setting > Hedge Check. Enter the Time and Members.",
      "System analyzes wagers. If no data is displayed, the member's betting is normal.",
    ],
    reminder:
      "Do not proceed with the Hedge Check if the member's Profit/Loss is negative.",

    requiredFields: [], // Hides all input fields
    isManualCheckOnly: true, // Hides inputs and disables the Create Ticket button

    generateScript: () => {
      return `// NO SCRIPT REQUIRED FOR PA CASINO.\n// \n// Please perform the check manually via the Provider Back Office.\n// Reference the SOP Guide tab for instructions.\n//\n// BO Path: Setting > Hedge Check`;
    },
  },

  // --- 13. GP CASINO ---
  "GP Casino": {
    channel: "GP-provided Ticket System",
    sla: "Standard",
    conditions: [
      "CS is required to fill out a ticket in the GP-provided system.",
      "Relevant information can be found in the on-duty tools.",
    ],
    process: [
      "Access the GP-provided ticket system via the on-duty tools.",
      "Fill out the ticket using the following required fields:\n• Merchant ID: 368cash\n• Member Username: [providerID from BO1.13]\n• Product: Casino\n• Time period: [Time range requested by merchant]",
    ],
    reminder:
      "Do not submit this query to a Teams group. It must go through the GP ticket system.",

    requiredFields: [], // Hides all inputs
    isManualCheckOnly: true, // Disables the Create Ticket button

    generateScript: () => {
      return `// GP CASINO TICKET INSTRUCTIONS\n// \n// Please fill out a ticket in the GP-provided system using these details:\n//\n// Merchant ID: 368cash\n// Member Username: [Provider ID from BO1.13]\n// Product: Casino\n// Time Period: [Requested Time Range]`;
    },
  },

  // --- 14. SA GAMING ---
  "SA Gaming": {
    channel: "No Query Service Available",
    sla: "N/A",
    conditions: ["No query service is available for this provider."],
    process: [
      "Inform the merchant/requesting party that SA Gaming does not support abnormal betting queries using the standard rejection script.",
    ],
    reminder:
      "Do not attempt to contact the provider for abnormal betting checks.",

    requiredFields: [], // Hides all inputs
    isManualCheckOnly: true, // Disables the Create Ticket button

    generateScript: (data, workName) => {
      // Returns the exact rejection script with the agent's name automatically inserted
      return `Hi Team, Please be informed that the SA Gaming provider doesn't provide to check the abnormality status of a member. Sorry for the inconvenience. Thank You - ${workName}`;
    },
  },

  // --- 15. PP CASINO ---
  "PP Casino": {
    channel: "[T1] PP - QQ288[A-BT-R2-LC-S] Live Casino support",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: [T1] PP - QQ288[A-BT-R2-LC-S] Live Casino support.",
      "Remember to tag Customer Support or CS Live Pragmatic Play in the chat.",
      "If abnormal betting is confirmed and merchant is notified, record it in the IP Provisional Logsheet【IC PP Casino Opposite betting】.",
    ],
    reminder:
      "Always tag Customer Support when submitting. Log confirmed abnormal bets in the IP Provisional Logsheet.",

    // We added gameName and timeRange here!
    requiredFields: ["memberId", "providerAccount", "gameName", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, gameName, timeRange } = data;

      if (providerAccount && gameName && timeRange) {
        return `@\nHello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\nproduct category ：Casino\nRound ID：ALL\nPeriod：${timeRange}\nGame name：${gameName}`;
      }
      return "// Waiting for Provider Account, Game Name, and Time Period...";
    },
  },

  // --- 16. GCLUB LIVE ---
  "GClub Live": {
    channel: "G Club- 368Cash(營運)",
    sla: "Standard",
    conditions: [
      "The service for querying abnormal betting is only available for the last 7 days, calculated from the date the query is requested.",
    ],
    process: [
      "Check member details in BO.",
      "Ensure the query time period is strictly within the last 7 days.",
      "Submit query to the Teams Group: G Club- 368Cash(營運)",
    ],
    reminder: "Do not submit queries for dates older than 7 days from today.",

    // I added timeRange here so the input box shows up!
    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 17. YEEBET ---
  Yeebet: {
    channel: "External Live Support - {YEEBET x QQ288} YB063QQ",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: External Live Support - {YEEBET x QQ288} YB063QQ",
    ],

    // Added timeRange here so the input box shows up!
    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 18. PT SLOTS ---
  "PT Slots": {
    channel: "[TM] PT x QQ288 - [BT-S] or Email: cs@crossits.com",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
      "Progressive Jackpot: Requires an additional confirmation email if triggered.",
    ],
    process: [
      "Check member details in BO.",
      "Regular Bet: Submit query to the Teams Group: [TM] PT x QQ288 - [BT-S] OR send an email to cs@crossits.com.",
      "Progressive Jackpot: If the provider informs you that a member triggered a progressive jackpot (after completing the normal query), send an additional confirmation email to support@pcmcsi.com.",
    ],
    reminder:
      "Do not forget to send the secondary email to support@pcmcsi.com if a progressive jackpot is triggered!",

    // Added timeRange here so the input box shows up!
    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 19. MG+ SLOT ---
  "MG+ Slot": {
    channel: "MG Ticket System",
    sla: "Standard",
    conditions: [
      "Submit an application via the provider link.",
      "Requires MG Ticket System credentials from the on-duty tools.",
    ],
    process: [
      "Submit an application via the provider link. Refer to the on-duty tools for the MG Ticket System (for checking bets) account and password to log in.",
      {
        text: "Select Playcheck / For Playcheck Query Only. Fill in the relevant information according to the fields (please refer to the picture below for details), and then submit.",
        image: "https://snipboard.io/3DjviG.jpg",
      },
    ],
    reminder:
      "Do not submit this query to a Teams group. It must go through the MG Ticket System.",

    requiredFields: [], // Hides all inputs
    isManualCheckOnly: true, // Disables the Create Ticket button

    generateScript: () => {
      return `// NO SCRIPT REQUIRED FOR MG+ SLOT.\n// \n// Please submit a ticket via the MG Ticket System.\n// Reference the SOP Guide tab for instructions and visual references.`;
    },
  },

  // --- 20. HBS ---
  HBS: {
    channel: "Zapport Services Inc & Habanero (Seamless/.net)",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: Zapport Services Inc & Habanero (Seamless/.net)",
    ],

    // Added timeRange here so the input box shows up!
    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 21. CQ9 SLOTS ---
  "CQ9 Slots": {
    channel: "CQ9-qq288客服群",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period or provide a bet ticket number.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: CQ9-qq288客服群",
    ],

    // We still list both here so the UI displays both input boxes
    requiredFields: ["memberId", "providerAccount", "timeRange", "betTicket"],

    generateScript: (data, workName) => {
      const { providerAccount, betTicket, timeRange } = data;

      // Now it only requires Provider Account AND (Bet Ticket OR Time Range)
      if (providerAccount && (betTicket || timeRange)) {
        // If bet ticket has text, use it. Otherwise, fall back to time range.
        const betInfo =
          betTicket && betTicket.trim() !== ""
            ? `Bet ticket number：${betTicket}`
            : `Time period：${timeRange}`;

        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\n${betInfo}`;
      }
      return "// Waiting for Provider Account and either Time Period or Bet Ticket...";
    },
  },

  // --- 22. SPADEGAMING ---
  Spadegaming: {
    channel: "C_CIC_ QQ288(368CASH) - Spadegaming",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: C_CIC_ QQ288(368CASH) - Spadegaming",
    ],

    // Added timeRange here so the input box shows up!
    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 23. YGG ---
  YGG: {
    channel: "[TG068/ Zapport (QQ288)/ YGG/ RG/ HS/ OP/ DC] CS",
    sla: "Standard",
    conditions: ["Only data from the last 10 days is available for querying."],
    process: [
      "Check member details in BO.",
      "Ensure the query time period is strictly within the last 10 days.",
      "Submit query to the Teams Group: [TG068/ Zapport (QQ288)/ YGG/ RG/ HS/ OP/ DC] CS",
    ],
    reminder: "Do not submit queries for dates older than 10 days from today.",

    // We include gameName here, which we already set up earlier!
    requiredFields: ["memberId", "providerAccount", "gameName", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, gameName, timeRange } = data;

      if (providerAccount && gameName && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nProvider name：YGG\nMember ID：${providerAccount}\nGame name：${gameName}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account, Game Name, and Time Range...";
    },
  },

  // --- 24. JOKER ---
  Joker: {
    channel: "[FA7QM] [TFEQ] [TFER] QQ288 - Joker API",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
      "Requires the correct currency to generate the specific Member ID prefix.",
    ],
    process: [
      "Check member details in BO.",
      "Ensure the correct currency is selected.",
      "Submit query to the Teams Group: [FA7QM] [TFEQ] [TFER] QQ288 - Joker API",
    ],

    requiredFields: ["memberId", "providerAccount", "currency", "timeRange"],

    // ADDED THIS: Now the dropdown will filter correctly!
    options: {
      currencies: ["IDR", "MYR", "CNY", "THB", "KRW", "USD"],
    },

    generateScript: (data, workName) => {
      const { providerAccount, currency, timeRange } = data;

      if (providerAccount && currency && timeRange) {
        const prefixMap = {
          IDR: "F2ZZ",
          MYR: "F311",
          CNY: "F312",
          THB: "F313",
          KRW: "F315",
          USD: "F316",
        };

        const prefix = prefixMap[currency.toUpperCase()] || "";
        const prefixedAccountId = `${prefix}${providerAccount}`;

        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${prefixedAccountId}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account, Currency, and Time Range...";
    },
  },

  // --- 25. PLAYSTAR ---
  Playstar: {
    channel: "QQ288 x PLAYSTAR API",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Select the correct currency from the dropdown.",
      "Submit query to the Teams Group: QQ288 x PLAYSTAR API",
    ],

    requiredFields: ["memberId", "providerAccount", "currency", "timeRange"],

    // Limits the dropdown to these specific currencies
    options: {
      currencies: ["VND", "USD", "THB", "MYR", "KRW", "CNY", "IDR"],
    },

    generateScript: (data, workName) => {
      const { providerAccount, currency, timeRange } = data;

      if (providerAccount && currency && timeRange) {
        // Agent mapping logic
        const agentMap = {
          IDR: "ZP-QQ288-IDR2",
          CNY: "ZP-QQ288-CNY",
          KRW: "ZP-QQ288-KRW",
          MYR: "ZP-QQ288-MYR",
          THB: "ZP-QQ288-THB",
          USD: "ZP-QQ288-USD",
          VND: "ZP-QQ288-VND2",
        };

        const agentName = agentMap[currency.toUpperCase()] || "ZP-QQ288";

        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nAgent：${agentName}\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account, Currency, and Time Range...";
    },
  },

  // --- 26. BNG ---
  BNG: {
    channel: "QQ288 / BNG API",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period or provide a specific bet ticket ID.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: QQ288 / BNG API",
    ],

    // Displays both input boxes in the UI
    requiredFields: ["memberId", "providerAccount", "timeRange", "betTicket"],

    generateScript: (data, workName) => {
      const { providerAccount, betTicket, timeRange } = data;

      // Matches the CQ9 logic: Requires Provider Account + (Bet Ticket OR Time Range)
      if (providerAccount && (betTicket || timeRange)) {
        // Dynamically choose the label and the value
        const betInfo =
          betTicket && betTicket.trim() !== ""
            ? `Bet Ticket ID：${betTicket}`
            : `Time period：${timeRange}`;

        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\n${betInfo}`;
      }
      return "// Waiting for Provider Account and either Time Period or Bet Ticket...";
    },
  },
  // --- 27. AWC ---
  AWC: {
    channel: "AWC Ticketing System (External)",
    sla: "Standard",
    conditions: [
      "Query must be submitted via the AWC ticketing system.",
      "Ensure time period is clearly defined in GMT+8.",
    ],
    process: [
      "Log in to the AWC ticketing system (see on-duty tools for login).",
      "Select 'Abnormal Behavior Check'.",
      "Enter AgentID: Mexqq288",
      "Enter UserID: q28 + [BO1.13 Provider ID]",
      "Select Platform: KINGMIDAS",
      "Copy the generated script below into the 'Detailed Description' field.",
    ],
    reminder:
      "Do not submit this to a Teams group. Use the AWC ticketing portal.",

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello Team this is ${workName},
Please help us check member betting normal or not. Thank you
Time period：${timeRange} (GMT+8)`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 28. SKYWIND ---
  SKYWIND: {
    channel: "SKYWIND Ticketing System (External)",
    sla: "Standard",
    conditions: [
      "Query must be submitted via the SKYWIND ticketing system.",
      "Time period must be provided in GMT+8 format.",
    ],
    process: [
      "Log in to the SKYWIND ticketing system (see on-duty tools).",
      "Select 'Task' to create a new request.",
      "Summary: Please check member bet normal or not",
      "Support Environment: Production",
      "Platform: Games",
      "Affected Players/Users: [BO1.13 Provider ID]",
      "Copy the generated script below into the description field.",
    ],
    reminder:
      "Ensure 'Production' and 'Games' are correctly selected in the portal.",

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Please help us check member betting normal or not. Thank you.\nPlayer：${providerAccount}\nTime period：${timeRange} (GMT+8)`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 29. NETENT ---
  NETENT: {
    channel: "No Query Service Available",
    sla: "N/A",
    conditions: ["No query service is available for this provider."],
    process: [
      "Inform the merchant/requesting party that NETENT does not support abnormal betting queries using the standard rejection script.",
    ],
    reminder:
      "Do not attempt to contact the provider for abnormal betting checks.",

    requiredFields: [],
    isManualCheckOnly: true,

    generateScript: (data, workName) => {
      return `Hi Team, Please be informed that the NETENT provider doesn't provide to check the abnormality status of a member. Sorry for the inconvenience. Thank You - ${workName}`;
    },
  },

  // --- 30. FASTSPIN ---
  FastSpin: {
    channel: "FS_ 368Cash-FastSpin integration",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: FS_ 368Cash-FastSpin integration",
    ],

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 31. JILI ---
  JILI: {
    channel: "QQ288 & JL_transfer(Teams)",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: QQ288 & JL_transfer(Teams)",
    ],

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 32. CG ---
  CG: {
    channel: "QQ288/CG integration",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
      "Channel ID is automatically mapped based on the member's currency.",
    ],
    process: [
      "Check member details in BO.",
      "Select the correct currency to generate the Channel ID.",
      "Submit query to the Teams Group: QQ288/CG integration",
    ],

    requiredFields: ["memberId", "providerAccount", "currency", "timeRange"],

    // Limits dropdown to these 7 currencies
    options: {
      currencies: ["IDR", "VND", "THB", "MYR", "CNY", "USD", "KRW"],
    },

    generateScript: (data, workName) => {
      const { providerAccount, currency, timeRange } = data;

      if (providerAccount && currency && timeRange) {
        // Channel ID mapping logic
        const channelMap = {
          IDR: "48550",
          VND: "88918",
          THB: "36768",
          MYR: "78541",
          CNY: "54928",
          USD: "82251",
          KRW: "81441",
        };

        const channelId = channelMap[currency.toUpperCase()] || "N/A";

        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Channel ID：${channelId}
Member ID：${providerAccount}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account, Currency, and Time Range...";
    },
  },

  // --- 33. NEXT SPIN ---
  "Next Spin": {
    channel: "No Query Service Available",
    sla: "N/A",
    conditions: ["The provider does not offer a standard query service."],
    process: [
      "Inform the merchant that a formal query service is unavailable using the script provided.",
      "SOP Note: If a merchant is highly insistent, they must provide a specific bet ticket number for manual confirmation.",
    ],
    reminder:
      "Formal queries are not supported. Only individual bet tickets can be checked manually if provided.",

    requiredFields: [], // Hides all input fields
    isManualCheckOnly: true, // Disables the 'Create Ticket' button logic

    generateScript: (data, workName) => {
      return `Hi Team, Please be informed that the Next Spin provider doesn't provide to check the abnormality status of a member. However, if you have concerns about a specific bet, please provide the bet ticket number for confirmation. Thank You - ${workName}`;
    },
  },

  // --- 34. RSG ---
  RSG: {
    channel: "RSG Slot - QQ(營運)",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
      "A specific Bet Ticket Number can be provided if available but is not mandatory.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: RSG Slot - QQ(營運)",
      "If a Bet Ticket Number is provided, it will be included in the script automatically.",
    ],

    // UI displays both boxes; button unlocks with either Time or Ticket
    requiredFields: ["memberId", "providerAccount", "timeRange", "betTicket"],

    generateScript: (data, workName) => {
      const { providerAccount, betTicket, timeRange } = data;

      if (providerAccount && (betTicket || timeRange)) {
        // Logic: Always show Member ID. Then show Ticket if available, otherwise show Time.
        const hasTicket = betTicket && betTicket.trim() !== "";
        const betInfo = hasTicket
          ? `Bet Ticket Number to Query：${betTicket}`
          : `Time period：${timeRange}`;

        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
${betInfo}`;
      }
      return "// Waiting for Provider Account and either Time Period or Bet Ticket...";
    },
  },

  // --- 35. NoLimit City ---
  "NoLimit City": {
    channel: "🟡*Evo Support - Skyline E_QG| NLC",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
      "The specific Game Name is required for this provider.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: 🟡*Evo Support - Skyline E_QG| NLC",
      "Ensure you include the specific Game Name where the betting occurred.",
    ],

    requiredFields: ["memberId", "providerAccount", "gameName", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, gameName, timeRange } = data;

      if (providerAccount && gameName && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
Time period：${timeRange}
Game name：${gameName}`;
      }
      return "// Waiting for Provider Account, Game Name, and Time Range...";
    },
  },

  // --- 36. OG Slots ---
  "OG Slots": {
    channel: "东方-mog858-QQ288-OG Slots-[tw]v2",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: 东方-mog858-QQ288-OG Slots-[tw]v2",
    ],

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 37. Relax Gaming ---
  "Relax Gaming": {
    channel: "[TG068/ QQ288/ YG/ DC/ AUX/ HS/ RG/ OP] CS",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
      "Game Name is a mandatory field for Relax Gaming queries.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: [TG068/ QQ288/ YG/ DC/ AUX/ HS/ RG/ OP] CS",
      "Ensure the 'Provider name' is explicitly mentioned as Relax Gaming.",
    ],

    requiredFields: ["memberId", "providerAccount", "gameName", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, gameName, timeRange } = data;

      if (providerAccount && gameName && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Provider name：Relax gaming
Member ID：${providerAccount}
Game name：${gameName}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account, Game Name, and Time Range...";
    },
  },

  // --- 38. Hacksaw ---
  Hacksaw: {
    channel: "[TG068/ Zapport (QQ288)/ YGG/ RG/ HS/ OP/ DC] CS",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
      "Game Name must be provided for Hacksaw investigation requests.",
    ],
    process: [
      "Verify member betting activity in the Back Office.",
      "Submit the query to the Teams Group: [TG068/ Zapport (QQ288)/ YGG/ RG/ HS/ OP/ DC] CS",
      "Confirm that 'Provider name: Hacksaw' is included in the message.",
    ],

    requiredFields: ["memberId", "providerAccount", "gameName", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, gameName, timeRange } = data;

      if (providerAccount && gameName && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Provider name：Hacksaw
Member ID：${providerAccount}
Game name：${gameName}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account, Game Name, and Time Range...";
    },
  },

  // --- 39. YGR ---
  YGR: {
    channel: "QQ288 - YGR API (transfer)",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: QQ288 - YGR API (transfer)",
    ],

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 40. AdvantPlay ---
  AdvantPlay: {
    channel: "AdvantPlay x QQ288 ( Technical support )",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
      "Provide either the Time Period OR a Bet Ticket Number.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: AdvantPlay x QQ288 ( Technical support )",
      "If you fill in the 'Bet Ticket Number', the script label will automatically update.",
    ],

    // UI shows both; validation passes if either is filled
    requiredFields: ["memberId", "providerAccount", "timeRange", "betTicket"],

    generateScript: (data, workName) => {
      const { providerAccount, betTicket, timeRange } = data;

      if (providerAccount && (betTicket || timeRange)) {
        // DYNAMIC LABEL LOGIC
        const hasTicket = betTicket && betTicket.trim() !== "";
        const label = hasTicket ? "Bet Ticket Number" : "Time period";
        const value = hasTicket ? betTicket : timeRange;

        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
${label}：${value}`;
      }
      return "// Waiting for Provider Account and either Time Period or Bet Ticket...";
    },
  },

  // --- 41. Octoplay ---
  Octoplay: {
    channel: "[TG068/ Zapport (QQ288)/ YGG/ RG/ HS/ OP/ DC] CS",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
      "Providing the Game Name is mandatory for Octoplay queries.",
    ],
    process: [
      "Verify member betting activity in the Back Office.",
      "Submit the query to the Teams Group: [TG068/ Zapport (QQ288)/ YGG/ RG/ HS/ OP/ DC] CS",
      "Ensure the 'Provider name' is explicitly listed as Octoplay.",
    ],

    requiredFields: ["memberId", "providerAccount", "gameName", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, gameName, timeRange } = data;

      if (providerAccount && gameName && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Provider name：Octoplay
Member ID：${providerAccount}
Game name：${gameName}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account, Game Name, and Time Range...";
    },
  },

  // --- 42. FatPanda ---
  FatPanda: {
    channel: "[T1] PP - FP [A-BT-LC-S] & QQ288 TECH SUPPORT SLOTS",
    sla: "Standard",
    conditions: ["Ensure member has betting records in the specified period."],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: [T1] PP - FP [A-BT-LC-S] & QQ288 TECH SUPPORT SLOTS",
      "Wait for provider feedback in the group.",
    ],

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hi team, this is ${workName} ，Please help us check member betting normal or not.Thank you.

Member ID：${providerAccount}
Period：${timeRange}
Provider name：FatPanda`;
      }
      return "// Waiting for Provider Account and Period...";
    },
  },

  // --- 43. 2J ---
  "2J": {
    channel: "2J Games & 288 技术对接群",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified time period.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: 2J Games & 288 技术对接群",
    ],

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 44. GGSoft ---
  GGSoft: {
    channel: "GGSoft - QQ",
    sla: "Standard",
    conditions: [
      "Ensure member has betting records in the specified period.",
      "You can provide either the Time Period or a specific Round ID.",
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Teams Group: GGSoft - QQ",
      "If you fill in the 'Round ID', the script label will automatically update.",
    ],

    // UI shows all relevant boxes
    requiredFields: ["memberId", "providerAccount", "timeRange", "roundId"],

    generateScript: (data, workName) => {
      const { providerAccount, roundId, timeRange } = data;

      if (providerAccount && (roundId || timeRange)) {
        // DYNAMIC LABEL LOGIC
        const hasRoundId = roundId && roundId.trim() !== "";
        const label = hasRoundId ? "Round ID" : "Time period";
        const value = hasRoundId ? roundId : timeRange;

        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
${label}：${value}`;
      }
      return "// Waiting for Provider Account and either Time Period or Round ID...";
    },
  },

  // --- 45. C-Sports ---
  "C-Sports": {
    channel: "Manual BO Check",
    sla: "N/A",
    conditions: [
      "No external provider query is needed.",
      "Verification is based entirely on the 【Risk Level】 found in the C-Sports Back Office.",
    ],
    process: [
      "Log in to the C-Sports BO.",
      "Navigate to: Member > MemberSegmentation.",
      "Check the member's 【Risk Level】.",
      "If the Risk Level is 'Uncategorized', 'New', 'Healthy', or 'Moderate', directly notify the merchant that betting is normal.",
      "If the Risk Level is anything else, use the standard 'Notifying merchants about abnormal betting members' script.",
      { image: "https://snipboard.io/7uPU6H.jpg" },
    ],

    requiredFields: [],
    isManualCheckOnly: true, // This hides the inputs and disables the ticket button

    generateScript: () => {
      return `// MANUAL BO CHECK REQUIRED //

ACTION REQUIRED:
1. Log into C-Sports BO > Member > MemberSegmentation
2. Check the 【Risk Level】

➔ NORMAL: Uncategorized, New, Healthy, Moderate
➔ ABNORMAL: Any other level (Use Abnormal Betting macro for merchant)`;
    },
  },

  // --- 46. SBO ---
  SBO: {
    channel: "QQ288 [1190] x SBO (NS1) API SW Tech. 新系統",
    sla: "Standard",
    conditions: [
      "Records within 7 days: Must be checked manually in the SBO Back Office.",
      "Records 8 to 30 days old: Submit inquiry directly to the provider group chat.",
      "Max Limit: The provider can ONLY query records from the past month.",
    ],
    process: [
      "Determine the age of the bet record.",
      "IF WITHIN 7 DAYS: Go to SBO BO > Search Member > Click 'Betting Profile' on the right > Click 'Check Abnormal Bets in 3 days' or '7 days'.",
      "IF OLDER THAN 7 DAYS: Submit the generated script below to the Teams group.",
      "Do not send requests to the provider for bets placed within the last 7 days.",
    ],
    // The reminder field puts a bright yellow warning box in your UI!
    reminder:
      "STOP: Is the bet less than 7 days old? If YES, check the Back Office manually. Only use this script for bets older than 7 days!",

    // UI displays both; logic handles the swap
    requiredFields: ["memberId", "providerAccount", "timeRange", "betTicket"],

    generateScript: (data, workName) => {
      const { providerAccount, betTicket, timeRange } = data;

      if (providerAccount && (betTicket || timeRange)) {
        // Dynamic label logic: use Ticket if provided, otherwise Time Range
        const betOrTime =
          betTicket && betTicket.trim() !== "" ? betTicket : timeRange;

        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
Time period/Bet Ticket Number：${betOrTime}`;
      }
      return "// Waiting for Provider Account and either Time Period or Bet Ticket...";
    },
  },

  // --- 47. I-sports ---
  "I-sports": {
    channel: "Manual BO Check",
    sla: "N/A",
    conditions: [
      "No external provider query is needed.",
      "Verification is based entirely on the 【Risk Level】 found in the I-sports Back Office.",
    ],
    process: [
      "Log in to the I-sports BO.",
      "Navigate to: 【Customer Management】 > 【Player Administration】.",
      "Enter the member's Account to view their Risk Level.",
      "If the Risk Level is 'Uncategorized', 'New', 'Healthy', or 'Moderate', directly notify the merchant that betting is normal.",
      { image: "https://snipboard.io/eiH0uE.jpg" },
      "If the Risk Level is anything else, use the standard 'Notifying merchants about abnormal betting members' macro to notify the merchant.",
    ],

    requiredFields: [],
    isManualCheckOnly: true, // Hides the inputs and disables the ticket button

    generateScript: () => {
      return `// MANUAL BO CHECK REQUIRED //

ACTION REQUIRED:
1. Log into I-sports BO > 【Customer Management】 > 【Player Administration】
2. Enter member account and check the 【Risk Level】

➔ NORMAL: Uncategorized, New, Healthy, Moderate
➔ ABNORMAL: Any other level (Use Abnormal Betting macro for merchant)`;
    },
  },

  // --- 48. OPUS SPORT ---
  "OPUS SPORT": {
    channel: "Zapport + Opus + SB2(new)",
    sla: "Standard (Email fallback on Weekdays only)",
    conditions: [
      "Submit queries via the Teams group normally.",
      "If TEAMS is unavailable, you MUST use Email or a Ticket to inquire.",
      "Email queries are only serviced on weekdays.",
      "Note: The script automatically adds the required 'A1_' prefix to the Provider Account.",
    ],
    process: [
      "Check member details in BO.",
      "Submit the generated script to the Teams Group: Zapport + Opus + SB2(new)",
      "IF TEAMS IS DOWN: Send an email using the details below (Email is suggested over Tickets).",
      {
        text: "Email Fallback Details:",
        copyText: `Title: Check if the member is normal  [O-Sport]
To: ic.csduty@368media.com
BCC: support@opus-gaming.com`,
      },
    ],

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        // Automatically appending the A1_ prefix as requested
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：A1_${providerAccount}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 49. BTi ---
  BTi: {
    channel: "[368Cash] QQ288 x BTi(WLT) Support",
    sla: "Standard",
    conditions: [
      "CS does NOT need to pre-verify the following criteria before inquiring:",
      "1. >5 bets within 30 days AND average amount > 900 CNY.",
      "2. Net profit within 30 days > 9,000 CNY.",
      "If the provider refuses the check based on these rules, use the Query Condition script to notify the merchant.",
    ],
    // This creates the dedicated Copy button at the top of the SOP tab, just like PKQ!
    conditionScript: (workName) => {
      return `sir, please be informed that there are some Bti rules, please check, thanks 
1. Member place bet more than 5 bets within 30 days and the average amount is higher than 900 CNY 
2. profit exceeds 9,000 CNY within 30 days 
 
Since the player does not meet the above criteria, Bti does not provide the query thank you. - ${workName}`;
    },
    process: [
      "Submit the generated script to the Teams Group: [368Cash] QQ288 x BTi(WLT) Support",
      "Wait for the provider's response.",
      "IF REJECTED BY PROVIDER: Use the 'Copy Script' button under Query Conditions to notify the merchant.",
    ],
    // Adds the yellow warning box for extra clarity
    reminder:
      "Reminder: You do NOT need to pre-verify the criteria before sending to the provider. Only send the rejection script to the merchant if the provider kicks it back.",

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 50. IMSB ---
  IMSB: {
    channel: "Internal Ticket / Manual BO Check",
    sla: "N/A",
    conditions: [
      "No external provider query script is needed.",
      "Please refer to the OwnCloud CSIP Documentation > IC > Provider BO Manual > IMSB Investigating List Module (EN).",
    ],
    process: [
      "Log in to the IMSB Back Office.",
      "Refer to the IMSB Investigating List Module documentation.",
      { image: "https://snipboard.io/dUy1YL.jpg" },
      "Fill out the required fields on the left.",
      "Click 'Create Ticket' to log this investigation. (Note: 'im3b1' will automatically be attached to the Provider ID).",
    ],
    reminder:
      "No Teams script is required for IMSB. Just check the BO, fill out the info, and create the ticket.",

    // We only ask for Member ID and Provider Account
    requiredFields: ["memberId", "providerAccount"],

    // We repurpose the script generator to show a Ticket Summary instead!
    generateScript: (data, workName) => {
      const { providerAccount, memberId } = data;

      if (providerAccount && memberId) {
        return `// INTERNAL TICKET LOGGING //

ACTION REQUIRED:
1. Check IMSB BO manually.
2. Click 'Create Ticket' below.

--- TICKET PAYLOAD PREVIEW ---
Member ID: ${memberId}
Provider Account: im3b1${providerAccount}`;
      }
      return "// Waiting for Member ID and Provider Account...";
    },
  },

  // --- 51. Wbet ---
  Wbet: {
    channel: "WBET - QQ CS support",
    sla: "Standard",
    conditions: [
      "The provider will only handle queries for members who have placed a bet on at least 8 different matches.",
      "CS does NOT need to pre-verify this condition; submit it directly to the provider for confirmation.",
    ],
    process: [
      "Check member details in BO.",
      "Generate the script below. (Note: The required currency suffix like '_DRQ' or '_CNQ' is added automatically).",
      "Submit the query directly to the Teams Group: WBET - QQ CS support",
    ],
    // The yellow warning box to save agents time!
    reminder:
      "Reminder: You do NOT need to pre-verify the 8-match condition. Just generate the script and send it directly to the provider!",

    requiredFields: ["memberId", "providerAccount", "currency", "timeRange"],

    // Explicitly listing the supported currencies for Wbet
    options: {
      currencies: ["IDR", "CNY", "VND", "THB", "MYR", "USD", "KRW"],
    },

    generateScript: (data, workName) => {
      const { providerAccount, currency, timeRange } = data;

      // The automatic suffix mapping logic
      const currencyMap = {
        IDR: "DRQ",
        CNY: "CNQ",
        VND: "VNQ",
        THB: "THQ",
        MYR: "MYQ",
        USD: "USQ",
        KRW: "KRQ",
      };

      const mappedCur = currencyMap[currency] || "";

      if (providerAccount && currency && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}_${mappedCur}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account, Currency, and Time Range...";
    },
  },

  // --- 52. QQKENO ---
  QQKENO: {
    channel: "C_C _QQ288(368CASH)_ QQLottery( KN/ TH / VT)",
    sla: "Standard",
    conditions: [
      "Ensure the member has betting records in the specified time period.",
    ],
    process: [
      "Verify member betting activity in the Back Office.",
      "Submit the generated script to the Teams Group: C_C _QQ288(368CASH)_ QQLottery( KN/ TH / VT)",
      "Wait for provider feedback.",
    ],

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 53. QQThai ---
  QQThai: {
    channel: "C_C _QQ288(368CASH)_ QQLottery( KN/ TH / VT)",
    sla: "Standard",
    conditions: [
      "Ensure the member has betting records in the specified time period.",
    ],
    process: [
      "Verify member betting activity in the Back Office.",
      "Submit the generated script to the Teams Group: C_C _QQ288(368CASH)_ QQLottery( KN/ TH / VT)",
      "Wait for provider feedback.",
    ],

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 54. QQViet ---
  QQViet: {
    channel: "C_C _QQ288(368CASH)_ QQLottery( KN/ TH / VT)",
    sla: "Standard",
    conditions: [
      "Ensure the member has betting records in the specified time period.",
    ],
    process: [
      "Verify member betting activity in the Back Office.",
      "Submit the generated script to the Teams Group: C_C _QQ288(368CASH)_ QQLottery( KN/ TH / VT)",
      "Wait for provider feedback.",
    ],

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  },

  // --- 55. QQ4D ---
  QQ4D: {
    channel: "QQ4D - QQ288 Integration Group",
    sla: "Standard",
    conditions: [
      "Ensure the member has betting records in the specified time period.",
    ],
    process: [
      "Verify member betting activity in the Back Office.",
      "Submit the generated script to the Teams Group: QQ4D - QQ288 Integration Group",
      "Wait for provider feedback.",
    ],

    requiredFields: ["memberId", "providerAccount", "timeRange"],

    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;

      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},
Please help us check member betting normal or not. Thank you.

Member ID：${providerAccount}
Time period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    },
  }, // <-- Make sure to close the final object properly without a trailing comma!
};
