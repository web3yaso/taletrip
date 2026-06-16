import { describe, expect, it } from "vitest";
import { readerPageText, type ReaderPage, type ReaderVocab } from "@/storypack/adapter";

const vocab: ReaderVocab = { perro: { en: "dog", es: "perro" } };

describe("readerPageText", () => {
  it("flattens text + vocab tokens into the spoken sentence (English side)", () => {
    const page = {
      n: 1,
      mood: "sky",
      parts: [{ t: "The " }, { v: "perro" }, { t: " runs fast." }],
    } as ReaderPage;
    expect(readerPageText(page, vocab)).toBe("The dog runs fast.");
  });

  it("collapses whitespace and trims", () => {
    const page = { n: 1, mood: "sky", parts: [{ t: "  Hello   world  " }] } as ReaderPage;
    expect(readerPageText(page, vocab)).toBe("Hello world");
  });

  it("falls back to the raw key when a vocab word is missing", () => {
    const page = { n: 1, mood: "sky", parts: [{ v: "gato" }] } as ReaderPage;
    expect(readerPageText(page, vocab)).toBe("gato");
  });
});
