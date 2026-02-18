export const PROVIDER_CONFIG = {
  // --- 1. PG SOFT ---
  "PG Soft": {
    channel: "QQ288- PG Soft Support交流群",
    sla: "1 business day (excl. weekends/holidays)",
    conditions: [
      "Member must have a minimum of 5 bets.",
      "If member has betting records but PROFIT IS NEGATIVE (Loss) -> Do NOT submit.",
      "If member has betting records and PROFIT IS POSITIVE -> Submit to group."
    ],
    process: [
      "Check betting records & profit in BO.",
      "If valid (Positive Profit), submit to provider group.",
      "Wait for response.",
      "Result Normal: Inform merchant member is normal.",
      "Result Abnormal: Use 'Abnormal Betting' script.",
      "Result Checked < 7 Days: Use 'Already Checked' script."
    ],
    reminder: "Do not copy the provider's tracking number or signature when replying to the merchant.",
    
    requiredFields: ['memberId', 'providerAccount', 'timeRange'],
    
    generateScript: (data, workName) => {
      const { providerAccount, timeRange } = data;
      if (providerAccount && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nAgent Name：QQ288\nMember ID：${providerAccount}\nTime period：${timeRange}`;
      }
      return "// Waiting for Provider Account and Time Range...";
    }
  },

  // --- 2. EVOLUTION ---
  "Evolution": {
    channel: "Evolution Back Office (Direct Check)",
    sla: "Instant / 4 Hours",
    conditions: [
      "Check Transaction ID in EVO Portal.",
      "Bet amount must exceed specified threshold."
    ],
    process: [
      "Login to Evo Portal.",
      "Search Round ID / Transaction ID.",
      "Analyze video replay for anomalies."
    ],
    reminder: "Download video proof if suspicious activity is found.",
    
    requiredFields: ['trackingId'],
    
    generateScript: (data, workName) => {
      const { trackingId } = data;
      if (trackingId) {
        return `Hello sir this is ${workName},\nRequesting check for Evolution Round.\n\nTracking ID: ${trackingId}`;
      }
      return "// Waiting for Tracking ID...";
    }
  },

  // --- 3. PRAGMATIC PLAY (NEW) ---
  "Pragmatic Play": {
    channel: "[T1] PP - FP [A-BT-LC-S] & QQ288 TECH SUPPORT SLOTS",
    sla: "Refer to Group Pinned Message",
    conditions: [
      "Ensure member has betting records in the specified time period."
    ],
    process: [
      "Check member details in BO.",
      "Submit query to the Telegram Group: [T1] PP - FP...",
      "Wait for provider feedback."
    ],
    reminder: "Make sure to include the Provider Name 'Pragmatic Play' in the script.",

    // Pragmatic only needs Member ID and Time Range based on your request
    requiredFields: ['memberId', 'timeRange'],

    generateScript: (data, workName) => {
      const { memberId, timeRange } = data;
      if (memberId && timeRange) {
        return `Hello sir this is ${workName},\nPlease help us check member betting normal or not. Thank you.\n\nMember ID：${memberId}\nTime period：${timeRange}\nProvider name：Pragmatic Play`;
      }
      return "// Waiting for Member ID and Time Period...";
    }
  }
};