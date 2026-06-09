// scripts/mac-sd-test.mjs
// Verify @qvac/sdk Stable Diffusion image generation runs on the Mac (Bare).
// This is the Parent Studio's key capability (illustrations) — it OOM'd on the
// 4GB iPad, but the Mac is unconstrained.
// Run:  node_modules/.bin/bare scripts/mac-sd-test.mjs
import fs from "bare-fs";
import { plugins, SD_V2_1_1B_Q4_0 } from "@qvac/sdk";
import { diffusionPlugin } from "@qvac/sdk/sdcpp-generation/plugin";

const { loadModel, diffusion, unloadModel } = plugins([diffusionPlugin]);

const t0 = Date.now();
console.log("loading SD 2.1 1B Q4 (first run downloads ~2.2GB)…");
let lastPct = -1;
const id = await loadModel({
  modelSrc: SD_V2_1_1B_Q4_0,
  onProgress: (p) => {
    const pct = Math.floor(Number(p?.percentage) || 0);
    if (pct !== lastPct && pct % 10 === 0) {
      lastPct = pct;
      console.log(`  dl ${pct}%`);
    }
  },
});
console.log(`SD loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const g0 = Date.now();
const { progressStream, outputs, stats } = diffusion({
  modelId: id,
  prompt: "a friendly cartoon fox in a sunny park, children storybook illustration, warm Mediterranean colors",
  negative_prompt: "blurry, deformed, extra limbs, text, watermark",
  width: 512,
  height: 512,
  steps: 20,
  cfg_scale: 7,
  seed: 42,
});
for await (const tick of progressStream) {
  if (typeof tick.step === "number" && tick.step % 5 === 0) console.log(`  step ${tick.step}`);
}
const bufs = await outputs;
const s = await stats;
console.log(`generated in ${((Date.now() - g0) / 1000).toFixed(1)}s | png bytes=${bufs?.[0]?.length ?? 0} | stats=${JSON.stringify(s)}`);

if (bufs?.[0]) {
  fs.writeFileSync("scripts/mac-sd-out.png", bufs[0]);
  console.log("wrote scripts/mac-sd-out.png");
}
await unloadModel({ modelId: id });
console.log("OK — Mac SD generation works.");
