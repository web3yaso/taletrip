import { z } from "zod";
import { plugins, QWEN3_4B_INST_Q4_K_M } from "@qvac/sdk";
import { llmPlugin } from "@qvac/sdk/llamacpp-completion/plugin";
const sdk = plugins([llmPlugin]);
const mid = await sdk.loadModel({ modelSrc: QWEN3_4B_INST_Q4_K_M, modelType: "llm", modelConfig: { ctx_size: 4096 } });
const tools = [{ name: "lookup_facts", description: "Look up kid-friendly facts about the destination.", parameters: z.object({ topic: z.string().describe("what to look up") }) }];
const history = [
  { role: "system", content: "You are researching one storybook page. Call lookup_facts exactly once with the most useful topic." },
  { role: "user", content: "Destination: Barcelona. Page scene: visiting a famous landmark with tall towers." },
];
const r = sdk.completion({ modelId: mid, history, tools, stream: false, generationParams: { reasoning_budget: 0 } });
console.log("text:", JSON.stringify((await r.text).slice(0,120)));
console.log("toolCalls:", JSON.stringify(await r.toolCalls));
console.log("DONE");
