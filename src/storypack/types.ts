// src/storypack/types.ts
// StoryPack data model — mirrors 技术方案 v2 §2.
export type Page = {
  index: number;
  image: string; // file name within the pack dir
  scene: string; // LLM anchor: what this page depicts
  authoredNarration: string; // parent-approved fallback text (safe)
  slots: string[]; // e.g. ["name","destination"]
};

export type VocabEntry = {
  word: string; // English source word
  translation: string; // target-language translation (parent-baked)
  say: string; // how to pronounce (target language text for TTS)
};

export type StoryPack = {
  id: string;
  version: number;
  checksum: string; // sha256:... over the canonical payload
  title: string;
  narrationLang: "en";
  vocabLang: "es";
  ageRange: [number, number];
  pages: Page[];
  vocab: VocabEntry[];
  huntTargets: string[];
  sleepPlan?: SleepPlan; // adaptive jet-lag plan (deterministic scheduler + MedPsy advice)
};

export type SleepPlanDay = {
  label: string; // "Night 1 in Barcelona"
  bedtime: string; // "19:30" or "—" (flight day)
  nap?: string; // deterministic nap window, e.g. "13:00–13:30 · ≤30 min, none after 15:00"
  light?: string; // deterministic light timing, e.g. "Bright morning light 7–9am · dim after dinner"
  phase?: "pre" | "arrival" | "home"; // pre-trip / at destination / back home (return leg)
  advice: string; // MedPsy: last night went fine
  adviceIfRough: string; // MedPsy: rough night branch
};

export type SleepPlan = {
  shiftHours: number;
  direction: "east" | "west"; // outbound shift direction (home → destination)
  childAge: number;
  baseBedtime: string;
  destination?: string; // for local-time anchoring copy ("Barcelona is +8h")
  days: SleepPlanDay[]; // pre-trip → arrival nights → back-home (return) nights
};
