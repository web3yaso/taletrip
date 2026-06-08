// src/reading/audio-player.ts
// Play int16 mono PCM (e.g. Supertonic TTS @44100) by wrapping it in a WAV
// container, writing to an app-private cache file, and playing via expo-audio.
// (expo-audio plays from a URI, not from a raw sample array — hence the WAV file.)
import { File, Paths } from "expo-file-system";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

// 16-bit mono PCM samples -> WAV byte stream.
function encodeWav(samples: number[], sampleRate: number): Uint8Array {
  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buf);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate = rate * channels * 2
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, dataLen, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    let v = samples[i] | 0;
    if (v > 32767) v = 32767;
    else if (v < -32768) v = -32768;
    view.setInt16(off, v, true);
    off += 2;
  }
  return new Uint8Array(buf);
}

let player: AudioPlayer | undefined;
let audioModeReady = false;

export function stopPcm() {
  try {
    player?.remove();
  } catch {}
  player = undefined;
}

// Write the PCM as a temp WAV and start playback. Resolves once playback has
// STARTED (not finished). The temp file stays in the app-private cache.
export async function playPcm(samples: number[], sampleRate = 44100): Promise<void> {
  if (!audioModeReady) {
    // Play even when the device's silent switch is on.
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      audioModeReady = true;
    } catch {}
  }
  const wav = encodeWav(samples, sampleRate);
  const file = new File(Paths.cache, `tts-${Date.now()}.wav`);
  if (!file.exists) file.create();
  file.write(wav);
  stopPcm();
  player = createAudioPlayer(file.uri);
  player.play();
}
