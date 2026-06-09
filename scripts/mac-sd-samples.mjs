// scripts/mac-sd-samples.mjs
// Generate a few storybook-page illustrations on the Mac to judge SD quality.
// One worker, model loaded once, 3 images. Run:
//   node_modules/.bin/bare scripts/mac-sd-samples.mjs
import fs from "bare-fs";
import { plugins, SD_V2_1_1B_Q4_0 } from "@qvac/sdk";
import { diffusionPlugin } from "@qvac/sdk/sdcpp-generation/plugin";

const { loadModel, diffusion, unloadModel } = plugins([diffusionPlugin]);

const STYLE = "children's storybook illustration, soft watercolor, warm Mediterranean colors, gentle, cute";
const NEG = "blurry, deformed, extra limbs, ugly, text, watermark, scary";
const PAGES = [
  { name: "p1-parkguell", prompt: `Park Güell in Barcelona, a friendly smiling mosaic lizard made of shiny blue and gold ceramic tiles, sunny terrace, ${STYLE}`, seed: 42 },
  { name: "p2-sagrada", prompt: `the Sagrada Familia church with tall pointy towers reaching into a bright blue sky, a little girl looking up in wonder, ${STYLE}`, seed: 7 },
  { name: "p3-beach", prompt: `a sunny Barcelona beach with gentle blue waves, a small white sailboat far away, a child building a sandcastle, ${STYLE}`, seed: 101 },
];

console.log("loading SD (cached)…");
const id = await loadModel({ modelSrc: SD_V2_1_1B_Q4_0 });
console.log("loaded.");

for (const pg of PAGES) {
  const g0 = Date.now();
  const { progressStream, outputs } = diffusion({
    modelId: id,
    prompt: pg.prompt,
    negative_prompt: NEG,
    width: 512,
    height: 512,
    steps: 24,
    cfg_scale: 7,
    seed: pg.seed,
  });
  for await (const _ of progressStream) { /* drain */ }
  const bufs = await outputs;
  if (bufs?.[0]) {
    fs.writeFileSync(`scripts/sample-${pg.name}.png`, bufs[0]);
    console.log(`${pg.name}: ${((Date.now() - g0) / 1000).toFixed(1)}s -> scripts/sample-${pg.name}.png`);
  }
}

await unloadModel({ modelId: id });
console.log("done — 3 samples written.");
