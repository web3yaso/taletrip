// studio/orchestrator.mjs
// Agentic story generation: a Qwen3 orchestrator agent plans the book and
// drives worker agents through TOOLS — lookup_facts (RAG), write_page (the 1B
// writer agent), paint_illustration (SDXL). Hybrid reliability design: the
// plan is one json_schema-constrained call, the page loop is pinned in JS,
// and the model decides the in-loop tool calls. Any derailment falls back to
// the deterministic generateStoryPack (caller catches).
import fs from "bare-fs";
import path from "bare-path";
import { QWEN3_4B_INST_Q4_K_M } from "@qvac/sdk";
import { logEvent } from "./evidence.mjs";
import {
  sdk, loadEngines, narrationMessages, pickVocab,
  STYLE, NEG, DENY, PACKS_ROOT, safeSlug,
} from "./generate.mjs";
import { buildSleepPlan, tzDiffFor } from "./medpsy.mjs";
import { retrieveFacts, retrieveStyle } from "./rag.mjs";

let orchestratorPromise = null;
function loadOrchestrator() {
  if (!orchestratorPromise) {
    orchestratorPromise = (async () => {
      const t0 = Date.now();
      const id = await sdk.loadModel({
        modelSrc: QWEN3_4B_INST_Q4_K_M, modelType: "llm",
        modelConfig: { ctx_size: 4096 },
      });
      logEvent("loadModel", { model: "QWEN3_4B_INST_Q4_K_M", durMs: Date.now() - t0 });
      return id;
    })();
  }
  return orchestratorPromise;
}

// free the 4B orchestrator before the heavy SDXL painting loop — less memory
// pressure on the worker; it reloads (~10s) on the next request's planning.
async function unloadOrchestrator() {
  if (!orchestratorPromise) return;
  try {
    const id = await orchestratorPromise;
    await sdk.unloadModel({ modelId: id });
    logEvent("unloadModel", { model: "QWEN3_4B_INST_Q4_K_M" });
  } catch {}
  orchestratorPromise = null;
}

// Structured tool calling: Qwen3 is a thinking model whose free-form tool-call
// emissions don't match the SDK's dialect parsers (verified: bare
// `lookup_facts("…")` text under pythonic/hermes both parse to []). Instead the
// call is grammar-constrained via responseFormat json_schema — the agent still
// chooses the topic (the decision), the GBNF guarantees the format (zero derail).
const lookupSchema = {
  type: "object",
  properties: {
    tool: { type: "string", enum: ["lookup_facts"] },
    topic: { type: "string", description: "What to look up, e.g. 'famous landmarks', 'local food', 'beach'" },
  },
  required: ["tool", "topic"],
};

const planSchema = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One sentence describing the scene for this page" },
          visual: { type: "string", description: "Short visual description for the illustrator" },
        },
        required: ["summary", "visual"],
      },
    },
  },
  required: ["scenes"],
};

// Trip designer: parse a parent's free-text trip description into structured
// fields (grammar-constrained — same structured tool-call pattern). The child
// info extracted here feeds the generation-side personalization (RAG).
const tripSchema = {
  type: "object",
  properties: {
    destination: { type: "string", description: "City the family is visiting" },
    days: { type: "integer", description: "Trip length in days; 0 if not mentioned" },
    childName: { type: "string", description: "Child's name; empty if not mentioned" },
    age: { type: "integer", description: "Child's age in years; 0 if not mentioned" },
    gender: { type: "string", enum: ["girl", "boy", ""], description: "Child's gender if mentioned" },
    likes: { type: "string", description: "Things the child loves, comma separated; empty if not mentioned" },
    favoriteBooks: { type: "string", description: "Picture books or stories the child loves, comma separated; empty if not mentioned" },
  },
  required: ["destination", "days", "childName", "age", "gender", "likes", "favoriteBooks"],
};

export async function parseTripRequest(text) {
  const orc = await loadOrchestrator();
  const t0 = Date.now();
  const r = sdk.completion({
    modelId: orc, stream: false,
    generationParams: { reasoning_budget: 0 },
    history: [
      { role: "system", content: "Extract trip-planning fields from the parent's message. The message may be in any language; output values in English (names stay as written). Output JSON only." },
      { role: "user", content: text },
    ],
    responseFormat: { type: "json_schema", json_schema: { name: "trip", schema: tripSchema } },
  });
  const out = JSON.parse(await r.text);
  logEvent("completion", { model: "QWEN3_4B_INST_Q4_K_M", role: "trip-parser", durMs: Date.now() - t0, outputChars: JSON.stringify(out).length });
  logEvent("toolCall", { tool: "parse_request", destination: out.destination, days: out.days });
  return out;
}

