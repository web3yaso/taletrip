# TaleTrip MVP Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Verification note (project-specific):** This repo has **no test runner** (per CLAUDE.md) and the proven validation method is **device-driven** — exactly how the whole runtime stack was verified this week (see `docs/qvac-bench-report.md`). So each task's "verify" step = **`npx tsc --noEmit` clean + a concrete on-device acceptance check**, NOT a unit test. The existing `src/app/bench.tsx` is the reference for how to call every QVAC capability; lift the verified snippets from it.

**Goal:** A fully on-device, offline, private bilingual storybook iPad app — personalized LLM narration + TTS read-aloud, point-to-translate, camera object-hunt — with a minimal MacBook authoring tool, all within the A12X/4GB memory budget.

**Architecture:** Two interfaces. **MacBook Parent Studio** (creation-time: LLM story + SD images + parent approval → packs a `StoryPack`). **iPad child reader** (runtime, offline: a single `ModelManager` owns model residency; reading runs a read-while-generate pipeline; point-to-translate and camera-hunt reuse/serially-swap models). The hard invariant is the **memory red line**: only lightweight models co-reside (LLM+TTS); big models load one-at-a-time; no screen keeps a model resident in the background.

**Tech Stack:** Expo SDK 56 / React Native 0.85 / expo-router (file routes in `src/app/`), `@qvac/sdk` 0.12.1 (LLM `LLAMA_3_2_1B_INST_Q4_0`, TTS `TTS_MULTILINGUAL_SUPERTONIC2_Q8_0`, VLM `SMOLVLM2_500M_MULTIMODAL_Q8_0`+mmproj, translate via the resident 1B+few-shot), `expo-file-system` (new `File`/`Paths`/`Directory` API), `expo-camera`, `expo-secure-store` (Keychain), `expo-asset`.

---

## Verified facts this plan is built on (A12X / 4GB, see bench report)

| Capability | Verified config | Numbers |
|---|---|---|
| LLM narration | `loadModel({ modelSrc: LLAMA_3_2_1B_INST_Q4_0, modelType:"llm" })`; `completion({history, stream:true})` | load ~3s; ~7s/page (clean) |
| TTS read-aloud | `loadModel({ modelSrc: TTS_MULTILINGUAL_SUPERTONIC2_Q8_0.src, modelType:"tts", modelConfig:{ ttsEngine:"supertonic", language:"en", voice:"F1" } })`; `textToSpeech({text, inputType:"text", stream:false}).buffer` → int16 PCM @44100 | RTF 0.30 |
| LLM+TTS co-resident | both loaded, no unload | no OOM ✅ |
| Translate | resident 1B + **`completion` few-shot** (NOT `translate(modelType:"llm")` — that returns garbage; Bergamot NMT native-crashes) | ~2.3s/word, correct |
| Camera hunt | `loadModel({ modelSrc: SMOLVLM2_500M_MULTIMODAL_Q8_0, modelType:"llm", modelConfig:{ ctx_size:1024, projectionModelSrc: MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0 } })`; `completion({history:[{…, attachments:[{ path }]}]})` | load 2.1s, ~2.7s/image |

**Hard rules baked into every task:**
1. **Memory red line:** one big model resident at a time except the proven LLM+TTS pair. Camera-hunt VLM is a **serial swap** (unload LLM+TTS → load VLM → unload VLM → reload LLM+TTS). Never auto-load a model in a screen's mount effect that survives tab switches (this was the v1 OOM root cause).
2. **Strict prompts are mandatory** for small-model correctness: VLM judge needs `"…If you are not sure, answer 'no'."`; translate needs few-shot examples + "output only the translation".
3. **Language sweet spot = EN↔ES** (TTS pronounces only en/es/de/it; es the only reliable non-EN).
4. **`Attachment` is path-only** → camera frames must be written to an app-private temp file, used, then **deleted immediately** (privacy: not persisted, not uploaded).
5. **Never load SD or any ≥~2GB model on device** (jetsam). Image generation is creation-time only (MacBook).

---

## File Structure

