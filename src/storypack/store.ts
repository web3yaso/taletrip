// src/storypack/store.ts
// Read StoryPacks from the device documents dir (where delivery — AirDrop / LAN /
// P2P — drops them), decoupled from how they arrive. On first run we seed the
// bundled demo pack into documents so there's always a book to read.
import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import { adaptPack, type ReaderStory } from "./adapter";
import type { StoryPack } from "./types";

const PACKS = new Directory(Paths.document, "packs");

export type PackMeta = { id: string; title: string };

function ensureDir() {
  if (!PACKS.exists) PACKS.create();
}

// list packs in documents/packs that have a storypack.json
export function listPacks(): PackMeta[] {
  ensureDir();
  const out: PackMeta[] = [];
  for (const entry of PACKS.list()) {
    if (!(entry instanceof Directory)) continue;
    const json = new File(entry, "storypack.json");
    if (!json.exists) continue;
    try {
      const p = JSON.parse(json.textSync()) as StoryPack;
      out.push({ id: p.id, title: p.title });
    } catch {}
  }
  return out;
}

// load one pack from documents into the Reader view model (images are file:// URIs)
export function loadPack(id: string): ReaderStory {
  const dir = new Directory(PACKS, id);
  const pack = JSON.parse(new File(dir, "storypack.json").textSync()) as StoryPack;
  const images = pack.pages.map((pg) => ({ uri: new File(dir, pg.image).uri }));
  return adaptPack(pack, images);
}

// "current book" marker — set on receive/generate so the Reader defaults to the
// newest book instead of whatever sorts first in the directory.
const CURRENT = () => new File(PACKS, ".current");
export function markCurrent(id: string) {
  ensureDir();
  try { CURRENT().write(id); } catch {}
}
export function currentPackId(): string | null {
  try {
    const f = CURRENT();
    if (!f.exists) return null;
    const id = f.textSync().trim();
    return new File(new Directory(PACKS, id), "storypack.json").exists ? id : null;
  } catch {
    return null;
  }
}

// load the raw pack (for hunt targets etc.)
export function loadPackRaw(id: string): StoryPack | null {
  const json = new File(new Directory(PACKS, id), "storypack.json");
  if (!json.exists) return null;
  try {
    return JSON.parse(json.textSync()) as StoryPack;
  } catch {
    return null;
  }
}

// On first run, copy the bundled "Mia's trip to Lisbon" into documents/packs.
const BUNDLED_JSON = require("@/assets/packs/lisbon-mia/storypack.json") as StoryPack;
const BUNDLED_IMAGES = [
  require("@/assets/packs/lisbon-mia/p0.png"),
  require("@/assets/packs/lisbon-mia/p1.png"),
  require("@/assets/packs/lisbon-mia/p2.png"),
  require("@/assets/packs/lisbon-mia/p3.png"),
  require("@/assets/packs/lisbon-mia/p4.png"),
];

export async function seedBundledIfEmpty(): Promise<void> {
  ensureDir();
  if (listPacks().length > 0) return;
  const dir = new Directory(PACKS, BUNDLED_JSON.id);
  if (!dir.exists) dir.create();
  new File(dir, "storypack.json").write(JSON.stringify(BUNDLED_JSON));
  for (let i = 0; i < BUNDLED_IMAGES.length; i++) {
    const asset = Asset.fromModule(BUNDLED_IMAGES[i]);
    await asset.downloadAsync();
    const localUri = asset.localUri ?? asset.uri;
    const dest = new File(dir, `p${i}.png`);
    if (!dest.exists) await new File(localUri).copy(dest);
  }
}
