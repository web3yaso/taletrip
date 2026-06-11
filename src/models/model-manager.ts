// src/models/model-manager.ts
import { loadModel, unloadModel, LLM_LOAD, ttsLoad, VLM_LOAD } from "./qvac";

type Slot = "llm" | "tts" | "vlm";
const ids: Partial<Record<Slot, string>> = {};

async function ensure(slot: Slot, opts: any): Promise<string> {
  if (ids[slot]) return ids[slot]!;
  ids[slot] = await loadModel(opts);
  return ids[slot]!;
}
async function drop(slot: Slot) {
  const id = ids[slot];
  if (!id) return;
  delete ids[slot];
  try { await unloadModel({ modelId: id }); } catch {}
}

export const ModelManager = {
  // Reading mode: LLM + TTS co-resident (proven safe).
  async enterReading() {
    const llm = await ensure("llm", LLM_LOAD);
    const tts = await ensure("tts", ttsLoad("en"));
    return { llm, tts };
  },
  // Read-aloud only needs the TTS voice (the reader doesn't generate text).
  async ensureTTS(language: "en" | "es" = "en") {
    return ensure("tts", ttsLoad(language));
  },
  // Hunt mode: serial swap — free LLM+TTS, load the VLM. Reverse on exit.
  async enterHunt() {
    await drop("tts"); await drop("llm");
    return ensure("vlm", VLM_LOAD);
  },
  async exitHunt() { await drop("vlm"); return this.enterReading(); },
  // Leaving the Hunt tab: free the VLM but don't eagerly reload reading models —
  // the Reader lazily re-ensures TTS on demand (the Kid app never needs the LLM).
  async leaveHunt() { await drop("vlm"); },
  llmId: () => ids.llm, ttsId: () => ids.tts, vlmId: () => ids.vlm,
  async unloadAll() { await drop("vlm"); await drop("tts"); await drop("llm"); },
};
