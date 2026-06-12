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
  advice: string; // MedPsy: last night went fine
  adviceIfRough: string; // MedPsy: rough night branch
};

export type SleepPlan = {
  shiftHours: number;
  direction: "east" | "west";
  childAge: number;
  baseBedtime: string;
  days: SleepPlanDay[];
};
