export const getGMT8Time = () => {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 8);
};

export const getFormattedDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getTimeInMinutes = (inputNow = getGMT8Time()) => {
  const now = new Date(inputNow);
  return now.getHours() * 60 + now.getMinutes();
};

export const resolveActiveShiftFromTime = (inputNow = getGMT8Time()) => {
  const minutes = getTimeInMinutes(inputNow);
  if (minutes >= 430 && minutes < 880) return "Morning"; // 07:10 - 14:39
  if (minutes >= 880 && minutes < 1360) return "Afternoon"; // 14:40 - 22:39
  return "Night"; // 22:40 - 07:09
};

export const getLastShiftChangeTime = (inputNow = getGMT8Time()) => {
  const now = new Date(inputNow);
  const minutes = getTimeInMinutes(now);

  const lastChange = new Date(now);
  lastChange.setSeconds(0, 0);

  if (minutes >= 430 && minutes < 880) {
    lastChange.setHours(7, 10, 0, 0);
  } else if (minutes >= 880 && minutes < 1360) {
    lastChange.setHours(14, 40, 0, 0);
  } else if (minutes >= 1360) {
    lastChange.setHours(22, 40, 0, 0);
  } else {
    lastChange.setDate(lastChange.getDate() - 1);
    lastChange.setHours(22, 40, 0, 0);
  }

  return lastChange;
};

export const getTransitionContext = (inputNow = getGMT8Time()) => {
  const now = new Date(inputNow);
  now.setSeconds(0, 0);

  const minutes = getTimeInMinutes(now);

  // 06:45 - 07:29 => Night -> Morning
  if (minutes >= 405 && minutes < 450) {
    const windowStart = new Date(now);
    windowStart.setHours(6, 45, 0, 0);

    return {
      pair: { outgoing: "Night", incoming: "Morning" },
      marker: `${getFormattedDate(now)}|Night->Morning`,
      windowStart,
      isManualWindow: minutes <= 430,
      isSharedWindow: minutes >= 430 && minutes < 450,
      isPostStartWindow: minutes >= 431 && minutes < 450,
      lockWarningHour: 7,
      lockWarningMinute: 20,
    };
  }

  // 14:15 - 14:59 => Morning -> Afternoon
  if (minutes >= 855 && minutes < 900) {
    const windowStart = new Date(now);
    windowStart.setHours(14, 15, 0, 0);

    return {
      pair: { outgoing: "Morning", incoming: "Afternoon" },
      marker: `${getFormattedDate(now)}|Morning->Afternoon`,
      windowStart,
      isManualWindow: minutes <= 880,
      isSharedWindow: minutes >= 880 && minutes < 900,
      isPostStartWindow: minutes >= 881 && minutes < 900,
      lockWarningHour: 14,
      lockWarningMinute: 50,
    };
  }

  // 22:15 - 22:59 => Afternoon -> Night
  if (minutes >= 1335 && minutes < 1380) {
    const windowStart = new Date(now);
    windowStart.setHours(22, 15, 0, 0);

    return {
      pair: { outgoing: "Afternoon", incoming: "Night" },
      marker: `${getFormattedDate(now)}|Afternoon->Night`,
      windowStart,
      isManualWindow: minutes <= 1360,
      isSharedWindow: minutes >= 1360 && minutes < 1380,
      isPostStartWindow: minutes >= 1361 && minutes < 1380,
      lockWarningHour: 22,
      lockWarningMinute: 50,
    };
  }

  return null;
};

export const checkIsHandoverWindow = (inputNow = getGMT8Time()) => {
  const ctx = getTransitionContext(inputNow);
  return !!ctx && ctx.isManualWindow;
};

export const getHandoverShiftPair = (inputNow = getGMT8Time()) => {
  const ctx = getTransitionContext(inputNow);
  return ctx?.pair || null;
};

export const getNextShift = (current) => {
  if (current === "Morning") return "Afternoon";
  if (current === "Afternoon") return "Night";
  return "Morning";
};

export const computeTransitionViewState = ({
  transitionCtx,
  myAssignedShift,
  isMyShiftActive,
  isAdminOrLeader,
  handoverCompletedForCurrentWindow,
}) => {
  const handoverPair = transitionCtx?.pair || null;
  const isInSharedZone = !!transitionCtx && transitionCtx.isSharedWindow;
  const isInManualWindow = !!transitionCtx && transitionCtx.isManualWindow;

  const isOutgoingTransitionViewer =
    !!handoverPair &&
    (isInManualWindow || isInSharedZone) &&
    myAssignedShift === handoverPair.outgoing;

  const isIncomingTransitionViewer =
    !!handoverPair &&
    (isInManualWindow || isInSharedZone) &&
    myAssignedShift === handoverPair.incoming &&
    handoverCompletedForCurrentWindow;

  const shouldHoldIncomingViewUntilHandover =
    !!handoverPair &&
    isInSharedZone &&
    myAssignedShift === handoverPair.incoming &&
    !handoverCompletedForCurrentWindow;

  const canViewTickets =
    (isMyShiftActive && !shouldHoldIncomingViewUntilHandover) ||
    isOutgoingTransitionViewer ||
    isIncomingTransitionViewer ||
    isAdminOrLeader;

  return {
    handoverPair,
    isInSharedZone,
    isInManualWindow,
    isOutgoingTransitionViewer,
    isIncomingTransitionViewer,
    shouldHoldIncomingViewUntilHandover,
    canViewTickets,
  };
};