import fs from "bare-fs";
import { plugins, SDXL_BASE_1_0_3B_Q4_0 } from "@qvac/sdk";
import { diffusionPlugin } from "@qvac/sdk/sdcpp-generation/plugin";
import { pngToLineArt } from "./studio/lineart.mjs";
const sdk = plugins([diffusionPlugin]);
const sd = await sdk.loadModel({ modelSrc: SDXL_BASE_1_0_3B_Q4_0 });
console.log("SDXL loaded");
const STYLE = "cute simple cartoon, thick bold uniform black outline, minimal interior detail, kawaii style, rounded chubby shapes, plain white background, no shading, lots of empty white space, adorable, very simple, single object centered";
const NEG = "shadow, shading, gradient, solid black, silhouette, dark background, realistic, photo, 3d, detailed, intricate, ornate, complex, many lines, busy, fine detail, text, watermark, scenery, background, multiple objects, pattern, texture, grid, frame, border";
for (const [seed, f] of [[100, "/tmp/blossom_a.png"], [201, "/tmp/blossom_b.png"]]) {
  const { progressStream, outputs } = sdk.diffusion({
    modelId: sd, prompt: `a cherry blossom branch, ${STYLE}`, negative_prompt: NEG,
    width: 768, height: 768, steps: 24, cfg_scale: 8, seed,
  });
  for await (const _ of progressStream) {}
  const bufs = await outputs;
  if (bufs?.[0]) {
    fs.writeFileSync(f.replace(".png", "_raw.png"), bufs[0]); // keep raw for diagnosis
    const r = pngToLineArt(bufs[0]);
    fs.writeFileSync(f, r.png);
    console.log(f, "black=", r.black.toFixed(3));
  }
}
console.log("DONE");