// Phase A: one constrained call — the orchestrator plans the scene arc.
async function planScenes(orc, destination, childName, nPages, likes) {
  const t0 = Date.now();
  const r = sdk.completion({
    modelId: orc, stream: false,
    generationParams: { reasoning_budget: 0 },
    history: [
      { role: "system", content: "You plan children's storybooks. Output JSON only." },
      { role: "user", content: `Plan ${nPages} scenes for a gentle storybook about a young child named ${childName} visiting ${destination}.${likes ? ` The child loves ${likes}.` : ""} Each scene: a one-sentence summary and a short visual description. Vary locations (arrival, landmark, park, food, evening…).` },
    ],
    responseFormat: { type: "json_schema", json_schema: { name: "plan", schema: planSchema } },
  });
  const text = await r.text;
  logEvent("completion", { model: "QWEN3_4B_INST_Q4_K_M", role: "planner", durMs: Date.now() - t0, outputChars: text.length });
  const scenes = JSON.parse(text).scenes?.slice(0, nPages);
  if (!scenes?.length) throw new Error("planner returned no scenes");
  return scenes;
}

// Phase B per-page: the orchestrator decides WHAT to look up (the agency),
// emits a grammar-constrained tool call, and we execute it against the RAG.
async function researchScene(orc, destination, summary, onTrace) {
  const t0 = Date.now();
  const run = sdk.completion({
    modelId: orc, stream: false,
    generationParams: { reasoning_budget: 0 },
    history: [
      { role: "system", content: "You research one storybook page. Choose the most useful knowledge-base topic for this scene (a landmark, food, custom, place…). Output the tool call as JSON only." },
      { role: "user", content: `Destination: ${destination}. Page scene: ${summary}` },
    ],
    responseFormat: { type: "json_schema", json_schema: { name: "tool_call", schema: lookupSchema } },
  });
  const text = await run.text;
  logEvent("completion", { model: "QWEN3_4B_INST_Q4_K_M", role: "researcher", durMs: Date.now() - t0, outputChars: text.length });
  const call = JSON.parse(text);
  if (call?.tool !== "lookup_facts" || !call?.topic) return [];
  const topic = String(call.topic);
  onTrace(`🔧 lookup_facts("${topic}")`);
  logEvent("toolCall", { tool: "lookup_facts", topic: topic.slice(0, 60) });
  const facts = await retrieveFacts(destination, topic, 2);
  return [...new Set(facts)].slice(0, 3);
}

