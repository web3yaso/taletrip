// src/app/index.tsx
// TaleTrip Kid · Home / Cover — faithful to the Claude Design mockup.
// "Parents" opens the family-profile form (the private half of the on-device RAG).
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { loadProfile, saveProfile, type FamilyProfile } from "@/family/profile";
import { Btn, MuteButton, StatusChips } from "@/ui/chrome";
import { Pill } from "@/ui/chrome";
import { Mosaic } from "@/ui/mosaic";
import { useMuted } from "@/reading/mute";
import { C, F, SHADOW } from "@/ui/tokens";

const field = { fontFamily: F.body, fontSize: 17, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.hairline2, backgroundColor: "#fff", color: C.ink } as const;

export default function Home() {
  const router = useRouter();
  const [silent, toggleSilent] = useMuted();
  const [parents, setParents] = useState(false);
  const [p, setP] = useState<FamilyProfile>(() => loadProfile());

  const set = (patch: Partial<FamilyProfile>) => setP((cur) => ({ ...cur, ...patch }));

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      {/* faceted Barcelona wash + warm paper overlay */}
      <Mosaic kind="facets" w={1180} h={820} cols={11} rows={8} jitter={0.5} palette="sky" seed={21} opacity={0.9} style={{ position: "absolute", inset: 0 }} />
      <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(247,238,216,0.5)" }} />

      {/* top bar */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingHorizontal: 26, paddingBottom: 6 }}>
        <Pressable onPress={() => { setP(loadProfile()); setParents(true); }}>
          <Pill icon="lock">Parents</Pill>
        </Pressable>
        <MuteButton silent={silent} onToggle={toggleSilent} />
      </View>

      {/* hero + title */}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 30, paddingLeft: 52, paddingRight: 46, paddingBottom: 30 }}>
        {/* left: hero art slot */}
        <View style={{ flex: 1.15, height: "100%", justifyContent: "flex-end", paddingBottom: 38 }}>
          <View style={{ position: "absolute", top: 8, left: 0, right: 0, bottom: 0, borderRadius: 18, overflow: "hidden" }}>
            <Mosaic kind="facets" w={520} h={620} cols={6} rows={8} jitter={0.55} palette="mixed" seed={42} style={{ position: "absolute", inset: 0 }} />
          </View>
          <View style={{ alignSelf: "flex-start" }}>
            <StatusChips silent={silent} />
          </View>
        </View>

        {/* right: wordmark + actions */}
        <View style={{ flex: 0.95, gap: 6 }}>
          <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 88, lineHeight: 86, color: C.ink }}>
            Tale<Text style={{ color: C.accent }}>Trip</Text>
          </Text>
          <Text style={{ fontFamily: F.displayItalic, fontSize: 27, color: C.accentD, marginTop: 6 }}>
            A little journey to Barcelona
          </Text>
          <View style={{ width: 120, borderTopWidth: 2, borderColor: C.hairline2, borderStyle: "dotted", marginTop: 10, marginBottom: 26 }} />

          <Btn
            variant="primary"
            icon="book"
            title="Start Story"
            iconRight="fwd"
            onPress={() => router.navigate("/reader")}
            style={{ width: 380, justifyContent: "space-between" }}
          />
          <Btn
            variant="secondary"
            icon="star"
            iconFill
            title="Play & Explore"
            iconRight="fwd"
            onPress={() => router.navigate("/activities")}
            style={{ width: 380, marginTop: 14, justifyContent: "space-between" }}
          />
          <Btn
            variant="secondary"
            icon="camera"
            title="Make a Photo Story"
            iconRight="fwd"
            onPress={() => router.navigate("/camera")}
            style={{ width: 380, marginTop: 14, justifyContent: "space-between" }}
          />
        </View>
      </View>

      {/* Parents overlay — family profile = the private half of on-device RAG */}
      {parents ? (
        <Pressable onPress={() => setParents(false)} style={{ position: "absolute", inset: 0, zIndex: 30, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(28,42,56,0.5)" }}>
          <Pressable onPress={() => {}} style={{ width: 520, maxWidth: "88%", backgroundColor: C.card, borderRadius: 26, padding: 26, gap: 12, boxShadow: SHADOW.pop }}>
            <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 26, color: C.ink }}>About your child</Text>
            <Text style={{ fontFamily: F.body, fontSize: 14, color: C.inkSoft, marginTop: -6 }}>
              Used to personalize stories on this iPad. Stays on the device — never uploaded.
            </Text>
            <TextInput style={field} placeholder="Child's name" value={p.childName} onChangeText={(v) => set({ childName: v })} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[field, { flex: 1 }]}
                placeholder="Age"
                keyboardType="number-pad"
                value={p.age ? String(p.age) : ""}
                onChangeText={(v) => set({ age: Number(v.replace(/\D/g, "")) || null })}
              />
              <View style={{ flex: 2, flexDirection: "row", gap: 8 }}>
                {(["girl", "boy", ""] as const).map((g) => (
                  <Pressable
                    key={g || "none"}
                    onPress={() => set({ gender: g })}
                    style={{ flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingVertical: 12, backgroundColor: p.gender === g ? C.accent : C.cardInset }}
                  >
                    <Text style={{ fontFamily: F.bodySemi, fontSize: 15, color: p.gender === g ? "#fff" : C.inkSoft }}>{g === "" ? "—" : g}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <TextInput style={field} placeholder="Hobbies (e.g. dinosaurs, drawing)" value={p.hobbies} onChangeText={(v) => set({ hobbies: v })} />
            <Btn variant="primary" fontSize={20} title="Save" onPress={() => { saveProfile(p); setParents(false); }} style={{ justifyContent: "center", marginTop: 4 }} />
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}
