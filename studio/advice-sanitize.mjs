// studio/advice-sanitize.mjs
// Post-process MedPsy's per-day advice into ONE clean, number-free, encouraging
// sentence. A 1.7B model tends to echo the task label ("For rough night:"),
// restate the branch condition ("Last night went fine."), or drop end
// punctuation — this trims all of that, and falls back to a warm generic line
// (phase-appropriate) when the output degenerates. Pure, dependency-free so
// both the generator (medpsy.mjs) and a one-off re-patch can share it.

const FB = {
  pre: {
    advice: "A calm, consistent wind-down tonight gently eases them toward the new time zone.",
    rough: "If last night was bumpy, keep tonight extra soothing and unhurried — it's all part of adjusting.",
  },
  arrival: {
    advice: "Tonight's calm, steady routine is nudging their body clock the right way — keep it gentle.",
    rough: "Last night was bumpy, so go a little slower tonight with extra cuddles — it settles within a few days.",
  },
  home: {
    advice: "Back home, a steady dim-light routine helps them slide back into their normal sleep.",
    rough: "If last night was rough, keep tonight quiet and reassuring — their clock is finding home again.",
  },
};

const hasTime = (s) => /\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\s?(am|pm|hrs?|hours?|h)\b|\b\d{1,2}\s?[-–]\s?\d{1,2}\b/i.test(s);

export function sanitizeAdvice(raw, kind /* "advice" | "rough" */, phase) {
  let t = String(raw ?? "").replace(/\s+/g, " ").trim();
  // drop echoed task-label prefixes: "For this night:", "If rough last night:",
  // "Fly home advice:", "For Home night 1,"
  t = t.replace(/^\s*(for\s+[^:,]{0,28}[:,]|if\s+[^:,]{0,28}[:,]|[a-z][a-z\s]{0,24}advice\s*:|tonight\s*:)\s*/i, "").trim();
  // keep the first sentence only
  const m = t.match(/^.*?[.!?](\s|$)/);
  if (m) t = m[0].trim();
  // tidy: strip a trailing comma, ensure terminal punctuation, capitalize
  t = t.replace(/[,\s]+$/, "").trim();
  if (t && !/[.!?]$/.test(t)) t += ".";
  if (t) t = t[0].toUpperCase() + t.slice(1);
  const fb = FB[phase] || FB.arrival;
  const degenerate =
    t.length < 28 ||
    hasTime(t) ||
    /\b(melatonin|medicat|supplement|drug|pill)\b/i.test(t) ||
    /^(last night|this night|advice|rough)\b/i.test(t) ||
    /(went fine|was rough|might be rough)/i.test(t);
  return degenerate ? (kind === "rough" ? fb.rough : fb.advice) : t;
}