```
src/
  models/
    qvac.ts              — verified model constants + load configs + prompt templates (single source of truth)
    model-manager.ts     — ModelManager: residency owner, load/unload, swap helpers, app-background unloadAll
  storypack/
    types.ts             — StoryPack / Page / Vocab / HuntTarget TS types (mirror tech-plan §2)
    loader.ts            — read + sha256-verify a StoryPack from a directory
    samples/lisbon/      — 1 bundled demo pack (storypack.json + page images) for offline demo
  reading/
    narration.ts         — buildNarrationPrompt(slots) + validateNarration() (safety/length/ontopic → fallback)
    use-reader.ts        — read-while-generate hook: play page N narration, prefetch N+1 (LLM→validate→TTS)
    audio-player.ts      — play int16 PCM @44100 via expo-audio
  translate/
    translate.ts         — translateWord(): vocab fast-path → 1B few-shot completion → first line
  hunt/
    temp-image.ts        — withTempImage(bytes, fn): write app-private temp file → fn(path) → delete in finally
    hunt.ts              — runHunt(): serial-swap to VLM, strict-prompt judge, swap back
  gate/
    parent-gate.ts       — setPin/verifyPin: salted hash in SecureStore, failure backoff
  app/
    index.tsx            — Library/home (REPLACES the SD experiment; remove auto-load)
    reader.tsx           — reader route
    hunt.tsx             — camera-hunt route (behind parent gate)
  components/
    page-view.tsx        — one page: image + tappable narration words
    translate-overlay.tsx— floating translation card + pronounce button
studio/                  — MacBook Parent Studio (Expo web or node script; Phase 5, minimal)
```

---

## Phase 0 — Foundation: ModelManager + StoryPack + cleanup

### Task 0.1: Single source of truth for QVAC configs

**Files:**
- Create: `src/models/qvac.ts`

- [ ] **Step 1: Extract the verified configs/snippets from `bench.tsx` into one module.**

```ts
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

// Few-shot translation prompt (EN→ES). Generic 1B; take first output line.
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
```

- [ ] **Step 2: Verify.** Run `npx tsc --noEmit`. Expected: clean. (No device step; this is pure config.)
- [ ] **Step 3: Commit.** `git add src/models/qvac.ts && git commit -m "feat(models): single source of truth for verified QVAC configs"`

### Task 0.2: ModelManager (residency owner)

**Files:**
- Create: `src/models/model-manager.ts`

- [ ] **Step 1: Implement a singleton that owns all load/unload and enforces the red line.**

```ts
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
  // Hunt mode: serial swap — free LLM+TTS, load the VLM. Reverse on exit.
  async enterHunt() {
    await drop("tts"); await drop("llm");
    return ensure("vlm", VLM_LOAD);
  },
  async exitHunt() { await drop("vlm"); return this.enterReading(); },
  llmId: () => ids.llm, ttsId: () => ids.tts, vlmId: () => ids.vlm,
  async unloadAll() { await drop("vlm"); await drop("tts"); await drop("llm"); },
};
```

- [ ] **Step 2: Wire `unloadAll()` to app background.** In `src/app/_layout.tsx`, add an `AppState` listener that calls `ModelManager.unloadAll()` on `background`.

```tsx
// add inside TabLayout, before return
import { AppState } from "react-native";
import { useEffect } from "react";
import { ModelManager } from "@/models/model-manager";
useEffect(() => {
  const sub = AppState.addEventListener("change", (s) => { if (s === "background") ModelManager.unloadAll(); });
  return () => sub.remove();
}, []);
```

- [ ] **Step 3: Verify (device).** `npx tsc --noEmit` clean. On device: call `ModelManager.enterReading()` from a temp button, confirm via Metro log `llamacpp-completion model … loaded` + `tts-ggml model … loaded`, both resident, no OOM. Then `enterHunt()` → Metro shows TTS+LLM `unloaded` then SmolVLM `loaded`. (Reuse the bench tab to drive this.)
- [ ] **Step 4: Commit.** `git commit -am "feat(models): ModelManager residency owner + background unloadAll"`

### Task 0.3: StoryPack types + loader + bundled demo pack

**Files:**
- Create: `src/storypack/types.ts`, `src/storypack/loader.ts`, `src/storypack/samples/lisbon/storypack.json` (+ page images)

- [ ] **Step 1: Types (mirror tech-plan §2).**

