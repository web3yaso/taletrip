// src/app/index.tsx
// TaleTrip Kid · Home / Cover — faithful to the Claude Design mockup.
// (Replaces the earlier on-device diffusion experiment.)
import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Btn, MuteButton, StatusChips } from "@/ui/chrome";
import { Pill } from "@/ui/chrome";
import { Mosaic } from "@/ui/mosaic";
import { C, F } from "@/ui/tokens";

export default function Home() {
  const router = useRouter();
  const [silent, setSilent] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      {/* faceted Barcelona wash + warm paper overlay */}
      <Mosaic kind="facets" w={1180} h={820} cols={11} rows={8} jitter={0.5} palette="sky" seed={21} opacity={0.9} style={{ position: "absolute", inset: 0 }} />
      <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(247,238,216,0.5)" }} />

      {/* top bar */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingHorizontal: 26, paddingBottom: 6 }}>
        <Pill icon="lock">Parents</Pill>
        <MuteButton silent={silent} onToggle={() => setSilent((s) => !s)} />
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
            title="Play & Color"
            iconRight="fwd"
            onPress={() => router.navigate("/reader")}
            style={{ width: 380, marginTop: 14, justifyContent: "space-between" }}
          />
        </View>
      </View>
    </View>
  );
}
