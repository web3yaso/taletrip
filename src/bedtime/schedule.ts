// src/bedtime/schedule.ts
// Pure jet-lag scheduling math, extracted from plan.ts so the time/anchoring
// logic is unit-testable without the file-IO (check-in log, snooze) that wraps
// it. plan.ts imports these and feeds them IO-derived inputs.

// "20:30" -> minutes since midnight (hours wrap mod 24).
export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h % 24) * 60 + (m || 0);
};

// minutes -> "HH:MM" (wraps into a single day, handles negatives).
export const toHHMM = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// Which night are we on, anchored to the calendar. The first check-in is the
// morning after Night 1, so that morning -> tonight is Night 2. `nightsSince` is
// whole days between the first check-in and today. Clamped to the plan length.
export function nightIndex(
  firstArrivalIdx: number,
  hasLog: boolean,
  nightsSince: number,
  dayCount: number,
): number {
  let idx = !hasLog ? firstArrivalIdx : firstArrivalIdx + 1 + Math.max(0, nightsSince);
  return Math.min(dayCount - 1, Math.max(0, idx));
}

// A rough night pushes tonight's bedtime ~20 min later (skip the "—" no-bedtime days).
export function roughAdjustMinutes(bedtime: string, rough: boolean): number {
  return rough && bedtime !== "—" ? 20 : 0;
}

// auto-enter window: now within [target, target+90min] tonight (design §9).
export function inAutoEnterWindow(bedtimeHHMM: string, now: Date): boolean {
  if (bedtimeHHMM === "—") return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const target = toMin(bedtimeHHMM);
  return cur >= target && cur <= target + 90;
}