```ts
// src/storypack/types.ts
export type Page = { index: number; image: string; scene: string; authoredNarration: string; slots: string[] };
export type VocabEntry = { word: string; translation: string; say: string };
export type StoryPack = {
  id: string; version: number; checksum: string;
  title: string; narrationLang: "en"; vocabLang: "es"; ageRange: [number, number];
  pages: Page[]; vocab: VocabEntry[]; huntTargets: string[];
};
```

- [ ] **Step 2: Loader with checksum verify** (use `expo-file-system` `File` + `expo-crypto` for sha256). Reject on mismatch (tech-plan §8 "资产校验失败 → 拒绝加载").

```ts
// src/storypack/loader.ts
import { File, Directory } from "expo-file-system";
import * as Crypto from "expo-crypto";
import type { StoryPack } from "./types";

export async function loadStoryPack(dir: Directory): Promise<StoryPack> {
  const json = new File(dir, "storypack.json");
  const text = await json.text();
  const pack = JSON.parse(text) as StoryPack;
  // checksum covers the canonical pages+vocab payload (exclude the checksum field itself)
  const { checksum, ...rest } = pack;
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(rest));
  if (`sha256:${digest}` !== checksum) throw new Error("StoryPack checksum mismatch");
  return pack;
}
```

- [ ] **Step 3: Author one demo pack** `samples/lisbon/storypack.json` — 4–6 pages, each with `scene`, `authoredNarration` (parent-approved fallback text containing the slot like "Sofia"), `slots:["name","destination"]`; a `vocab` of ~8 EN→ES words (tree→árbol, sun→sol…); `huntTargets:["tree","window","door"]`. Add matching page images (WebP) under the same dir.
- [ ] **Step 4: Verify.** `npx tsc --noEmit` clean. On device: load the demo pack, log `pack.title` + `pages.length`; tamper one byte → confirm it throws "checksum mismatch".
- [ ] **Step 5: Commit.** `git commit -am "feat(storypack): types, checksum-verified loader, bundled Lisbon demo pack"`

### Task 0.4: Replace the SD-experiment home + keep Bench dev-only

**Files:**
- Modify: `src/app/index.tsx` (remove the SD auto-load entirely; becomes the Library), `src/app/_layout.tsx` (Bench tab already dev-gated via `initialRouteName`; keep Bench tab hidden in non-dev later).

- [ ] **Step 1:** Strip `index.tsx` down to a Library screen: list available StoryPacks (just the demo pack for MVP) → tap navigates to `/reader?id=…`. Delete the diffusion code and the `AUTO_LOAD_ON_HOME` effect (no longer needed once SD code is gone).
- [ ] **Step 2: Verify.** `npx tsc --noEmit` clean. On device: cold-start → Library shows the demo book; no model loads on mount (Metro silent until you tap a book).
- [ ] **Step 3: Commit.** `git commit -am "feat(app): replace SD experiment home with StoryPack library"`

---

## Phase 1 — Reading core (M3 + M4): read-while-generate + read-aloud

### Task 1.1: Narration prompt builder + safety validator

**Files:**
- Create: `src/reading/narration.ts`

- [ ] **Step 1:** `buildNarrationMessages(page, slots)` anchors the LLM to the page `scene` and fills slots (child name/destination); `validateNarration(text, page)` enforces length + on-topic + a denylist, returning `page.authoredNarration` on failure (tech-plan §7 content safety: "绝不把未校验文本念给孩子").

