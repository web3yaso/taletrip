// src/app/reader.tsx
// TaleTrip Kid · Storybook Reader — renders a (Studio-generated) StoryPack:
// real illustrations + tappable Spanish vocab + flashcard, with on-device TTS
// read-aloud and word pronounce. Fully offline.
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ModelManager } from "@/models/model-manager";
import { textToSpeech, TTS_SAMPLE_RATE } from "@/models/qvac";
import { playPcm, stopPcm } from "@/reading/audio-player";
import { useMuted } from "@/reading/mute";
import { readerPageText, type ReaderPage, type ReaderStory, type ReaderVocab } from "@/storypack/adapter";
import { PHOTO_STORY_ID } from "@/photostory/pipeline";
import { currentPackId, deletePack, listPacks, loadPack, markCurrent, packCover, seedBundledIfEmpty } from "@/storypack/store";
import { Btn, Card, Circ, MuteButton, Pill } from "@/ui/chrome";
import { Icon } from "@/ui/icon";
import { Mosaic } from "@/ui/mosaic";
import { C, F, SHADOW } from "@/ui/tokens";

function StoryText({ page, vocab, onWord }: { page: ReaderPage; vocab: ReaderVocab; onWord: (k: string) => void }) {
  return (
    <Text style={{ fontFamily: F.body, fontSize: 30, lineHeight: 49, color: C.ink }}>
      {page.parts.map((p, i) =>
        "t" in p ? (
          <Text key={i}>{p.t}</Text>
        ) : (
          <Text key={i} onPress={() => onWord(p.v)} style={{ color: C.ink, backgroundColor: C.blue + "33", borderRadius: 8 }}>
            {" "}
            {vocab[p.v]?.en ?? p.v}{" "}
          </Text>
        ),
      )}
    </Text>
  );
}

