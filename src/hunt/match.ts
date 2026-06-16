// src/hunt/match.ts
// Pure Scavenger-Hunt logic, extracted from hunt.tsx so it is dependency-free
// and unit-testable. The on-device VLM is asked to NAME what it sees (open-ended,
// to dodge a tiny model's "yes" bias); we then decide a hit in JS here.

// Findable-around-the-house objects SmolVLM can verify — each round samples 3.
export const POOL = [
  "book", "cup", "chair", "table", "shoe", "plant", "window", "door",
  "bottle", "ball", "clock", "pillow", "spoon", "hat", "sock", "lamp",
  "toy", "backpack",
];

// The VLM names what it sees (e.g. "a soda can", "wooden chair"); accept a hit
// when the target word — or a close synonym — appears as a whole word. Word
// boundaries avoid false hits like "hat" inside "what". Optional trailing "s"
// covers plurals ("books" → book).
export const SYNONYMS: Record<string, string[]> = {
  cup: ["mug"],
  shoe: ["sneaker", "boot", "trainer", "sandal"],
  plant: ["flower", "tree", "leaf", "pot"],
  bottle: ["flask"],
  backpack: ["bag", "rucksack"],
  pillow: ["cushion"],
  lamp: ["light"],
  toy: ["teddy", "doll", "figure"],
  clock: ["watch"],
  table: ["desk"],
};

export function matchesTarget(answer: string, target: string): boolean {
  const words = [target, ...(SYNONYMS[target] ?? [])];
  return words.some((w) => new RegExp(`\\b${w}s?\\b`).test(answer.toLowerCase()));
}

// Pick 3 distinct objects, never repeating ones in `exclude`.
export function sampleTargets(exclude: string[] = []): string[] {
  const pool = POOL.filter((t) => !exclude.includes(t));
  const out: string[] = [];
  while (out.length < 3 && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}