```ts
// src/reading/narration.ts
import type { Page } from "@/storypack/types";
export function buildNarrationMessages(page: Page, slots: Record<string,string>) {
  return [
    { role: "system", content: "Write one short storybook page for a 5-year-old: 2-3 simple, gentle sentences. Stay strictly on the given scene. No scary or unsafe content." },
    { role: "user", content: `Scene: ${page.scene}\nChild's name: ${slots.name ?? "the child"}\nDestination: ${slots.destination ?? "the city"}` },
  ];
}
const DENY = [/\b(kill|blood|gun|die|scary|hate)\b/i];
export function validateNarration(text: string, page: Page): string {
  const t = text.trim();
  const ok = t.length >= 10 && t.length <= 400 && !DENY.some((r) => r.test(t));
  return ok ? t : page.authoredNarration;
}
```

- [ ] **Step 2: Verify.** `npx tsc --noEmit` clean. On device (bench-style): feed page.scene through the LLM, log raw vs validated; force a denylist hit → confirm fallback to `authoredNarration`.
- [ ] **Step 3: Commit.** `git commit -am "feat(reading): narration prompt builder + safety validator with authored fallback"`

### Task 1.2: PCM audio player

**Files:**
- Create: `src/reading/audio-player.ts`

- [ ] **Step 1:** Wrap `expo-audio` to play an int16 PCM `number[]` @44100 (wrap with a WAV header in-memory, play from a data URI or temp file). Expose `playPcm(samples): Promise<void>` and `stop()`.
- [ ] **Step 2: Verify (device).** Synthesize one page via TTS (reuse bench config) → `playPcm` → audible narration; `stop()` cuts it.
- [ ] **Step 3: Commit.** `git commit -am "feat(reading): int16 PCM @44100 audio player"`

### Task 1.3: Read-while-generate hook

**Files:**
- Create: `src/reading/use-reader.ts`

- [ ] **Step 1:** `useReader(pack, slots)` — owns current page index; on entering page N: show image immediately, play N's prepared narration (LLM→validate→TTS computed ahead), and in the background prepare N+1 (`completion` → `validateNarration` → `textToSpeech`) into a cache. Pre-prepare page 0 at book open (avoid first-page cold start — bench report §七 note). On memory warning, drop the N+1 cache. Uses `ModelManager.enterReading()` for the resident LLM+TTS.
- [ ] **Step 2: Verify (device).** Open demo book → page 0 narrates within a couple seconds; tap to advance → next page narration plays with no visible wait (already prefetched); Metro shows interleaved `completion` + TTS; no OOM across all pages.
- [ ] **Step 3: Commit.** `git commit -am "feat(reading): read-while-generate hook with N+1 prefetch + page-0 warmup"`

### Task 1.4: Reader UI + tap-word pronounce (M4)

**Files:**
- Create: `src/app/reader.tsx`, `src/components/page-view.tsx`

- [ ] **Step 1:** `page-view.tsx` renders the page image (first opaque child / ScrollView per Expo UI rules) and the narration as **tappable words**; tapping a word calls `onTapWord(word)`. `reader.tsx` wires `useReader` + paging (tap zones / swipe) + on tap-word: TTS-pronounce the word (English now; translation added in Phase 2).
- [ ] **Step 2: Verify (device, airplane mode).** Full offline read-through of the demo book with personalized narration (child name appears); tapping a word speaks it within ~0.5s.
- [ ] **Step 3: Commit.** `git commit -am "feat(reading): paged reader UI + tap-word pronounce"`

**Acceptance (M3+M4):** airplane-mode end-to-end read with personalized narration, instant paging, no OOM, tap-word speaks. (PRD §7 M3/M4.)

---

## Phase 2 — S1: point-to-translate (1B + few-shot)

### Task 2.1: translateWord with vocab fast-path

**Files:**
- Create: `src/translate/translate.ts`

- [ ] **Step 1:** `translateWord(text, pack)` — if `text` matches a `pack.vocab` entry (normalized), return it instantly (the parent-baked translation). Else run the resident 1B via `completion(translateMessages(text), stream:false)`, take the first output line. Reuses `ModelManager.llmId()` (no extra model).

```ts
// src/translate/translate.ts
import { completion, translateMessages } from "@/models/qvac";
import { ModelManager } from "@/models/model-manager";
import type { StoryPack } from "@/storypack/types";

