// studio/p2p-spike-local.mjs  ·  P2P Spike-0a (single process, local DHT testnet)
// Proves the FULL P2P data path on Bare: swarm discovery -> connection ->
// Hyperdrive replication (metadata + blobs). Uses a local DHT testnet so two
// same-host peers connect reliably (public-DHT same-host holepunch is flaky and
// not representative of Mac<->iPad). Run:
//   node_modules/.bin/bare studio/p2p-spike-local.mjs
import fs from "bare-fs";
import createTestnet from "hyperdht/testnet";
import Corestore from "corestore";
import Hyperdrive from "hyperdrive";
import Hyperswarm from "hyperswarm";
import idEnc from "hypercore-id-encoding";

for (const d of ["/tmp/p2p-pub-store", "/tmp/p2p-con-store"]) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
}

const testnet = await createTestnet(3);
const bootstrap = testnet.bootstrap;
console.log("local DHT testnet up (" + bootstrap.length + " nodes)");

// ── Publisher (the MacBook role) ──
const pubStore = new Corestore("/tmp/p2p-pub-store");
const drive = new Hyperdrive(pubStore);
await drive.ready();
await drive.put("/storypack.json", Buffer.from(JSON.stringify({ id: "spike", title: "P2P spike pack", pages: 2 })));
await drive.put("/p0.png", Buffer.from("PNG-PLACEHOLDER-" + "x".repeat(4096)));
await drive.put("/hello.txt", Buffer.from("hello from the MacBook over QVAC P2P 🐻"));
const pairKey = idEnc.encode(drive.key);
console.log("PAIRING_KEY=" + pairKey);

const pubSwarm = new Hyperswarm({ bootstrap });
pubSwarm.on("connection", (c) => pubStore.replicate(c));
await pubSwarm.join(drive.discoveryKey, { server: true, client: true }).flushed();
console.log("publisher serving");

// ── Consumer (the iPad role) ──
const conStore = new Corestore("/tmp/p2p-con-store");
const cdrive = new Hyperdrive(conStore, idEnc.decode(pairKey));
await cdrive.ready();
const conSwarm = new Hyperswarm({ bootstrap });
let connected = false;
conSwarm.on("connection", (c) => { connected = true; conStore.replicate(c); });
conSwarm.join(cdrive.discoveryKey, { server: true, client: true });
await conSwarm.flush();

async function getWithRetry(p, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try { await cdrive.update(); } catch {}
    const b = await cdrive.get(p);
    if (b) return b;
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

console.log("consumer syncing… connected=" + connected);
const txt = await getWithRetry("/hello.txt");
const json = await getWithRetry("/storypack.json");
const png = await getWithRetry("/p0.png");
console.log("  /hello.txt      →", txt ? txt.toString() : "(null)");
console.log("  /storypack.json →", json ? json.toString() : "(null)");
console.log("  /p0.png         →", png ? png.length + " bytes" : "(null)");

const ok = txt && json && png;
console.log(ok ? "\n✅ OK — full P2P (swarm discovery + Hyperdrive replication) works on Bare" : "\n⚠️ incomplete");

await conSwarm.destroy();
await pubSwarm.destroy();
await testnet.destroy();
