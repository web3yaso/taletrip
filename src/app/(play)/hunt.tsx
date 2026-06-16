// src/app/hunt.tsx
// TaleTrip Kid · Picture Scavenger Hunt — point the camera at a target, snap, and
// an on-device VLM (SmolVLM 500M) decides yes/no. Fully offline. Per-pack targets.
import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File } from "expo-file-system";
import Svg, { Circle } from "react-native-svg";
import { ModelManager } from "@/models/model-manager";
import { completion, huntPrompt, textToSpeech, TTS_SAMPLE_RATE } from "@/models/qvac";
import { playPcm, stopPcm } from "@/reading/audio-player";
import { matchesTarget, sampleTargets } from "@/hunt/match";
import { Btn, Circ, MuteButton, Pill } from "@/ui/chrome";
import { Icon } from "@/ui/icon";
import { useMuted } from "@/reading/mute";
import { C, F, SHADOW } from "@/ui/tokens";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ProgressRing({ found, total }: { found: number; total: number }) {
  const r = 26, c = 2 * Math.PI * r;
  const pct = total ? found / total : 0;
  return (
    <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
      <Svg width={64} height={64} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={32} cy={32} r={r} stroke={C.cardInset} strokeWidth={6} fill="none" />
        <Circle cx={32} cy={32} r={r} stroke={C.accent} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </Svg>
      <Text style={{ fontFamily: F.bodySemi, fontSize: 15, color: C.ink, fontVariant: ["tabular-nums"] }}>{found}/{total}</Text>
    </View>
  );
}

