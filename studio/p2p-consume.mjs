// studio/p2p-consume.mjs  ·  P2P Spike-0a (consumer)
// Read the pairing key, join the swarm, replicate the Hyperdrive, download the
// files, print them, exit. Run:  node_modules/.bin/bare studio/p2p-consume.mjs
import fs from "bare-fs";
import Corestore from "corestore";
import Hyperdrive from "hyperdrive";
import Hyperswarm from "hyperswarm";
import idEnc from "hypercore-id-encoding";

const STORE = "/tmp/p2p-con-store";
try { fs.rmSync(STORE, { recursive: true, force: true }); } catch {}

const key = idEnc.decode(fs.readFileSync("/tmp/p2p-key.txt").toString().trim());
console.log("pairing key:", idEnc.encode(key).slice(0, 16), "…");

const store = new Corestore(STORE);
const drive = new Hyperdrive(store, key);
await drive.ready();

const swarm = new Hyperswarm();
let connected = false;
swarm.on("connection", (conn) => {
  connected = true;
  console.log("connected to peer:", idEnc.encode(conn.remotePublicKey).slice(0, 12), "…");
  store.replicate(conn); // replicate the whole corestore (drive metadata + blobs)
});
swarm.join(drive.discoveryKey, { server: true, client: true });

console.log("looking for the peer on the DHT…");
await swarm.flush(); // wait for topic announce + lookup + connections to settle

// give replication a moment, retry the read until the file shows up (or timeout)
async function getWithRetry(path, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try { await drive.update(); } catch {}
    const b = await drive.get(path);
    if (b) return b;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

console.log("syncing… (connected=" + connected + ")");
const buf = await getWithRetry("/hello.txt");
console.log("GOT /hello.txt →", buf ? buf.toString() : "(null)");
const json = await getWithRetry("/storypack.json");
console.log("GOT /storypack.json →", json ? json.toString() : "(null)");
const png = await getWithRetry("/p0.png");
console.log("GOT /p0.png →", png ? png.length + " bytes" : "(null)");

console.log(buf && json && png ? "\nOK — P2P Hyperdrive replication works on Bare ✅" : "\n⚠️ incomplete");
await swarm.destroy();
