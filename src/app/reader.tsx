// src/app/reader.tsx
// TaleTrip Kid · Storybook Reader — faithful to the Claude Design mockup, wired
// to on-device TTS: the page reads itself aloud (unless Silent Mode), and tapping
// a colored word opens a Spanish flashcard you can hear. No cloud, fully offline.
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ModelManager } from "@/models/model-manager";
import { textToSpeech } from "@/models/qvac";
import { TTS_SAMPLE_RATE } from "@/models/qvac";
import { playPcm, stopPcm } from "@/reading/audio-player";
import { STORY, VOCAB, pageText, type StoryPage } from "@/storypack/barcelona";
import { Btn, Card, Circ, MuteButton, Pill } from "@/ui/chrome";
import { Icon } from "@/ui/icon";
import { Mosaic } from "@/ui/mosaic";
import { C, F, SHADOW } from "@/ui/tokens";

// food words get a terracotta tint, everything else a blue tint (design rule)
function vocabTint(key: string, strong = false): string {
  const food = VOCAB[key]?.tag === "food";
  const base = food ? C.terracotta : C.blue;
  return base + (strong ? "55" : "33"); // ~34% / ~20% alpha
}

function StoryText({ page, onWord }: { page: StoryPage; onWord: (k: string) => void }) {
  return (
    <Text style={{ fontFamily: F.body, fontSize: 30, lineHeight: 49, color: C.ink }}>
      {page.parts.map((p, i) =>
        "t" in p ? (
          <Text key={i}>{p.t}</Text>
        ) : (
          <Text
            key={i}
            onPress={() => onWord(p.v)}
            style={{ color: C.ink, backgroundColor: vocabTint(p.v), borderRadius: 8 }}
          >
            {" "}
            {VOCAB[p.v]?.en ?? p.v}{" "}
          </Text>
        ),
      )}
    </Text>
  );
}

