# TaleTrip — How It Works

> **Track:** Mobile (retail smartphones & tablets).
> **One line:** A traveling family turns a real trip into a personalized, bilingual AI picture book — **authored, illustrated, narrated, and played entirely on-device**, with the heavy authoring step **delegated from the tablet to a laptop over P2P**. No cloud, no accounts, no data leaving the devices.

This document explains how TaleTrip works and maps each part to the Mobile track's mandatory requirements and core judging criteria.

---

## 1. TL;DR

TaleTrip is two cooperating QVAC apps:

- **Kid app — runs on a retail iPad (on-device).** Reads the book aloud (TTS), teaches Spanish vocabulary tap-by-tap, plays a camera **Scavenger Hunt** (on-device VLM) and **Photo Story**, and runs a **Sleep Coach** that fights jet lag with guidance authored on-device by a **MedPsy** model (and selected/scheduled offline on the iPad). Works fully offline — a bundled demo book ships inside the app so it needs nothing else.
- **Parent Studio — optional delegation target on a laptop (Apple Silicon Mac).** Runs the heavy authoring agents (a 4B orchestrator + SDXL illustrator) that a phone-class NPU shouldn't carry, then **seeds the finished StoryPack to the iPad over `pear://` P2P**.

Every model — language, vision, speech, diffusion, embeddings, and MedPsy — runs locally through the **QVAC SDK**. Nothing touches a network service.

```
   PARENT STUDIO (laptop · optional)              KID APP (retail iPad · on-device)
 ┌─────────────────────────────────┐            ┌────────────────────────────────────┐
 │ trip + child profile            │            │ read aloud (Supertonic TTS)         │
 │ ── multi-agent authoring ──     │  pear://   │ tap-to-learn Spanish vocab          │
 │ Qwen3 4B orchestrator           │  P2P       │ Scavenger Hunt (SmolVLM2 500M)      │
 │  ├─ lookup_facts → EmbeddingGemma│ ─────────▶ │ Photo Story (VLM + LLM)             │
 │  ├─ write_page  → Llama 3.2 1B  │  Hyperdrive│ Sleep Coach (MedPsy 1.7B, offline)  │
 │  └─ paint       → SDXL          │  delivery  │ bundled fallback book (zero-network)│
 └─────────────────────────────────┘            └────────────────────────────────────┘
        all inference = QVAC SDK                        all inference = QVAC SDK
```

---

## 2. Why this is a Mobile-track project

| Track focus area | How TaleTrip delivers it |
| --- | --- |
| **Delegation: phone offloads heavy tasks to a laptop via P2P** | The iPad delegates 4B-orchestration + SDXL authoring to the Mac and receives the result over a `pear://` Hyperdrive — the tablet never runs the heavy generation, only the delightful parts. |
| **Health/wellness using on-device MedPsy** | The Sleep Coach builds an adaptive jet-lag bedtime plan; every medical sentence is authored on-device by a **MedPsy 1.7B** model (during authoring, never cloud), gated by deterministic sanitizers, then selected offline on the iPad. |
| **Multimodal mobile (photo → analysis, voice → action)** | Camera Scavenger Hunt (photo → on-device VLM verdict) and Photo Story (photos → a generated tale); TTS turns text → spoken narration. |
| **Privacy-first alternative to cloud apps (travel assistant, tutor, translator)** | A bilingual travel storybook + language tutor that never sends a child's photos, voice, or prompts anywhere. |
| **Creative QVAC + device features (camera, mic, sensors)** | Uses the camera for two games, the speaker for narration, the local clock/timezone for jet-lag scheduling. |

