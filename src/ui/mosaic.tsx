// src/ui/mosaic.tsx
// Gaudí trencadís / faceted backgrounds generated in code (no painted art),
// ported from the design bundle's mosaic.js to react-native-svg. Deterministic
// per `seed` so a given screen always tiles the same way.
import { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Path, Rect, G } from "react-native-svg";

const PALETTES: Record<string, string[]> = {
  sky: ["#bcd3df", "#a9c6d6", "#d8e3df", "#cfd9c4", "#e7ddc2", "#c9d8dd", "#b5cbd2", "#dfe7da"],
  sea: ["#3f7f9b", "#5a93aa", "#86b0bd", "#b7d0d2", "#d9e2cf", "#7fa1a3", "#cdb98f", "#e6dcc0"],
  earth: ["#c1693f", "#d08a52", "#e0a33c", "#caa56a", "#b9824d", "#d9c39a", "#a7894f", "#e7d6b0"],
  garden: ["#7e8c4e", "#9aa766", "#c2b06a", "#bcd0c0", "#5e7f86", "#d6c79a", "#86a47e", "#e7ddc2"],
  mixed: ["#2f6f8f", "#bd5838", "#7e8c4e", "#e0a33c", "#86b0bd", "#d9c39a", "#c98a63", "#cdd8c6", "#5a93aa", "#e7dcc0"],
  muted: ["#48677a", "#5b7c86", "#7b9298", "#9aaa9a", "#b9b89a", "#c9b58c", "#a9805a", "#6e8a92"],
};

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function resolvePalette(p: string | string[]): string[] {
  return Array.isArray(p) ? p : PALETTES[p] ?? PALETTES.mixed;
}

type Common = { w?: number; h?: number; palette?: string | string[]; seed?: number; opacity?: number; style?: StyleProp<ViewStyle> };

type Tri = { d: string; f: string; o: number };
function buildFacets(o: Required<Pick<Common, "w" | "h" | "palette" | "seed">> & { cols: number; rows: number; jitter: number }): Tri[] {
  const cols = Math.max(2, o.cols | 0);
  const rows = Math.max(2, o.rows | 0);
  const pal = resolvePalette(o.palette);
  const rand = rng(o.seed * 977 + cols * 13 + rows);
  const cw = o.w / cols;
  const ch = o.h / rows;
  const pts: number[][][] = [];
  for (let r = 0; r <= rows; r++) {
    pts[r] = [];
    for (let c = 0; c <= cols; c++) {
      const edge = r === 0 || c === 0 || r === rows || c === cols;
      const jx = edge ? 0 : (rand() - 0.5) * cw * o.jitter;
      const jy = edge ? 0 : (rand() - 0.5) * ch * o.jitter;
      pts[r][c] = [c * cw + jx, r * ch + jy];
    }
  }
  const out: Tri[] = [];
  let last = -1;
  const pick = () => {
    let i: number;
    do {
      i = (rand() * pal.length) | 0;
    } while (i === last && pal.length > 2);
    last = i;
    return pal[i];
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = pts[r][c], b = pts[r][c + 1], d = pts[r + 1][c], e = pts[r + 1][c + 1];
      const flip = rand() > 0.5;
      const t1 = flip ? [a, b, d] : [a, b, e];
      const t2 = flip ? [b, e, d] : [a, e, d];
      for (const t of [t1, t2]) {
        out.push({
          d: `M${t[0][0].toFixed(1)} ${t[0][1].toFixed(1)}L${t[1][0].toFixed(1)} ${t[1][1].toFixed(1)}L${t[2][0].toFixed(1)} ${t[2][1].toFixed(1)}Z`,
          f: pick(),
          o: Number((0.78 + rand() * 0.22).toFixed(2)),
        });
      }
    }
  }
  return out;
}

type Shard = { x: number; y: number; w: number; h: number; rx: number; rot: number; cx: number; cy: number; f: string };
function buildTrencadis(o: Required<Pick<Common, "w" | "h" | "palette" | "seed">> & { tile: number; gap: number; radius: number; jitter: number }): Shard[] {
  const pal = resolvePalette(o.palette);
  const rand = rng(o.seed * 1301);
  const cols = Math.ceil(o.w / o.tile);
  const rows = Math.ceil(o.h / o.tile);
  const out: Shard[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.06) continue;
      const x = c * o.tile + o.gap / 2 + (rand() - 0.5) * o.gap * o.jitter;
      const y = r * o.tile + o.gap / 2 + (rand() - 0.5) * o.gap * o.jitter;
      const w = Math.max(2, o.tile - o.gap - rand() * o.gap);
      const h = Math.max(2, o.tile - o.gap - rand() * o.gap);
      out.push({
        x, y, w, h,
        rx: rand() * o.radius,
        rot: (rand() - 0.5) * 8,
        cx: x + w / 2,
        cy: y + h / 2,
        f: pal[(rand() * pal.length) | 0],
      });
    }
  }
  return out;
}

export function Mosaic({
  kind = "facets",
  w = 600,
  h = 400,
  cols = 9,
  rows = 6,
  jitter = 0.42,
  tile = 30,
  gap = 3,
  radius = 5,
  palette = "mixed",
  seed = 7,
  opacity = 1,
  style,
}: Common & {
  kind?: "facets" | "trencadis";
  cols?: number;
  rows?: number;
  jitter?: number;
  tile?: number;
  gap?: number;
  radius?: number;
}) {
  const palKey = Array.isArray(palette) ? palette.join() : palette;
  const facets = useMemo(
    () => (kind === "facets" ? buildFacets({ w, h, cols, rows, jitter, palette, seed }) : []),
    [kind, w, h, cols, rows, jitter, palKey, seed],
  );
  const shards = useMemo(
    () => (kind === "trencadis" ? buildTrencadis({ w, h, tile, gap, radius, jitter, palette, seed }) : []),
    [kind, w, h, tile, gap, radius, jitter, palKey, seed],
  );
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" style={[{ opacity }, style]}>
      {kind === "trencadis" && <Rect width={w} height={h} fill="rgba(41,74,99,0.06)" />}
      {kind === "facets"
        ? facets.map((t, i) => <Path key={i} d={t.d} fill={t.f} fillOpacity={t.o} />)
        : shards.map((s, i) => (
            <G key={i} origin={`${s.cx}, ${s.cy}`} rotation={s.rot}>
              <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.f} />
            </G>
          ))}
    </Svg>
  );
}
