// src/bedtime/overlay.tsx
// Sleep Coach (two stages, see docs/taletrip-sleep-coach-design.md):
//   1. parent card — the MedPsy day-by-day jet-lag plan (tonight highlighted &
//      adapted by the morning check-in), the check-in buttons, "Start wind-down"
//   2. wind-down — dim slideshow of the kid's photos + book art, soft noise,
//      tab bar hidden; a grown-up exits by holding ~2.5s (snoozes auto-enter
//      for the rest of the night)
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { listPhotos } from "@/photostory/pipeline";
import { currentPackId, listPacks, loadPackRaw, packCover } from "@/storypack/store";
import { Btn } from "@/ui/chrome";
import { Icon } from "@/ui/icon";
import { C, F, SHADOW } from "@/ui/tokens";
import { checkIn, loadSleepPlan, snoozeTonight, todaysCheckIn, tonight, type SleepQuality } from "./plan";
import { startNoise, stopNoise } from "./noise";
import { setBedtime } from "./state";

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

const QUALITY: { key: SleepQuality; emoji: string; label: string }[] = [
  { key: "smooth", emoji: "😴", label: "Slept well" },
  { key: "ok", emoji: "🙂", label: "So-so" },
  { key: "rough", emoji: "😫", label: "Rough night" },
];

// ── stage 2: wind-down ──────────────────────────────────────────────────────
function WindDown() {
  const [uris] = useState(slideUris);
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    startNoise();
    return () => stopNoise();
  }, []);

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

  // grown-up exit: hold ~2.5s (hand-rolled — onLongPress with long delays gets
  // cancelled by tiny finger movements). Exiting snoozes auto-enter tonight.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const startHold = useCallback(() => {
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      snoozeTonight();
      setBedtime(false);
    }, 2500);
  }, []);
  const cancelHold = useCallback(() => {
    setHolding(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  return (
    <Pressable
      onPressIn={startHold}
      onPressOut={cancelHold}
      pressRetentionOffset={{ top: 200, bottom: 200, left: 200, right: 200 }}
      style={{ position: "absolute", inset: 0, backgroundColor: "#14110c" }}
    >
      {uris.length ? (
        <Animated.Image
          source={{ uri: uris[idx] }}
          resizeMode="cover"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: fade }}
        />
      ) : null}
      <View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: "rgba(26,16,6,0.55)" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 46, alignItems: "center", paddingHorizontal: 60, gap: 10 }}>
        <Text style={{ fontFamily: F.displayItalic, fontSize: 22, color: "rgba(255,240,214,0.75)" }}>
          Sweet dreams 🌙 sleep tight…
        </Text>
        <Text style={{ fontFamily: F.body, fontSize: holding ? 15 : 12.5, color: holding ? "rgba(255,240,214,0.95)" : "rgba(255,240,214,0.4)" }}>
          {holding ? "keep holding…" : "grown-ups: press and hold to exit"}
        </Text>
      </View>
    </Pressable>
  );
}

// ── stage 1: tonight's plan (parent card) ───────────────────────────────────
export function BedtimeOverlay() {
  const [plan] = useState(loadSleepPlan);
  const [stage, setStage] = useState<"plan" | "winddown">(plan ? "plan" : "winddown");
  const [, force] = useState(0); // re-render after a check-in
  const [dayOverride, setDayOverride] = useState<number | null>(null); // tap a row to pick tonight
  const [feedback, setFeedback] = useState("");

  if (stage === "winddown") {
    return (
      <View style={{ position: "absolute", inset: 0, zIndex: 100 }}>
        <WindDown />
      </View>
    );
  }

  const t = tonight(plan!, dayOverride);
  const checked = todaysCheckIn();

  return (
    <View style={{ position: "absolute", inset: 0, zIndex: 100, backgroundColor: "rgba(20,17,12,0.92)", alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 680, maxWidth: "92%", maxHeight: "92%", backgroundColor: C.card, borderRadius: 26, padding: 24, boxShadow: SHADOW.pop }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 26, color: C.ink }}>
            🌙 Tonight's sleep plan
          </Text>
          <Pressable onPress={() => setBedtime(false)} style={{ padding: 8 }}>
            <Text style={{ fontFamily: F.bodySemi, fontSize: 16, color: C.inkFaint }}>close</Text>
          </Pressable>
        </View>
        <Text style={{ fontFamily: F.body, fontSize: 14, color: C.inkSoft, marginTop: 2 }}>
          Jet lag {plan!.shiftHours}h {plan!.direction} · plan by MedPsy, on-device
        </Text>

        {/* tonight, big and actionable */}
        <View style={{ marginTop: 14, backgroundColor: C.cardInset, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Text style={{ fontFamily: F.display, fontWeight: "700", fontSize: 40, color: C.accentD }}>{t.bedtime}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodySemi, fontSize: 16, color: C.ink }}>
              {t.label}
              {t.adjustedBy ? `  (+${t.adjustedBy} min after a rough night)` : ""}
            </Text>
            <Text style={{ fontFamily: F.body, fontSize: 14.5, color: C.inkSoft, marginTop: 3 }}>{t.advice}</Text>
          </View>
        </View>

        {/* morning check-in */}
        <Text style={{ fontFamily: F.bodySemi, fontSize: 15, color: C.ink, marginTop: 14 }}>
          ☀️ How did last night go?{checked ? "  ✓ logged" : ""}
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          {QUALITY.map((q) => (
            <Pressable
              key={q.key}
              onPress={() => {
                checkIn(q.key);
                const after = tonight(plan!, dayOverride);
                setFeedback(
                  q.key === "rough"
                    ? `✓ Logged. Tonight moves to ${after.bedtime} (+${after.adjustedBy || 20} min, gentler routine).`
                    : `✓ Logged. Tonight stays at ${after.bedtime} — keep the plan.`,
                );
                force((x) => x + 1);
              }}
              style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: checked?.quality === q.key ? C.accent : C.cardInset }}
            >
              <Text style={{ fontSize: 24 }}>{q.emoji}</Text>
              <Text style={{ fontFamily: F.bodyMed, fontSize: 13, color: checked?.quality === q.key ? "#fff" : C.inkSoft, marginTop: 2 }}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
        {feedback ? (
          <Text style={{ fontFamily: F.bodyMed, fontSize: 13.5, color: C.olive, marginTop: 8 }}>{feedback}</Text>
        ) : null}

        {/* the full table */}
        <ScrollView style={{ marginTop: 14, maxHeight: 200 }} contentContainerStyle={{ gap: 6 }}>
          {plan!.days.map((d, i) => (
            <Pressable
              key={d.label}
              onPress={() => setDayOverride(i)} // parent can pick which night tonight is
              style={{ flexDirection: "row", gap: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: i === t.dayIndex ? "rgba(189,88,56,0.12)" : "transparent" }}
            >
              <Text style={{ fontFamily: F.bodySemi, fontSize: 15, color: C.accentD, minWidth: 52 }}>{d.bedtime}</Text>
              <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14.5, color: C.ink }}>{d.label}</Text>
              {i === t.dayIndex ? <Icon name="moon" size={16} color={C.accentD} /> : null}
            </Pressable>
          ))}
        </ScrollView>

        <Btn
          variant="primary"
          icon="moon"
          fontSize={21}
          title="Start wind-down"
          onPress={() => setStage("winddown")}
          style={{ justifyContent: "center", marginTop: 14 }}
        />
      </View>
    </View>
  );
}
