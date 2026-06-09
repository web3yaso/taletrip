// studio/seeder.mjs
// Seed generated StoryPacks over QVAC P2P. Each pack -> a Hyperdrive (namespaced
// by pack id off a stable Corestore, so the pairing key is deterministic). One
// long-lived Hyperswarm serves all drives. The iPad fetches via downloadAsset.
import fs from "bare-fs";
import b4a from "b4a";
import Corestore from "corestore";
import Hyperdrive from "hyperdrive";
import Hyperswarm from "hyperswarm";

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const store = new Corestore("/tmp/taletrip-seed-store"); // stable -> stable keys
let swarm = null;
const published = new Map(); // id -> { drive, keyHex }

function getSwarm() {
  if (!swarm) {
    swarm = new Hyperswarm();
    swarm.on("connection", (conn) => store.replicate(conn));
  }
  return swarm;
}

// Publish studio/packs/<id> into a Hyperdrive and seed it. Returns the pear key (hex).
export async function publishPack(id) {
  if (!SAFE_ID.test(id)) throw new Error("bad pack id");
  if (published.has(id)) return { id, keyHex: published.get(id).keyHex };

  const dir = `studio/packs/${id}`;
  const pack = JSON.parse(fs.readFileSync(`${dir}/storypack.json`));

  const drive = new Hyperdrive(store.namespace(id));
  await drive.ready();
  await drive.put("/storypack.json", fs.readFileSync(`${dir}/storypack.json`));
  for (const pg of pack.pages) {
    await drive.put("/" + pg.image, fs.readFileSync(`${dir}/${pg.image}`));
  }

  const keyHex = b4a.toString(drive.key, "hex");
  const discovery = getSwarm().join(drive.discoveryKey, { server: true, client: false });
  await discovery.flushed();

  published.set(id, { drive, keyHex });
  console.log(`  📡 seeding "${pack.title}" → pear://${keyHex}/…`);
  return { id, keyHex };
}