The **consumer-facing app runs on a retail iPad** (the track's allowed hardware). The laptop is purely an optional P2P delegation peer — and the iPad works standalone via the bundled book when no peer is present.

---

## 3. The on-device AI stack (100% QVAC SDK)

Every model is loaded and run through `@qvac/sdk` — satisfying the mandatory *"QVAC SDK for all AI inference and RAG."*

| Role | Model (QVAC) | Quant | Runs on | Used for |
| --- | --- | --- | --- | --- |
| Orchestrator | **Qwen3 4B Instruct** | Q4_K_M | Laptop | Plans the book, calls tools (grammar-constrained) |
| Writer | **Llama 3.2 1B Instruct** | Q4_0 | Laptop | Writes each page's narration |
| Illustrator | **SDXL Base 1.0** | Q4_0 | Laptop | Paints one illustration per page |
| RAG embedder | **EmbeddingGemma 300M** | Q4_0 | Laptop | Destination facts + picture-book style retrieval |
| Vision | **SmolVLM2 500M (multimodal)** | Q8_0 | **iPad** | Scavenger Hunt object recognition, Photo Story |
| Speech | **Supertonic2 multilingual TTS** | Q8_0 | **iPad** | Read-aloud (EN) + Spanish word pronunciation |
| Health | **MedPsy 1.7B** | Q4_K_M | Laptop→ships in pack | Jet-lag sleep advice (a Tether Psy model) |

RAG uses `sdk.embed()` (EmbeddingGemma) with brute-force cosine over two tiny corpora: destination facts and a 12-book picture-book style corpus.

---

## 4. Capabilities — the multi-agent authoring pipeline

This addresses the **Capabilities** criterion (multi-agent workflows, orchestration, tool calling).

A **Qwen3 4B orchestrator agent** drives worker agents through tools. The reliability design is a deliberate hybrid:

1. **Plan** — one `json_schema`-constrained call returns the page scenes (`{summary, visual}` per page). The model makes the creative decision; a GBNF grammar guarantees the format (zero derail).
2. **Tool: `lookup_facts`** → RAG over the destination corpus (EmbeddingGemma). The agent chooses the topic; the grammar fixes the call shape. (Qwen3's free-form tool emissions don't match the SDK's dialect parsers, so we constrain the format instead of hoping it parses.)
3. **Tool: `write_page`** → delegates to the **Llama 3.2 1B** writer, steered by retrieved facts and the family's favorite picture-book *writing* style.
4. **Tool: `paint_illustration`** → **SDXL** paints the same scene the page narrates, starring the named child, in the favorite book's *art* style — keeping text and picture coherent.

The page loop is pinned in JS for determinism; the model decides the in-loop tool calls. If the agent ever derails, the system falls back to a deterministic pipeline (`generateStoryPack`) so a book always ships. Memory is managed by a slot manager: the 4B orchestrator is **unloaded before** the SDXL painting loop to cut peak memory.

---

## 5. Performance — P2P delegation & constrained-device engineering

This addresses the **Performance** criterion (optimization, P2P load distribution, constrained devices, speed & reliability).

**P2P delegation (load distribution).** The Mac publishes each finished StoryPack into a **Hyperdrive** (key derived deterministically from a stable Corestore, so the pairing key is reproducible), seeded by a single long-lived **Hyperswarm**. The iPad fetches each file with `downloadAsset(pear://<key>/<file>)`. The tablet spends zero cycles on 4B/SDXL work; it only renders, reads, and plays.

**On-device slot management (constrained device).** The iPad holds one model family resident at a time via a `ModelManager`:
- *Reading mode* — LLM + TTS co-resident (verified safe).
- *Hunt mode* — serial swap: free LLM/TTS, load the **SmolVLM2 500M**; reverse on exit.
- *RAG* — EmbeddingGemma loaded serially, dropped before the LLM.
- Backgrounding the app unloads everything.

**Measured (Apple Silicon Mac, M4; from `artifacts/runs/.../events.jsonl`):** Llama 1B writer ≈ 1–4 s/page; SDXL illustration ≈ 72–91 s/page at the default **640²/20 steps** (≈ 28 s at 512², per `docs/qvac-bench-report.md`); no OOM. A captured 5-page run is summarized below.

**Reliability.** Tiny-model failure modes are handled deterministically rather than by prompt-wishing: the Scavenger Hunt asks the VLM to *name* what it sees (open-ended) and decides the verdict in JS — dodging the "always says yes" bias of a 500M VLM on yes/no questions; MedPsy advice is passed through a sanitizer that strips clock times and task-label echoes before a child ever hears it.

### A captured run (evidence excerpt)

One real authoring run — `artifacts/runs/2026-06-16-04-38-generate/` (request: Barcelona, "Sofia", 5 pages, agentic) — produced **42 timestamped events, 0 errors**, end to end in ≈ 7m14s:

| Signal | Value (from `events.jsonl` / `run.json`) |
| --- | --- |
| Models exercised | 5 — Qwen3 4B · EmbeddingGemma 300M · Llama 3.2 1B · SDXL Base 1.0 · **MedPsy 1.7B** |
| Multi-agent tool calls | 5 × `lookup_facts` (topics: *landmark*, *customs_and_culture_in_barcelona*) |
| RAG retrievals | 6 × `ragSearch`, incl. picture-book style → matched **"The Very Hungry Caterpillar"** |
| Text generation | 5 writer completions, ≈ 1.1–3.6 s/page |
| Illustration | 5 × SDXL diffusion, ≈ 71–91 s/page (640²/20 steps), ~0.77–0.89 MB each |
| Errors | 0 |

This single trace evidences the full stack: agentic orchestration + tool calling, RAG (facts **and** style), six-modality model coverage, and on-device diffusion timings — all logged, all reproducible.

---

## 6. The on-device experience (Model Usage & Coverage + UX)

All of the following run **on the iPad, offline**:

- **Bilingual reader** — real illustrations, tap a colored English word → flashcard with the Spanish word + on-device pronunciation; a play/pause control reads the page aloud.
- **Scavenger Hunt** — "Find a chair!" → point the camera, snap → **SmolVLM2** names the object → JS decides the hit. Pure-offline vision game.
- **Photo Story** — the child snaps photos → an on-device tale is written about the photo (first-person diary voice).
- **Sleep Coach** — for trips crossing ≥3 timezones, a bidirectional (outbound + return) jet-lag plan with daily nap/light windows; nightly check-ins pick which **MedPsy**-authored branch to show and nudge tonight's bedtime; the app can auto-enter a calm "bedtime mode" inside the target window.

Coverage spans **six model modalities** (LLM, diffusion, VLM, TTS, embeddings, MedPsy) — strong Model Usage & Coverage.

---

## 7. Privacy & offline guarantee

- Children's photos are deleted immediately after on-device inference; **no image, prompt, voice, or sample ever leaves the device.**
- The iPad needs no network: a **bundled StoryPack ships inside the app**, so reading, vocabulary, both camera games, and the Sleep Coach all work in airplane mode.
- The only inter-device traffic is the optional **P2P StoryPack transfer**, which is device-to-device (`pear://`), not a cloud round-trip.

(See `docs/qvac-privacy-experiment.md` for the no-network verification.)

---

## 8. Reproducibility & artifacts (mandatory)

**Run it:**

```bash
npm install
# Kid app on a retail iPad (on-device inference)
npm run ios            # then Metro serves the JS bundle; for true offline use a release build
# Parent Studio on the laptop (optional P2P delegation peer)
node node_modules/.bin/bare studio/server.mjs   # http://localhost:3000, warms all models + seeds demo book
npx tsc --noEmit && npm test                     # type-check + 37 pure-logic unit tests
```

**Hardware proof / setup:** Kid app verified on an iPad Pro (A12X); Studio authoring verified on an Apple Silicon Mac (M4). Bundle id `com.anonymous.taletrip`.

**Evidence bundle (Artifact Quality):** every inference is logged at a single choke point:
- Laptop: `artifacts/runs/<timestamp>-generate/events.jsonl` (+ `run.json` manifest) — one timestamped line per `loadModel` / `completion` / `diffusion` / `ragSearch`, plus a `runEnd` summary.
- iPad: `documents/evidence/<date>.jsonl` — device-tagged JSONL for every on-device inference, exported via Finder file sharing.

**Other artifacts:** per-feature [demo videos](../README.md#demo-videos-per-feature) (Parent Studio, generation, Photo Story, Scavenger Hunt, Sleep Coach), rehearsal script `docs/taletrip-demo-runbook.md`, benchmark report `docs/qvac-bench-report.md`, regression checklist `docs/taletrip-regression-checklist.md`.

---

## 9. How it maps to the judging criteria

| Criterion | Where it shows up |
| --- | --- |
| **Innovation** (novel edge/P2P AI) | Tablet→laptop **P2P delegation** of 4B+SDXL authoring; a private, offline, bilingual storybook generated from a real trip. |
| **Capabilities** (multi-agent + tool calling) | Qwen3 4B orchestrator with grammar-constrained `lookup_facts` / `write_page` / `paint` tools and a deterministic fallback (§4). |
| **Performance** (optimization, P2P, constrained devices) | Hyperdrive/Hyperswarm load distribution + iPad model-slot swapping + measured timings (§5). |
| **Artifact Quality** | Dual JSONL evidence logs, bench report, runbook, regression suite (§8). |
| **Complexity & UX** | Reader + 2 camera games + adaptive Sleep Coach, native iOS tabs, beautiful kid-first UI. |
| **Model Usage & Coverage** | Six modalities incl. **MedPsy** Psy model (§3, §6). |
| **Early Bird** | Targeting submission before June 17. |

---

## 10. Honest limitations

- Heavy authoring needs an Apple Silicon laptop; the iPad runs the reader, games, and Sleep Coach, not the 4B/SDXL authoring.
- P2P image delivery has a known `file://` render edge case on receive; the bundled book is the reliable demo path.
- True offline requires a release build (a debug build live-loads the JS bundle from Metro).
- TTS is verified for English narration + Spanish vocabulary; other languages are untested.
