// src/app/p2p.tsx — Kid "Get a book" (P2P) · scan the pairing QR on the parent's
// Studio (or paste the code), then receive the StoryPack over QVAC P2P and write
// it into documents/packs so the Reader/Coloring/Hunt screens pick it up. Offline.
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { receivePack } from "@/storypack/receive";
import { Btn, MuteButton, Pill } from "@/ui/chrome";
import { Icon } from "@/ui/icon";
import { useMuted } from "@/reading/mute";
import { C, F, SHADOW } from "@/ui/tokens";

// pull a 64-hex pear key out of a scanned/pasted value (raw key or pear:// url)
function extractKey(s: string): string | null {
  const m = s.trim().match(/[0-9a-fA-F]{64}/);
  return m ? m[0].toLowerCase() : null;
}

// prefill: barcelona-sofia, the demo book. Any QR/code from the Studio works too.
const DEFAULT_KEY = "db84daf025da96d8e60dc07f82b37dddd636c8b19383fe1e3a845506623ab86f";

export default function Receive() {
  const router = useRouter();
  const [silent, toggleSilent] = useMuted();
  const [perm, requestPerm] = useCameraPermissions();
  const [key, setKey] = useState(DEFAULT_KEY);
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);
  const print = (s: string) => setLog((L) => [...L, s]);

  // close the scanner when this tab loses focus (don't hold the camera session)
  useFocusEffect(useCallback(() => () => setScanning(false), []));

  async function receive(k: string) {
    if (busy) return;
    setBusy(true);
    setLog([]);
    try {
      const t0 = Date.now();
      const id = await receivePack(k.trim(), print);
      print(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s — opening…`);
      router.navigate(`/reader?id=${id}`);
    } catch (e: any) {
      print("❌ " + (e?.message ?? String(e)));
    }
    setBusy(false);
  }

  async function openScanner() {
    if (!perm?.granted) {
      const r = await requestPerm();
      if (!r.granted) return;
    }
    lockRef.current = false;
    setScanning(true);
  }

  function onScanned(data: string) {
    if (lockRef.current) return;
    const k = extractKey(data);
    if (!k) return;
    lockRef.current = true;
    setScanning(false);
    setKey(k);
    receive(k);
  }

  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: "#10171f" }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={(e) => onScanned(e.data)}
        />
        {/* aiming frame + cancel */}
        <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: "rgba(255,255,255,0.85)" }} />
          <Text style={{ fontFamily: F.body, fontSize: 16, color: "#fff", marginTop: 18 }}>Point at the QR on the grown-up&apos;s screen</Text>
        </View>
        <Pressable
          onPress={() => setScanning(false)}
          style={{ position: "absolute", top: 24, right: 24, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18, backgroundColor: "rgba(20,28,36,0.7)" }}
        >
          <Text style={{ fontFamily: F.bodySemi, fontSize: 16, color: "#fff" }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ padding: 32, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pill icon="lock">Parents</Pill>
        <MuteButton silent={silent} onToggle={toggleSilent} />
      </View>

      <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 40, color: C.ink }}>Get a book from a grown-up</Text>
      <Text style={{ fontFamily: F.body, fontSize: 16, color: C.inkSoft }}>
        Scan the pairing QR on the parent&apos;s Studio. Same WiFi. Downloads over P2P — no cloud.
      </Text>

      <Pressable
        onPress={openScanner}
        disabled={busy}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, borderRadius: 18, paddingVertical: 18, backgroundColor: C.navyBtn, boxShadow: SHADOW.soft, opacity: busy ? 0.5 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
      >
        <Icon name="search" size={24} color="#f6ecd6" />
        <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 24, color: "#f6ecd6" }}>Scan the QR code</Text>
      </Pressable>

      <Text style={{ fontFamily: F.body, fontSize: 14, color: C.inkFaint, textAlign: "center" }}>— or paste the code —</Text>
      <TextInput
        value={key}
        onChangeText={setKey}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="pairing code (64-char key)"
        style={{ fontFamily: "Courier", fontSize: 13, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.hairline2, backgroundColor: "#fff", color: C.ink }}
      />
      <Btn variant="secondary" title={busy ? "Receiving…" : "Receive the book"} onPress={() => receive(key)} />

      <View style={{ marginTop: 6, gap: 3 }}>
        {log.map((l, i) => (
          <Text key={i} style={{ fontFamily: "Courier", fontSize: 12, color: C.inkSoft }}>{l}</Text>
        ))}
      </View>
    </ScrollView>
  );
}
