import { describe, expect, it } from "vitest";
import { encodeWav } from "@/reading/wav";

const str = (b: Uint8Array, off: number, len: number) =>
  String.fromCharCode(...b.slice(off, off + len));
const u32 = (b: Uint8Array, off: number) => new DataView(b.buffer).getUint32(off, true);
const u16 = (b: Uint8Array, off: number) => new DataView(b.buffer).getUint16(off, true);
const i16 = (b: Uint8Array, off: number) => new DataView(b.buffer).getInt16(off, true);

describe("encodeWav", () => {
  it("writes a valid 16-bit mono WAV header", () => {
    const wav = encodeWav([0, 1, -1, 100], 44100);
    expect(str(wav, 0, 4)).toBe("RIFF");
    expect(str(wav, 8, 4)).toBe("WAVE");
    expect(str(wav, 12, 4)).toBe("fmt ");
    expect(str(wav, 36, 4)).toBe("data");
    expect(u16(wav, 20)).toBe(1); // PCM
    expect(u16(wav, 22)).toBe(1); // mono
    expect(u32(wav, 24)).toBe(44100); // sample rate
    expect(u16(wav, 34)).toBe(16); // bits per sample
  });

  it("sizes the buffer as 44-byte header + 2 bytes per sample", () => {
    const wav = encodeWav([0, 0, 0], 16000);
    expect(wav.length).toBe(44 + 3 * 2);
    expect(u32(wav, 40)).toBe(3 * 2); // data chunk length
  });

  it("clamps samples into the int16 range", () => {
    const wav = encodeWav([40000, -40000], 16000);
    expect(i16(wav, 44)).toBe(32767);
    expect(i16(wav, 46)).toBe(-32768);
  });
});
