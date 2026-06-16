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

## The problem

Kids' digital content is generic, cloud-bound, and rarely bilingual or about the child's own life. Family travel makes it harder — jet lag, unfamiliar places — yet nothing turns a real trip into a gentle, personalized bedtime story. And parents worry about privacy: today's "AI for kids" ships children's photos, voices, and prompts to someone else's servers.

## Solution

TaleTrip is two cooperating QVAC apps that make a private, offline storybook out of a real trip:

- **Kid app — a retail iPad, fully on-device.** Reads the book aloud (TTS), teaches Spanish tap-by-tap, plays a camera **Scavenger Hunt** and **Photo Story** (on-device vision model), and runs a **Sleep Coach** that fights jet lag using an on-device MedPsy model. A bundled demo book ships inside the app, so everything works in airplane mode.
- **Parent Studio — an optional laptop peer.** Runs the heavy authoring agents — a **Qwen3 4B orchestrator** that plans the book, calls a RAG tool, writes the whole connected story, and drives **SDXL** for illustrations — then **seeds the finished StoryPack to the iPad over `pear://` P2P**.

```
PARENT STUDIO (laptop)              KID APP (retail iPad · on-device)
 trip + child profile     pear://     read aloud (TTS)
 plan → research → write   P2P        tap-to-learn Spanish
 → paint (Qwen3 4B, SDXL) ───────▶    Scavenger Hunt + Photo Story (SmolVLM)
 + EmbeddingGemma RAG                 Sleep Coach (MedPsy) · works offline
```

Every model — language, diffusion, vision, speech, embeddings, and MedPsy — runs locally through the **QVAC SDK**. Nothing touches a network service.

## Why it fits the Mobile track

- **Delegation over P2P.** The consumer-facing app runs on a retail iPad; the laptop is purely an *optional* peer that the tablet offloads its heavy 4B + SDXL authoring to, delivered device-to-device over a `pear://` Hyperdrive — exactly the track's "phone offloads heavy tasks to a laptop" scenario. With the bundled book, the iPad also works fully standalone.
- **On-device on real consumer hardware.** Verified on an iPad Pro 12.9" (3rd gen, A12X) and an Apple Silicon Mac (M4). The iPad keeps one model family resident at a time via a serial model-slot manager, and tiny-model failure modes are handled deterministically for reliability — production-leaning, local-first.
- **Multimodal, multi-agent, and privacy-first.** A grammar-constrained Qwen3 4B orchestrator with tool calling + RAG; seven QVAC models across six modalities (incl. the **MedPsy** Psy model for jet-lag coaching); and a hard privacy guarantee — photos, prompts, and audio never leave the device, with only the P2P book transfer between devices.

## Hardware

- **Kid app (consumer-facing, on-device):** iPad Pro 12.9-inch (3rd gen, A12X), iPadOS 26.5.
- **Parent Studio (P2P delegation peer):** Apple Silicon Mac (M4), macOS 26.5.
