// studio/p2p-publish.mjs  ·  P2P Spike-0a (publisher)
// Create a Hyperdrive, put a couple of files, join the swarm, print the pairing
// key. Stays alive serving. Run:  node_modules/.bin/bare studio/p2p-publish.mjs
import fs from "bare-fs";
import Corestore from "corestore";
import Hyperdrive from "hyperdrive";
import Hyperswarm from "hyperswarm";
import idEnc from "hypercore-id-encoding";

const STORE = "/tmp/p2p-pub-store";
try { fs.rmSync(STORE, { recursive: true, force: true }); } catch {}

const store = new Corestore(STORE);
const drive = new Hyperdrive(store);
await drive.ready();

// a tiny "StoryPack": a json + a fake image blob
await drive.put("/storypack.json", Buffer.from(JSON.stringify({ id: "spike", title: "P2P spike pack", pages: 2 })));
await drive.put("/p0.png", Buffer.from("PNG-BYTES-PLACEHOLDER-" + "x".repeat(2048)));
await drive.put("/hello.txt", Buffer.from("hello from the MacBook over QVAC P2P 🐻"));

const key = idEnc.encode(drive.key); // z-base32 pairing code
fs.writeFileSync("/tmp/p2p-key.txt", key);
console.log("PAIRING_KEY=" + key);
console.log("files: /storypack.json /p0.png /hello.txt");

const swarm = new Hyperswarm();
swarm.on("connection", (conn) => {
  console.log("peer connected:", idEnc.encode(conn.remotePublicKey).slice(0, 12), "…");
  store.replicate(conn); // replicate the whole corestore (drive metadata + blobs)
});
const discovery = swarm.join(drive.discoveryKey, { server: true, client: true });
await discovery.flushed();
console.log("announced on DHT — serving. (Ctrl-C to stop)");
