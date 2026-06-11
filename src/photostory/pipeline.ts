// src/photostory/pipeline.ts
// Kid "Photo Story" — photos taken by the child live in documents/kidphotos (on
// the iPad, never uploaded). makePhotoStory() turns them into a StoryPack fully
// ON-DEVICE: SmolVLM looks at each photo → 1B LLM writes a page per photo → the
// child's own photos ARE the illustrations → vocab table adds tappable Spanish.
// Memory choreography reuses the proven Hunt swap (VLM alone, then LLM+TTS).
import { Directory, File, Paths } from "expo-file-system";
import { ModelManager } from "@/models/model-manager";
import { completion } from "@/models/qvac";
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

// SmolVLM strict caption prompt (small VLMs need tight instructions)
const captionPrompt =
  "Describe the main thing in this photo in ONE short, simple sentence for a children's storybook. Only the sentence, nothing else.";

function pageMessages(caption: string) {
  return [
    {
      role: "system",
      content:
        "Write one short storybook page for a 5-year-old about our trip: 2-3 simple, warm sentences in a playful 'we' voice. Keep it about the given scene. No scary content.",
    },
    { role: "user", content: `Scene from one of our photos: ${caption}` },
  ];
}

export async function makePhotoStory(onProgress: (p: GenProgress) => void): Promise<string> {
  const photos = listPhotos().slice(0, MAX_PHOTOS);
  if (photos.length < MIN_PHOTOS) throw new Error(`need at least ${MIN_PHOTOS} photos`);
  const n = photos.length;

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
    if (cap.length < 5 || cap.length > 200 || DENY.test(cap)) cap = "something wonderful we saw on our trip";
    captions.push(cap);
    onProgress({ stage: "look", done: i + 1, total: n });
  }

  // 2) "Writing your story" — swap to the 1B LLM, one page per photo
  onProgress({ stage: "write", done: 0, total: n });
  const { llm } = await ModelManager.exitHunt(); // drops VLM, loads LLM(+TTS)
  const pages: StoryPack["pages"] = [];
  for (let i = 0; i < n; i++) {
    let text = "";
    try {
      const run = completion({ modelId: llm, stream: false, history: pageMessages(captions[i]) });
      text = (await run.text).trim().split("\n").filter(Boolean)[0] ?? "";
    } catch {}
    if (text.length < 10 || text.length > 400 || DENY.test(text)) text = `On our trip we saw ${captions[i]}. What a wonderful day!`;
    pages.push({ index: i, image: `p${i}.jpg`, scene: captions[i], authoredNarration: text, slots: [] });
    onProgress({ stage: "write", done: i + 1, total: n });
  }

  // 3) "Placing your pictures" — the child's own photos are the illustrations
  onProgress({ stage: "place", done: 0, total: n });
  ensure(PACKS);
  const dir = new Directory(PACKS, PHOTO_STORY_ID);
  if (dir.exists) dir.delete();
  dir.create();
  for (let i = 0; i < n; i++) {
    await photos[i].copy(new File(dir, `p${i}.jpg`));
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
  onProgress({ stage: "words", done: 1, total: 1 });
  return PHOTO_STORY_ID;
}
