// studio/generate.mjs
// Parent Studio generation pipeline (reusable) — LLM narration + SD illustrations
// -> StoryPack. Engines are loaded ONCE and kept resident (Mac is unconstrained),
// so the long-lived server reuses them across requests (and avoids worker-lock churn).
import fs from "bare-fs";
import path from "bare-path";
import { plugins, LLAMA_3_2_1B_INST_Q4_0, SDXL_BASE_1_0_3B_Q4_0 } from "@qvac/sdk";

fs.mkdirSync("studio/packs", { recursive: true });
export const PACKS_ROOT = fs.realpathSync("studio/packs");
// slug user input down to a safe filename component (no path separators / traversal)
export const safeSlug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";
import { llmPlugin } from "@qvac/sdk/llamacpp-completion/plugin";
import { diffusionPlugin } from "@qvac/sdk/sdcpp-generation/plugin";
import { embeddingsPlugin } from "@qvac/sdk/llamacpp-embedding/plugin";
import { logEvent } from "./evidence.mjs";

export const sdk = plugins([llmPlugin, diffusionPlugin, embeddingsPlugin]);

let enginesPromise = null;
export function loadEngines(onProgress = () => {}) {
  if (!enginesPromise) {
    enginesPromise = (async () => {
      onProgress("warming up the storyteller (LLM)…");
      let t0 = Date.now();
      const llm = await sdk.loadModel({ modelSrc: LLAMA_3_2_1B_INST_Q4_0, modelType: "llm" });
      logEvent("loadModel", { model: "LLAMA_3_2_1B_INST_Q4_0", durMs: Date.now() - t0 });
      onProgress("warming up the illustrator (SDXL)…");
      t0 = Date.now();
      const sd = await sdk.loadModel({ modelSrc: SDXL_BASE_1_0_3B_Q4_0 });
      logEvent("loadModel", { model: "SDXL_BASE_1_0_3B_Q4_0", durMs: Date.now() - t0 });
      return { llm, sd };
    })();
  }
  return enginesPromise;
}

export const sceneArc = (dest) => [
  `arriving in ${dest}: a sunny morning walk through a lively square full of color`,
  `a famous landmark in ${dest} with tall towers reaching into a bright blue sky`,
  `a green park in ${dest} with a tree, birds, and a sparkling fountain`,
  `a sunny beach near ${dest} with gentle blue waves and a small white sailboat`,
  `sunset over ${dest} as warm yellow lights turn on across the city`,
];

const VOCAB = {
  square: "la plaza", color: "el color", tower: "la torre", sky: "el cielo",
  park: "el parque", tree: "el árbol", bird: "el pájaro", fountain: "la fuente",
  beach: "la playa", wave: "la ola", boat: "el barco", sun: "el sol",
  sunset: "el atardecer", light: "la luz", city: "la ciudad", morning: "la mañana",
};

export const STYLE = "children's storybook illustration, soft watercolor, warm Mediterranean colors, gentle, cute";
export const NEG = "blurry, deformed, extra limbs, ugly, text, watermark, scary";
export const DENY = /\b(kill|blood|gun|die|dead|scary|hate|weapon)\b/i;

export function narrationMessages(scene, childName, dest) {
  return [
    { role: "system", content: "Write one short storybook page for a 5-year-old: 2-3 simple, gentle sentences. Use the child's name. Keep it about the given scene. No scary content." },
    { role: "user", content: `Child: ${childName}. Place: ${dest}. Scene: ${scene}.` },
  ];
}
export function pickVocab(text) {
  const lower = text.toLowerCase();
  const out = [];
  for (const [en, es] of Object.entries(VOCAB)) {
    if (out.length >= 3) break;
    if (new RegExp(`\\b${en}s?\\b`).test(lower)) out.push({ word: en, translation: es, say: es });
  }
  return out;
}

export async function generateStoryPack(req, onProgress = () => {}) {
  const destination = (req.destination || "Lisbon").trim();
  const childName = (req.childName || "Mia").trim();
  const vocabLang = req.vocabLang || "es";
  const nPages = Math.max(1, Math.min(5, Number(req.pages) || 5));

  const { llm, sd } = await loadEngines(onProgress);
  const scenes = sceneArc(destination).slice(0, nPages);
  const PAINT = req.quality === "high"
    ? { width: 768, height: 768, steps: 24 }
    : { width: 640, height: 640, steps: 20 };
  const total = scenes.length * 2;
  let step = 0;

  // Phase 1: LLM narration
  const pages = [];
  const vocabAll = {};
  for (let i = 0; i < scenes.length; i++) {
    onProgress(`writing page ${i + 1} of ${scenes.length}…`, ++step, total);
    const tw = Date.now();
    const r = sdk.completion({ modelId: llm, history: narrationMessages(scenes[i], childName, destination), stream: false });
    let text = (await r.text).trim().replace(/\s*\n+\s*/g, " ").replace(/\s+/g, " ").trim();
    logEvent("completion", { model: "LLAMA_3_2_1B_INST_Q4_0", page: i, durMs: Date.now() - tw, outputChars: text.length });
    if (text.length < 10 || text.length > 400 || DENY.test(text)) text = `${childName} enjoys ${scenes[i]}.`;
    for (const v of pickVocab(text)) vocabAll[v.word] = v;
    pages.push({ index: i, image: `p${i}.png`, scene: scenes[i], authoredNarration: text, slots: [] });
  }

  // Phase 2: SD illustrations
  const id = `${safeSlug(destination)}-${safeSlug(childName)}`;
  const outDir = path.resolve(PACKS_ROOT, id);
  if (outDir !== PACKS_ROOT && !outDir.startsWith(PACKS_ROOT + path.sep)) throw new Error("bad pack id");
  fs.mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < pages.length; i++) {
    onProgress(`painting page ${i + 1} of ${pages.length}…`, ++step, total);
    const tp = Date.now();
    const { progressStream, outputs } = sdk.diffusion({
      modelId: sd, prompt: `${pages[i].scene}, ${STYLE}`, negative_prompt: NEG,
      ...PAINT, cfg_scale: 8, seed: 40 + i * 7,
    });
    for await (const tick of progressStream) {
      const tot = tick?.totalSteps ?? tick?.total;
      if (tick?.step && tot)
        onProgress(`🎨 painting page ${i + 1} of ${pages.length} · brush stroke ${tick.step}/${tot}`, step - 1 + tick.step / tot, total);
    }
    const bufs = await outputs;
    if (bufs?.[0]) fs.writeFileSync(`${outDir}/p${i}.png`, bufs[0]);
    logEvent("diffusion", { model: "SDXL_BASE_1_0_3B_Q4_0", page: i, durMs: Date.now() - tp, bytes: bufs?.[0]?.length ?? 0, size: "768x768", steps: 24 });
  }

  // Phase 3: pack
  const pack = {
    id, version: 1, checksum: "sha256:dev",
    title: `${childName}'s trip to ${destination}`,
    narrationLang: "en", vocabLang, ageRange: [4, 7],
    pages, vocab: Object.values(vocabAll), huntTargets: ["tree", "tower", "boat"],
  };
  fs.writeFileSync(`${outDir}/storypack.json`, JSON.stringify(pack, null, 2));
  onProgress("done", total, total);
  return pack;
}
