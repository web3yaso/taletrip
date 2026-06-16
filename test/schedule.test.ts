import { describe, expect, it } from "vitest";
import { inAutoEnterWindow, nightIndex, roughAdjustMinutes, toHHMM, toMin } from "@/bedtime/schedule";

describe("time conversion", () => {
  it("toMin / toHHMM round-trip", () => {
    expect(toMin("20:30")).toBe(1230);
    expect(toHHMM(1230)).toBe("20:30");
  });
  it("toHHMM wraps past midnight and handles negatives", () => {
    expect(toHHMM(1230 + 60)).toBe("21:30");
    expect(toHHMM(-30)).toBe("23:30");
    expect(toHHMM(1440)).toBe("00:00");
  });
});

describe("nightIndex (calendar anchoring)", () => {
  const COUNT = 6;
  it("no check-ins yet -> Night 1 (first arrival index)", () => {
    expect(nightIndex(2, false, 0, COUNT)).toBe(2);
  });
  it("first check-in morning -> tonight is Night 2", () => {
    expect(nightIndex(2, true, 0, COUNT)).toBe(3);
  });
  it("advances one night per whole day since the first check-in", () => {
    expect(nightIndex(2, true, 2, COUNT)).toBe(5);
  });
  it("clamps to the last day of the plan", () => {
    expect(nightIndex(2, true, 99, COUNT)).toBe(COUNT - 1);
  });
});

describe("roughAdjustMinutes", () => {
  it("adds 20 min after a rough night", () => {
    expect(roughAdjustMinutes("20:30", true)).toBe(20);
  });
  it("adds nothing on a smooth night or a no-bedtime day", () => {
    expect(roughAdjustMinutes("20:30", false)).toBe(0);
    expect(roughAdjustMinutes("—", true)).toBe(0);
  });
});

describe("inAutoEnterWindow", () => {
  const at = (h: number, m: number) => new Date(2026, 5, 15, h, m);
  it("true at the target bedtime and within +90 min", () => {
    expect(inAutoEnterWindow("20:30", at(20, 30))).toBe(true);
    expect(inAutoEnterWindow("20:30", at(21, 59))).toBe(true);
  });
  it("false before the target and after the 90-min window", () => {
    expect(inAutoEnterWindow("20:30", at(20, 29))).toBe(false);
    expect(inAutoEnterWindow("20:30", at(22, 1))).toBe(false);
  });
  it("never auto-enters on a no-bedtime day", () => {
    expect(inAutoEnterWindow("—", at(21, 0))).toBe(false);
  });
});
