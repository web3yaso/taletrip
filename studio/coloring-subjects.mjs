// studio/coloring-subjects.mjs
// Curated SIMPLE, cute-renderable coloring subjects per region — representative
// plants, animals, and simple foods (NOT complex landmarks, which SD can't make
// into clean cute coloring pages). Each is a single, simple, child-friendly object.
//
// `kind` drives the Kid app's Coloring toggle:  "nature" = plants & animals,  "food" = foods.
// Matched against the destination string by keyword; falls back to GENERIC.

export const REGIONS = [
  {
    match: ["japan", "tokyo", "kyoto", "osaka"],
    items: [
      { name: "a cherry blossom branch", kind: "nature" },
      { name: "a cute koi fish", kind: "nature" },
      { name: "a red maple leaf", kind: "nature" },
      { name: "a piece of sushi", kind: "food" },
      { name: "a bowl of ramen noodles", kind: "food" },
      { name: "a round mochi rice cake", kind: "food" },
    ],
  },
  {
    match: ["france", "paris", "lyon", "nice"],
    items: [
      { name: "a sprig of lavender", kind: "nature" },
      { name: "a cute rooster", kind: "nature" },
      { name: "a little snail", kind: "nature" },
      { name: "a loaf of baguette bread", kind: "food" },
      { name: "a wedge of cheese", kind: "food" },
      { name: "a croissant", kind: "food" },
    ],
  },
  {
    match: ["spain", "barcelona", "madrid", "seville", "sevilla", "granada", "valencia"],
    items: [
      { name: "a cute bull", kind: "nature" },
      { name: "a sunflower", kind: "nature" },
      { name: "an orange with a leaf", kind: "nature" },
      { name: "a pan of paella", kind: "food" },
      { name: "a churro", kind: "food" },
      { name: "an ice cream cone", kind: "food" },
    ],
  },
  {
    match: ["portugal", "lisbon", "porto"],
    items: [
      { name: "a colorful rooster", kind: "nature" },
      { name: "a little sardine fish", kind: "nature" },
      { name: "an olive branch", kind: "nature" },
      { name: "a custard tart", kind: "food" },
      { name: "a loaf of bread", kind: "food" },
      { name: "a bunch of grapes", kind: "food" },
    ],
  },
  {
    match: ["italy", "rome", "venice", "florence", "milan"],
    items: [
      { name: "a cypress tree", kind: "nature" },
      { name: "a cute cat", kind: "nature" },
      { name: "a bunch of grapes", kind: "nature" },
      { name: "a slice of pizza", kind: "food" },
      { name: "a gelato ice cream", kind: "food" },
      { name: "a plate of spaghetti", kind: "food" },
    ],
  },
  {
    match: ["china", "beijing", "shanghai", "chengdu"],
    items: [
      { name: "a cute panda", kind: "nature" },
      { name: "a bamboo branch", kind: "nature" },
      { name: "a peony flower", kind: "nature" },
      { name: "a steamed dumpling", kind: "food" },
      { name: "a bowl of noodles", kind: "food" },
      { name: "a round bao bun", kind: "food" },
    ],
  },
];

export const GENERIC = [
  { name: "a cute little bird", kind: "nature" },
  { name: "a happy flower", kind: "nature" },
  { name: "a butterfly", kind: "nature" },
  { name: "an ice cream cone", kind: "food" },
  { name: "an apple", kind: "food" },
  { name: "a slice of cake", kind: "food" },
];

// Pick the subject list for a destination (keyword match, else generic).
export function subjectsFor(destination) {
  const d = String(destination || "").toLowerCase();
  for (const r of REGIONS) if (r.match.some((k) => d.includes(k))) return r.items;
  return GENERIC;
}
