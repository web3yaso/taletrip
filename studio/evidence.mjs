// studio/evidence.mjs
// Evidence logger (Mac side) for the competition's 3-stage verification bundle.
// Each Studio generation run gets artifacts/runs/<stamp>-<label>/ holding
// events.jsonl (every model load / completion / diffusion, timestamped) and
// run.json (request, model manifest, totals). Same event schema as the iPad.
import fs from "bare-fs";

const ROOT = "artifacts/runs";
let runDir = null;
let runMeta = null;

export function beginRun(label, request = {}) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  runDir = `${ROOT}/${stamp}-${label}`;
  fs.mkdirSync(runDir, { recursive: true });
  runMeta = { label, startedAt: new Date().toISOString(), request, models: {}, events: 0 };
  logEvent("runBegin", { request });
  return runDir;
}

export function logEvent(op, meta = {}) {
  try {
    if (!runDir) beginRun("adhoc");
    runMeta.events++;
    if (meta.model) runMeta.models[meta.model] = true;
    const line = JSON.stringify({ ts: new Date().toISOString(), device: "mac-studio", op, ...meta });
    fs.appendFileSync(`${runDir}/events.jsonl`, line + "\n");
  } catch { /* never break generation */ }
}

export function endRun(summary = {}) {
  try {
    if (!runDir) return;
    logEvent("runEnd", summary);
    fs.writeFileSync(
      `${runDir}/run.json`,
      JSON.stringify({ ...runMeta, models: Object.keys(runMeta.models), finishedAt: new Date().toISOString(), summary }, null, 2),
    );
  } catch {}
  runDir = null;
  runMeta = null;
}
