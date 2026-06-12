// studio/medpsy.mjs
// Adaptive sleep coach, generation side. Reliability split (see
// docs/taletrip-sleep-coach-design.md): a deterministic JS scheduler computes
// the day-by-day skeleton (shift direction, 30min/night convergence, nap/light
// windows — small models can't do arithmetic), and QVAC MedPsy-1.7B (Tether's
// medical Psy family, local GGUF) writes the per-day guidance in TWO branches:
// `advice` (last night went fine) and `adviceIfRough` (rough night) — so the
// iPad can adapt offline while every medical sentence still comes from MedPsy.
import fs from "bare-fs";
import path from "bare-path";
import { logEvent } from "./evidence.mjs";
import { sdk } from "./generate.mjs";

const MEDPSY_PATH = path.resolve("studio/models/medpsy-1.7b-q4_k_m.gguf");

// rough destination UTC offsets for the jet-lag gate (demo scope)
const TZ = { barcelona: 2, paris: 2, tokyo: 9, generic: null };

export function tzDiffFor(destination) {
  const key = Object.keys(TZ).find((k) => destination.toLowerCase().includes(k));
  const dest = key ? TZ[key] : null;
  if (dest == null) return 0;
  const home = -new Date().getTimezoneOffset() / 60; // parent's Mac timezone
  return Math.abs(home - dest);
}
function tzDirectionFor(destination) {
  const key = Object.keys(TZ).find((k) => destination.toLowerCase().includes(k));
  const dest = key ? TZ[key] : null;
  if (dest == null) return "west";
  const home = -new Date().getTimezoneOffset() / 60;
  return dest < home ? "west" : "east";
}

// ── deterministic scheduler ─────────────────────────────────────────────────
const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h % 24) * 60 + (m || 0);
};
const toHHMM = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// westward: body clock runs ahead of local → kid sleepy too EARLY locally →
// start earlier than base on arrival and move +30min/night up to base.
// eastward: the mirror image (start later, move earlier).
export function buildSkeleton(destination, shiftHours, direction, baseBedtime = "20:30") {
  const base = toMin(baseBedtime);
  const days = [];
  // pre-trip: 2 nights, nudging 30 min toward the destination clock
  const preSign = direction === "west" ? +1 : -1;
  days.push({ label: "2 nights before", bedtime: toHHMM(base + preSign * 30) });
  days.push({ label: "1 night before", bedtime: toHHMM(base + preSign * 60) });
  days.push({ label: "✈️ Flight day", bedtime: "—" });
  // arrival: start offset toward the body clock, converge 30 min/night to base
  const nights = Math.min(4, Math.max(2, Math.round(shiftHours / 2)));
  const startOffset = (direction === "west" ? -1 : +1) * Math.min(90, shiftHours * 15);
  for (let n = 1; n <= nights; n++) {
    const frac = n / nights; // linear convergence to base
    days.push({ label: `Night ${n} in ${destination}`, bedtime: toHHMM(base + Math.round(startOffset * (1 - frac))) });
  }
  days.push({ label: "Back to normal", bedtime: baseBedtime });
  return days;
}

// ── MedPsy advisor ──────────────────────────────────────────────────────────
let medpsyPromise = null;
function loadMedPsy() {
  if (!medpsyPromise) {
    medpsyPromise = (async () => {
      if (!fs.existsSync(MEDPSY_PATH)) throw new Error("MedPsy gguf missing");
      const t0 = Date.now();
      const id = await sdk.loadModel({ modelSrc: MEDPSY_PATH, modelType: "llm", modelConfig: { ctx_size: 2048 } });
      logEvent("loadModel", { model: "MedPsy-1.7B-Q4_K_M(local)", durMs: Date.now() - t0 });
      return id;
    })();
  }
  return medpsyPromise;
}

const adviceSchema = {
  type: "object",
  properties: {
    advice: { type: "string", description: "1-2 short sentences for parents tonight if last night went fine" },
    adviceIfRough: { type: "string", description: "1-2 short sentences for parents tonight if last night was rough" },
  },
  required: ["advice", "adviceIfRough"],
};

const FALLBACK = {
  advice: "Keep the usual wind-down routine and dim the lights 30 minutes before the target time.",
  adviceIfRough: "Push bedtime ~20 minutes later tonight, keep the room dark, and add an extra calm story or cuddle.",
};

async function adviseDay(id, destination, age, shiftHours, day) {
  const t0 = Date.now();
  try {
    const r = sdk.completion({
      modelId: id, stream: false,
      generationParams: { reasoning_budget: 0 },
      history: [
        { role: "system", content: "You are a pediatric sleep advisor helping a family beat jet lag. Output JSON only, each field 1-2 short practical sentences a parent can act on tonight. Behavioral guidance only — NEVER recommend medication, melatonin or any supplement. No disclaimers, no numbered lists." },
        { role: "user", content: `Child age ${age || 5}. Trip to ${destination}, time shift ${shiftHours}h. Tonight is "${day.label}", target bedtime ${day.bedtime}. Write the two advice branches.` },
      ],
      responseFormat: { type: "json_schema", json_schema: { name: "advice", schema: adviceSchema } },
    });
    const out = JSON.parse((await r.text).replace(/<think>[\s\S]*?<\/think>/g, ""));
    logEvent("completion", { model: "MedPsy-1.7B-Q4_K_M(local)", role: "sleep-advisor", day: day.label, durMs: Date.now() - t0 });
    // guardrails: behavioral advice only (no meds/supplements), single clean sentence flow
    const clean = (s) =>
      String(s ?? "")
        .replace(/^\s*\d+[.)]\s*/gm, "")
        .replace(/\n+/g, " ")
        .trim();
    const ok = (s) => s.length > 15 && s.length < 320 && !/\b(melatonin|medicat|supplement|drug|pill)\b/i.test(s);
    const a = clean(out.advice), b = clean(out.adviceIfRough);
    return { advice: ok(a) ? a : FALLBACK.advice, adviceIfRough: ok(b) ? b : FALLBACK.adviceIfRough };
  } catch {
    return { ...FALLBACK };
  }
}

// Build the full adaptive sleep plan (skeleton by JS, guidance by MedPsy).
export async function buildSleepPlan(destination, age, tzDiff, baseBedtime = "20:30", onProgress = () => {}) {
  const direction = tzDirectionFor(destination);
  const skeleton = buildSkeleton(destination, tzDiff, direction, baseBedtime);
  const id = await loadMedPsy();
  const days = [];
  for (let i = 0; i < skeleton.length; i++) {
    onProgress(`🏥 MedPsy advising "${skeleton[i].label}"…`);
    days.push({ ...skeleton[i], ...(await adviseDay(id, destination, age, tzDiff, skeleton[i])) });
  }
  return { shiftHours: tzDiff, direction, childAge: age || 5, baseBedtime, days };
}
