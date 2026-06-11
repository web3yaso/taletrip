// src/app/camera.tsx
// TaleTrip Kid · My Camera → Photo Story (per the Claude Design mockup).
// Kids snap photos (saved on the iPad, never uploaded); "Make my story" runs the
// fully on-device pipeline: SmolVLM looks at the photos → 1B LLM writes pages →
// the photos themselves illustrate the book → tappable Spanish words → Reader.
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  addPhoto, deletePhoto, listPhotos, makePhotoStory,
  MAX_PHOTOS, MIN_PHOTOS, type GenProgress, type GenStage,
} from "@/photostory/pipeline";
import { Btn, MuteButton, Pill } from "@/ui/chrome";
import { Icon } from "@/ui/icon";
import { useMuted } from "@/reading/mute";
import { C, F, SHADOW } from "@/ui/tokens";

const STAGES: { id: GenStage; label: string; icon: string }[] = [
  { id: "look", label: "Looking at your photos", icon: "gallery" },
  { id: "write", label: "Writing your story", icon: "pencil" },
  { id: "place", label: "Placing your pictures", icon: "palette" },
  { id: "words", label: "Adding Spanish words", icon: "translate" },
];

function cornerStyle(pos: number) {
  const base = { position: "absolute" as const, width: 30, height: 30, margin: 16, borderColor: "rgba(255,255,255,0.85)", borderRadius: 6 };
  if (pos === 0) return { ...base, top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 };
  if (pos === 1) return { ...base, top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 };
  if (pos === 2) return { ...base, bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 };
  return { ...base, bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 };
}