function VocabCard({ wordKey, onClose, silent, onHear }: { wordKey: string; onClose: () => void; silent: boolean; onHear: (es: string) => void }) {
  const entry = VOCAB[wordKey];
  if (!entry) return null;
  return (
    <Pressable
      onPress={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 30, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(28,42,56,0.42)" }}
    >
      <Pressable onPress={() => {}} style={{ width: 460, borderRadius: 26, overflow: "hidden", backgroundColor: C.card, boxShadow: SHADOW.pop }}>
        <View style={{ height: 150 }}>
          <Mosaic kind="trencadis" w={460} h={150} tile={26} gap={3} palette="mixed" seed={wordKey.length * 11 + 5} style={{ position: "absolute", inset: 0 }} />
          <Circ icon="back" onPress={onClose} size={42} iconSize={20} style={{ position: "absolute", top: 12, right: 12 }} />
        </View>
        <View style={{ paddingHorizontal: 28, paddingTop: 22, paddingBottom: 28, alignItems: "center" }}>
          <Text style={{ fontFamily: F.body, fontSize: 16, letterSpacing: 2, color: C.inkFaint, textTransform: "uppercase" }}>English</Text>
          <Text style={{ fontFamily: F.display, fontSize: 40, fontWeight: "600", color: C.ink }}>{entry.en}</Text>
          <View style={{ width: 60, borderTopWidth: 2, borderColor: C.hairline2, borderStyle: "dotted", marginVertical: 16 }} />
          <Text style={{ fontFamily: F.body, fontSize: 16, letterSpacing: 2, color: C.accent, textTransform: "uppercase" }}>Español</Text>
          <Text style={{ fontFamily: F.displayBold ?? F.display, fontSize: 46, fontWeight: "700", color: C.accentD }}>{entry.es}</Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
            <Btn
              variant="secondary"
              fontSize={20}
              icon={silent ? "mute" : "audio"}
              title={silent ? "Muted" : "Hear it"}
              onPress={() => !silent && onHear(entry.es)}
              style={{ opacity: silent ? 0.5 : 1, paddingVertical: 13, paddingHorizontal: 20 }}
            />
            <Btn variant="primary" fontSize={20} icon="check" title="Got it" onPress={onClose} style={{ paddingVertical: 13, paddingHorizontal: 22 }} />
          </View>
        </View>
      </Pressable>
    </Pressable>
  );
}

export default function Reader() {
  const router = useRouter();
  const S = STORY;
  const [page, setPage] = useState(0);
  const [word, setWord] = useState<string | null>(null);
  const [silent, setSilent] = useState(false);
  const [reading, setReading] = useState(false);
  const reqRef = useRef(0); // cancels stale synth when the page changes
  const pg = S.pages[page];
  const last = S.pages.length - 1;

  // Read the current page aloud (unless Silent Mode). Re-runs on page change.
  useEffect(() => {
    let cancelled = false;
    const req = ++reqRef.current;
    stopPcm();
    if (silent) {
      setReading(false);
      return;
    }
    (async () => {
      try {
        setReading(true);
        await ModelManager.ensureTTS("en");
        const ttsId = ModelManager.ttsId();
        if (!ttsId || cancelled || req !== reqRef.current) return;
        const buf = await textToSpeech({ modelId: ttsId, text: pageText(pg), inputType: "text", stream: false }).buffer;
        if (cancelled || req !== reqRef.current) return;
        await playPcm(buf, TTS_SAMPLE_RATE);
      } catch {
        /* offline read-aloud is best-effort */
      } finally {
        if (!cancelled && req === reqRef.current) setReading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, silent, pg]);

  useEffect(() => () => stopPcm(), []);

  const hearWord = useCallback(async (es: string) => {
    try {
      await ModelManager.ensureTTS("en");
      const ttsId = ModelManager.ttsId();
      if (!ttsId) return;
      const buf = await textToSpeech({ modelId: ttsId, text: es, inputType: "text", stream: false }).buffer;
      await playPcm(buf, TTS_SAMPLE_RATE);
    } catch {
      /* best-effort */
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.paperDeep }}>
      <Mosaic kind="facets" w={1180} h={820} cols={11} rows={8} jitter={0.5} palette={pg.mood} seed={pg.n * 13 + 7} opacity={0.9} style={{ position: "absolute", inset: 0 }} />

      {/* top bar */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingHorizontal: 26, paddingBottom: 6 }}>
        <Circ icon="back" label="Home" onPress={() => router.back()} />
        <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 27, color: C.ink }} numberOfLines={1}>
          {S.title}
        </Text>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <MuteButton silent={silent} onToggle={() => setSilent((s) => !s)} compact />
          <Circ icon="bookmark" label="Bookmark" />
        </View>
      </View>

      {/* book spread */}
      <View style={{ flex: 1, flexDirection: "row", paddingHorizontal: 30, paddingTop: 6, paddingBottom: 18, gap: 0 }}>
        {/* left: illustration */}
        <Card style={{ flex: 1, margin: 8, overflow: "hidden" }}>
          <Mosaic kind="facets" w={520} h={620} cols={6} rows={8} jitter={0.55} palette={pg.mood} seed={pg.n * 31 + 3} style={{ position: "absolute", inset: 0 }} />
          <View style={{ position: "absolute", left: 16, bottom: 14, backgroundColor: "rgba(40,55,70,0.55)", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 }}>
            <Text style={{ fontFamily: F.body, fontSize: 14, color: "#fff" }}>Tap colored words to learn Spanish</Text>
          </View>
          {reading ? (
            <View style={{ position: "absolute", right: 16, top: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(40,55,70,0.55)", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
              <Icon name="audio" size={16} color="#fff" />
              <Text style={{ fontFamily: F.body, fontSize: 13, color: "#fff" }}>reading…</Text>
            </View>
          ) : null}
        </Card>

        {/* right: text */}
        <Card style={{ flex: 1, margin: 8, padding: 42 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <Pill icon="grid" iconColor={C.accent} style={{ backgroundColor: C.cardInset }}>
              {S.theme}
            </Pill>
            <Text style={{ fontFamily: F.display, fontSize: 22, color: C.inkFaint }}>
              {pg.n} / {S.pages.length}
            </Text>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
            <StoryText page={pg} onWord={setWord} />
          </ScrollView>
          {silent ? (
            <Pill icon="headphones" iconColor={C.accent} color={C.accent} style={{ alignSelf: "flex-start", marginTop: 10 }}>
              Silent Mode — read together
            </Pill>
          ) : null}
        </Card>
      </View>

      {/* footer nav */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 40, paddingBottom: 22 }}>
        <View style={{ opacity: page === 0 ? 0 : 1 }}>
          <Btn variant="secondary" icon="back" title="Back" onPress={() => setPage((p) => Math.max(0, p - 1))} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {S.pages.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => setPage(i)}
              style={{ width: i === page ? 26 : 9, height: 9, borderRadius: 999, backgroundColor: i === page ? C.accent : C.hairline2 }}
            />
          ))}
        </View>
        {page < last ? (
          <Btn variant="primary" title="Next" iconRight="fwd" onPress={() => setPage((p) => Math.min(last, p + 1))} />
        ) : (
          <Btn variant="accent" icon="star" iconFill title="Play Activities" onPress={() => router.back()} />
        )}
      </View>

      {word ? <VocabCard wordKey={word} onClose={() => setWord(null)} silent={silent} onHear={hearWord} /> : null}
    </View>
  );
}
