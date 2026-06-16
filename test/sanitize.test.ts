import { describe, expect, it } from "vitest";
// pure, dependency-free studio helper
import { sanitizeAdvice } from "../studio/advice-sanitize.mjs";

describe("sanitizeAdvice (MedPsy guardrails)", () => {
  it("keeps a clean single sentence as-is", () => {
    const s = "Tonight a calm, unhurried wind-down helps them ease into the new time zone.";
    expect(sanitizeAdvice(s, "advice", "arrival")).toBe(s);
  });

  it("strips an echoed task-label prefix", () => {
    const out = sanitizeAdvice(
      "For this night: Keep the room dim and the routine slow so they settle softly.",
      "advice",
      "arrival",
    );
    expect(out.toLowerCase()).not.toMatch(/^for this night/);
    expect(out).toMatch(/dim/);
  });

  it("drops any clock time (falls back to a clean line)", () => {
    const out = sanitizeAdvice("Put them to bed at 20:30 tonight for best results.", "advice", "arrival");
    expect(out).not.toMatch(/\d{1,2}[:.]\d{2}/);
    expect(out.length).toBeGreaterThan(20);
  });

  it("keeps only the first sentence", () => {
    const out = sanitizeAdvice(
      "Keep tonight gentle and reassuring. Then tomorrow do the opposite.",
      "advice",
      "arrival",
    );
    expect(out).toBe("Keep tonight gentle and reassuring.");
  });

  it("falls back when the model restates the branch condition", () => {
    const out = sanitizeAdvice("Last night went fine.", "advice", "arrival");
    expect(out).not.toMatch(/went fine/i);
    expect(out.length).toBeGreaterThan(20);
  });

  it("returns the rough-phase fallback for the rough branch", () => {
    const out = sanitizeAdvice("", "rough", "home");
    expect(out.length).toBeGreaterThan(20);
    expect(out).toMatch(/[.!?]$/);
  });
});
