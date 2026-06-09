// src/storypack/receive.ts
// Receive a StoryPack over QVAC P2P: downloadAsset() each file from a Mac-seeded
// pear:// hyperdrive, then copy the bytes into documents/packs/<id>/ where the
// Reader picks them up. downloadAsset lands files in the worker cache as
// `<sha256(key/file)[:16]>_<file>`; we locate the just-appeared `*_<file>`.
import { downloadAsset } from "@qvac/sdk";
import { Directory, File, Paths } from "expo-file-system";
import type { StoryPack } from "./types";

const CACHE = new Directory(Paths.document, ".qvac", "models");
const PACKS = new Directory(Paths.document, "packs");

// The StoryPack comes over P2P from a peer — treat id/image names as untrusted.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_FILE = /^[A-Za-z0-9_.-]{1,64}$/;
function assertSafeId(id: string) {
  if (!SAFE_ID.test(id)) throw new Error(`unsafe pack id: ${id}`);
}
function assertSafeFile(name: string) {
  if (!SAFE_FILE.test(name) || name.includes("..")) throw new Error(`unsafe file name: ${name}`);
}

function cacheMatches(suffix: string): Map<string, File> {
  const out = new Map<string, File>();
  if (!CACHE.exists) return out;
  for (const e of CACHE.list()) {
    if (e instanceof File && e.name.endsWith("_" + suffix)) out.set(e.name, e);
  }
  return out;
}

// Download one file from the pear:// drive and return its cached File.
async function fetchToCache(key: string, file: string): Promise<File> {
  const before = cacheMatches(file);
  await downloadAsset({ assetSrc: `pear://${key}/${file}` } as never);
  const after = cacheMatches(file);
  for (const [name, f] of after) if (!before.has(name)) return f; // the new one
  const any = after.values().next().value; // idempotent re-download fallback
  if (any) return any;
  throw new Error(`downloaded file not found in cache: ${file}`);
}

export async function receivePack(key: string, onProgress?: (s: string) => void): Promise<string> {
  if (!PACKS.exists) PACKS.create();

  onProgress?.("downloading story…");
  const jsonFile = await fetchToCache(key, "storypack.json");
  const pack = JSON.parse(jsonFile.textSync()) as StoryPack;

  assertSafeId(pack.id);
  for (const pg of pack.pages) assertSafeFile(pg.image);

  const dir = new Directory(PACKS, pack.id);
  if (!dir.exists) dir.create();
  const destJson = new File(dir, "storypack.json");
  if (destJson.exists) destJson.delete();
  await jsonFile.copy(destJson);

  for (const pg of pack.pages) {
    onProgress?.(`downloading ${pg.image}…`);
    const img = await fetchToCache(key, pg.image);
    const dest = new File(dir, pg.image);
    if (dest.exists) dest.delete();
    await img.copy(dest);
  }

  onProgress?.(`✅ received "${pack.title}" (${pack.pages.length} pages)`);
  return pack.id;
}
