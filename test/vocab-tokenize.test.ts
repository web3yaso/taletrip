import { describe, expect, it } from "vitest";
import { adaptPack } from "@/storypack/adapter";
import type { StoryPack } from "@/storypack/types";

// Regression guard for the reader highlight bug: "sun" must not be tokenized
// inside "sun-kissed" (a hyphenated word), which used to split the word and
// leave a stray empty highlight block.
const packWith = (narration: string): StoryPack =>
  ({
    title: "t",
    vocab: [{ word: "sun", translation: "sol" }],
    pages: [{ index: 0, authoredNarration: narration, image: "p0.png" }],
  }) as unknown as StoryPack;

const story = (narration: string) => adaptPack(packWith(narration), [undefined as never]);
const vocabTokens = (parts: { t?: string; v?: string }[]) => parts.filter((p) => "v" in p);
const flatten = (parts: { t?: string; v?: string }[]) =>
  parts.map((p) => ("t" in p ? p.t : p.v)).join("");

describe("vocab tokenization (reader highlight)", () => {
  it("does NOT highlight a vocab word inside a hyphenated word", () => {
    const parts = story("the sun-kissed platform").pages[0].parts;
    expect(vocabTokens(parts)).toHaveLength(0); // 'sun' in 'sun-kissed' stays plain
    expect(flatten(parts)).toBe("the sun-kissed platform"); // word preserved intact
  });

  it("still highlights a standalone vocab word", () => {
    const parts = story("the bright sun today").pages[0].parts;
    expect(vocabTokens(parts)).toHaveLength(1);
    expect(flatten(parts)).toBe("the bright sun today"); // no spaces lost or added
  });

  it("highlights the standalone word but not the hyphenated one in the same line", () => {
    const parts = story("a sun-kissed bright sun").pages[0].parts;
    expect(vocabTokens(parts)).toHaveLength(1);
    expect(flatten(parts)).toBe("a sun-kissed bright sun");
  });
});