function VocabCard({ wordKey, vocab, onClose, silent, onHear }: { wordKey: string; vocab: ReaderVocab; onClose: () => void; silent: boolean; onHear: (es: string) => void }) {
  const entry = vocab[wordKey];
  if (!entry) return null;
  return (
    <Pressable onPress={onClose} style={{ position: "absolute", inset: 0, zIndex: 30, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(28,42,56,0.42)" }}>
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
          <Text style={{ fontFamily: F.displayBold, fontSize: 46, fontWeight: "700", color: C.accentD }}>{entry.es}</Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
            <Btn variant="secondary" fontSize={20} icon={silent ? "mute" : "audio"} title={silent ? "Muted" : "Hear it"} onPress={() => !silent && onHear(entry.es)} style={{ opacity: silent ? 0.5 : 1, paddingVertical: 13, paddingHorizontal: 20 }} />
            <Btn variant="primary" fontSize={20} icon="check" title="Got it" onPress={onClose} style={{ paddingVertical: 13, paddingHorizontal: 22 }} />
          </View>
        </View>
      </Pressable>
    </Pressable>
  );
}

export default function Reader() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; ts?: string }>();
  const [story, setStory] = useState<ReaderStory | null>(null);
  const [page, setPage] = useState(0);
  const [word, setWord] = useState<string | null>(null);
  const [silent, toggleSilent] = useMuted();
  const [reading, setReading] = useState(false);
  // NativeTabs mount every tab up-front — only read aloud while THIS tab is
  // focused, and stop narration the moment the kid switches away.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        stopPcm();
      };
    }, [])
  );
  // bookshelf: parent-sent books + the kid's own photo story, switchable
  const [shelf, setShelf] = useState(false);
  const [books, setBooks] = useState<{ id: string; title: string; cover: string | null; mine: boolean }[]>([]);
  // two-step delete: long-press arms a book (red badge), tapping the badge deletes
  const [armed, setArmed] = useState<string | null>(null);

  const openShelf = useCallback(() => {
    setBooks(listPacks().map((p) => ({ ...p, cover: packCover(p.id), mine: p.id === PHOTO_STORY_ID })));
    setArmed(null);
    setShelf(true);
  }, []);

  const pickBook = useCallback((id: string) => {
    try {
      const s = loadPack(id);
      markCurrent(id);
      setStory(s);
      setPage(0);
      setWord(null);
    } catch {}
    setShelf(false);
  }, []);
  const reqRef = useRef(0);

  // load a StoryPack from the device documents (seed the bundled demo on first run)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await seedBundledIfEmpty();
        const packs = listPacks();
        if (!packs.length || cancelled) return;
        // explicit ?id= wins; else the "current" (newest received/generated) book
        const id =
          params.id && packs.some((p) => p.id === params.id)
            ? params.id
            : (currentPackId() ?? packs[0].id);
        const s = loadPack(id);
        if (!cancelled) {
          setStory(s);
          setPage(0);
        }
      } catch {
        /* no pack available */
      }
    })();
    return () => {
      cancelled = true;
    };
    // params.ts: navigations after receive/photo-story carry a timestamp so a
    // SAME-ID book with fresh content forces a reload (text, images and audio)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.ts]);

  const pg = story?.pages[page];
  const last = story ? story.pages.length - 1 : 0;

  // read the current page aloud (unless Silent Mode)
  useEffect(() => {
    let cancelled = false;
    const req = ++reqRef.current;
    stopPcm();
    if (!focused || silent || !story || !pg) {
      setReading(false);
      return;
    }
    (async () => {
      try {
        setReading(true);
        await ModelManager.ensureTTS("en");
        const ttsId = ModelManager.ttsId();
        if (!ttsId || cancelled || req !== reqRef.current) return;
        const buf = await textToSpeech({ modelId: ttsId, text: readerPageText(pg, story.vocab), inputType: "text", stream: false }).buffer;
        if (cancelled || req !== reqRef.current) return;
        await playPcm(buf, TTS_SAMPLE_RATE);
      } catch {
        /* best-effort */
      } finally {
        if (!cancelled && req === reqRef.current) setReading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, silent, pg, story, focused]);

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

  if (!story || !pg) {
    return (
      <View style={{ flex: 1, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" }}>
        <Mosaic kind="facets" w={1180} h={820} cols={11} rows={8} jitter={0.5} palette="sky" seed={21} opacity={0.5} style={{ position: "absolute", inset: 0 }} />
        <Text style={{ fontFamily: F.displayItalic, fontSize: 28, color: C.accentD }}>Opening the storybook…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paperDeep }}>
      <Mosaic kind="facets" w={1180} h={820} cols={11} rows={8} jitter={0.5} palette={pg.mood} seed={pg.n * 13 + 7} opacity={0.9} style={{ position: "absolute", inset: 0 }} />

      {/* top bar */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingHorizontal: 26, paddingBottom: 6 }}>
        <Circ icon="back" label="Home" onPress={() => router.navigate("/")} />
        <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 27, color: C.ink }} numberOfLines={1}>
          {story.title}
        </Text>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <MuteButton silent={silent} onToggle={toggleSilent} compact />
          <Circ icon="library" label="My books" onPress={openShelf} />
        </View>
      </View>

      {/* book spread */}
      <View style={{ flex: 1, flexDirection: "row", paddingHorizontal: 30, paddingTop: 6, paddingBottom: 18 }}>
        {/* left: illustration */}
        <Card style={{ flex: 1, margin: 8, overflow: "hidden" }}>
          <Mosaic kind="facets" w={520} h={620} cols={6} rows={8} jitter={0.55} palette={pg.mood} seed={pg.n * 31 + 3} style={{ position: "absolute", inset: 0 }} />
          {pg.image ? <Image source={pg.image} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} resizeMode="cover" /> : null}
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
              {story.theme}
            </Pill>
            <Text style={{ fontFamily: F.display, fontSize: 22, color: C.inkFaint }}>
              {pg.n} / {story.pages.length}
            </Text>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
            <StoryText page={pg} vocab={story.vocab} onWord={setWord} />
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
          {story.pages.map((_, i) => (
            <Pressable key={i} onPress={() => setPage(i)} style={{ width: i === page ? 26 : 9, height: 9, borderRadius: 999, backgroundColor: i === page ? C.accent : C.hairline2 }} />
          ))}
        </View>
        {page < last ? (
          <Btn variant="primary" title="Next" iconRight="fwd" onPress={() => setPage((p) => Math.min(last, p + 1))} />
        ) : (
          <Btn variant="accent" icon="star" iconFill title="Play Activities" onPress={() => router.navigate("/activities")} />
        )}
      </View>

      {word ? <VocabCard wordKey={word} vocab={story.vocab} onClose={() => setWord(null)} silent={silent} onHear={hearWord} /> : null}

      {/* bookshelf overlay — parent-sent books + the kid's own photo story */}
      {shelf ? (
        <Pressable onPress={() => setShelf(false)} style={{ position: "absolute", inset: 0, zIndex: 30, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(28,42,56,0.5)" }}>
          <Pressable onPress={() => {}} style={{ width: 640, maxWidth: "88%", maxHeight: "82%", backgroundColor: C.card, borderRadius: 26, padding: 24, boxShadow: SHADOW.pop }}>
            <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 28, color: C.ink, marginBottom: 14 }}>My books</Text>
            <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              {books.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => (armed === b.id ? setArmed(null) : pickBook(b.id))}
                  delayLongPress={700}
                  onLongPress={() => setArmed(b.id)}
                  style={{ width: 180 }}
                >
                  <View style={{ width: 180, height: 126, borderRadius: 14, overflow: "hidden", backgroundColor: C.cardInset, boxShadow: SHADOW.soft }}>
                    {b.cover ? (
                      <Image source={{ uri: b.cover }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Icon name="book" size={34} color={C.inkFaint} />
                      </View>
                    )}
                    <View style={{ position: "absolute", left: 8, top: 8, backgroundColor: b.mine ? C.accent : "rgba(40,55,70,0.65)", borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 }}>
                      <Text style={{ fontSize: 11.5, color: "#fff", fontFamily: F.bodySemi }}>{b.mine ? "📷 Made by me" : "From your grown-ups"}</Text>
                    </View>
                  </View>
                  {armed === b.id ? (
                    // second tap on the red badge confirms the delete
                    <Pressable
                      onPress={() => {
                        deletePack(b.id);
                        setBooks((bs) => bs.filter((x) => x.id !== b.id));
                        setArmed(null);
                      }}
                      style={{ position: "absolute", left: -8, top: -8, width: 34, height: 34, borderRadius: 17, backgroundColor: "#d23b2e", alignItems: "center", justifyContent: "center", boxShadow: SHADOW.soft, zIndex: 2 }}
                    >
                      <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700", lineHeight: 24 }}>−</Text>
                    </Pressable>
                  ) : null}
                  <Text numberOfLines={2} style={{ fontFamily: F.bodyMed, fontSize: 15, color: C.ink, marginTop: 6 }}>{b.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}
