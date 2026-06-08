// src/ui/icon.tsx
// Hand-drawn-ish line icons (24x24, stroke = color) ported from the design
// bundle's ui.jsx to react-native-svg. RN has no `currentColor`, so color is
// an explicit prop.
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C } from "./tokens";

export const I: Record<string, string> = {
  back: "M15 5l-7 7 7 7",
  fwd: "M9 5l7 7-7 7",
  gear: "M12 9.2a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6zM12 2.6l1.3 2.2 2.5-.3 1 2.3 2.3 1-.3 2.5 1.6 2-1.6 2 .3 2.5-2.3 1-1 2.3-2.5-.3L12 21.4l-1.3-2.2-2.5.3-1-2.3-2.3-1 .3-2.5L3.6 12l1.6-2-.3-2.5 2.3-1 1-2.3 2.5.3z",
  bookmark: "M7 4h10v16l-5-3.5L7 20z",
  palette:
    "M12 3a9 9 0 100 18c1.7 0 1.8-1.4 1-2.3-.7-.9-.5-2.2.8-2.2H17a4 4 0 004-4c0-5-4-7.5-9-7.5zM7.5 12.5a1 1 0 110-2 1 1 0 010 2zm2.5-3.5a1 1 0 110-2 1 1 0 010 2zm4 0a1 1 0 110-2 1 1 0 010 2z",
  pin: "M12 22s7-6.3 7-12A7 7 0 005 10c0 5.7 7 12 7 12zm0-9.2a2.8 2.8 0 100-5.6 2.8 2.8 0 000 5.6z",
  star: "M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.8L12 16.6 6.9 19.3 8 13.5l-4.3-4 5.8-.7z",
  chat: "M5 5h14v10H9l-4 4z",
  translate: "M4 6h7M7.5 4.5v1.5c0 3.5-2 6-4 7M6 9c.7 2 2.4 3.6 4.5 4.4M13 20l3.5-9 3.5 9m-6-2.4h5",
  plus: "M12 6v12M6 12h12",
  sparkle:
    "M12 4l1.4 4.6L18 10l-4.6 1.4L12 16l-1.4-4.6L6 10l4.6-1.4zM18.5 14.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z",
  audio: "M5 9.5h3l4-3.5v12l-4-3.5H5zM16 8.6a4 4 0 010 6.8M18.6 6a7 7 0 010 12",
  mute: "M5 9.5h3l4-3.5v12l-4-3.5H5zM16 9l4 6M20 9l-4 6",
  heart: "M12 20S4.5 15 4.5 9.6A3.6 3.6 0 0112 7a3.6 3.6 0 017.5 2.6C19.5 15 12 20 12 20z",
  download: "M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5M5 18.5h14",
  undo: "M9 7L5 11l4 4M5 11h8.5a4.5 4.5 0 010 9H11",
  redo: "M15 7l4 4-4 4M19 11h-8.5a4.5 4.5 0 000 9H13",
  pencil: "M4 20l1-4L16 5l3 3L8 19zM14.5 6.5l3 3",
  book: "M4 5.5C4 5 4.4 4.6 5 4.6h5c.8 0 1.5.6 1.5 1.5v13c0-.7-.7-1.3-1.5-1.3H4zM20 5.5c0-.5-.4-.9-1-.9h-5c-.8 0-1.5.6-1.5 1.5v13c0-.7.7-1.3 1.5-1.3H20z",
  library: "M5 5h3v14H5zM10.5 5h3v14h-3zM16.2 5.4l2.8.7-2.6 13.6-2.8-.7z",
  grid: "M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z",
  chart: "M5 19V11M10 19V6M15 19v-5M20 19V8M4 19.5h16",
  search: "M11 4a7 7 0 105 12 7 7 0 00-5-12zm5.5 11.5L21 20",
  check: "M5 12.5l4.5 4.5L19 6.5",
  headphones: "M4 13a8 8 0 0116 0M4 13v3.5a2 2 0 002 2h1V13H6a2 2 0 00-2 0zM20 13v3.5a2 2 0 01-2 2h-1V13h1a2 2 0 012 0z",
  wifiOff:
    "M3 5l18 18M8.5 12.7A6 6 0 0112 11.5M5.5 9.7a10 10 0 014-2.2M19 9.7a10 10 0 00-5.5-2.6M11 16.2a2.5 2.5 0 012-.2M12 20h.01",
  moon: "M20 14.5A8 8 0 119.5 4 6.5 6.5 0 0020 14.5z",
  parents:
    "M8.5 8.5a2.3 2.3 0 100-4.6 2.3 2.3 0 000 4.6zM4 18c0-2.8 2-4.5 4.5-4.5S13 15.2 13 18M16 9a2 2 0 100-4 2 2 0 000 4zM13.5 18c0-2.4 1.6-4 3.5-4 1.6 0 3 1 3.5 2.6",
  plane:
    "M11 3.5c.4-1 1.6-1 2 0l.4 6.2 5.6 3.4c.5.3.5 1 0 1.2l-5.6 1.4-.6 4.3 1.6 1.3-.2 1-2.2-.8-2.2.8-.2-1 1.6-1.3-.6-4.3L4 15.5c-.5-.2-.5-.9 0-1.2l5.6-3.4z",
  train: "M7 4h10a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zM5.5 9.5h13M9 13h.01M15 13h.01M8 16l-2 3M16 16l2 3",
  mic: "M12 4a2.5 2.5 0 012.5 2.5v5a2.5 2.5 0 01-5 0v-5A2.5 2.5 0 0112 4zM6.5 11a5.5 5.5 0 0011 0M12 16.5V20M9 20h6",
  calendar: "M5 6h14v14H5zM5 10h14M8 4v3M16 4v3M9 14h2M14 14h1.5",
  lock: "M7 11V8.5a5 5 0 0110 0V11M5.5 11h13v8.5h-13zM12 14.5v2.5",
  globe:
    "M12 3a9 9 0 100 18 9 9 0 000-18zM3.5 12h17M12 3c2.5 2.3 3.8 5.6 3.8 9s-1.3 6.7-3.8 9c-2.5-2.3-3.8-5.6-3.8-9S9.5 5.3 12 3z",
  play: "M8 5.5v13l11-6.5z",
};

export function Icon({
  name,
  size = 24,
  color = C.ink,
  fill = false,
  sw = 1.7,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  fill?: boolean;
  sw?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const d = I[name] ?? "";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d={d}
        fill={fill ? color : "none"}
        stroke={fill ? "none" : color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
