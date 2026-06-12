// studio/medpsy.mjs
// QVAC MedPsy-1.7B (Tether's medical Psy family, local GGUF) writes the trip's
// jet-lag sleep plan for the child — generated at book time, shipped in the
// pack as `sleepTips`, surfaced by the iPad's Bedtime mode.
// Model: huggingface.co/qvac/MedPsy-1.7B-GGUF (q4_k_m), loaded from a local path.
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

// 3 short, parent-friendly sleep tips for the child + this trip's time shift
export async function sleepTips(destination, age, tzDiff) {
  const id = await loadMedPsy();
  const t0 = Date.now();
  const r = sdk.completion({
    modelId: id, stream: false,
    generationParams: { reasoning_budget: 0 }, // MedPsy is Qwen3-based — skip <think>
    history: [
      {
        role: "system",
        content:
          "You are a pediatric sleep advisor. Reply with EXACTLY 3 short, practical, reassuring tips (one per line, no numbering preamble), in simple language parents can act on tonight. No disclaimers.",
      },
      {
        role: "user",
        content: `We are traveling with our ${age || 5}-year-old to ${destination}. The time difference is about ${tzDiff} hours. How do we help the child adjust their sleep during the trip?`,
      },
    ],
  });
  const text = (await r.text).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  logEvent("completion", { model: "MedPsy-1.7B-Q4_K_M(local)", role: "health-advisor", durMs: Date.now() - t0, outputChars: text.length });
  const tips = text
    .split("\n")
    .map((s) => s.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter((s) => s.length > 12 && s.length < 220)
    .slice(0, 3);
  if (!tips.length) throw new Error("medpsy returned no tips");
  return tips;
}
