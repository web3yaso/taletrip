// studio/p2p-seed.mjs  ·  P2P Spike-0b (Mac seeder)
// Seed a real StoryPack (lisbon-mia) into a Hyperdrive on the public DHT and
// print the pear:// URLs. The iPad fetches these with the SDK's downloadAsset
// (no app rebuild). Uses a STABLE corestore dir so the key stays constant across
// runs (so the iPad test can hardcode it). Run:
//   node_modules/.bin/bare studio/p2p-seed.mjs
import fs from "bare-fs";
import b4a from "b4a";
import Corestore from "corestore";
import Hyperdrive from "hyperdrive";
import Hyperswarm from "hyperswarm";

const STORE = "/tmp/p2p-seed-store"; // stable (NOT deleted) -> stable drive key
const SRC = "assets/packs/lisbon-mia"; // the real generated pack (committed)

const store = new Corestore(STORE);
const drive = new Hyperdrive(store);
await drive.ready();

// put the pack files into the drive (idempotent)
const files = ["storypack.json", "p0.png", "p1.png", "p2.png", "p3.png", "p4.png"];
for (const f of files) {
  const bytes = fs.readFileSync(`${SRC}/${f}`);
  await drive.put("/" + f, bytes);
}

const keyHex = b4a.toString(drive.key, "hex");
console.log("\n  drive key (hex): " + keyHex);
console.log("  pear URLs the iPad downloadAsset() can fetch:");
for (const f of files) console.log(`    pear://${keyHex}/${f}`);

const swarm = new Hyperswarm();
swarm.on("connection", (conn) => {
  console.log("  peer connected:", b4a.toString(conn.remotePublicKey, "hex").slice(0, 12), "…");
  store.replicate(conn);
});
const discovery = swarm.join(drive.discoveryKey, { server: true, client: false });
await discovery.flushed();
console.log("\n  seeding on public DHT — leave running. (Ctrl-C to stop)\n");
