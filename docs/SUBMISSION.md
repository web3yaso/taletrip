# TaleTrip — Personalized, bilingual AI picture books, **100% on-device**

Turn a family trip into a personalized, bilingual AI picture book — **written, illustrated, narrated, and played entirely on-device**, with the heavy authoring step **delegated from the tablet to a laptop over P2P**. No cloud, no accounts, no data ever leaves the device.

- **Repo:** https://github.com/web3yaso/taletrip
- **Evidence bundle (dual-side logs + book + docs):** https://github.com/web3yaso/taletrip/releases/download/v0.1-demo/taletrip-evidence.zip
- **How it works (deep dive):** https://github.com/web3yaso/taletrip/blob/master/docs/HOW_IT_WORKS.md

## 🎬 Demo videos (per feature)

| Feature | What runs on-device (QVAC SDK) | Watch |
| --- | --- | --- |
| Parent Studio (Mac authoring app) | Style RAG — EmbeddingGemma 300M | https://youtu.be/HDn0kAgcNNY |
| Generate a story (multi-agent pipeline) | Qwen3 4B orchestrator + tool calls → EmbeddingGemma RAG → 4B writes the connected book → SDXL illustrates | https://youtu.be/9Uv2a9EIyG4 |
| Photo Story (iPad) | SmolVLM2 500M captions photos → Llama 3.2 1B writes the diary | https://youtu.be/aOYc-Tvb5Qw |
| Scavenger Hunt (iPad) | SmolVLM2 500M recognizes real-world objects | https://youtu.be/BQbl9ClfkYA |
| Sleep Coach (iPad) | MedPsy 1.7B authors an adaptive jet-lag bedtime plan | https://youtu.be/rEMcw5sA89s |

## What it is

Two cooperating QVAC apps. A **Kid app on a retail iPad** reads the book aloud (TTS), teaches Spanish tap-by-tap, plays camera games (on-device VLM), and runs a Sleep Coach (on-device MedPsy) — fully offline via a bundled book. A **Parent Studio on a laptop** runs the heavy authoring agents (4B orchestrator + SDXL) a phone shouldn't carry, then **seeds the finished book to the iPad over `pear://` P2P**.

```
PARENT STUDIO (laptop)              KID APP (retail iPad · on-device)
 trip + child profile     pear://     read aloud (TTS)
 plan → research → write   P2P        tap-to-learn Spanish
 → paint (Qwen3 4B, SDXL) ───────▶    Scavenger Hunt + Photo Story (SmolVLM)
 + EmbeddingGemma RAG                 Sleep Coach (MedPsy) · works offline
```

---

## ✅ Mandatory requirements

| Requirement | How TaleTrip meets it |
| --- | --- |
| **QVAC SDK for all AI inference and RAG** | Every model — Qwen3 4B, Llama 3.2 1B, SDXL, SmolVLM2 500M, Supertonic2 (TTS), EmbeddingGemma 300M, and MedPsy 1.7B — is loaded and run through the QVAC SDK. RAG (destination facts + picture-book style) uses `sdk.embed()` with EmbeddingGemma. No cloud inference anywhere. |
| **Follow a track's hardware constraints (Mobile)** | The consumer-facing app runs on a **retail iPad Pro 12.9" (3rd gen, A12X)** — the track's allowed hardware. The laptop is purely an *optional P2P delegation peer* (an explicit Mobile-track focus area), and the iPad works standalone via the bundled book. |
| **Full reproducibility + hardware setup** | Run commands, model warm-up, and hardware (iPad Pro A12X + Apple Silicon Mac M4) are documented in the [README](https://github.com/web3yaso/taletrip#getting-started) and `docs/HOW_IT_WORKS.md` §8. |
| **Complete artifacts** | Evidence bundle contains: Mac generation traces (`events.jsonl` + `run.json`), **iPad device-tagged inference logs**, a generated 5-page book + illustrations, five per-feature demo videos, and full docs (incl. a `MANIFEST.md` mapping each file to a criterion). |

---

## 🏆 Core criteria

- **Early Bird Bonus** — submitted before June 17.

- **Innovation (novel edge / P2P AI)** — a private, offline, bilingual storybook generated from a *real family trip*, with the tablet **delegating its heavy 4B + SDXL authoring to a laptop over a `pear://` Hyperdrive** rather than the cloud. P2P delivery, device-to-device.

- **Capabilities (multi-agent + tool calling)** — a **Qwen3 4B orchestrator** plans the book, emits grammar-constrained `lookup_facts` tool calls against the RAG, writes the whole *connected* story in one pass, and drives **SDXL** for illustrations — a hybrid pipeline pinned in JS with a deterministic fallback so a book always ships. Every `toolCall` / `ragSearch` / `completion` / `diffusion` is logged.

- **Artifact Quality (consistent logs, resources, demo)** — **dual-side, device-tagged JSONL**: Mac (`device: mac-studio`) and iPad (`device: iPad Pro (12.9-inch) (3rd generation)`), same event schema, 0 errors per run; numbers in the docs match the logs; per-feature demo videos map 1:1 to the models they exercise.

- **Performance (optimization, P2P load distribution, constrained devices, speed & reliability)** — heavy work is **offloaded to the laptop over P2P (Hyperdrive/Hyperswarm)**; the iPad holds one model family resident at a time via a serial **model-slot manager** (proven on a 4GB-class A12X). Tiny-model failure modes are handled deterministically (open-ended VLM judging, repetition/parenthesis sanitizers) for reliability, not prompt-wishing.

- **Complexity & UX (advanced features + real usability)** — bilingual reader with TTS read-aloud and tap-to-learn vocab, two camera games (Scavenger Hunt, Photo Story), and an adaptive bidirectional **jet-lag Sleep Coach** — native iOS tabs, a kid-first UI, and a genuine daily-life use case (traveling families).

- **Model Usage & Coverage (creative use of Psy models)** — **seven models across six modalities**: LLM (Qwen3 4B orchestrator, Llama 3.2 1B writer), diffusion (SDXL), vision (SmolVLM2 500M), speech (Supertonic2 TTS), embeddings/RAG (EmbeddingGemma 300M), and a **Psy model — MedPsy 1.7B** — authoring the jet-lag sleep guidance.

---

## Hardware

- **Kid app (consumer-facing, on-device):** iPad Pro 12.9-inch (3rd gen, A12X), iPadOS 26.5.
- **Parent Studio (P2P delegation peer):** Apple Silicon Mac (M4), macOS 26.5.
