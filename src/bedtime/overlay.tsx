// src/bedtime/overlay.tsx
// Bedtime mode — the iPad becomes a dim photo frame: the kid's own photos and
// the current book's illustrations cross-fade slowly while soft noise loops.
// The tab bar is hidden while active (see app-tabs); a grown-up exits by
// long-pressing (3s) anywhere. Optional sleep tip (MedPsy, shipped in the pack).
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { listPhotos } from "@/photostory/pipeline";
import { currentPackId, listPacks, loadPackRaw, packCover } from "@/storypack/store";
import { Directory, File, Paths } from "expo-file-system";
import { setBedtime } from "./state";
import { startNoise, stopNoise } from "./noise";
import { F } from "@/ui/tokens";

function slideUris(): string[] {
  const uris: string[] = [];
  for (const f of listPhotos()) uris.push(f.uri);
  const packId = currentPackId() ?? listPacks()[0]?.id;
  if (packId) {
    const raw = loadPackRaw(packId);
    const dir = new Directory(new Directory(Paths.document, "packs"), packId);
    for (const pg of raw?.pages ?? []) {
      const f = new File(dir, pg.image);
      if (f.exists) uris.push(f.uri);
    }
    if (!uris.length) {
      const cover = packCover(packId);
      if (cover) uris.push(cover);
    }
  }
  return uris;
}

export function BedtimeOverlay() {
  const [uris] = useState(slideUris);
  // tonight's sleep tip (MedPsy-generated, shipped inside the pack when present)
  const [tip] = useState<string | undefined>(() => {
    const id = currentPackId();
    const raw = id ? (loadPackRaw(id) as { sleepTips?: string[] } | null) : null;
    return raw?.sleepTips?.[0];
  });
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    startNoise();
    return () => stopNoise();
  }, []);

  // slow cross-fade carousel: fade out -> swap -> fade in, every 8s
  useEffect(() => {
    if (uris.length < 2) return;
    const iv = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 1400, useNativeDriver: true }).start(() => {
        setIdx((i) => (i + 1) % uris.length);
        Animated.timing(fade, { toValue: 1, duration: 1400, useNativeDriver: true }).start();
      });
    }, 8000);
    return () => clearInterval(iv);
  }, [uris.length, fade]);

  const exit = useCallback(() => setBedtime(false), []);

  return (
    <Pressable onLongPress={exit} delayLongPress={3000} style={{ position: "absolute", inset: 0, zIndex: 100, backgroundColor: "#14110c" }}>
      {uris.length ? (
        <Animated.Image
          source={{ uri: uris[idx] }}
          resizeMode="cover"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: fade }}
        />
      ) : null}
      {/* warm dim wash */}
      <View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: "rgba(26,16,6,0.55)" }} />

      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 46, alignItems: "center", paddingHorizontal: 60, gap: 10 }}>
        {tip ? (
          <Text style={{ fontFamily: F.body, fontSize: 17, color: "rgba(255,240,214,0.9)", textAlign: "center" }}>{tip}</Text>
        ) : null}
        <Text style={{ fontFamily: F.displayItalic, fontSize: 22, color: "rgba(255,240,214,0.75)" }}>
          Sweet dreams 🌙 sleep tight…
        </Text>
        <Text style={{ fontFamily: F.body, fontSize: 12.5, color: "rgba(255,240,214,0.4)" }}>
          grown-ups: press and hold to exit
        </Text>
      </View>
    </Pressable>
  );
}
