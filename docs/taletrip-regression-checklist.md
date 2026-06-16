# TaleTrip — Regression Test Process

Goal: after any change, confirm features still work before committing / demoing.

There are two layers:

1. **Automated (fast, run on every change):** pure-logic unit tests + type check.
2. **Manual (device/integration, run when you touch the relevant area):** the
   per-feature checklist below.

---

## 1. Automated gate — run after every code change

```bash
npx tsc --noEmit     # strict types, whole project
npm test             # vitest — pure logic (hunt match, jet-lag math, advice
                     # sanitizer, narration validation, reader text, WAV)
npm run lint         # eslint
```

All three must be green before you commit. The unit tests live in `test/` and
cover dependency-free modules extracted for testing:

| Module | Guards against |
| --- | --- |
| `src/hunt/match.ts` | Scavenger Hunt judging wrong (the "always says yes" regression) |
| `src/bedtime/schedule.ts` | Jet-lag night anchoring / bedtime / auto-enter window math |
| `studio/advice-sanitize.mjs` | MedPsy advice leaking clock times / task labels |
| `src/reading/narration.ts` | Unsafe/over-long narration reaching a child |
| `src/storypack/adapter.ts` | Reader text flattening (what TTS speaks) |
| `src/reading/wav.ts` | Corrupt WAV header → no audio |

> Logic that needs a device (audio playback, camera, P2P, on-device models) is
> **not** unit-tested — it is covered by the manual checklist below.

---

## 2. Manual regression checklist (iPad / Studio)

Run the section(s) whose **Trigger** your change touched. Run **all** sections
before a demo. After changing iPad code: shake → Reload. After changing Studio
(Bare) code: restart the server (no hot reload).

### Reader — read-aloud & audio (Trigger: `reader.tsx`, `audio-player.ts`, `qvac.ts` TTS)
- [ ] Open a book → the page narration plays automatically (not in Silent Mode).
- [ ] Tap the **Pause** button on the illustration → audio stops immediately.
- [ ] Tap **Read aloud** → it re-reads the current page.
- [ ] Tap a colored word → narration stops, the word is pronounced.
- [ ] Turn the page mid-narration → old audio stops, new page reads. **No overlap, no "keeps playing after stop".**
- [ ] Switch to another tab mid-narration → audio stops.
- [ ] Silent Mode on → no audio anywhere; the play/pause button is hidden.

### Navigation & Play hub (Trigger: `app-tabs.tsx`, `(play)/*`, routing)
- [ ] Bottom bar shows exactly **Home / Read / Play / Get a book** (no Hunt/Camera tabs).
- [ ] Play → shows only **Scavenger hunt** + **Photo story** tiles.
- [ ] Enter Hunt / Photo → top-left **← Play** returns to the hub.

### Bookshelf (Trigger: `reader.tsx` shelf, `store.ts`)
- [ ] Open "My books", long-press a book, tap the red badge → it deletes.
- [ ] Delete the **last** book → shelf closes and the app jumps to **Get a book**.
- [ ] Reload with no books → seeds the bundled book (or lands on Get a book if seeding produces nothing).

### Scavenger Hunt (Trigger: `(play)/hunt.tsx`, `src/hunt/match.ts`, `qvac.ts` huntPrompt)
- [ ] Point at the **correct** object → "Yes! Found a …".
- [ ] Point at a **wrong** object → "No … yet". (Not everything judged correct.)
- [ ] `npm test` covers the matching rules — re-run it after editing synonyms/prompt.

### Photo Story (Trigger: `(play)/camera.tsx`, `photostory/*`)
- [ ] Take photos → a story is generated about the photo; first-person diary voice.

### P2P delivery (Trigger: `receive.ts`, `seeder.mjs`, `server.mjs`)
- [ ] Studio log on launch shows `📡 demo book seeded → pear://…`.
- [ ] iPad → Get a book → **Receive the book** connects (no error).
- [ ] (Known issue) received images may show a mosaic placeholder — bundled book is the demo fallback.

### Generation quality (Trigger: `orchestrator.mjs`, `generate.mjs`, `rag.mjs`, `picturebooks.json`)
- [ ] Generate with a favorite book chosen → progress shows `📚 styling after "<title>"`.
- [ ] Each page's **illustration matches its text** (same child, same scene).
- [ ] A distinctive book (e.g. The Very Hungry Caterpillar) visibly changes the **art style**.
- [ ] No clock times / task labels leak into Sleep Coach advice (also unit-tested).

### Sleep Coach (Trigger: `bedtime/*`, `medpsy.mjs`)
- [ ] Jet-lag plan present for a ≥3h shift; nightly check-in changes tonight's branch/time.
- [ ] Auto-enter bedtime fires within the target window; manual exit snoozes for the night.

---

## When you add a feature

1. If it has pure logic, put that logic in a dependency-free module and add a
   `test/*.test.ts` for it.
2. Add a row/section to the manual checklist for its device behaviour.
