import { Buffer } from 'buffer';

/**
 * Audio helpers for the Whisper privacy experiment.
 *
 * The whole point of the experiment is that audio stays in memory, so these
 * are pure in-memory transforms — no files, no native modules. We take the
 * int16 PCM that QVAC TTS produces (mono @ 44.1kHz) and turn it into the raw
 * 16kHz mono float32 little-endian buffer that Whisper expects
 * (`modelConfig.audio_format = 'f32le'`).
 */

const WHISPER_RATE = 16000;

/**
 * Linear-interpolation resample of int16 PCM to 16kHz, normalized to f32 [-1, 1].
 *
 * Linear interp is plenty for a TTS source feeding tiny-Whisper — we are
 * proving a filesystem property, not chasing transcription WER.
 */
export function resampleTo16kF32(
  int16: number[] | Int16Array,
  inRate = 44100,
): Float32Array {
  if (inRate === WHISPER_RATE) {
    const out = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) out[i] = (int16[i] ?? 0) / 32768;
    return out;
  }
  const ratio = inRate / WHISPER_RATE;
  const outLen = Math.floor(int16.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, int16.length - 1);
    const frac = srcPos - i0;
    const s = (int16[i0] ?? 0) * (1 - frac) + (int16[i1] ?? 0) * frac;
    out[i] = s / 32768;
  }
  return out;
}

/**
 * Serialize a Float32Array to a little-endian f32 byte Buffer.
 *
 * Returns a Node-style Buffer (via the `buffer` polyfill) because the QVAC
 * client encodes `audioChunk` with `.toString('base64')` — see
 * @qvac/sdk client/api/transcribe.js. Passing a Buffer (not a string) is what
 * routes the call through `{ type: 'base64' }` instead of `{ type: 'filePath' }`.
 */
export function f32leBuffer(f32: Float32Array): Buffer {
  const bytes = new Uint8Array(f32.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < f32.length; i++) {
    view.setFloat32(i * 4, f32[i] ?? 0, true);
  }
  return Buffer.from(bytes);
}
