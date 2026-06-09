// src/app/p2p.tsx — Kid "Receive a book" (P2P) · receives a StoryPack over QVAC
// P2P from the parent's Mac (studio seeder) and writes it into documents/packs
// so the Reader can read it offline. (Dev-ish UI; pairing-code paste for now.)
import { useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { receivePack } from "@/storypack/receive";
import { C, F } from "@/ui/tokens";

// pre-filled with a Studio pairing code (barcelona-mia — a book the iPad doesn't
// have yet, to prove a NEW book arrives over P2P). Copy any code from the Studio UI.
const DEFAULT_KEY = "0f10853430915b609bf6b2209de75244138bd0ffa4d8225f136c71ee088d602b";

export default function Receive() {
  const router = useRouter();
  const [key, setKey] = useState(DEFAULT_KEY);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const print = (s: string) => setLog((L) => [...L, s]);

  async function go() {
    setBusy(true);
    setLog([]);
    try {
      const t0 = Date.now();
      const id = await receivePack(key.trim(), print);
      print(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s — opening…`);
      router.navigate(`/reader?id=${id}`);
    } catch (e: any) {
      print("❌ " + (e?.message ?? String(e)));
    }
    setBusy(false);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ padding: 24, gap: 12 }}>
      <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 34, color: C.ink }}>Get a book from a grown-up</Text>
      <Text style={{ fontFamily: F.body, fontSize: 15, color: C.inkSoft }}>
        Enter the pairing code shown on the parent&apos;s Studio. Same WiFi. Downloads over P2P — no cloud.
      </Text>
      <TextInput
        value={key}
        onChangeText={setKey}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="pairing code (64-char key)"
        style={{ fontFamily: "Courier", fontSize: 13, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.hairline2, backgroundColor: "#fff", color: C.ink }}
      />
      <Button title={busy ? "Receiving…" : "Receive the book"} onPress={go} disabled={busy} />
      <Button title="Go to Reader" onPress={() => router.navigate("/reader")} disabled={busy} />
      <View style={{ marginTop: 10, gap: 3 }}>
        {log.map((l, i) => (
          <Text key={i} style={{ fontFamily: "Courier", fontSize: 12, color: C.inkSoft }}>
            {l}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}
