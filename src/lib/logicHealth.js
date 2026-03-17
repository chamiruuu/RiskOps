import { resolveActiveShiftFromTime } from "./shiftLogic";

export const LOGIC_CODES = {
  REALTIME_ERROR: "RT-001",
  REALTIME_DEGRADED: "RT-002",
  REALTIME_RESTORED: "RT-000",
  REALTIME_ESCALATED: "RT-900",
  HANDOVER_FAILED: "HO-001",
  HANDOVER_RETRY_QUEUED: "HO-002",
  HANDOVER_SUCCESS: "HO-000",
  HANDOVER_ESCALATED: "HO-900",
  PROVIDER_CHECKING: "PV-001",
  PROVIDER_DUPLICATE: "PV-002",
  PROVIDER_PASSED: "PV-000",
  PROVIDER_ERROR: "PV-003",
  OWNERSHIP_CONFLICT: "DT-001",
  SHIFT_MISMATCH: "SH-001",
  PRESENCE_STALE: "PR-001",
  PRESENCE_STATUS: "PR-002",
};

export const LOGIC_SEVERITIES = ["all", "error", "warning", "success", "info"];

export const createCorrelationId = (prefix = "LG") => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
};

export const normalizeLogicEventDetail = (detail, defaults = {}) => {
  const event = detail || {};
  const at = Number(event.at || event.time || Date.now());
  return {
    code: event.code || defaults.code || "LG-000",
    title: event.title || defaults.title || "Logic Event",
    detail:
      event.detail ||
      event.text ||
      defaults.detail ||
      "No additional details.",
    level: event.level || defaults.level || "info",
    at,
    source: event.source || defaults.source || "ui",
    correlationId: event.correlationId || createCorrelationId(),
  };
};

export const makeLogicEntry = ({
  code,
  title,
  detail,
  level = "info",
  at = Date.now(),
  source = "ui",
  correlationId = createCorrelationId(),
}) => ({
  id: `${code}-${at}-${correlationId}`,
  code,
  title,
  detail,
  level,
  at,
  source,
  correlationId,
});

export const shouldEscalateLogicEntry = ({
  nextEntry,
  entries,
  windowMs = 2 * 60 * 1000,
  threshold = 3,
}) => {
  if (!nextEntry || nextEntry.level !== "error") return false;

  const recentSameCode = entries.filter(
    (entry) =>
      entry.code === nextEntry.code &&
      entry.level === "error" &&
      nextEntry.at - entry.at <= windowMs,
  );

  if (recentSameCode.length < threshold) return false;

  const alreadyEscalated = entries.some(
    (entry) =>
      entry.code === LOGIC_CODES.REALTIME_ESCALATED &&
      entry.detail.includes(nextEntry.code) &&
      nextEntry.at - entry.at <= windowMs,
  );

  return !alreadyEscalated;
};

export const buildEscalationEntry = ({ code, level, at, correlationId }) =>
  makeLogicEntry({
    code: LOGIC_CODES.REALTIME_ESCALATED,
    title: "Repeated Runtime Failure",
    detail: `${code} repeated 3+ times in 2 minutes. Immediate investigation recommended.`,
    level: level === "error" ? "warning" : "info",
    at,
    source: "escalation",
    correlationId,
  });

export const runQuickChecks = ({
  currentActiveShift,
  presenceDebug,
  now = Date.now(),
}) => {
  const checks = [];

  const expectedShift = resolveActiveShiftFromTime(new Date(now));
  const shiftOk = !currentActiveShift || currentActiveShift === expectedShift;
  checks.push({
    key: "shift-sync",
    pass: shiftOk,
    code: shiftOk ? "SH-000" : LOGIC_CODES.SHIFT_MISMATCH,
    message: shiftOk
      ? `Shift aligned (${expectedShift})`
      : `Shift mismatch: expected ${expectedShift}, got ${currentActiveShift || "unset"}`,
  });

  const hbAt = presenceDebug?.lastHeartbeatAt || null;
  const heartbeatAge = hbAt ? now - hbAt : Number.MAX_SAFE_INTEGER;
  const heartbeatOk = hbAt && heartbeatAge <= 25000;
  checks.push({
    key: "presence-heartbeat",
    pass: !!heartbeatOk,
    code: heartbeatOk ? "PR-000" : LOGIC_CODES.PRESENCE_STALE,
    message: heartbeatOk
      ? `Presence heartbeat healthy (${Math.floor(heartbeatAge / 1000)}s ago)`
      : "Presence heartbeat stale or missing",
  });

  const status = presenceDebug?.lastSubscribeStatus || "IDLE";
  const statusOk = status === "SUBSCRIBED";
  checks.push({
    key: "presence-status",
    pass: statusOk,
    code: statusOk ? "PR-010" : LOGIC_CODES.PRESENCE_STATUS,
    message: statusOk
      ? "Presence subscription is active"
      : `Presence status is ${status}`,
  });

  return {
    checks,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
  };
};