export default function MyCamera() {
  const router = useRouter();
  const [silent, toggleSilent] = useMuted();
  const [perm, requestPerm] = useCameraPermissions();
  const [camRef, setCamRef] = useState<CameraView | null>(null);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [photos, setPhotos] = useState(() => listPhotos());
  const [flash, setFlash] = useState(false);
  const [busyShot, setBusyShot] = useState(false);
  const [gen, setGen] = useState<GenProgress | null>(null);
  const [genDone, setGenDone] = useState(false);

  const refresh = useCallback(() => setPhotos(listPhotos()), []);
  const enough = photos.length >= MIN_PHOTOS;
  const full = photos.length >= MAX_PHOTOS;

  // NativeTabs keep screens mounted — only the FOCUSED tab may hold the camera
  // session (iOS allows one), else this view steals the Hunt tab's camera.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setPhotos(listPhotos());
      return () => setFocused(false);
    }, [])
  );

  async function shoot() {
    if (busyShot || full || !camRef) return;
    setBusyShot(true);
    try {
      const photo = await camRef.takePictureAsync({ quality: 0.6, skipProcessing: true });
      if (photo?.uri) {
        setFlash(true);
        setTimeout(() => setFlash(false), 230);
        await addPhoto(photo.uri);
        refresh();
      }
    } catch {}
    setBusyShot(false);
  }

  async function startGen() {
    if (!enough || gen) return;
    setGenDone(false);
    setGen({ stage: "look", done: 0, total: photos.length });
    try {
      await makePhotoStory((p) => setGen(p));
      setGenDone(true);
    } catch {
      setGen(null);
    }
  }

  const stageIdx = gen ? STAGES.findIndex((s) => s.id === gen.stage) : 0;
  const overall = gen ? (stageIdx + (gen.total ? gen.done / gen.total : 0)) / STAGES.length : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.paperDeep }}>
      {/* top bar */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingHorizontal: 26, paddingBottom: 6 }}>
        <Pill icon="lock">Parents</Pill>
        <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 30, color: C.ink }}>My Camera</Text>
        <MuteButton silent={silent} onToggle={toggleSilent} compact />
      </View>

      <View style={{ flex: 1, flexDirection: "row", gap: 16, paddingHorizontal: 34, paddingTop: 6, paddingBottom: 16 }}>
        {/* ── viewfinder ── */}
        <View style={{ flex: 1.65, borderRadius: 22, overflow: "hidden", backgroundColor: "#11181d", boxShadow: SHADOW.card }}>
          {perm?.granted && focused ? (
            // unmounted entirely when unfocused — mounting alone can claim the
            // single iOS camera session even when paused
            <CameraView ref={setCamRef} style={{ flex: 1 }} facing={facing} active />
          ) : perm?.granted ? (
            <View style={{ flex: 1, backgroundColor: "#11181d" }} />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 30 }}>
              <Icon name="camera" size={48} color="#e7d8b8" />
              <Text style={{ fontFamily: F.body, fontSize: 17, color: "#e7d8b8", textAlign: "center" }}>
                Let TaleTrip use the camera to take your trip photos. They stay on the iPad.
              </Text>
              <Btn variant="accent" title="Allow camera" onPress={requestPerm} />
            </View>
          )}

          {/* HUD corner brackets */}
          {[0, 1, 2, 3].map((i) => (
            <View key={i} pointerEvents="none" style={cornerStyle(i)} />
          ))}

          {/* top HUD pill */}
          <View pointerEvents="none" style={{ position: "absolute", top: 14, left: 0, right: 0, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(40,55,70,0.55)", borderRadius: 999, paddingVertical: 5, paddingHorizontal: 14 }}>
              <Icon name="camera" size={16} color="#fff" />
              <Text style={{ fontSize: 14, color: "#fff", fontFamily: F.bodyMed }}>
                {photos.length}/{MAX_PHOTOS} photos · saved on iPad
              </Text>
            </View>
          </View>

          {/* focus square */}
          {perm?.granted ? (
            <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 150, height: 150, borderWidth: 2, borderColor: "rgba(255,255,255,0.85)", borderRadius: 14 }} />
              <Text style={{ marginTop: 14, fontFamily: F.display, fontSize: 21, fontWeight: "600", color: "#fff", backgroundColor: "rgba(40,55,70,0.5)", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 16, overflow: "hidden" }}>
                {full ? "Photo roll is full!" : "Point at something cool!"}
              </Text>
            </View>
          ) : null}

          {/* shutter row */}
          {perm?.granted ? (
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 26 }}>
              <Pressable
                onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
                style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" }}
              >
                <Icon name="refresh" size={24} color="#fff" />
              </Pressable>
              <Pressable
                onPress={shoot}
                disabled={busyShot || full}
                style={({ pressed }) => ({
                  width: 86, height: 86, borderRadius: 43, borderWidth: 5, borderColor: "rgba(255,255,255,0.95)",
                  backgroundColor: full ? "#7c5a48" : C.accent, alignItems: "center", justifyContent: "center",
                  boxShadow: "0 10px 26px -10px rgba(0,0,0,0.6)", transform: [{ scale: pressed ? 0.95 : 1 }], opacity: busyShot ? 0.7 : 1,
                })}
              >
                <Icon name="camera" size={34} color="#fff" />
              </Pressable>
              <View style={{ width: 52, height: 52, borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
                {photos.length ? (
                  <Image source={{ uri: photos[photos.length - 1].uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <Icon name="gallery" size={22} color="#fff" />
                )}
              </View>
            </View>
          ) : null}

          {/* flash */}
          {flash ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: "#fff", opacity: 0.85 }} /> : null}
        </View>

        {/* ── photo roll + make story ── */}
        <View style={{ flex: 1, gap: 12 }}>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 20, padding: 16, boxShadow: SHADOW.card }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Icon name="gallery" size={20} color={C.accent} />
              <Text style={{ fontFamily: F.display, fontSize: 21, fontWeight: "600", color: C.ink }}>My Photos</Text>
              <View style={{ marginLeft: "auto", backgroundColor: C.cardInset, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 13, fontFamily: F.body, color: C.inkSoft }}>{photos.length} on iPad</Text>
              </View>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
              {photos.map((f) => (
                <Pressable
                  key={f.uri}
                  onLongPress={() => { deletePhoto(f); refresh(); }}
                  style={{ width: "48%", aspectRatio: 4 / 3, borderRadius: 12, overflow: "hidden", boxShadow: SHADOW.soft }}
                >
                  <Image source={{ uri: f.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </Pressable>
              ))}
              {!photos.length ? (
                <Text style={{ fontFamily: F.body, fontSize: 15, color: C.inkFaint, padding: 8 }}>
                  Snap your first photo with the big button!
                </Text>
              ) : null}
            </ScrollView>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
              <Icon name="wifiOff" size={14} color={C.inkFaint} />
              <Text style={{ fontSize: 12.5, fontFamily: F.body, color: C.inkFaint }}>Photos stay on your iPad — nothing is uploaded.</Text>
            </View>
          </View>

          <Btn
            variant={enough ? "accent" : "secondary"}
            icon="sparkle"
            iconFill
            fontSize={22}
            title={enough ? "Make my story" : `Take ${MIN_PHOTOS - photos.length} more`}
            onPress={enough ? startGen : undefined}
            style={{ justifyContent: "center", opacity: enough ? 1 : 0.6 }}
          />
        </View>
      </View>

      {/* ── generation overlay ── */}
      {gen ? (
        <View style={{ position: "absolute", inset: 0, zIndex: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(28,42,56,0.5)" }}>
          <View style={{ width: 580, maxWidth: "86%", backgroundColor: C.card, borderRadius: 28, padding: 30, alignItems: "center", boxShadow: SHADOW.pop }}>
            {/* fanned photos */}
            <View style={{ height: 110, marginBottom: 8, alignSelf: "stretch", alignItems: "center", justifyContent: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                {photos.slice(0, 5).map((f, i, arr) => {
                  const off = i - (arr.length - 1) / 2;
                  return (
                    <Image
                      key={f.uri}
                      source={{ uri: f.uri }}
                      style={{
                        width: 84, height: 64, borderRadius: 10, marginHorizontal: genDone ? -30 : -12,
                        borderWidth: 3, borderColor: "#fff",
                        transform: [{ rotate: `${genDone ? 0 : off * 7}deg` }, { translateY: Math.abs(off) * (genDone ? 0 : 4) }],
                      }}
                      resizeMode="cover"
                    />
                  );
                })}
                {genDone ? (
                  <View style={{ position: "absolute", width: 64, height: 64, borderRadius: 32, backgroundColor: C.olive, alignItems: "center", justifyContent: "center", boxShadow: SHADOW.pop }}>
                    <Icon name="check" size={36} color="#fff" sw={2.4} />
                  </View>
                ) : null}
              </View>
            </View>

            <Text style={{ fontFamily: F.display, fontSize: 29, fontWeight: "600", color: C.ink, textAlign: "center" }}>
              {genDone ? "Your story is ready! 🎉" : STAGES[stageIdx].label}
            </Text>
            <Text style={{ fontFamily: F.body, fontSize: 16, color: C.inkSoft, marginTop: 6, textAlign: "center" }}>
              {genDone ? "Made just for you, right here on the iPad." : "Making your very own tale…"}
            </Text>

            {!genDone ? (
              <>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 18, marginBottom: 14 }}>
                  {STAGES.map((s, i) => (
                    <View key={s.id} style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: i < stageIdx ? C.olive : i === stageIdx ? C.accent : C.cardInset }}>
                      <Icon name={i < stageIdx ? "check" : s.icon} size={20} color={i <= stageIdx ? "#fff" : C.inkFaint} sw={i < stageIdx ? 2.4 : 1.7} />
                    </View>
                  ))}
                </View>
                <View style={{ alignSelf: "stretch", height: 8, borderRadius: 999, backgroundColor: C.cardInset, overflow: "hidden" }}>
                  <View style={{ width: `${Math.round(overall * 100)}%`, height: "100%", backgroundColor: C.accent, borderRadius: 999 }} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }}>
                  <Icon name="lock" size={13} color={C.inkFaint} />
                  <Text style={{ fontSize: 12.5, fontFamily: F.body, color: C.inkFaint }}>Made on your iPad · no internet needed</Text>
                </View>
              </>
            ) : (
              <View style={{ flexDirection: "row", gap: 12, marginTop: 22 }}>
                <Btn variant="secondary" icon="camera" fontSize={18} title="More photos" onPress={() => { setGen(null); setGenDone(false); }} />
                <Btn variant="primary" icon="book" fontSize={18} title="Read my story" onPress={() => { setGen(null); setGenDone(false); router.navigate("/reader?id=my-photo-story"); }} />
              </View>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}
