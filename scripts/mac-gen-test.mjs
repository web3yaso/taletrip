// scripts/mac-gen-test.mjs
// Verify @qvac/sdk LLM generation runs on the Mac (Bare runtime).
// Run from project root:  node_modules/.bin/bare scripts/mac-gen-test.mjs
// NOTE: Bare has no Node `process` global — use console.log, not process.stdout.
// On desktop/Bare we register plugins explicitly (the Expo app bakes them into
// its worker bundle). plugins([...]) returns the host API.
import { plugins, LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";
import { llmPlugin } from "@qvac/sdk/llamacpp-completion/plugin";

const { loadModel, completion, unloadModel } = plugins([llmPlugin]);

const t0 = Date.now();
console.log("loading LLM (1B)…");
let lastPct = -1;
const id = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,
  modelType: "llm",
  onProgress: (p) => {
    const pct = Math.floor(Number(p?.percentage) || 0);
    if (pct !== lastPct && pct % 10 === 0) {
      lastPct = pct;
      console.log(`  dl ${pct}%`);
    }
  },
});
console.log(`LLM loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${id}`);

const g0 = Date.now();
const r = completion({
  modelId: id,
  history: [
    { role: "system", content: "Write one short storybook page for a 5-year-old: 2-3 simple sentences." },
    { role: "user", content: "Scene: Mia and her family arrive in Lisbon and walk through a sunny park." },
  ],
  stream: false,
});
const text = await r.text;
console.log(`\nGENERATED (${((Date.now() - g0) / 1000).toFixed(1)}s):\n${text}\n`);

await unloadModel({ modelId: id });
console.log("OK — Mac LLM generation works.");
