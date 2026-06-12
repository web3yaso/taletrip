// scripts/gen-models-manifest.mjs
// Generate artifacts/models.json — the authoritative manifest of every model
// TaleTrip uses, pulled from the QVAC SDK registry constants (name, size,
// quantization, sha256, engine) plus which device runs it. Run with:
//   node scripts/gen-models-manifest.mjs
import fs from "node:fs";
import {
  LLAMA_3_2_1B_INST_Q4_0,
  TTS_MULTILINGUAL_SUPERTONIC2_Q8_0,
  SMOLVLM2_500M_MULTIMODAL_Q8_0,
  MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0,
  EMBEDDINGGEMMA_300M_Q4_0,
  SDXL_BASE_1_0_3B_Q4_0,
  QWEN3_4B_INST_Q4_K_M,
} from "@qvac/sdk";

const USES = [
  { c: LLAMA_3_2_1B_INST_Q4_0, role: "story writer (per-page narration)", device: "Mac + iPad" },
  { c: QWEN3_4B_INST_Q4_K_M, role: "orchestrator agent (planning + structured tool calls)", device: "Mac" },
  { c: SDXL_BASE_1_0_3B_Q4_0, role: "illustrator (storybook watercolors)", device: "Mac" },
  { c: TTS_MULTILINGUAL_SUPERTONIC2_Q8_0, role: "narrator (read-aloud EN + vocab ES)", device: "iPad" },
  { c: SMOLVLM2_500M_MULTIMODAL_Q8_0, role: "vision (scavenger hunt verify + photo captions)", device: "iPad" },
  { c: MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0, role: "vision projection (SmolVLM mmproj)", device: "iPad" },
  { c: EMBEDDINGGEMMA_300M_Q4_0, role: "RAG retrieval embeddings", device: "Mac + iPad" },
];

const manifest = USES.map(({ c, role, device }) => ({
  name: c.name,
  role,
  device,
  params: c.params ?? null,
  quantization: c.quantization ?? null,
  sizeBytes: c.expectedSize ?? null,
  sizeMB: c.expectedSize ? Math.round(c.expectedSize / 1048576) : null,
  sha256: c.sha256Checksum ?? null,
  engine: c.engine ?? null,
  source: "QVAC model registry",
}));

manifest.push({
  name: "MedPsy-1.7B-Q4_K_M",
  role: "health advisor (jet-lag sleep plan for the trip)",
  device: "Mac",
  params: "1.7B", quantization: "Q4_K_M",
  sizeBytes: null, sizeMB: 1223, sha256: null,
  engine: "llamacpp-completion",
  source: "huggingface.co/qvac/MedPsy-1.7B-GGUF (local file load)",
});

fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync("artifacts/models.json", JSON.stringify(manifest, null, 2));
console.log(`artifacts/models.json — ${manifest.length} models`);
for (const m of manifest) console.log(`  ${m.name}  [${m.device}]  ${m.role}`);
