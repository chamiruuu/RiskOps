import { describe, expect, it } from "vitest";
import {
  getTransitionContext,
  resolveActiveShiftFromTime,
  computeTransitionViewState,
} from "./shiftLogic";

const atGmt8 = (hour, minute) => {
  const utcHour = (hour - 8 + 24) % 24;
  return new Date(Date.UTC(2026, 0, 1, utcHour, minute, 0, 0));
};

describe("shift transitions", () => {
  it("uses exact shift boundary cutovers at 07:10 / 14:40 / 22:40", () => {
    expect(resolveActiveShiftFromTime(atGmt8(7, 9))).toBe("Night");
    expect(resolveActiveShiftFromTime(atGmt8(7, 10))).toBe("Morning");

    expect(resolveActiveShiftFromTime(atGmt8(14, 39))).toBe("Morning");
    expect(resolveActiveShiftFromTime(atGmt8(14, 40))).toBe("Afternoon");

    expect(resolveActiveShiftFromTime(atGmt8(22, 39))).toBe("Afternoon");
    expect(resolveActiveShiftFromTime(atGmt8(22, 40))).toBe("Night");
  });

  it("returns transition context around window boundaries", () => {
    const preMorning = getTransitionContext(atGmt8(6, 44));
    expect(preMorning).toBeNull();

    const morningManual = getTransitionContext(atGmt8(7, 9));
    expect(morningManual?.pair).toEqual({ outgoing: "Night", incoming: "Morning" });
    expect(morningManual?.isManualWindow).toBe(true);

    const morningShared = getTransitionContext(atGmt8(7, 10));
    expect(morningShared?.isSharedWindow).toBe(true);
    expect(morningShared?.isPostStartWindow).toBe(true);

    const afternoonManual = getTransitionContext(atGmt8(14, 39));
    expect(afternoonManual?.pair).toEqual({ outgoing: "Morning", incoming: "Afternoon" });
    expect(afternoonManual?.isManualWindow).toBe(true);

    const afternoonShared = getTransitionContext(atGmt8(14, 40));
    expect(afternoonShared?.isSharedWindow).toBe(true);

    const nightManual = getTransitionContext(atGmt8(22, 39));
    expect(nightManual?.pair).toEqual({ outgoing: "Afternoon", incoming: "Night" });
    expect(nightManual?.isManualWindow).toBe(true);

    const nightShared = getTransitionContext(atGmt8(22, 40));
    expect(nightShared?.isSharedWindow).toBe(true);
  });

  it("enforces incoming lock and outgoing visibility rules", () => {
    const transitionCtx = getTransitionContext(atGmt8(14, 45));

    const incomingLocked = computeTransitionViewState({
      transitionCtx,
      myAssignedShift: "Afternoon",
      isMyShiftActive: true,
      isAdminOrLeader: false,
      handoverCompletedForCurrentWindow: false,
    });
    expect(incomingLocked.shouldHoldIncomingViewUntilHandover).toBe(true);
    expect(incomingLocked.canViewTickets).toBe(false);

    const incomingUnlocked = computeTransitionViewState({
      transitionCtx,
      myAssignedShift: "Afternoon",
      isMyShiftActive: true,
      isAdminOrLeader: false,
      handoverCompletedForCurrentWindow: true,
    });
    expect(incomingUnlocked.isIncomingTransitionViewer).toBe(true);
    expect(incomingUnlocked.canViewTickets).toBe(true);

    const outgoingDuringWindow = computeTransitionViewState({
      transitionCtx,
      myAssignedShift: "Morning",
      isMyShiftActive: false,
      isAdminOrLeader: false,
      handoverCompletedForCurrentWindow: false,
    });
    expect(outgoingDuringWindow.isOutgoingTransitionViewer).toBe(true);
    expect(outgoingDuringWindow.canViewTickets).toBe(true);
  });
});