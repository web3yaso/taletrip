// src/bedtime/plan.ts
// Sleep Coach state on the iPad: the plan ships in the current pack
// (pack.sleepPlan); the nightly check-in log lives in documents/sleeplog.json.
// Adaptation is deterministic (the design's reliability split): the check-in
// picks WHICH MedPsy-written branch to show and nudges tonight's time —
// every medical sentence still comes from MedPsy.
import { Directory, File, Paths } from "expo-file-system";
import { currentPackId, listPacks, loadPackRaw } from "@/storypack/store";
import type { SleepPlan } from "@/storypack/types";

export type SleepQuality = "smooth" | "ok" | "rough";
export type SleepLogEntry = { date: string; quality: SleepQuality };

const LOG = () => new File(new Directory(Paths.document, "family"), "sleeplog.json");
const today = () => new Date().toISOString().slice(0, 10);

export function loadSleepLog(): SleepLogEntry[] {
  try {
    const f = LOG();
    if (f.exists) return JSON.parse(f.textSync());
  } catch {}
  return [];
}

export function checkIn(quality: SleepQuality) {
  const log = loadSleepLog().filter((e) => e.date !== today());
  log.push({ date: today(), quality });
  const dir = new Directory(Paths.document, "family");
  if (!dir.exists) dir.create();
  LOG().write(JSON.stringify(log));
}

export function todaysCheckIn(): SleepLogEntry | null {
  return loadSleepLog().find((e) => e.date === today()) ?? null;
}

export function loadSleepPlan(): SleepPlan | null {
  const id = currentPackId() ?? listPacks()[0]?.id;
  if (!id) return null;
  return loadPackRaw(id)?.sleepPlan ?? null;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h % 24) * 60 + (m || 0);
};
const toHHMM = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export type Tonight = {
  dayIndex: number;
  label: string;
  bedtime: string; // adjusted by the latest check-in
  advice: string; // the MedPsy branch matching the check-in
  adjustedBy: number; // minutes added by adaptation (0 if none)
};

// Which night are we on? First check-in = the morning after night 1 — so the
// night index equals the number of check-ins since the trip's first one.
// (Parents can also just read the full table; this only drives the highlight.)
export function tonight(plan: SleepPlan): Tonight {
  const log = loadSleepLog();
  const firstArrivalIdx = plan.days.findIndex((d) => d.label.startsWith("Night 1"));
  const idx = Math.min(plan.days.length - 1, Math.max(firstArrivalIdx, firstArrivalIdx + log.length));
  const day = plan.days[idx];
  const rough = todaysCheckIn()?.quality === "rough";
  const adjustedBy = rough && day.bedtime !== "—" ? 20 : 0; // rough night -> ~20min later tonight
  return {
    dayIndex: idx,
    label: day.label,
    bedtime: day.bedtime === "—" ? day.bedtime : toHHMM(toMin(day.bedtime) + adjustedBy),
    advice: rough ? day.adviceIfRough : day.advice,
    adjustedBy,
  };
}

// auto-enter window: within [target, target+90min] tonight (design §9)
export function shouldAutoEnter(plan: SleepPlan, now = new Date()): boolean {
  const t = tonight(plan);
  if (t.bedtime === "—") return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const target = toMin(t.bedtime);
  return cur >= target && cur <= target + 90;
}

// "not tonight" — manual exit suppresses re-entry until tomorrow
const SNOOZE = () => new File(new Directory(Paths.document, "family"), "bedtime-snooze.txt");
export function snoozeTonight() {
  const dir = new Directory(Paths.document, "family");
  if (!dir.exists) dir.create();
  SNOOZE().write(today());
}
export function isSnoozedTonight(): boolean {
  try {
    const f = SNOOZE();
    return f.exists && f.textSync().trim() === today();
  } catch {
    return false;
  }
}
