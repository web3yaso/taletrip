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

// Publish studio/packs/<id> into a Hyperdrive and seed it. Returns the pear key
// (hex). Re-publishing the same id ALWAYS re-puts the files (a regenerated book
// must replace the old bytes in the drive) — only the swarm join happens once.
export async function publishPack(id) {
  if (!SAFE_ID.test(id)) throw new Error("bad pack id");

  const dir = `studio/packs/${id}`;
  const pack = JSON.parse(fs.readFileSync(`${dir}/storypack.json`));
  const jsonMtime = fs.statSync(`${dir}/storypack.json`).mtimeMs;

  let entry = published.get(id);
  if (!entry) {
    const drive = new Hyperdrive(store.namespace(id));
    await drive.ready();
    entry = { drive, keyHex: b4a.toString(drive.key, "hex"), putMtime: 0, joined: false };
    published.set(id, entry);
  }
  if (entry.putMtime !== jsonMtime) {
    await entry.drive.put("/storypack.json", fs.readFileSync(`${dir}/storypack.json`));
    for (const pg of pack.pages) {
      await entry.drive.put("/" + pg.image, fs.readFileSync(`${dir}/${pg.image}`));
    }
    entry.putMtime = jsonMtime;
    console.log(`  📡 seeding "${pack.title}" → pear://${entry.keyHex}/…`);
  }
  if (!entry.joined) {
    const discovery = getSwarm().join(entry.drive.discoveryKey, { server: true, client: false });
    await discovery.flushed();
    entry.joined = true;
  }
  return { id, keyHex: entry.keyHex };
}
