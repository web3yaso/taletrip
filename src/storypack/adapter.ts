// src/storypack/adapter.ts
// Adapt a generated StoryPack (authoredNarration strings + flat vocab) into the
// Reader's view model: tappable-token pages + a vocab lookup + page images.
import type { ImageSourcePropType } from "react-native";
import type { Mood } from "@/ui/tokens";
import type { StoryPack } from "./types";

export type ReaderVocab = Record<string, { en: string; es: string }>;
export type ReaderPart = { t: string } | { v: string };
export type ReaderPage = { n: number; mood: Mood; parts: ReaderPart[]; image?: ImageSourcePropType };
export type ReaderStory = { title: string; theme: string; pages: ReaderPage[]; vocab: ReaderVocab };

// cycle moods so each page's mosaic background varies
const MOODS: Mood[] = ["sky", "garden", "sea", "earth", "muted"];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Split narration into plain-text and tappable vocab tokens (whole-word, case-insensitive).
function tokenize(text: string, vocabWords: string[]): ReaderPart[] {
  if (vocabWords.length === 0) return [{ t: text }];
  // longest-first so multi-word entries win
  const alt = [...vocabWords].sort((a, b) => b.length - a.length).map(escapeRe).join("|");
  const re = new RegExp(`\\b(${alt})\\b`, "ig");
  const parts: ReaderPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index) });
    parts.push({ v: m[1].toLowerCase() });
    last = m.index + m[0].length;
    if (m.index === re.lastIndex) re.lastIndex++; // guard zero-width
  }
  if (last < text.length) parts.push({ t: text.slice(last) });
  return parts;
}

export function adaptPack(pack: StoryPack, images: ImageSourcePropType[]): ReaderStory {
  const vocab: ReaderVocab = {};
  for (const v of pack.vocab) vocab[v.word.toLowerCase()] = { en: v.word, es: v.translation };
  const vocabWords = Object.keys(vocab);
  const pages: ReaderPage[] = pack.pages.map((pg, i) => ({
    n: pg.index + 1,
    mood: MOODS[i % MOODS.length],
    parts: tokenize(pg.authoredNarration, vocabWords),
    image: images[i],
  }));
  return { title: pack.title, theme: "Trip story", pages, vocab };
}

// Flatten a page back to the sentence the TTS reads aloud.
export function readerPageText(page: ReaderPage, vocab: ReaderVocab): string {
  return page.parts
    .map((p) => ("t" in p ? p.t : vocab[p.v]?.en ?? p.v))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
