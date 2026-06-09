import { Directory, File, Paths } from 'expo-file-system';

/**
 * Recursive filesystem snapshot/diff for the Whisper privacy experiment.
 *
 * The QVAC worker is started with `HOME_DIR = Paths.document` (see
 * @qvac/sdk client/rpc/expo-rpc-client.js), so anything the worker writes —
 * including any transient audio scratch file — lands somewhere under the
 * app's document directory. We snapshot that whole tree immediately before and
 * after a single `transcribe()` call and diff it to prove nothing audio-shaped
 * was written.
 */

export type FileStat = { size: number; mtime: number };
export type Snapshot = Map<string, FileStat>;

export type SnapshotDiff = {
  added: { uri: string; stat: FileStat }[];
  removed: { uri: string; stat: FileStat }[];
  modified: { uri: string; before: FileStat; after: FileStat }[];
};

const AUDIO_EXT =
  /\.(wav|pcm|raw|f32|f32le|s16le|l16|caf|m4a|aac|mp3|ogg|opus|flac|aiff?)$/i;
const AUDIO_KEYWORD = /(audio|pcm|speech|whisper.*\.(bin|tmp)|mel|samples?)/i;

/** Heuristic: does this path look like an audio artifact we'd be worried about? */
export function looksLikeAudio(uri: string): boolean {
  return AUDIO_EXT.test(uri) || AUDIO_KEYWORD.test(uri);
}

/** Walk the document tree and record every file's uri/size/mtime. */
export function snapshot(): Snapshot {
  const map: Snapshot = new Map();
  const walk = (dir: Directory) => {
    let entries: (Directory | File)[];
    try {
      entries = dir.list();
    } catch {
      return; // unreadable dir — skip rather than abort the whole snapshot
    }
    for (const entry of entries) {
      if (entry instanceof File) {
        try {
          map.set(entry.uri, {
            size: entry.size ?? 0,
            mtime: entry.modificationTime ?? 0,
          });
        } catch {
          map.set(entry.uri, { size: -1, mtime: -1 });
        }
      } else if (entry instanceof Directory) {
        walk(entry);
      }
    }
  };
  walk(new Directory(Paths.document));
  return map;
}

export function diff(before: Snapshot, after: Snapshot): SnapshotDiff {
  const added: SnapshotDiff['added'] = [];
  const removed: SnapshotDiff['removed'] = [];
  const modified: SnapshotDiff['modified'] = [];
  for (const [uri, stat] of after) {
    const prev = before.get(uri);
    if (!prev) added.push({ uri, stat });
    else if (prev.size !== stat.size || prev.mtime !== stat.mtime)
      modified.push({ uri, before: prev, after: stat });
  }
  for (const [uri, stat] of before) {
    if (!after.has(uri)) removed.push({ uri, stat });
  }
  return { added, removed, modified };
}

/** Any added/modified path that looks like audio = the privacy claim failed. */
export function audioHits(d: SnapshotDiff): string[] {
  const hits: string[] = [];
  for (const a of d.added) if (looksLikeAudio(a.uri)) hits.push(a.uri);
  for (const m of d.modified) if (looksLikeAudio(m.uri)) hits.push(m.uri);
  return hits;
}
