// studio/rag.mjs
// Mac-side RAG over the shared destination knowledge base — powers the
// orchestrator's lookup_facts tool. EmbeddingGemma via QVAC embed(); corpus
// embeddings cached on disk; brute-force cosine (corpus is tiny).
import fs from "bare-fs";
import { EMBEDDINGGEMMA_300M_Q4_0 } from "@qvac/sdk";
import { logEvent } from "./evidence.mjs";
import { sdk } from "./generate.mjs";

const KNOWLEDGE = JSON.parse(fs.readFileSync("assets/knowledge/destinations.json", "utf8"));
const CACHE_DIR = "studio/.ragcache";

let embedId = null;
async function ensureEmbedder() {
  if (!embedId) {
    const t0 = Date.now();
    embedId = await sdk.loadModel({ modelSrc: EMBEDDINGGEMMA_300M_Q4_0 });
    logEvent("loadModel", { model: "EMBEDDINGGEMMA_300M_Q4_0", durMs: Date.now() - t0 });
  }
  return embedId;
}

function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
}

export function destKeyFor(text) {
  const lower = String(text).toLowerCase();
  for (const key of Object.keys(KNOWLEDGE)) {
    if (key !== "generic" && lower.includes(key)) return key;
  }
  return "generic";
}

async function corpus(key) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = `${CACHE_DIR}/${key}.json`;
  const chunks = KNOWLEDGE[key];
  if (fs.existsSync(cachePath)) {
    try {
      const entries = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      if (entries.length === chunks.length) return entries;
    } catch {}
  }
  const id = await ensureEmbedder();
  const entries = [];
  for (const text of chunks) {
    const r = await sdk.embed({ modelId: id, text });
    entries.push({ text, vec: r.embedding });
  }
  fs.writeFileSync(cachePath, JSON.stringify(entries));
  return entries;
}

// retrieve top-k facts about `topic` for a destination
export async function retrieveFacts(destination, topic, k = 2) {
  const t0 = Date.now();
  const entries = await corpus(destKeyFor(destination));
  const id = await ensureEmbedder();
  const q = await sdk.embed({ modelId: id, text: topic });
  const hits = entries
    .map((e) => ({ text: e.text, score: cosine(q.embedding, e.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  logEvent("ragSearch", { model: "EMBEDDINGGEMMA_300M_Q4_0", topic: String(topic).slice(0, 60), hits: hits.length, durMs: Date.now() - t0 });
  return hits.map((h) => h.text);
}
