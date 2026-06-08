// src/ui/tokens.ts
// TaleTrip design tokens — ported from the design bundle's taletrip.css :root.
// Barcelona / Gaudí warm-paper storybook palette.
export const C = {
  paper: "#f7eed8",
  paperDeep: "#efe2c4",
  card: "#fbf6e9",
  card2: "#f6edd8",
  cardInset: "#f3e8cf",

  ink: "#294a63",
  inkSoft: "#3f617a",
  inkFaint: "#6b8499",

  terracotta: "#bd5838",
  terracottaD: "#a4482b",
  blue: "#2f6f8f",
  blueD: "#245870",
  olive: "#7e8c4e",
  yellow: "#e0a33c",
  gold: "#cf9326",
  coral: "#e08a6c",
  navyBtn: "#284a60",

  // tweakable accent (defaults to terracotta)
  accent: "#bd5838",
  accentD: "#a4482b",

  hairline: "rgba(41,74,99,0.10)",
  hairline2: "rgba(41,74,99,0.16)",
} as const;

// Font family names = the @expo-google-fonts export identifiers (loaded in fonts.ts).
export const F = {
  display: "CormorantGaramond_600SemiBold",
  displayBold: "CormorantGaramond_700Bold",
  displayItalic: "CormorantGaramond_500Medium_Italic",
  body: "Lora_400Regular",
  bodyMed: "Lora_500Medium",
  bodySemi: "Lora_600SemiBold",
} as const;

// Layered shadows (RN 0.85 / Expo 56 supports the CSS `boxShadow` style prop).
export const SHADOW = {
  card: "0 18px 40px -22px rgba(40,55,70,0.45), 0 3px 10px -6px rgba(40,55,70,0.25)",
  soft: "0 10px 24px -16px rgba(40,55,70,0.4)",
  pop: "0 24px 60px -20px rgba(28,42,56,0.55)",
} as const;

export const RADIUS = { screen: 30, card: 20, row: 16 } as const;

// The iPad mockup canvas the design was laid out at.
export const CANVAS = { w: 1180, h: 820 } as const;

// Mosaic palette keys used across screens (mood -> palette).
export type Mood = "sky" | "sea" | "earth" | "garden" | "mixed" | "muted";
