import { describe, expect, it } from "vitest";
import { matchesTarget, sampleTargets, POOL, SYNONYMS } from "@/hunt/match";

// Regression guard for the "always says yes" hunt bug: judgement is now done in
// JS over the object the VLM names, so these cases must stay correct.
describe("matchesTarget", () => {
  it("hits the exact target as a whole word", () => {
    expect(matchesTarget("a wooden chair", "chair")).toBe(true);
    expect(matchesTarget("Window", "window")).toBe(true); // case-insensitive
  });

  it("hits a known synonym", () => {
    expect(matchesTarget("a ceramic mug", "cup")).toBe(true);
    expect(matchesTarget("white sneaker", "shoe")).toBe(true);
  });

  it("accepts a simple plural", () => {
    expect(matchesTarget("two books on the desk", "book")).toBe(true);
  });

  it("does NOT match a substring inside another word", () => {
    expect(matchesTarget("what is that", "hat")).toBe(false); // 'hat' in 'what'
    expect(matchesTarget("a doormat", "door")).toBe(false); // 'door' in 'doormat'
  });

  it("misses when the named object is unrelated (soda can ≠ window)", () => {
    expect(matchesTarget("a soda can", "window")).toBe(false);
  });
});

describe("sampleTargets", () => {
  it("returns 3 distinct objects from the pool", () => {
    const t = sampleTargets();
    expect(t).toHaveLength(3);
    expect(new Set(t).size).toBe(3);
    for (const x of t) expect(POOL).toContain(x);
  });

  it("never returns an excluded object", () => {
    const prev = sampleTargets();
    const next = sampleTargets(prev);
    for (const x of next) expect(prev).not.toContain(x);
  });
});

describe("SYNONYMS table", () => {
  it("only maps keys that exist in the pool", () => {
    for (const key of Object.keys(SYNONYMS)) expect(POOL).toContain(key);
  });
});
