// src/storypack/barcelona.ts
// Demo story content ported from the design bundle's data.jsx — the active
// 12-page Barcelona storybook + EN->ES vocab. (Barcelona is the example trip;
// the StoryPack model in types.ts is the general form.)
import type { Mood } from "@/ui/tokens";

export type VocabTag = "place" | "art" | "people" | "food" | "say" | "shape" | "color" | "thing";
export type Vocab = { en: string; es: string; tag: VocabTag };

export const VOCAB: Record<string, Vocab> = {
  park: { en: "park", es: "parque", tag: "place" },
  mosaics: { en: "mosaics", es: "mosaicos", tag: "art" },
  family: { en: "family", es: "familia", tag: "people" },
  beach: { en: "beach", es: "playa", tag: "place" },
  "ice cream": { en: "ice cream", es: "helado", tag: "food" },
  "thank you": { en: "thank you", es: "gracias", tag: "say" },
  church: { en: "church", es: "iglesia", tag: "place" },
  tower: { en: "tower", es: "torre", tag: "shape" },
  tree: { en: "tree", es: "árbol", tag: "shape" },
  sky: { en: "sky", es: "cielo", tag: "color" },
  blue: { en: "blue", es: "azul", tag: "color" },
  circle: { en: "circle", es: "círculo", tag: "shape" },
  star: { en: "star", es: "estrella", tag: "shape" },
  house: { en: "house", es: "casa", tag: "place" },
  hello: { en: "hello", es: "hola", tag: "say" },
  water: { en: "water", es: "agua", tag: "thing" },
  sun: { en: "sun", es: "sol", tag: "color" },
  lizard: { en: "lizard", es: "lagarto", tag: "thing" },
  tiles: { en: "tiles", es: "azulejos", tag: "art" },
  bench: { en: "bench", es: "banco", tag: "thing" },
  boat: { en: "boat", es: "barco", tag: "thing" },
  night: { en: "night", es: "noche", tag: "color" },
};

// A story part is either plain text or a tappable vocab token.
export type Part = { t: string } | { v: string };
const t = (s: string): Part => ({ t: s });
const v = (k: string): Part => ({ v: k });

export type StoryPage = { n: number; mood: Mood; parts: Part[] };
export type Story = { title: string; theme: string; pages: StoryPage[] };

export const STORY: Story = {
  title: "A Little Journey to Barcelona",
  theme: "Colors & Shapes",
  pages: [
    { n: 1, mood: "sky", parts: [t("Sofía and her "), v("family"), t(" arrive in Barcelona. They see a beautiful "), v("park"), t(" with colorful "), v("mosaics"), t(" and amazing views of the city.")] },
    { n: 2, mood: "garden", parts: [t("At Park Güell, Sofía finds a friendly "), v("lizard"), t(" made of shiny "), v("tiles"), t(". It sparkles "), v("blue"), t(" and gold in the "), v("sun"), t(".")] },
    { n: 3, mood: "sea", parts: [t("She sits on a long, curvy "), v("bench"), t(". Leo points at a big "), v("circle"), t(" and a tiny "), v("star"), t(" hiding in the wall.")] },
    { n: 4, mood: "earth", parts: [t("Next they visit a tall "), v("church"), t(" called Sagrada Família. Its "), v("tower"), t(" reaches high into the "), v("sky"), t(".")] },
    { n: 5, mood: "earth", parts: [t("“The columns look like a "), v("tree"), t("!” says Sofía. The whole "), v("house"), t(" of stone feels like a forest.")] },
    { n: 6, mood: "garden", parts: [t("In the old town they say "), v("hello"), t(" to a baker. Sofía smiles and says "), v("thank you"), t(".")] },
    { n: 7, mood: "earth", parts: [t("For a treat, Sofía tries a cold "), v("ice cream"), t(". “Mmm!” She licks a drop before it melts in the "), v("sun"), t(".")] },
    { n: 8, mood: "sea", parts: [t("Then off to the "), v("beach"), t("! Leo digs in the sand while waves of "), v("water"), t(" tickle their toes.")] },
    { n: 9, mood: "sea", parts: [t("A little "), v("boat"), t(" floats far away. Sofía waves "), v("hello"), t(" and it bobs on the "), v("blue"), t(" sea.")] },
    { n: 10, mood: "garden", parts: [t("Back in the "), v("park"), t(", they count shapes: one "), v("circle"), t(", two stars, and a roof shaped like a wave.")] },
    { n: 11, mood: "sky", parts: [t("The "), v("sky"), t(" turns pink and orange. Lights twinkle like a "), v("star"), t(" map over the city.")] },
    { n: 12, mood: "muted", parts: [t("“Buenas noches, Barcelona,” whispers Sofía. Tomorrow is a brand new "), v("night"), t(" of dreams. The end.")] },
  ],
};

// Flatten a page's parts into the plain sentence the TTS reads aloud.
export function pageText(page: StoryPage): string {
  return page.parts
    .map((p) => ("t" in p ? p.t : VOCAB[p.v]?.en ?? p.v))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
