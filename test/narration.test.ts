import { describe, expect, it } from "vitest";
import { fillSlots, validateNarration } from "@/reading/narration";
import type { Page } from "@/storypack/types";

const page = (authored: string): Page =>
  ({ scene: "{name} explores {destination}.", authoredNarration: authored } as unknown as Page);

describe("fillSlots", () => {
  it("substitutes known slots", () => {
    expect(fillSlots("Hi {name} in {destination}!", { name: "Sofia", destination: "Barcelona" })).toBe(
      "Hi Sofia in Barcelona!",
    );
  });
  it("leaves unknown slots untouched", () => {
    expect(fillSlots("Hi {name} in {place}", { name: "Sofia" })).toBe("Hi Sofia in {place}");
  });
});

describe("validateNarration", () => {
  const slots = { name: "Sofia", destination: "Barcelona" };

  it("passes clean, in-range text through unchanged", () => {
    const text = "Sofia skipped along the sunny Barcelona beach and laughed.";
    expect(validateNarration(text, page("fallback"), slots)).toBe(text);
  });

  it("falls back (filled) when the model returns unsafe words", () => {
    const out = validateNarration("a scary monster with a gun", page("Sofia loves {destination}."), slots);
    expect(out).toBe("Sofia loves Barcelona.");
  });

  it("falls back when text is too short", () => {
    expect(validateNarration("hi", page("Sofia loves {destination}."), slots)).toBe("Sofia loves Barcelona.");
  });

  it("falls back when text is too long", () => {
    const out = validateNarration("x".repeat(401), page("Sofia loves {destination}."), slots);
    expect(out).toBe("Sofia loves Barcelona.");
  });
});
