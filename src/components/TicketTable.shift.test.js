import { describe, expect, it } from "vitest";
import {
  computeTransitionViewState,
  getTransitionContext,
} from "../lib/shiftLogic";

const atGmt8 = (hour, minute) => {
  const utcHour = (hour - 8 + 24) % 24;
  return new Date(Date.UTC(2026, 0, 1, utcHour, minute, 0, 0));
};

describe("TicketTable transition visibility", () => {
  it("locks incoming view until handover completion and allows outgoing overlap visibility", () => {
    const transitionCtx = getTransitionContext(atGmt8(7, 20));

    const incomingBeforeHandover = computeTransitionViewState({
      transitionCtx,
      myAssignedShift: "Morning",
      isMyShiftActive: true,
      isAdminOrLeader: false,
      handoverCompletedForCurrentWindow: false,
    });

    expect(incomingBeforeHandover.shouldHoldIncomingViewUntilHandover).toBe(true);
    expect(incomingBeforeHandover.canViewTickets).toBe(false);

    const outgoingOverlap = computeTransitionViewState({
      transitionCtx,
      myAssignedShift: "Night",
      isMyShiftActive: false,
      isAdminOrLeader: false,
      handoverCompletedForCurrentWindow: false,
    });

    expect(outgoingOverlap.isOutgoingTransitionViewer).toBe(true);
    expect(outgoingOverlap.canViewTickets).toBe(true);
  });
});