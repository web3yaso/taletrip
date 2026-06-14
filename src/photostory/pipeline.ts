// src/photostory/pipeline.ts
// Kid "Photo Story" — photos taken by the child live in documents/kidphotos (on
// the iPad, never uploaded). makePhotoStory() turns them into a StoryPack fully
// ON-DEVICE: SmolVLM looks at each photo → 1B LLM writes a page per photo → the
// child's own photos ARE the illustrations → vocab table adds tappable Spanish.
// Memory choreography reuses the proven Hunt swap (VLM alone, then LLM+TTS).
import { Directory, File, Paths } from "expo-file-system";
import { beginRun, endRun } from "@/evidence/log";
import { loadProfile } from "@/family/profile";
import { ModelManager } from "@/models/model-manager";
import { completion } from "@/models/qvac";
import { markCurrent } from "@/storypack/store";
import type { StoryPack } from "@/storypack/types";
import { VOCAB } from "@/storypack/vocab";

const PHOTOS = new Directory(Paths.document, "kidphotos");
const PACKS = new Directory(Paths.document, "packs");
export const PHOTO_STORY_ID = "my-photo-story"; // one slot, regenerated each time
export const MAX_PHOTOS = 6;
export const MIN_PHOTOS = 3;

function ensure(dir: Directory) {
  if (!dir.exists) dir.create();
}

export function listPhotos(): File[] {
  ensure(PHOTOS);
  return (PHOTOS.list().filter((e) => e instanceof File) as File[])
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f.name))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

// move a fresh camera capture into the kid's photo roll (persists on the iPad)
export async function addPhoto(tempUri: string): Promise<File> {
  ensure(PHOTOS);
  const dest = new File(PHOTOS, `photo-${Date.now()}.jpg`);
  await new File(tempUri).move(dest);
  return dest;
}

export function deletePhoto(f: File) {
  try { f.delete(); } catch {}
}

const DENY = /\b(kill|blood|gun|die|dead|scary|hate|weapon)\b/i;

export type GenStage = "look" | "write" | "place" | "words";
export type GenProgress = { stage: GenStage; done: number; total: number };

// SmolVLM caption prompt — name the concrete object(s) actually visible, so the
// writer has something real to anchor to (a weak caption makes the LLM invent).
const captionPrompt =
  "Look at this photo. Name the main object you actually see, in 3-6 words. Just the object, e.g. 'a red toy car' or 'a brown teddy bear'. No story, no guessing.";

// Photo Story = the CHILD's own travel diary: first person, excited, about the
// THING IN THE PHOTO only. No destination trivia (the kid photographed a toy,
// not a landmark) — that was the bug where a RAG "fact" became the opening line.
function pageMessages(caption: string, childName: string) {
  return [
    {
      role: "system",
      content:
        `Write 2-3 short sentences of a child's travel diary, first person ("I"). The child${childName ? ` (${childName})` : ""} is describing this photo they just took. ` +
        `Start from the object in the photo and stay ONLY about it — do NOT mention any city, landmark, or place that is not in the photo. ` +
        `Simple, happy words a 5-year-old would use. Begin like "Today I saw…" or "Look! I found…".`,
    },
    { role: "user", content: `The photo shows: ${caption}. Write my diary page about it.` },
  ];
}

export async function makePhotoStory(onProgress: (p: GenProgress) => void): Promise<string> {
  const photos = listPhotos().slice(0, MAX_PHOTOS);
  if (photos.length < MIN_PHOTOS) throw new Error(`need at least ${MIN_PHOTOS} photos`);
  const n = photos.length;
  beginRun("photostory");

  // 1) "Looking at your photos" — SmolVLM captions, one photo at a time
  onProgress({ stage: "look", done: 0, total: n });
  const vlmId = await ModelManager.enterHunt(); // VLM alone (drops LLM/TTS first)
  const captions: string[] = [];
  for (let i = 0; i < n; i++) {
    let cap = "";
    try {
      const run = completion({
        modelId: vlmId, stream: false,
        history: [{ role: "user", content: captionPrompt, attachments: [{ path: photos[i].uri.replace("file://", "") }] }],
      });
      cap = (await run.text).trim().split("\n").filter(Boolean)[0] ?? "";
    } catch {}
    if (cap.length < 5 || cap.length > 200 || DENY.test(cap)) cap = "a really cool thing";
    captions.push(cap);
    onProgress({ stage: "look", done: i + 1, total: n });
  }

  // 2) "Writing your story" — swap VLM out, 1B LLM in; one diary page per photo.
  // No RAG here: the diary is strictly about the photographed object (destination
  // facts caused "you're standing in a town square" injected over a toy photo).
  onProgress({ stage: "write", done: 0, total: n });
  await ModelManager.leaveHunt(); // drop the VLM before loading the writer
  const childName = loadProfile().childName;
  const { llm } = await ModelManager.enterReading(); // loads LLM(+TTS)
  const pages: StoryPack["pages"] = [];
  for (let i = 0; i < n; i++) {
    let text = "";
    try {
      const run = completion({ modelId: llm, stream: false, history: pageMessages(captions[i], childName) });
      text = (await run.text).trim().split("\n").filter(Boolean)[0] ?? "";
    } catch {}
    if (text.length < 10 || text.length > 400 || DENY.test(text)) text = `Today I saw ${captions[i]}! It was so cool!`;
    pages.push({ index: i, image: `p${i}.jpg`, scene: captions[i], authoredNarration: text, slots: [] });
    onProgress({ stage: "write", done: i + 1, total: n });
  }

  // 3) "Placing your pictures" — the child's own photos are the illustrations.
  // Stamped filenames: regenerating the photo story must yield new file:// uris
  // or the RN image cache keeps showing the previous edition.
  onProgress({ stage: "place", done: 0, total: n });
  ensure(PACKS);
  const dir = new Directory(PACKS, PHOTO_STORY_ID);
  if (dir.exists) dir.delete();
  dir.create();
  const stamp = Date.now().toString(36);
  for (let i = 0; i < n; i++) {
    const local = `${stamp}-p${i}.jpg`;
    await photos[i].copy(new File(dir, local));
    pages[i].image = local;
    onProgress({ stage: "place", done: i + 1, total: n });
  }

  // 4) "Adding Spanish words" — pre-baked vocab matched against the narration
  onProgress({ stage: "words", done: 0, total: 1 });
  const vocab: StoryPack["vocab"] = [];
  for (const [word, v] of Object.entries(VOCAB)) {
    if (vocab.length >= 8) break;
    if (pages.some((p) => new RegExp(`\\b${word}s?\\b`, "i").test(p.authoredNarration)))
      vocab.push({ word, translation: v.translation, say: v.say });
  }

  const pack: StoryPack = {
    id: PHOTO_STORY_ID, version: 1, checksum: "sha256:device",
    title: "My Photo Story",
    narrationLang: "en", vocabLang: "es", ageRange: [4, 7],
    pages, vocab, huntTargets: [],
  };
  new File(dir, "storypack.json").write(JSON.stringify(pack));
  markCurrent(PHOTO_STORY_ID); // the fresh photo story becomes the Reader's default
  endRun({ packId: PHOTO_STORY_ID, pages: n, vocab: vocab.length });
  onProgress({ stage: "words", done: 1, total: 1 });
  return PHOTO_STORY_ID;
}
