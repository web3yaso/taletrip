import { z } from "zod";
import { plugins, QWEN3_4B_INST_Q4_K_M } from "@qvac/sdk";
import { llmPlugin } from "@qvac/sdk/llamacpp-completion/plugin";
const sdk = plugins([llmPlugin]);
const mid = await sdk.loadModel({ modelSrc: QWEN3_4B_INST_Q4_K_M, modelType: "llm", modelConfig: { ctx_size: 4096 } });
const tools = [{ name: "lookup_facts", description: "Look up kid-friendly facts about the destination.", parameters: z.object({ topic: z.string() }) }];
const history = [
  { role: "system", content: "You are researching one storybook page. Call lookup_facts exactly once with the most useful topic." },
  { role: "user", content: "Destination: Barcelona. Page scene: visiting a famous landmark with tall towers." },
];
// A: toolDialect pythonic
let r = sdk.completion({ modelId: mid, history, tools, stream: false, toolDialect: "pythonic", generationParams: { reasoning_budget: 0 } });
console.log("A(pythonic) toolCalls:", JSON.stringify(await r.toolCalls), "text:", JSON.stringify((await r.text).slice(0,80)));
// B: hermes
r = sdk.completion({ modelId: mid, history, tools, stream: false, toolDialect: "hermes", generationParams: { reasoning_budget: 0 } });
console.log("B(hermes) toolCalls:", JSON.stringify(await r.toolCalls), "text:", JSON.stringify((await r.text).slice(0,80)));
// C: json_schema structured fallback
r = sdk.completion({ modelId: mid, stream: false, generationParams: { reasoning_budget: 0 },
  history: [
    { role: "system", content: "Choose the most useful knowledge-base topic for this storybook page. Output JSON only." },
    { role: "user", content: "Destination: Barcelona. Page scene: visiting a famous landmark with tall towers." },
  ],
  responseFormat: { type: "json_schema", json_schema: { name: "lookup", schema: { type: "object", properties: { topic: { type: "string" } }, required: ["topic"] } } },
});
console.log("C(json_schema):", JSON.stringify((await r.text).slice(0,100)));
console.log("DONE");
