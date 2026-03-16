import { describe, expect, it } from "vitest";
import { resolveActiveShiftFromTime } from "../lib/shiftLogic";

const atGmt8 = (hour, minute) => {
  const utcHour = (hour - 8 + 24) % 24;
  return new Date(Date.UTC(2026, 0, 1, utcHour, minute, 0, 0));
};

describe("DutyContext shift boundaries", () => {
  it("matches active shift assignments exactly at window cutovers", () => {
    expect(resolveActiveShiftFromTime(atGmt8(7, 10))).toBe("Morning");
    expect(resolveActiveShiftFromTime(atGmt8(14, 40))).toBe("Afternoon");
    expect(resolveActiveShiftFromTime(atGmt8(22, 40))).toBe("Night");
  });
});