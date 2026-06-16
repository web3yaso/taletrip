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
import { logEvent, completionStats } from "./evidence.mjs";
import { sdk } from "./generate.mjs";
import { sanitizeAdvice } from "./advice-sanitize.mjs";

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

// Light is the strongest zeitgeber. To shift the body clock EARLIER (phase
// advance — what an eastward trip needs) seek morning light, avoid evening
// light. To shift LATER (phase delay — westward) do the reverse. Naps are
// strategic: short and early enough not to steal that night's sleep drive.
// `dir` here is the direction THIS leg must shift the clock.
function lightTip(dir, phase) {
  if (dir === "east") {
    return phase === "pre"
      ? "Catch early-morning light; dim lights ~30 min earlier each evening"
      : "Bright light first thing 7–9am local · dim screens & lights after dinner";
  }
  return phase === "pre"
    ? "Stay up with bright evening light; sleep in a little later"
    : "Soak up afternoon/evening light 4–7pm local · keep the morning dim";
}
function napTip(phase, n) {
  if (phase === "pre") return "";
  if (phase === "flight") return "Nap on the plane only during the destination's night-time";
  // first two days at a new clock: a short, early nap is OK; after that, push through
  if (n <= 2) return "Short nap OK 13:00–13:30 local · ≤30 min, none after 15:00";
  return "Try to skip naps today — push through to tonight's target";
}

// Build the day-by-day skeleton: pre-trip nudge → flight → arrival nights
// (converge to base) → RETURN leg back home (clock shifts the OTHER way, so a
// few more nights to re-adapt). westward: body clock ahead of local → sleepy
// too early → start earlier than base, move +30/night. eastward: mirror.
export function buildSkeleton(destination, shiftHours, direction, baseBedtime = "20:30") {
  const base = toMin(baseBedtime);
  const days = [];
  const offsetFor = (dir) => (dir === "west" ? -1 : +1) * Math.min(90, shiftHours * 15);
  const nightsFor = () => Math.min(4, Math.max(2, Math.round(shiftHours / 2)));

  // pre-trip: 2 nights nudging toward the destination clock
  const preSign = direction === "west" ? +1 : -1;
  days.push({ phase: "pre", label: "2 nights before", bedtime: toHHMM(base + preSign * 30), nap: napTip("pre"), light: lightTip(direction, "pre") });
  days.push({ phase: "pre", label: "1 night before", bedtime: toHHMM(base + preSign * 60), nap: napTip("pre"), light: lightTip(direction, "pre") });
  days.push({ phase: "pre", label: "✈️ Flight day", bedtime: "—", nap: napTip("flight"), light: "Set watches to destination time on takeoff" });

  // arrival: shift toward the destination clock, converge to base
  const aNights = nightsFor();
  const aOffset = offsetFor(direction);
  for (let n = 1; n <= aNights; n++) {
    const frac = n / aNights;
    days.push({ phase: "arrival", label: `Night ${n} in ${destination}`, bedtime: toHHMM(base + Math.round(aOffset * (1 - frac))), nap: napTip("arrival", n), light: lightTip(direction, "arrival") });
  }

  // return leg home: the clock must now shift the OTHER way
  const homeDir = direction === "east" ? "west" : "east";
  const hNights = Math.min(3, nightsFor());
  const hOffset = offsetFor(homeDir);
  const homeLight = lightTip(homeDir, "arrival");
  days.push({ phase: "home", label: "✈️ Fly home", bedtime: "—", nap: napTip("flight"), light: homeLight });
  for (let n = 1; n <= hNights; n++) {
    const frac = n / hNights;
    days.push({ phase: "home", label: `Home night ${n}`, bedtime: toHHMM(base + Math.round(hOffset * (1 - frac))), nap: napTip("arrival", n), light: homeLight });
  }
  days.push({ phase: "home", label: "Back to normal", bedtime: baseBedtime, nap: "", light: "Normal routine — jet lag beaten 🎉" });
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
  advice: "Tonight's calm, steady routine is nudging their body clock the right way — keep it gentle.",
  adviceIfRough: "Last night was bumpy, so go a little slower tonight with extra cuddles — it settles within a few days.",
};

async function adviseDay(id, destination, age, shiftHours, day) {
  const t0 = Date.now();
  // Build a NUMBER-FREE focus so the small model has no clock time to parrot
  // (the exact windows are already shown from the deterministic fields). The
  // light field encodes the shift direction (morning light = advance/earlier).
  const lt = day.light || "";
  const shiftWord =
    day.phase === "home" ? "back toward home time"
    : /morning/i.test(lt) ? "to a slightly earlier rhythm"
    : /afternoon|evening/i.test(lt) ? "to a slightly later rhythm"
    : "toward the new schedule";
  const lightFocus =
    /morning/i.test(lt) ? "bright morning daylight and a calm, dim evening"
    : /afternoon|evening/i.test(lt) ? "plenty of afternoon and evening light with a quiet, dim morning"
    : "bright light by day and dim light at night";
  const napFocus =
    /short nap/i.test(day.nap || "") ? ", and a short early-afternoon nap is fine"
    : /skip/i.test(day.nap || "") ? ", and skipping daytime naps so night sleep comes easily"
    : /plane/i.test(day.nap || "") ? ", resting on the plane only during the destination's night"
    : "";
  try {
    const r = sdk.completion({
      modelId: id, stream: false,
      generationParams: { reasoning_budget: 0 },
      history: [
        { role: "system", content: "You are a warm pediatric sleep coach. For EACH field write exactly ONE short, encouraging sentence (under 22 words) a parent reads at night. Say WHY tonight helps; for a rough night, reassure them and suggest going a little gentler. NEVER mention any clock time, hour, number, or place name — those are shown separately. Behavioral only: never medication, melatonin or supplements. No lists, no preamble." },
        { role: "user", content: `Child age ${age || 5}. Tonight is "${day.label}". It nudges the body clock ${shiftWord}, using ${lightFocus}${napFocus}. Write advice (last night went fine) and adviceIfRough (last night was rough — reassure and go gentler tonight).` },
      ],
      responseFormat: { type: "json_schema", json_schema: { name: "advice", schema: adviceSchema } },
    });
    const out = JSON.parse((await r.text).replace(/<think>[\s\S]*?<\/think>/g, ""));
    logEvent("completion", { model: "MedPsy-1.7B-Q4_K_M(local)", role: "sleep-advisor", day: day.label, durMs: Date.now() - t0, ...(await completionStats(r)) });
    // deterministic clean-up: one clean sentence, no echoed labels / clock times
    return {
      advice: sanitizeAdvice(out.advice, "advice", day.phase),
      adviceIfRough: sanitizeAdvice(out.adviceIfRough, "rough", day.phase),
    };
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
  return { shiftHours: tzDiff, direction, childAge: age || 5, baseBedtime, destination, days };
}