export default function Hunt() {
  const [silent, toggleSilent] = useMuted();
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const router = useRouter();

  const [targets, setTargets] = useState<string[]>(() => sampleTargets());
  const [found, setFound] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Loading the picture brain…");
  const [ready, setReady] = useState(false);
  // NativeTabs keep screens mounted — only the FOCUSED tab may hold the camera
  // session (iOS allows one), so each camera screen activates on focus only.
  const [focused, setFocused] = useState(false);

  // say the word out loud — pre-readers can't read "tree" yet. TTS is small
  // enough to sit beside the VLM; respects Silent Mode via playPcm.
  const speak = useCallback(async (word: string) => {
    try {
      const ttsId = await ModelManager.ensureTTS("en");
      const buf = await textToSpeech({ modelId: ttsId, text: `Find a ${word}!`, inputType: "text", stream: false }).buffer;
      await playPcm(buf, TTS_SAMPLE_RATE);
    } catch {}
  }, []);

  // swap models into Hunt mode (VLM) when this tab is focused; release the VLM
  // when leaving (NativeTabs keep screens mounted, so focus — not mount — is the
  // right lifecycle to avoid the VLM lingering co-resident with reading models).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setFocused(true);
      setReady(false);
      setStatus("Loading the picture brain…");
      (async () => {
        try {
          await ModelManager.enterHunt();
          if (alive) {
            setReady(true);
            setStatus(`Find a ${targets[0]}!`);
            speak(targets[0]);
          }
        } catch {
          if (alive) setStatus("Couldn't load the picture brain.");
        }
      })();
      return () => {
        alive = false;
        setFocused(false);
        stopPcm();
        ModelManager.leaveHunt().catch(() => {});
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const target = targets[active];
  const allDone = found.size >= targets.length;

  // new round: 3 fresh objects, reset, announce the first
  function refreshRound() {
    const next = sampleTargets(targets);
    setTargets(next);
    setFound(new Set());
    setActive(0);
    setStatus(`Find a ${next[0]}!`);
    if (ready) speak(next[0]);
  }

  async function snap() {
    if (busy || !ready || allDone) return;
    setBusy(true);
    setStatus(`Looking for a ${target}…`);
    let photoUri: string | undefined;
    try {
      const photo = await camRef.current?.takePictureAsync({ quality: 0.5, skipProcessing: true });
      if (!photo?.uri) throw new Error("no photo");
      photoUri = photo.uri; // app-private cache file — never leaves the device
      const vlm = ModelManager.vlmId();
      if (!vlm) throw new Error("vlm not loaded");
      const t0 = Date.now();
      const run = completion({
        modelId: vlm, stream: false,
        history: [{ role: "user", content: huntPrompt(), attachments: [{ path: photoUri.replace("file://", "") }] }],
      });
      const answer = (await run.text).toLowerCase();
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (matchesTarget(answer, target)) {
        const next = new Set(found); next.add(target); setFound(next);
        const remaining = targets.findIndex((t) => !next.has(t));
        if (remaining === -1) setStatus(`You found everything! 🎉 (${secs}s)`);
        else {
          setActive(remaining);
          setStatus(`Yes! Found a ${target} ✓ (${secs}s). Now find a ${targets[remaining]}!`);
          speak(targets[remaining]);
        }
      } else {
        setStatus(`No ${target} yet — keep looking! (${secs}s)`);
      }
    } catch {
      setStatus("Hmm, try again.");
    } finally {
      // privacy: delete the captured photo immediately after inference
      if (photoUri) { try { new File(photoUri).delete(); } catch {} }
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingHorizontal: 26, paddingBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Circ icon="back" label="Play" onPress={() => router.navigate("/activities")} />
          <Pill icon="lock">Parents</Pill>
        </View>
        <MuteButton silent={silent} onToggle={toggleSilent} />
      </View>

      <View style={{ flex: 1, flexDirection: "row", gap: 22, paddingHorizontal: 40, paddingTop: 8, paddingBottom: 30 }}>
        {/* left: camera viewfinder */}
        <View style={{ flex: 1.35, borderRadius: 22, overflow: "hidden", backgroundColor: "#1c2630", boxShadow: SHADOW.card }}>
          {perm?.granted && focused ? (
            // unmounted entirely when unfocused — mounting alone can claim the
            // single iOS camera session even when paused
            <CameraView ref={camRef} style={{ flex: 1 }} facing="back" active />
          ) : perm?.granted ? (
            <View style={{ flex: 1, backgroundColor: "#11181d" }} />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 30 }}>
              <Icon name="search" size={48} color="#e7d8b8" />
              <Text style={{ fontFamily: F.body, fontSize: 17, color: "#e7d8b8", textAlign: "center" }}>
                Let TaleTrip use the camera to play the hunt. Nothing leaves the iPad.
              </Text>
              <Btn variant="accent" title="Allow camera" onPress={requestPerm} />
            </View>
          )}
          {/* status banner */}
          <View style={{ position: "absolute", left: 16, right: 16, bottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: "rgba(20,28,36,0.78)", borderRadius: 16, paddingVertical: 12, paddingHorizontal: 18 }}>
            <Text style={{ flex: 1, fontFamily: F.bodyMed, fontSize: 17, color: "#fdf4e6" }}>{status}</Text>
            {perm?.granted ? (
              <Pressable
                onPress={snap}
                disabled={busy || !ready || allDone}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: busy || !ready ? "#7c5a48" : C.accent, opacity: allDone ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
              >
                <Icon name="search" size={20} color="#fff" />
                <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 20, color: "#fff" }}>{busy ? "Looking…" : "Snap"}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* right: targets checklist */}
        <View style={{ width: 300, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <ProgressRing found={found.size} total={targets.length} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 30, color: C.ink }}>Hunt</Text>
              <Text style={{ fontFamily: F.body, fontSize: 14, color: C.inkSoft }}>Find them with the camera</Text>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            {targets.map((t) => {
              const got = found.has(t);
              const isActive = t === target && !got;
              return (
                <Pressable
                  key={t}
                  onPress={() => {
                    if (got) return;
                    setActive(targets.indexOf(t));
                    speak(t); // tap a word to hear it — for kids who can't read yet
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: C.card, boxShadow: isActive ? `${SHADOW.soft}, 0 0 0 2px ${C.accent}` : SHADOW.soft, opacity: got ? 0.7 : 1 }}
                >
                  <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: got ? C.olive : C.cardInset }}>
                    {got ? <Icon name="check" size={18} color="#fff" sw={2.4} /> : <Icon name="search" size={16} color={C.inkFaint} />}
                  </View>
                  <Text style={{ flex: 1, fontFamily: F.bodyMed, fontSize: 18, color: C.ink, textDecorationLine: got ? "line-through" : "none" }}>{cap(t)}</Text>
                  {!got ? <Icon name="audio" size={18} color={C.inkFaint} /> : null}
                </Pressable>
              );
            })}
          </View>

          {allDone ? (
            <View style={{ marginTop: "auto", backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12, boxShadow: SHADOW.soft }}>
              <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 24, color: C.olive }}>All found! 🎉</Text>
              <Text style={{ fontFamily: F.body, fontSize: 15, color: C.inkSoft }}>Great looking, explorer.</Text>
              <Btn variant="accent" icon="refresh" fontSize={20} title="Play again" onPress={refreshRound} style={{ justifyContent: "center" }} />
            </View>
          ) : (
            <Pressable onPress={refreshRound} style={{ marginTop: "auto", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 }}>
              <Icon name="refresh" size={16} color={C.inkFaint} />
              <Text style={{ fontFamily: F.body, fontSize: 14, color: C.inkFaint }}>New things to find</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
