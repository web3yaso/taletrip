// src/storypack/samples/demo.ts
// Inline demo StoryPack for building/testing the reader before real authored
// packs (with illustrations) exist. Images are intentionally empty — the reader
// shows a placeholder card per page until a real pack provides art.
import type { StoryPack } from "../types";

export const DEMO_PACK: StoryPack = {
  id: "demo-lisbon",
  version: 1,
  checksum: "sha256:dev", // not enforced for the inline demo
  title: "{name}'s trip to {destination}",
  narrationLang: "en",
  vocabLang: "es",
  ageRange: [4, 7],
  pages: [
    {
      index: 0,
      image: "",
      scene:
        "{name} and their family arrive in {destination} and walk through a sunny park full of colorful tiles.",
      authoredNarration:
        "{name} arrives in {destination}. The sun is warm and the park is full of colorful tiles.",
      slots: ["name", "destination"],
    },
    {
      index: 1,
      image: "",
      scene:
        "{name} sees a tall tree by the water and a little boat sailing past in {destination}.",
      authoredNarration:
        "{name} sees a tall tree by the water. A little boat sails past. {name} waves at it.",
      slots: ["name", "destination"],
    },
    {
      index: 2,
      image: "",
      scene:
        "At sunset {name} eats a sweet pastry and watches yellow lights turn on across {destination}.",
      authoredNarration:
        "{name} eats a sweet pastry at sunset. Yellow lights turn on across {destination}. It is a happy day.",
      slots: ["name", "destination"],
    },
  ],
  vocab: [
    { word: "tree", translation: "el árbol", say: "el árbol" },
    { word: "sun", translation: "el sol", say: "el sol" },
    { word: "boat", translation: "el barco", say: "el barco" },
    { word: "park", translation: "el parque", say: "el parque" },
    { word: "water", translation: "el agua", say: "el agua" },
  ],
  huntTargets: ["tree", "window", "door"],
};
