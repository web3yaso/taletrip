// studio/text-quality.mjs
// Deterministic quality gate for the 1B writer's page narration. Tiny models
// degenerate into repetition ("Sofia, Sofia, Sofia, ...") — which slips past a
// pure length/deny-word check — so we also detect repetition and fall back to
// the planner's scene sentence (never "${name} loved ${name} ..."). Pure and
// dependency-free so both generate.mjs and orchestrator.mjs share it and it is
// unit-testable.

const DENY = /\b(kill|blood|gun|die|dead|scary|hate|weapon)\b/i;

// Repetition detector: a low unique/total word ratio, or 3+ identical words in
// a row, means the model has degenerated. Returns false for short fragments.
export function isDegenerate(text) {
  const words = String(text ?? "").toLowerCase().match(/[a-z']+/g) || [];
  if (words.length < 4) return false;
  if (new Set(words).size / words.length < 0.5) return true; // heavy repetition
  let run = 1;
  for (let i = 1; i < words.length; i++) {
    run = words[i] === words[i - 1] ? run + 1 : 1;
    if (run >= 3) return true; // same word 3× in a row
  }
  return false;
}

// Accept the writer's line if it is in-range, clean, and not degenerate;
// otherwise fall back to the scene sentence itself (a clean, name-grounded
// sentence from the planner), avoiding the doubled-name fallback.
export function vetNarration(text, fallbackScene, childName) {
  // strip parenthetical asides the model injects, e.g. "abuela (grandmother)" —
  // the app teaches Spanish via tappable highlights, not inline translations.
  const t = String(text ?? "").replace(/\s*[([{（][^)\]}）]*[)\]}）]/g, "").replace(/\s{2,}/g, " ").trim();
  if (t.length >= 10 && t.length <= 400 && !DENY.test(t) && !isDegenerate(t)) return t;
  let fb = String(fallbackScene ?? "").trim();
  if (fb && !/[.!?]$/.test(fb)) fb += ".";
  return fb.length >= 10 ? fb : `${String(childName || "The child").trim()} loved the adventure.`;
}
