// src/reading/audio-player.ts
// Play int16 mono PCM (e.g. Supertonic TTS @44100) by wrapping it in a WAV
// container, writing to an app-private cache file, and playing via expo-audio.
// (expo-audio plays from a URI, not from a raw sample array — hence the WAV file.)
import { File, Paths } from "expo-file-system";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { isMuted, subscribeMute } from "./mute";
import { encodeWav } from "./wav";

export { encodeWav }; // re-export so existing importers keep working

let player: AudioPlayer | undefined;
let audioModeReady = false;
// Monotonic token: every stopPcm() (and every new playPcm()) bumps it. An
// in-flight playPcm whose token is stale aborts BEFORE starting playback — this
// is what makes pause/stop reliable even mid-await (the bug: stopPcm ran while
// playPcm was awaiting setAudioMode/file-write, then playPcm started anyway).
let playGen = 0;

export function stopPcm() {
  playGen++; // invalidate any playPcm currently between awaits
  try {
    player?.pause();
  } catch {}
  try {
    player?.remove();
  } catch {}
  player = undefined;
}

// Silent Mode flipped ON anywhere → stop whatever is currently playing immediately,
// independent of any screen's effects.
subscribeMute(() => {
  if (isMuted()) stopPcm();
});

// Write the PCM as a temp WAV and start playback. Resolves once playback has
// STARTED (not finished). The temp file stays in the app-private cache.
export async function playPcm(samples: number[], sampleRate = 44100): Promise<void> {
  if (isMuted()) return; // Silent Mode — kids reading on a plane/train
  const myGen = ++playGen; // this call supersedes anything earlier and is itself cancellable
  // stop whatever is currently playing (without bumping the token again)
  try { player?.pause(); } catch {}
  try { player?.remove(); } catch {}
  player = undefined;
  if (!audioModeReady) {
    // Play even when the device's silent switch is on.
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      audioModeReady = true;
    } catch {}
  }
  if (myGen !== playGen) return; // a stopPcm()/newer playPcm() happened during the await
  const wav = encodeWav(samples, sampleRate);
  const file = new File(Paths.cache, `tts-${Date.now()}.wav`);
  if (!file.exists) file.create();
  file.write(wav);
  if (myGen !== playGen) return; // ditto — never start playback the caller already cancelled
  const p = createAudioPlayer(file.uri);
  if (myGen !== playGen) { try { p.remove(); } catch {} return; }
  player = p;
  player.play();
}
