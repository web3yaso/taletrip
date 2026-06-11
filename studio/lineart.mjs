// studio/lineart.mjs
// Convert an SD-generated cute cartoon PNG into a clean black-and-white coloring
// page by baking a grayscale + high-contrast curve into the pixels (so the file
// itself is a coloring page — prints and displays cleanly, no runtime filter).
// Pure Bare: decode PNG -> luminance + contrast/brightness -> re-encode 8-bit gray.
import zlib from "bare-zlib";
import b4a from "b4a";

const SIG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf, start, end) {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
function putU32(b, o, v) {
  b[o] = (v >>> 24) & 255; b[o + 1] = (v >>> 16) & 255; b[o + 2] = (v >>> 8) & 255; b[o + 3] = v & 255;
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  putU32(out, 0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  putU32(out, 8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

// CSS-equivalent curve proven to match the look:  grayscale -> contrast(C) -> brightness(B)
const CONTRAST = 7.0;
const BRIGHT = 1.3;

// 3x3 morphology on a 0/1 ink mask
function dilate(src, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && src[ny * w + nx]) { on = 1; break; }
        }
      out[y * w + x] = on;
    }
  return out;
}
function erode(src, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let all = 1;
      for (let dy = -1; dy <= 1 && all; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= h || nx < 0 || nx >= w || !src[ny * w + nx]) { all = 0; break; }
        }
      out[y * w + x] = all;
    }
  return out;
}
// remove connected ink components smaller than minArea (speckle noise)
function despeckle(m, w, h, minArea) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || seen[s]) continue;
    let sp = 0;
    stack[sp++] = s; seen[s] = 1;
    const comp = [s];
    while (sp > 0) {
      const p = stack[--sp];
      const py = (p / w) | 0, pxx = p % w;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ny = py + dy, nx = pxx + dx;
          if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (m[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; comp.push(q); }
        }
    }
    if (comp.length < minArea) for (const q of comp) m[q] = 0;
  }
}

export function pngToLineArt(input) {
  const buf = Uint8Array.from(input);
  let w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  let pos = 8;
  while (pos + 8 <= buf.length) {
    const len = u32(buf, pos);
    const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
    const ds = pos + 8;
    if (type === "IHDR") { w = u32(buf, ds); h = u32(buf, ds + 4); bitDepth = buf[ds + 8]; colorType = buf[ds + 9]; }
    else if (type === "IDAT") idat.push(buf.subarray(ds, ds + len));
    else if (type === "IEND") break;
    pos = ds + len + 4;
  }
  if (bitDepth !== 8) throw new Error("bitDepth " + bitDepth + " unsupported");
  const ch = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0;
  if (!ch) throw new Error("colorType " + colorType + " unsupported");

  const raw = Uint8Array.from(zlib.inflateSync(b4a.concat(idat.map((u) => b4a.from(u)))));
  const stride = w * ch;
  const px = new Uint8Array(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++];
    const row = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const v = raw[rp++];
      const a = x >= ch ? row[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let val;
      switch (f) {
        case 0: val = v; break;
        case 1: val = v + a; break;
        case 2: val = v + b; break;
        case 3: val = v + ((a + b) >> 1); break;
        case 4: val = v + paeth(a, b, c); break;
        default: throw new Error("filter " + f);
      }
      row[x] = val & 255;
    }
  }

  // 1) ink mask: luminance -> contrast/brightness curve -> threshold
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * stride + x * ch;
      const lum = ch >= 3 ? 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] : px[i];
      let v = (lum / 255 - 0.5) * CONTRAST + 0.5;
      v *= BRIGHT;
      if (v < 0.45) ink[y * w + x] = 1; // dark -> ink
    }
  // 2) morphological close (dilate then erode) to repair broken / hairline gaps
  let m = erode(dilate(ink, w, h), w, h);
  // 3) drop tiny connected components (the scattered speckle noise)
  despeckle(m, w, h, 28);

  // 4) crisp 8-bit grayscale scanlines (filter 0 per row): ink -> black, else white
  const gray = new Uint8Array(h * (w + 1));
  let blackCount = 0;
  for (let y = 0; y < h; y++) {
    gray[y * (w + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const isInk = m[y * w + x];
      gray[y * (w + 1) + 1 + x] = isInk ? 0 : 255;
      if (isInk) blackCount++;
    }
  }

  const ihdr = new Uint8Array(13);
  putU32(ihdr, 0, w); putU32(ihdr, 4, h);
  ihdr[8] = 8; ihdr[9] = 0; // 8-bit grayscale
  const compressed = Uint8Array.from(zlib.deflateSync(b4a.from(gray)));
  const png = b4a.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", new Uint8Array(0))]);
  // black = fraction of dark pixels; a good coloring page is mostly white (low black)
  return { png, black: blackCount / (w * h) };
}
