import { describe, expect, it } from "vitest";
import { isDegenerate, vetNarration } from "../studio/text-quality.mjs";

describe("isDegenerate (1B writer repetition guard)", () => {
  it("flags pure name repetition (the bug)", () => {
    expect(isDegenerate("Sofia, Sofia, Sofia, Sofia, Sofia,")).toBe(true);
  });
  it("flags 3+ identical words in a row", () => {
    expect(isDegenerate("the cat the the the sat")).toBe(true);
  });
  it("accepts a normal varied sentence", () => {
    expect(isDegenerate("Sofia walked through the warm Barcelona air and smiled.")).toBe(false);
  });
  it("does not flag short fragments", () => {
    expect(isDegenerate("Sofia ran")).toBe(false);
  });
  it("does not flag light, legitimate repetition", () => {
    expect(isDegenerate("Brown bear, brown bear, what do you see?")).toBe(false);
  });
});

describe("vetNarration", () => {
  it("falls back to the scene sentence on degenerate output (no doubled name)", () => {
    const out = vetNarration(
      "Sofia, Sofia, Sofia, Sofia, Sofia,",
      "Sofia steps off the train onto the platform",
      "Sofia",
    );
    expect(out).toBe("Sofia steps off the train onto the platform.");
  });
  it("keeps a clean in-range sentence", () => {
    const good = "Sofia gazed at the colorful Barcelona rooftops.";
    expect(vetNarration(good, "scene", "Sofia")).toBe(good);
  });
  it("falls back on a deny word", () => {
    expect(vetNarration("a scary monster appeared", "Sofia plays in the park", "Sofia")).toBe(
      "Sofia plays in the park.",
    );
  });
  it("uses a safe generic line when the scene fallback is unusable", () => {
    expect(vetNarration("x x x x", "", "Sofia")).toBe("Sofia loved the adventure.");
  });
  it("strips inline parenthetical translations the model injects", () => {
    expect(vetNarration("Her abuela (grandmother) was cooking paella.", "scene", "Sofia")).toBe(
      "Her abuela was cooking paella.",
    );
  });
});
