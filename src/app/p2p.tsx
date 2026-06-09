// src/app/p2p.tsx — TEMP dev screen · P2P Spike-0b
// Calls the SDK's downloadAsset() against a pear:// hyperdrive URL seeded by the
// Mac (studio/p2p-seed.mjs). Pure JS — no rebuild. Proves iPad<->Mac P2P works.
import { useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";
import { downloadAsset } from "@qvac/sdk";

// stable key from studio/p2p-seed.mjs (Mac seeder must be running)
const KEY = "eff99874618e1f6ec416a9deeecdafa8030208fe1d9e891152b43b10003d88f8";

export default function P2PTest() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const print = (s: string) => setLog((L) => [...L, s]);

  async function test(file: string) {
    setBusy(true);
    try {
      const src = `pear://${KEY}/${file}`;
      print(`downloadAsset ${src} …`);
      const t0 = Date.now();
      const id = await downloadAsset({
        assetSrc: src,
        onProgress: (p: any) => print("  dl: " + JSON.stringify(p)),
      } as any);
      print(`✅ done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${id}`);
      print("→ iPad↔Mac P2P works ✅");
    } catch (e: any) {
      print("❌ ERROR: " + (e?.message ?? String(e)));
    }
    setBusy(false);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>P2P · downloadAsset 测试</Text>
      <Text style={{ fontSize: 12, color: "#666" }}>前提：Mac 上 `bare studio/p2p-seed.mjs` 在跑，同一 WiFi</Text>
      <Button title="① 下 storypack.json (pear://)" onPress={() => test("storypack.json")} disabled={busy} />
      <Button title="② 下 p0.png (pear://)" onPress={() => test("p0.png")} disabled={busy} />
      <Button title="clear" onPress={() => setLog([])} disabled={busy} />
      <View style={{ marginTop: 12, gap: 2 }}>
        {log.map((l, i) => (
          <Text key={i} style={{ fontFamily: "Courier", fontSize: 12 }}>
            {l}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}
