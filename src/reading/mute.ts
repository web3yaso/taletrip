// src/reading/mute.ts
// Shared "Silent Mode" state — one source of truth across every Kid screen, so
// the mute button is persistent (plane/train) and actually silences narration.
// The audio player checks isMuted() before playing.
import { useSyncExternalStore } from "react";

let muted = false;
const subs = new Set<() => void>();

export function isMuted() {
  return muted;
}
export function setMuted(v: boolean) {
  if (v === muted) return;
  muted = v;
  subs.forEach((f) => f());
}
export function toggleMuted() {
  setMuted(!muted);
}
export function subscribeMute(cb: () => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

// [silent, toggle] for a screen's <MuteButton silent={silent} onToggle={toggle} />
export function useMuted(): [boolean, () => void] {
  const v = useSyncExternalStore(subscribeMute, isMuted, isMuted);
  return [v, toggleMuted];
}
