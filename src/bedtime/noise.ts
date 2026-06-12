// src/bedtime/noise.ts
// Looping white(ish) noise for Bedtime mode — synthesized in JS (pink-leaning
// via a one-pole low-pass over white noise), no audio assets needed.
import { File, Paths } from "expo-file-system";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { encodeWav } from "@/reading/audio-player";

const RATE = 22050;
const SECONDS = 20;

let player: AudioPlayer | undefined;

function synthNoise(): number[] {
  const n = RATE * SECONDS;
  const out = new Array<number>(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    lp = 0.96 * lp + 0.04 * white; // soften toward pink — gentler on small ears
    out[i] = Math.round(lp * 0.5 * 32767 * 6); // boost the low-passed signal
  }
  // short fade-in/out so the loop seam doesn't click
  const fade = RATE * 0.05;
  for (let i = 0; i < fade; i++) {
    out[i] = Math.round((out[i] * i) / fade);
    out[n - 1 - i] = Math.round((out[n - 1 - i] * i) / fade);
  }
  return out;
}

export async function startNoise() {
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {}
  const file = new File(Paths.cache, "bedtime-noise.wav");
  if (!file.exists) {
    file.create();
    file.write(encodeWav(synthNoise(), RATE));
  }
  stopNoise();
  player = createAudioPlayer(file.uri);
  player.loop = true;
  player.volume = 0.6;
  player.play();
}

export function stopNoise() {
  try {
    player?.pause();
  } catch {}
  try {
    player?.remove();
  } catch {}
  player = undefined;
}
