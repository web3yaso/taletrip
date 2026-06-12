import { z } from "zod";
import { plugins, QWEN3_4B_INST_Q4_K_M } from "@qvac/sdk";
import { llmPlugin } from "@qvac/sdk/llamacpp-completion/plugin";
const sdk = plugins([llmPlugin]);
const mid = await sdk.loadModel({ modelSrc: QWEN3_4B_INST_Q4_K_M, modelType: "llm", modelConfig: { ctx_size: 4096 } });
console.log("loaded");
const tools = [{ name: "lookup_facts", description: "Look up kid-friendly facts about the destination.", parameters: z.object({ topic: z.string().describe("what to look up") }) }];
const history = [
  { role: "system", content: "You are researching one storybook page. Call lookup_facts exactly once with the most useful topic." },
  { role: "user", content: "Destination: Barcelona. Page scene: visiting a famous landmark with tall towers." },
];
// A: stream:false
let r = sdk.completion({ modelId: mid, history, tools, stream: false });
console.log("A text:", JSON.stringify((await r.text).slice(0,200)));
console.log("A toolCalls:", JSON.stringify(await r.toolCalls));
// B: stream:true + drain
r = sdk.completion({ modelId: mid, history, tools, stream: true });
for await (const _ of r.tokenStream) {}
console.log("B toolCalls:", JSON.stringify(await r.toolCalls));
console.log("DONE");
