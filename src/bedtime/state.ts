// src/bedtime/state.ts
// Global Bedtime mode flag — while on, the tab bar is hidden (native-level lock)
// and the Home screen shows the wind-down slideshow. Exited by a grown-up
// long-press. Same tiny external-store pattern as the mute switch.
import { useSyncExternalStore } from "react";

let on = false;
const subs = new Set<() => void>();

export function isBedtime() {
  return on;
}
export function setBedtime(v: boolean) {
  if (v === on) return;
  on = v;
  subs.forEach((f) => f());
}
function subscribe(cb: () => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}
export function useBedtime(): boolean {
  return useSyncExternalStore(subscribe, isBedtime, isBedtime);
}
