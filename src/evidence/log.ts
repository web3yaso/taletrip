// src/evidence/log.ts
// Evidence logger for the competition's 3-stage verification bundle. Every AI
// inference on the iPad is appended as one JSONL line under documents/evidence/
// (exported to a Mac via Finder file sharing). Instrumentation lives at the
// single choke point src/models/qvac.ts — app code does not log manually.
import { Directory, File, Paths } from "expo-file-system";
import * as Device from "expo-device";

const DIR = new Directory(Paths.document, "evidence");
const deviceTag = `${Device.modelName ?? "ios-device"}`;

let currentRun = "session";
export function beginRun(label: string) {
  currentRun = `${label}-${new Date().toISOString().slice(5, 16).replace(/[T:]/g, "")}`;
  logEvent("runBegin", {});
  return currentRun;
}
export function endRun(meta: Record<string, unknown> = {}) {
  logEvent("runEnd", meta);
  currentRun = "session";
}

export function logEvent(op: string, meta: Record<string, unknown>) {
  try {
    if (!DIR.exists) DIR.create();
    const day = new Date().toISOString().slice(0, 10);
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      device: deviceTag,
      run: currentRun,
      op,
      ...meta,
    });
    new File(DIR, `${day}.jsonl`).write(line + "\n", { append: true });
  } catch {
    /* evidence logging must never break the app */
  }
}
