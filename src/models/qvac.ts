// src/models/qvac.ts
// Single choke point for every QVAC inference on the iPad — the evidence logger
// wraps the SDK here, so all model loads/completions/synthesis are recorded for
// the competition's verification bundle without touching feature code.
import {
  loadModel as _loadModel,
  unloadModel as _unloadModel,
  completion as _completion,
  textToSpeech as _textToSpeech,
  downloadAsset as _downloadAsset,
  embed as _embed,
  LLAMA_3_2_1B_INST_Q4_0,
  TTS_MULTILINGUAL_SUPERTONIC2_Q8_0,
  SMOLVLM2_500M_MULTIMODAL_Q8_0, MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0,
  EMBEDDINGGEMMA_300M_Q4_0,
} from "@qvac/sdk";
import { logEvent } from "@/evidence/log";

export const TTS_SAMPLE_RATE = 44100; // Supertonic int16 PCM

export const LLM_LOAD = { modelSrc: LLAMA_3_2_1B_INST_Q4_0, modelType: "llm" as const };

export const ttsLoad = (language: "en" | "es" = "en") => ({
  modelSrc: TTS_MULTILINGUAL_SUPERTONIC2_Q8_0.src,
  modelType: "tts" as const,
  modelConfig: { ttsEngine: "supertonic", language, voice: "F1" },
});

// EmbeddingGemma 300M — on-device RAG retrieval (~300MB, swaps in serially)
export const EMBED_LOAD = { modelSrc: EMBEDDINGGEMMA_300M_Q4_0 };

export const VLM_LOAD = {
  modelSrc: SMOLVLM2_500M_MULTIMODAL_Q8_0,
  modelType: "llm" as const,
  modelConfig: { ctx_size: 1024, projectionModelSrc: MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0 },
};

// Few-shot translation prompt (EN->ES). Generic 1B; take first output line.
export const translateMessages = (text: string) => [
  { role: "system", content: "You are a translation engine. Translate the user's English into Spanish. Reply with ONLY the Spanish translation — no English, no notes, no quotes." },
  { role: "user", content: "tree" }, { role: "assistant", content: "árbol" },
  { role: "user", content: "the house" }, { role: "assistant", content: "la casa" },
  { role: "user", content: text },
];

// Open-ended hunt prompt. A yes/no question makes tiny VLMs (SmolVLM 500M) answer
// "yes" to everything (strong affirmative bias). Asking it to NAME the object
// instead forces it to ground its answer in what it actually sees; we then match
// the named object against the target in JS (see hunt.tsx `matchesTarget`).
export const huntPrompt = () =>
  `Look at this photo. Name the single main object you see. Reply with ONLY the object name in one or two words — no sentence, no punctuation.`;

// ── evidence instrumentation ────────────────────────────────────────────────
const idToName = new Map<string, string>(); // modelId -> human model name

function srcName(src: unknown): string {
  if (src && typeof src === "object" && "name" in (src as any)) return String((src as any).name);
  if (typeof src === "string") return src.split("/").pop() ?? src;
  return "unknown";
}

// lazily wrap one promise-valued property (e.g. .text/.buffer) to time it
// without consuming the underlying stream eagerly
function timeProp<T extends object>(run: T, prop: string, onDone: (ms: number, val: unknown) => void): T {
  const t0 = Date.now();
  let cached: Promise<unknown> | undefined;
  return new Proxy(run, {
    get(target, p) {
      const v = Reflect.get(target, p, target);
      if (p === prop) {
        if (!cached) cached = Promise.resolve(v).then((val) => { onDone(Date.now() - t0, val); return val; });
        return cached;
      }
      return typeof v === "function" ? (v as Function).bind(target) : v;
    },
  }) as T;
}

export const loadModel: typeof _loadModel = (async (opts: any) => {
  const t0 = Date.now();
  const name = srcName(opts?.modelSrc);
  const id = await _loadModel(opts);
  idToName.set(String(id), name);
  logEvent("loadModel", { model: name, modelType: opts?.modelType ?? "auto", durMs: Date.now() - t0 });
  return id;
}) as typeof _loadModel;

export const unloadModel: typeof _unloadModel = (async (opts: any) => {
  const name = idToName.get(String(opts?.modelId)) ?? "unknown";
  const r = await _unloadModel(opts);
  logEvent("unloadModel", { model: name });
  return r;
}) as typeof _unloadModel;

export const completion: typeof _completion = ((params: any) => {
  const model = idToName.get(String(params?.modelId)) ?? "unknown";
  const multimodal = !!params?.history?.some((m: any) => m?.attachments?.length);
  const run = _completion(params);
  return timeProp(run as object, "text", async (ms, val) => {
    // pull per-call token/timing metrics from run.stats (QVAC SDK exposes them)
    let st: Record<string, unknown> = {};
    try {
      const s = await (run as any)?.stats;
      if (s) st = { promptTokens: s.promptTokens, generatedTokens: s.generatedTokens, ttftMs: s.timeToFirstToken, tokensPerSec: s.tokensPerSecond, backend: s.backendDevice };
    } catch {}
    logEvent("completion", { model, multimodal, durMs: ms, outputChars: typeof val === "string" ? val.length : -1, ...st });
  }) as ReturnType<typeof _completion>;
}) as typeof _completion;

export const textToSpeech: typeof _textToSpeech = ((params: any) => {
  const model = idToName.get(String(params?.modelId)) ?? "unknown";
  const inputChars = typeof params?.text === "string" ? params.text.length : -1;
  const run = _textToSpeech(params);
  return timeProp(run as object, "buffer", (ms, val) =>
    logEvent("tts", { model, inputChars, durMs: ms, samples: Array.isArray(val) ? val.length : -1 }),
  ) as ReturnType<typeof _textToSpeech>;
}) as typeof _textToSpeech;

export const embed: typeof _embed = (async (params: any) => {
  const t0 = Date.now();
  const model = idToName.get(String(params?.modelId)) ?? "unknown";
  const r = await _embed(params);
  logEvent("embed", { model, durMs: Date.now() - t0, dims: (r as any)?.embedding?.length ?? -1, inputChars: typeof params?.text === "string" ? params.text.length : -1 });
  return r;
}) as typeof _embed;

export const downloadAsset: typeof _downloadAsset = (async (opts: any) => {
  const t0 = Date.now();
  const src = typeof opts?.assetSrc === "string" ? opts.assetSrc : "unknown";
  const r = await _downloadAsset(opts);
  logEvent("downloadAsset", { assetSrc: src.slice(0, 90), durMs: Date.now() - t0 });
  return r;
}) as typeof _downloadAsset;
