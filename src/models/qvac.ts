// src/models/qvac.ts
import {
  loadModel, unloadModel, completion, textToSpeech,
  LLAMA_3_2_1B_INST_Q4_0,
  TTS_MULTILINGUAL_SUPERTONIC2_Q8_0,
  SMOLVLM2_500M_MULTIMODAL_Q8_0, MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0,
} from "@qvac/sdk";

export const TTS_SAMPLE_RATE = 44100; // Supertonic int16 PCM

export const LLM_LOAD = { modelSrc: LLAMA_3_2_1B_INST_Q4_0, modelType: "llm" as const };

export const ttsLoad = (language: "en" | "es" = "en") => ({
  modelSrc: TTS_MULTILINGUAL_SUPERTONIC2_Q8_0.src,
  modelType: "tts" as const,
  modelConfig: { ttsEngine: "supertonic", language, voice: "F1" },
});

export const VLM_LOAD = {
  modelSrc: SMOLVLM2_500M_MULTIMODAL_Q8_0,
  modelType: "llm" as const,
  modelConfig: { ctx_size: 1024, projectionModelSrc: MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0 },
};

// Few-shot translation prompt (EN->ES). Generic 1B; take first output line.
export const translateMessages = (text: string) => [
  { role: "system", content: "You are a translation engine. Translate the user's English into Spanish. Reply with ONLY the Spanish translation — no English, no notes, no quotes." },
  { role: "user", content: "tree" }, { role: "assistant", content: "árbol" },
  { role: "user", content: "the house" }, { role: "assistant", content: "la casa" },
  { role: "user", content: text },
];

// Strict VLM hunt prompt — the "if unsure answer no" clause is load-bearing.
export const huntPrompt = (target: string) =>
  `Look carefully. Is there a real ${target} in this image? Answer only 'yes' or 'no'. If you are not sure, answer 'no'.`;

export { loadModel, unloadModel, completion, textToSpeech };