export async function generateStoryPackAgentic(req, onProgress = () => {}) {
  const destination = (req.destination || "Barcelona").trim();
  const childName = (req.childName || "Sofia").trim();
  const likes = (req.likes || "").trim();
  const vocabLang = req.vocabLang || "es";
  const nPages = Math.max(1, Math.min(5, Number(req.pages) || 5));
  // fast by default (640²/20 steps ≈ 0.6× the render time); "high" for the
  // final showcase book (768²/24)
  const PAINT = req.quality === "high"
    ? { width: 768, height: 768, steps: 24 }
    : { width: 640, height: 640, steps: 20 };

  const { llm, sd } = await loadEngines(onProgress);
  onProgress("waking the orchestrator agent (Qwen3 4B)…");
  const orc = await loadOrchestrator();

  // total: plan + per-page (research + write + paint)
  const total = 1 + nPages * 3;
  let step = 0;

  onProgress("🤖 planning the book…", ++step, total);
  const scenes = await planScenes(orc, destination, childName, nPages, likes);

  const id = `${safeSlug(destination)}-${safeSlug(childName)}`;
  const outDir = path.resolve(PACKS_ROOT, id);
  if (outDir !== PACKS_ROOT && !outDir.startsWith(PACKS_ROOT + path.sep)) throw new Error("bad pack id");
  fs.mkdirSync(outDir, { recursive: true });

  // research ALL pages first (the agent decides each lookup), then free the 4B
  // orchestrator before the heavy SDXL loop — less memory pressure = faster paints.
  const factsPer = [];
  for (let i = 0; i < scenes.length; i++) {
    onProgress(`🤖 researching page ${i + 1}…`, ++step, total);
    try {
      factsPer.push(await researchScene(orc, destination, scenes[i].summary, (line) => onProgress(line, step, total)));
    } catch {
      factsPer.push([]);
    }
  }
  await unloadOrchestrator();

  // style RAG: match the books the child loves to a shared picture-book corpus
  // (EmbeddingGemma). writeGuide steers the writer's cadence; artStyle steers the
  // SDXL illustrator so the chosen book changes BOTH the prose and the art.
  let style = { title: "", writeGuide: "", artStyle: "" };
  if (req.favoriteBooks) {
    onProgress("📚 matching your child's favorite picture-book style…", step, total);
    try { style = await retrieveStyle(req.favoriteBooks); } catch {}
    if (style.title) onProgress(`📚 styling after "${style.title}"`, step, total);
  }
  const artStyle = style.artStyle || STYLE; // book's art when chosen, else the default look
  // a consistent protagonist description so the SAME child appears on every page
  // and the picture actually depicts who the narration is about.
  const who = req.gender === "girl" ? "girl" : req.gender === "boy" ? "boy" : "child";
  const subject = childName ? `${childName}, a ${req.age ? req.age + "-year-old " : ""}${who}` : `a young ${who}`;

  const pages = [];
  const vocabAll = {};
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const facts = factsPer[i] ?? [];

    // write (delegated to the 1B writer agent)
    onProgress(`✍️ writing page ${i + 1} of ${scenes.length}…`, ++step, total);
    const tw = Date.now();
    const msgs = narrationMessages(scene.summary, childName, destination);
    if (style.writeGuide) msgs[0].content += ` ${style.writeGuide}`;
    if (facts.length) msgs[0].content += ` Weave in naturally if it fits: ${facts.join(" ")}`;
    if (likes) msgs[0].content += ` The child loves ${likes}.`;
    if (req.gender === "girl" || req.gender === "boy") msgs[0].content += ` ${childName} is a ${req.gender}.`;
    const r = sdk.completion({ modelId: llm, history: msgs, stream: false });
    let text = (await r.text).trim().split("\n").filter(Boolean)[0] ?? "";
    logEvent("completion", { model: "LLAMA_3_2_1B_INST_Q4_0", role: "writer", page: i, durMs: Date.now() - tw, outputChars: text.length });
    if (text.length < 10 || text.length > 400 || DENY.test(text)) text = `${childName} loved ${scene.summary}.`;
    for (const v of pickVocab(text)) vocabAll[v.word] = v;
    pages.push({ index: i, image: `p${i}.png`, scene: scene.summary, authoredNarration: text, slots: [] });

    // paint (illustrator agent) — stream per-denoise-step ticks so the bar
    // moves smoothly through the ~1min render instead of freezing
    onProgress(`🎨 painting page ${i + 1} of ${scenes.length}…`, ++step, total);
    const tp = Date.now();
    // paint the SAME scene the page narrates, starring the same child, in the
    // chosen book's art style — this is what keeps text and picture in sync.
    const { progressStream, outputs } = sdk.diffusion({
      modelId: sd, prompt: `${subject}. ${scene.visual || scene.summary}. ${artStyle}`, negative_prompt: NEG,
      ...PAINT, cfg_scale: 8, seed: 40 + i * 7,
    });
    for await (const tick of progressStream) {
      const tot = tick?.totalSteps ?? tick?.total;
      if (tick?.step && tot)
        onProgress(`🎨 painting page ${i + 1} of ${scenes.length} · brush stroke ${tick.step}/${tot}`, step - 1 + tick.step / tot, total);
    }
    const bufs = await outputs;
    if (bufs?.[0]) fs.writeFileSync(`${outDir}/p${i}.png`, bufs[0]);
    logEvent("diffusion", { model: "SDXL_BASE_1_0_3B_Q4_0", role: "illustrator", page: i, durMs: Date.now() - tp, bytes: bufs?.[0]?.length ?? 0 });
  }

  const pack = {
    id, version: 1, checksum: "sha256:dev",
    title: `${childName}'s trip to ${destination}`,
    narrationLang: "en", vocabLang, ageRange: [4, 7],
    pages, vocab: Object.values(vocabAll), huntTargets: ["tree", "tower", "boat"],
  };

  // jet-lag gate: big time shift -> deterministic scheduler + MedPsy advisor
  // build the adaptive day-by-day sleep plan; it ships in the pack and powers
  // the iPad's Sleep Coach (check-in -> branch selection happens on-device).
  const tzDiff = tzDiffFor(destination);
  if (tzDiff >= 3) {
    try {
      onProgress(`🏥 building the jet-lag sleep plan (${tzDiff}h shift)…`, total, total);
      pack.sleepPlan = await buildSleepPlan(destination, req.age, tzDiff, req.baseBedtime || "20:30", (m) => onProgress(m, total, total));
    } catch (e) {
      console.log("medpsy skipped:", e?.message ?? e);
    }
  }

  fs.writeFileSync(`${outDir}/storypack.json`, JSON.stringify(pack, null, 2));
  onProgress("done", total, total);
  return pack;
}
