// src/rag/retrieval.ts
// On-device RAG over the destination knowledge base (assets/knowledge) using
// QVAC EmbeddingGemma 300M. Chunk embeddings are computed once per destination
// and cached in documents/rag/; queries are embedded at generation time and
// matched with brute-force cosine (corpus < 200 chunks — a vector DB would be
// pure overhead). All retrieval stays on the iPad.
import { Directory, File, Paths } from "expo-file-system";
import { ModelManager } from "@/models/model-manager";
import { embed } from "@/models/qvac";
import KNOWLEDGE from "@/assets/knowledge/destinations.json";

const RAG_DIR = new Directory(Paths.document, "rag");

type Entry = { text: string; vec: number[] };

function cosine(a: number[], b: number[]): number {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
}

// destination key from a pack id / title, e.g. "barcelona-sofia" -> "barcelona"
export function destKeyFor(text: string): keyof typeof KNOWLEDGE {
  const lower = text.toLowerCase();
  for (const key of Object.keys(KNOWLEDGE)) {
    if (key !== "generic" && lower.includes(key)) return key as keyof typeof KNOWLEDGE;
  }
  return "generic";
}

async function embedText(text: string): Promise<number[]> {
  const id = await ModelManager.ensureEmbed();
  const r = await embed({ modelId: id, text });
  return (r as { embedding: number[] }).embedding;
}

// Ensure the destination corpus is embedded (cached across runs).
async function corpus(key: keyof typeof KNOWLEDGE): Promise<Entry[]> {
  if (!RAG_DIR.exists) RAG_DIR.create();
  const cache = new File(RAG_DIR, `${key}.json`);
  const chunks = KNOWLEDGE[key] as string[];
  if (cache.exists) {
    try {
      const entries = JSON.parse(cache.textSync()) as Entry[];
      if (entries.length === chunks.length) return entries;
    } catch {}
  }
  const entries: Entry[] = [];
  for (const text of chunks) entries.push({ text, vec: await embedText(text) });
  cache.write(JSON.stringify(entries));
  return entries;
}

// Retrieve top-k facts for a query. Loads the embed model on demand — caller
// is responsible for ModelManager.dropEmbed() before loading the big LLM.
export async function retrieveFacts(destText: string, query: string, k = 2): Promise<string[]> {
  const entries = await corpus(destKeyFor(destText));
  const q = await embedText(query);
  return entries
    .map((e) => ({ text: e.text, score: cosine(q, e.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((e) => e.text);
}
