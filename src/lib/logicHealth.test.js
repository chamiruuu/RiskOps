import { describe, expect, it } from "vitest";
import {
  createCorrelationId,
  makeLogicEntry,
  runQuickChecks,
  shouldEscalateLogicEntry,
} from "./logicHealth";

describe("logic health quick checks", () => {
  it("passes healthy state", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const result = runQuickChecks({
      currentActiveShift: "Morning",
      presenceDebug: {
        lastHeartbeatAt: now - 5000,
        lastSubscribeStatus: "SUBSCRIBED",
      },
      now,
    });

    expect(result.failCount).toBe(0);
    expect(result.passCount).toBe(3);
  });

  it("flags stale presence and bad subscribe status", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const result = runQuickChecks({
      currentActiveShift: "Morning",
      presenceDebug: {
        lastHeartbeatAt: now - 60000,
        lastSubscribeStatus: "CHANNEL_ERROR",
      },
      now,
    });

    expect(result.failCount).toBeGreaterThanOrEqual(2);
    expect(result.checks.some((c) => c.code === "PR-001")).toBe(true);
    expect(result.checks.some((c) => c.code === "PR-002")).toBe(true);
  });

  it("generates stable correlation id format", () => {
    const id = createCorrelationId("HO");
    expect(id.startsWith("HO-")).toBe(true);
    expect(id.split("-").length).toBe(3);
  });

  it("escalates repeated error code in threshold window", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const seed = [
      makeLogicEntry({ code: "RT-001", title: "err", detail: "a", level: "error", at: now - 1000 }),
      makeLogicEntry({ code: "RT-001", title: "err", detail: "b", level: "error", at: now - 40000 }),
    ];
    const next = makeLogicEntry({
      code: "RT-001",
      title: "err",
      detail: "c",
      level: "error",
      at: now,
    });

    expect(shouldEscalateLogicEntry({ nextEntry: next, entries: [next, ...seed] })).toBe(true);
  });
});
