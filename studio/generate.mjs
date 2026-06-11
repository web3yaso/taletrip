// studio/generate.mjs
// Parent Studio generation pipeline (reusable) — LLM narration + SD illustrations
// -> StoryPack. Engines are loaded ONCE and kept resident (Mac is unconstrained),
// so the long-lived server reuses them across requests (and avoids worker-lock churn).
import fs from "bare-fs";
import path from "bare-path";
import { plugins, LLAMA_3_2_1B_INST_Q4_0, SDXL_BASE_1_0_3B_Q4_0 } from "@qvac/sdk";

fs.mkdirSync("studio/packs", { recursive: true });
const PACKS_ROOT = fs.realpathSync("studio/packs");
// slug user input down to a safe filename component (no path separators / traversal)
const safeSlug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";
import { llmPlugin } from "@qvac/sdk/llamacpp-completion/plugin";
import { diffusionPlugin } from "@qvac/sdk/sdcpp-generation/plugin";
import { subjectsFor } from "./coloring-subjects.mjs";
import { pngToLineArt } from "./lineart.mjs";

const sdk = plugins([llmPlugin, diffusionPlugin]);

let enginesPromise = null;
export function loadEngines(onProgress = () => {}) {
  if (!enginesPromise) {
    enginesPromise = (async () => {
      onProgress("warming up the storyteller (LLM)…");
      const llm = await sdk.loadModel({ modelSrc: LLAMA_3_2_1B_INST_Q4_0, modelType: "llm" });
      onProgress("warming up the illustrator (SDXL)…");
      const sd = await sdk.loadModel({ modelSrc: SDXL_BASE_1_0_3B_Q4_0 });
      return { llm, sd };
    })();
  }
  return enginesPromise;
}

const sceneArc = (dest) => [
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

const STYLE = "children's storybook illustration, soft watercolor, warm Mediterranean colors, gentle, cute";
const NEG = "blurry, deformed, extra limbs, ugly, text, watermark, scary";
const DENY = /\b(kill|blood|gun|die|dead|scary|hate|weapon)\b/i;

// Coloring pages: cute SIMPLE kawaii cartoons (curated per-region plants/animals/
// foods — see coloring-subjects.mjs). SD renders them in soft color, then
// pngToLineArt() bakes them into clean black-and-white coloring pages for printing.
const COLOR_STYLE = "cute simple cartoon, thick bold uniform black outline, minimal interior detail, kawaii style, rounded chubby shapes, plain white background, no shading, lots of empty white space, adorable, very simple, single object centered";
const COLOR_NEG = "shadow, shading, gradient, solid black, silhouette, dark background, realistic, photo, 3d, detailed, intricate, ornate, complex, many lines, busy, fine detail, text, watermark, scenery, background, multiple objects, pattern, texture, grid, frame, border";

function narrationMessages(scene, childName, dest) {
  return [
    { role: "system", content: "Write one short storybook page for a 5-year-old: 2-3 simple, gentle sentences. Use the child's name. Keep it about the given scene. No scary content." },
    { role: "user", content: `Child: ${childName}. Place: ${dest}. Scene: ${scene}.` },
  ];
}
function pickVocab(text) {
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
  const N_COLOR = 6; // 3 landmarks + 3 foods
  const total = scenes.length * 2 + N_COLOR;
  let step = 0;

  // Phase 1: LLM narration
  const pages = [];
  const vocabAll = {};
  for (let i = 0; i < scenes.length; i++) {
    onProgress(`writing page ${i + 1} of ${scenes.length}…`, ++step, total);
    const r = sdk.completion({ modelId: llm, history: narrationMessages(scenes[i], childName, destination), stream: false });
    let text = (await r.text).trim().split("\n").filter(Boolean)[0] ?? "";
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
    const { progressStream, outputs } = sdk.diffusion({
      modelId: sd, prompt: `${pages[i].scene}, ${STYLE}`, negative_prompt: NEG,
      width: 768, height: 768, steps: 24, cfg_scale: 8, seed: 40 + i * 7,
    });
    for await (const _ of progressStream) { /* drain */ }
    const bufs = await outputs;
    if (bufs?.[0]) fs.writeFileSync(`${outDir}/p${i}.png`, bufs[0]);
  }

  // Phase 2.5: coloring pages — curated SIMPLE per-region subjects (plants / animals
  // / foods), rendered as cute kawaii cartoons, then baked into clean black-and-white
  // coloring pages with pngToLineArt() so they print like a real coloring book.
  const colorItems = subjectsFor(destination).map((s, i) => ({ kind: s.kind, name: s.name, image: `color-${i}.png` }));
  for (let i = 0; i < colorItems.length; i++) {
    const it = colorItems[i];
    onProgress(`drawing coloring page: ${it.name}…`, ++step, total);
    // best-of-N: a good coloring page is mostly white — keep the attempt with the
    // least black (auto-rejects solid-black failures like dark foods).
    let best = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { progressStream, outputs } = sdk.diffusion({
        modelId: sd, prompt: `${it.name}, ${COLOR_STYLE}`, negative_prompt: COLOR_NEG,
        width: 768, height: 768, steps: 24, cfg_scale: 8, seed: 100 + i * 17 + attempt * 101,
      });
      for await (const _ of progressStream) { /* drain */ }
      const bufs = await outputs;
      if (!bufs?.[0]) continue;
      let res;
      try { res = pngToLineArt(bufs[0]); } catch { res = { png: bufs[0], black: 1 }; }
      if (!best || res.black < best.black) best = res;
      if (best.black <= 0.22) break; // clean enough — stop early
    }
    if (best) fs.writeFileSync(`${outDir}/${it.image}`, best.png);
  }

  // Phase 3: pack
  const pack = {
    id, version: 1, checksum: "sha256:dev",
    title: `${childName}'s trip to ${destination}`,
    narrationLang: "en", vocabLang, ageRange: [4, 7],
    pages, vocab: Object.values(vocabAll), huntTargets: ["tree", "tower", "boat"],
    coloring: colorItems.filter((it) => fs.existsSync(`${outDir}/${it.image}`)),
  };
  fs.writeFileSync(`${outDir}/storypack.json`, JSON.stringify(pack, null, 2));
  onProgress("done", total, total);
  return pack;
}
