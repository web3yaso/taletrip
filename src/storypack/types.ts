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

export type ColoringPage = {
  kind: "nature" | "food"; // plants & animals vs. foods
  name: string; // display name (e.g. "a cute koi fish")
  image: string; // line-art file name within the pack dir
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
  coloring?: ColoringPage[]; // printable line-art (added by the Studio SD pipeline)
};