export async function translateWord(text: string, pack: StoryPack): Promise<string> {
  const hit = pack.vocab.find((v) => v.word.toLowerCase() === text.trim().toLowerCase());
  if (hit) return hit.translation;
  const modelId = ModelManager.llmId();
  if (!modelId) throw new Error("LLM not resident");
  const r = completion({ modelId, history: translateMessages(text), stream: false });
  return (await r.text).trim().split("\n")[0].trim();
}
```

- [ ] **Step 2: Verify (device).** Tap a vocab word → instant ES; tap a non-vocab word → ~2.3s ES (tree→árbol). Confirm via screen + Metro `kind=completion`.
- [ ] **Step 3: Commit.** `git commit -am "feat(translate): vocab fast-path + 1B few-shot translateWord"`

### Task 2.2: Translation overlay + pronounce

**Files:**
- Create: `src/components/translate-overlay.tsx`; Modify: `src/app/reader.tsx`

- [ ] **Step 1:** Floating card showing `original → translation` with a 🔊 button that TTS-pronounces the **Spanish** (`ttsLoad("es")` — but note: switching TTS language means a TTS reload; for MVP keep an ES TTS available or reload on demand and document the latency). Wire reader's `onTapWord` to `translateWord` → show overlay.
- [ ] **Step 2: Verify (device, airplane mode).** Tap any word → overlay shows correct ES within ~2.3s → 🔊 pronounces it. EN↔ES only (document the limit).
- [ ] **Step 3: Commit.** `git commit -am "feat(translate): tap-word translation overlay + ES pronounce"`

**Acceptance (S1):** offline, tap any word → ES translation + pronounce. (PRD §7 S1.)

---

## Phase 3 — S2: camera object-hunt (SmolVLM2 500M, serial swap)

### Task 3.1: temp-image helper (privacy-correct)

**Files:**
- Create: `src/hunt/temp-image.ts`

- [ ] **Step 1:** `withTempImage(bytes, fn)` writes an app-private temp file, calls `fn(path)`, and **deletes the file in `finally`** (privacy invariant — frame never persisted/uploaded; see tech-plan §5.4/§7 corrected wording).

```ts
// src/hunt/temp-image.ts
import { File, Paths } from "expo-file-system";
export async function withTempImage<T>(bytes: Uint8Array, fn: (path: string) => Promise<T>): Promise<T> {
  const f = new File(Paths.cache, `hunt-${Date.now()}.jpg`);
  await f.write(bytes);
  try { return await fn(f.uri.replace(/^file:\/\//, "")); }
  finally { try { f.delete(); } catch {} }
}
```

- [ ] **Step 2: Verify (device).** Call with a bundled image → confirm file exists during `fn`, gone after; snapshot the cache dir before/after = no residue.
- [ ] **Step 3: Commit.** `git commit -am "feat(hunt): withTempImage write→use→delete privacy helper"`

### Task 3.2: runHunt (serial swap + strict-prompt judge)

**Files:**
- Create: `src/hunt/hunt.ts`

- [ ] **Step 1:** `runHunt(target, frameBytes)` — assumes hunt mode entered (`ModelManager.enterHunt()` loaded the VLM and freed LLM+TTS). `withTempImage(frameBytes, path => completion({ modelId: ModelManager.vlmId(), history:[{role:"user", content: huntPrompt(target), attachments:[{path}]}], stream:false }))`; parse the answer for a leading "yes". Strict prompt from `qvac.ts` (the "if unsure answer no" clause).
- [ ] **Step 2: Verify (device).** Enter hunt → point at a real `tree`/`window` → "yes"; point away → "no" within ~2.7s. Confirm serial swap in Metro (LLM+TTS unloaded, SmolVLM loaded; reverse on exit), no OOM.
- [ ] **Step 3: Commit.** `git commit -am "feat(hunt): serial-swap VLM judge with strict prompt + temp frame"`

### Task 3.3: Hunt screen (camera) + fallback flag

**Files:**
- Create: `src/app/hunt.tsx`

- [ ] **Step 1:** `expo-camera` preview + current target + "snap" → grab frame bytes → `runHunt` → success/try-again UI. On mount: `ModelManager.enterHunt()`; on unmount: `ModelManager.exitHunt()` (back to reading residency). Add a `VLM_ENABLED` flag; if false, fall back to iOS Vision (out of scope for MVP — flag only, document it loses edge-AI credit).
- [ ] **Step 2: Verify (device, airplane mode).** From reader → hunt → find a target → success; exit returns to reading without OOM.
- [ ] **Step 3: Commit.** `git commit -am "feat(hunt): camera hunt screen with serial model swap"`

**Acceptance (S2):** offline camera judge ≤~5s, correct yes/no with strict prompt, clean swap. (PRD §7 S2.)

---

## Phase 4 — Parent gate + privacy audit (M5 + non-functional)

### Task 4.1: PIN parent gate (Keychain)

**Files:**
- Create: `src/gate/parent-gate.ts`, gate UI in `src/app/hunt.tsx` entry (and Studio sync/exit).

- [ ] **Step 1:** `setPin(pin)` stores a salted SHA-256 hash in `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); `verifyPin(pin)` checks with exponential backoff on failures (tech-plan §7).
- [ ] **Step 2: Verify (device).** Set PIN, wrong PIN backs off, right PIN opens gated action; hash not readable in plaintext.
- [ ] **Step 3: Commit.** `git commit -am "feat(gate): salted-hash PIN parent gate with backoff"`

### Task 4.2: Zero-network audit + "clear data"

**Files:**
- Create: `src/privacy/network-guard.ts` (dev-only assertion); add a "clear child data" action.

- [ ] **Step 1:** A dev-mode guard that asserts no network egress during a full run (wrap/inspect fetch; log any attempt). "Clear data" removes child name/slots + caches.
- [ ] **Step 2: Verify (device, airplane mode):** complete the full demo (read → translate → hunt) in airplane mode; the demo script's network monitor shows zero out. (PRD §7 M5 acceptance.)
- [ ] **Step 3: Commit.** `git commit -am "feat(privacy): zero-network dev audit + clear-data"`

---

## Phase 5 — Parent Studio (M1 + M2), minimal

> Hackathon scope: the demo can run off the **bundled** demo pack (Phase 0.3), so the Studio is the lowest-priority build. Keep it minimal — a creation tool, NOT a second polished app.

### Task 5.1: Studio generate → approve → pack (MacBook)

**Files:**
- Create: `studio/` (Expo web target or a node script using `@qvac/sdk` on the Mac — unconstrained compute).

- [ ] **Step 1:** Input theme → LLM story (per-page `scene`+`authoredNarration`) → SD illustrations (creation-time only; fixed seed for cross-page character consistency) → **parent preview/edit/approve** → write a checksum'd `StoryPack` dir.
- [ ] **Step 2: Verify (Mac).** Generate a new pack in <~90s; approve; output loads + checksum-verifies via `loadStoryPack`.
- [ ] **Step 3: Commit.** `git commit -am "feat(studio): minimal generate→approve→pack tool"`

### Task 5.2: Deliver to iPad

**Files:**
- Modify: `studio/` export; iPad import handler.

- [ ] **Step 1:** MVP delivery = AirDrop/file import of the pack dir into the iPad app's documents (P2P Hyperdrive/Hyperswarm is the stretch — and the strategic "iPad-initiated P2P delegation" reframe for the Mobile-track pitch).
- [ ] **Step 2: Verify.** Import a Studio-made pack on iPad → appears in Library → reads offline.
- [ ] **Step 3: Commit.** `git commit -am "feat(studio): StoryPack delivery to iPad (AirDrop/file)"`

---

## Phase 6 — Could (only with time left)

- **C1 Coloring:** photo → line art via **Core Image edge detection** (NOT diffusion). `git commit -m "feat(could): Core Image coloring"`.
- **C2 Multi-book library:** already structurally supported by Phase 0.3/0.4 — add a 2nd demo pack.

---

## Demo cut (3 min, PRD §10)

Airplane mode on → (pre-baked) open "Sofia's Lisbon trip" → personalized narration with "Sofia" → tap word → ES translation + pronounce → enter hunt → find a "tree" → close: "zero network, child's data never left this 2018 4GB iPad." Studio generation can be shown pre-recorded or live-on-Mac depending on time.

---

## Open items carried from the bench report / strategy (not code tasks)

- ❓ **Mobile-track classification** — confirm with @qvac; consider reframing MacBook as **iPad-initiated P2P delegation** (a sanctioned focus area) for the pitch.
- 🟡 Exact clean LLM tok/s (proxy ~7s/page in use).
- ⏳ Supertonic2 ES voice warmth check; VLM natural-photo accuracy spot-check; cross-page character consistency method.

---

## Build order (PRD §12, dependency-correct)

Phase 0 → **Phase 1 (M3/M4, the spine)** → Phase 2 (S1) → Phase 3 (S2) → Phase 4 (gate/privacy) → Phase 5 (Studio) → Phase 6 (Could). Phases 1–3 are the judged on-device magic and are already de-risked; do them first and deepest.
