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

// remove a book from the device (long-press on the shelf)
export function deletePack(id: string) {
  try {
    const dir = new Directory(PACKS, id);
    if (dir.exists) dir.delete();
  } catch {}
}

// first-page image as a bookshelf cover (file:// uri), if present
export function packCover(id: string): string | null {
  const raw = loadPackRaw(id);
  const img = raw?.pages?.[0]?.image;
  if (!img) return null;
  const f = new File(new Directory(PACKS, id), img);
  return f.exists ? f.uri : null;
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

// The bundled demo book — a complete "Sofia's trip to Barcelona": real
// illustrations + full bilingual text + two-way jet-lag sleep plan + vocab.
// Shipped in the app bundle so the Reader ALWAYS has a perfect book to drive
// every feature, independent of P2P delivery (which we demo separately).
const BUNDLED_JSON = require("@/assets/packs/barcelona-sofia/storypack.json") as StoryPack;
const BUNDLED_IMAGES = [
  require("@/assets/packs/barcelona-sofia/p0.png"),
  require("@/assets/packs/barcelona-sofia/p1.png"),
  require("@/assets/packs/barcelona-sofia/p2.png"),
  require("@/assets/packs/barcelona-sofia/p3.png"),
  require("@/assets/packs/barcelona-sofia/p4.png"),
];

// (Re)seed the bundled book once per app session. Overwrites any prior copy of
// the same id (e.g. a broken P2P download), so the demo always opens to a
// complete, image-perfect book, and makes it the Reader's default.
let bundledSeeded = false;
export async function seedBundledIfEmpty(): Promise<void> {
  ensureDir();
  if (bundledSeeded) return;
  bundledSeeded = true;
  const dir = new Directory(PACKS, BUNDLED_JSON.id);
  if (dir.exists) dir.delete();
  dir.create();
  new File(dir, "storypack.json").write(JSON.stringify(BUNDLED_JSON));
  for (let i = 0; i < BUNDLED_IMAGES.length; i++) {
    const asset = Asset.fromModule(BUNDLED_IMAGES[i]);
    await asset.downloadAsync();
    const localUri = asset.localUri ?? asset.uri;
    await new File(localUri).copy(new File(dir, `p${i}.png`));
  }
  markCurrent(BUNDLED_JSON.id);
}
