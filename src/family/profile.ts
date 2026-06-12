// src/family/profile.ts
// Family profile — the private half of the on-device RAG knowledge base.
// Entered once by a parent, stored in the app's documents dir, NEVER uploaded.
import { Directory, File, Paths } from "expo-file-system";

export type FamilyProfile = {
  childName: string;
  age: number | null;
  gender: "girl" | "boy" | "" ;
  hobbies: string; // free text, e.g. "dinosaurs, drawing, football"
};

const FILE = () => new File(new Directory(Paths.document, "family"), "profile.json");

export function loadProfile(): FamilyProfile {
  try {
    const f = FILE();
    if (f.exists) return { childName: "", age: null, gender: "", hobbies: "", ...JSON.parse(f.textSync()) };
  } catch {}
  return { childName: "", age: null, gender: "", hobbies: "" };
}

export function saveProfile(p: FamilyProfile) {
  const dir = new Directory(Paths.document, "family");
  if (!dir.exists) dir.create();
  FILE().write(JSON.stringify(p));
}

// one-line summary injected into story prompts (empty string when unset)
export function profileSummary(p = loadProfile()): string {
  if (!p.childName && !p.hobbies) return "";
  const bits = [
    p.childName && `The child's name is ${p.childName}`,
    p.age && `${p.age} years old`,
    p.gender && (p.gender === "girl" ? "a girl" : "a boy"),
    p.hobbies && `loves ${p.hobbies}`,
  ].filter(Boolean);
  return bits.join(", ") + ".";
}
