// src/reading/narration.ts
// Build the LLM prompt for a personalized page narration, and validate the
// output before it is ever spoken to a child. On any failure the parent-approved
// `authoredNarration` is returned instead (技术方案 §7: never speak unvetted text).
//
// Personalization works by SUBSTITUTING slots into the scene/authored text
// (e.g. "{name}", "{destination}"), NOT by passing them as separate instructions.
// A 1B model reliably narrates what's IN the scene, but ignores side-channel
// "Destination: X" hints — so we bake the concrete details into the scene first.
import type { Page } from "@/storypack/types";

export function fillSlots(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key) => slots[key] ?? `{${key}}`);
}

export function buildNarrationMessages(page: Page, slots: Record<string, string>) {
  const scene = fillSlots(page.scene, slots);
  return [
    {
      role: "system",
      content:
        "Retell the given scene as one short storybook page for a 5-year-old: 2-3 simple, gentle sentences. Keep the child's name and the place exactly as written in the scene. No scary or unsafe content.",
    },
    { role: "user", content: `Scene: ${scene}` },
  ];
}

const DENY = [/\b(kill|blood|gun|die|dead|scary|hate|weapon)\b/i];

export function validateNarration(
  text: string,
  page: Page,
  slots: Record<string, string>,
): string {
  const t = text.trim();
  const ok = t.length >= 10 && t.length <= 400 && !DENY.some((r) => r.test(t));
  return ok ? t : fillSlots(page.authoredNarration, slots);
}
