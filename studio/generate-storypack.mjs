// studio/generate-storypack.mjs
// TaleTrip Parent Studio — core generation pipeline (MacBook / Bare).
// Input a destination + child name → LLM writes each page's narration (name +
// place woven in), SD paints a scene illustration, then pack a StoryPack.
// Scene-focused arc (SD 1B does scenes well, not characters — "够用" route).
//
// Run:  node_modules/.bin/bare studio/generate-storypack.mjs
import fs from "bare-fs";
import { plugins, LLAMA_3_2_1B_INST_Q4_0, SD_V2_1_1B_Q4_0 } from "@qvac/sdk";
import { llmPlugin } from "@qvac/sdk/llamacpp-completion/plugin";
import { diffusionPlugin } from "@qvac/sdk/sdcpp-generation/plugin";

const { loadModel, completion, diffusion, unloadModel } = plugins([llmPlugin, diffusionPlugin]);

// ── request (later comes from the Web UI) ──────────────────────────────
const REQ = { destination: "Lisbon", childName: "Mia", vocabLang: "es", ageRange: [4, 7] };

// Scene arc parameterized by destination — reliable structure; the LLM
// personalizes the prose, SD paints each scene.
const sceneArc = (dest) => [
  `arriving in ${dest}: a sunny morning walk through a lively square full of color`,
  `a famous landmark in ${dest} with tall towers reaching into a bright blue sky`,
  `a green park in ${dest} with a tree, birds, and a sparkling fountain`,
  `a sunny beach near ${dest} with gentle blue waves and a small white sailboat`,
  `sunset over ${dest} as warm yellow lights turn on across the city`,
];

// Curated EN→ES travel vocab; words found in a page's narration become tappable.
const VOCAB = {
  square: "la plaza", color: "el color", tower: "la torre", sky: "el cielo",
  park: "el parque", tree: "el árbol", bird: "el pájaro", fountain: "la fuente",
  beach: "la playa", wave: "la ola", boat: "el barco", sun: "el sol",
  sunset: "el atardecer", light: "la luz", city: "la ciudad", morning: "la mañana",
};

const STYLE = "children's storybook illustration, soft watercolor, warm Mediterranean colors, gentle, cute";
const NEG = "blurry, deformed, extra limbs, ugly, text, watermark, scary";

function narrationMessages(scene, childName, dest) {
  return [
    { role: "system", content: "Write one short storybook page for a 5-year-old: 2-3 simple, gentle sentences. Use the child's name. Keep it about the given scene. No scary content." },
    { role: "user", content: `Child: ${childName}. Place: ${dest}. Scene: ${scene}.` },
  ];
}
const DENY = /\b(kill|blood|gun|die|dead|scary|hate|weapon)\b/i;
function pickVocab(text) {
  const lower = text.toLowerCase();
  const out = [];
  for (const [en, es] of Object.entries(VOCAB)) {
    if (out.length >= 3) break;
    if (new RegExp(`\\b${en}s?\\b`).test(lower)) out.push({ word: en, translation: es, say: es });
  }
  return out;
}

async function main() {
  const scenes = sceneArc(REQ.destination);
  const t0 = Date.now();

  // ── Phase 1: LLM narration per page ──
  console.log("Phase 1: LLM narration…");
  const llm = await loadModel({ modelSrc: LLAMA_3_2_1B_INST_Q4_0, modelType: "llm" });
  const pages = [];
  const vocabAll = {};
  for (let i = 0; i < scenes.length; i++) {
    const r = completion({ modelId: llm, history: narrationMessages(scenes[i], REQ.childName, REQ.destination), stream: false });
    let text = (await r.text).trim().split("\n").filter(Boolean)[0] ?? "";
    if (text.length < 10 || text.length > 400 || DENY.test(text)) {
      text = `${REQ.childName} enjoys ${scenes[i]}.`;
    }
    for (const v of pickVocab(text)) vocabAll[v.word] = v;
    pages.push({ index: i, image: `p${i}.png`, scene: scenes[i], authoredNarration: text, slots: [] });
    console.log(`  page ${i + 1}/${scenes.length}: ${text.slice(0, 70)}…`);
  }
  await unloadModel({ modelId: llm });

  // ── Phase 2: SD illustration per page ──
  console.log("Phase 2: SD illustrations…");
  const sd = await loadModel({ modelSrc: SD_V2_1_1B_Q4_0 });
  const outDir = `studio/packs/${REQ.destination.toLowerCase()}-${REQ.childName.toLowerCase()}`;
  fs.mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < pages.length; i++) {
    const { progressStream, outputs } = diffusion({
      modelId: sd, prompt: `${pages[i].scene}, ${STYLE}`, negative_prompt: NEG,
      width: 512, height: 512, steps: 22, cfg_scale: 7, seed: 40 + i * 7,
    });
    for await (const _ of progressStream) { /* drain */ }
    const bufs = await outputs;
    if (bufs?.[0]) fs.writeFileSync(`${outDir}/p${i}.png`, bufs[0]);
    console.log(`  image ${i + 1}/${pages.length} -> p${i}.png`);
  }
  await unloadModel({ modelId: sd });

  // ── Phase 3: pack StoryPack ──
  const pack = {
    id: `${REQ.destination.toLowerCase()}-${REQ.childName.toLowerCase()}`,
    version: 1,
    checksum: "sha256:dev",
    title: `${REQ.childName}'s trip to ${REQ.destination}`,
    narrationLang: "en",
    vocabLang: REQ.vocabLang,
    ageRange: REQ.ageRange,
    pages,
    vocab: Object.values(vocabAll),
    huntTargets: ["tree", "tower", "boat"],
  };
  fs.writeFileSync(`${outDir}/storypack.json`, JSON.stringify(pack, null, 2));
  console.log(`\nDONE in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${outDir}/ (${pages.length} pages, ${pack.vocab.length} vocab)`);
}

main().then(() => console.log("OK — StoryPack generated."));
