// src/app/coloring.tsx
// TaleTrip Kid · Coloring — printable flat line-art (landmarks & local food),
// SD-generated on the parent's Mac and delivered in the StoryPack. Per the design
// this is a PRINT preview (a grown-up prints it; kids color on paper, no screen).
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { File } from "expo-file-system";
import * as Print from "expo-print";
import { listPacks, loadColoring, type ColoringView } from "@/storypack/store";
import { MuteButton, Pill } from "@/ui/chrome";
import { Icon } from "@/ui/icon";
import { useMuted } from "@/reading/mute";
import { C, F, SHADOW } from "@/ui/tokens";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1] ?? 0, b2 = bytes[i + 2] ?? 0;
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "=";
  }
  return out;
}

function printPages(items: ColoringView[]) {
  const sheets = items
    .map((it) => {
      const b64 = toBase64(new File(it.uri).bytesSync());
      return `<div style="page-break-after:always;text-align:center;padding:24px 0">
        <div style="font:600 22px Georgia,serif;color:#294a63;margin-bottom:10px">Color me — ${it.name}</div>
        <img src="data:image/png;base64,${b64}" style="width:88%;border:2px dashed #bbb;border-radius:12px"/>
        <div style="font:12px Georgia,serif;color:#999;margin-top:8px;letter-spacing:2px">TALETRIP</div>
      </div>`;
    })
    .join("");
  return Print.printAsync({ html: `<html><body style="margin:0">${sheets}</body></html>` });
}

export default function Coloring() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [silent, toggleSilent] = useMuted();
  const [cat, setCat] = useState<"nature" | "food">("nature");
  const [sel, setSel] = useState(0);

  // resolve the coloring pages: explicit id, else the pack with the MOST pages of
  // the current kinds (so a freshly-received book wins over older/legacy ones).
  const all = useMemo<ColoringView[]>(() => {
    const ok = (c: ColoringView) => c.kind === "nature" || c.kind === "food";
    if (id) return loadColoring(id).filter(ok);
    let best: ColoringView[] = [];
    for (const p of listPacks()) {
      const c = loadColoring(p.id).filter(ok);
      if (c.length > best.length) best = c;
    }
    return best;
  }, [id]);

  // show a category that actually has pages (avoid a blank tab on open)
  const effectiveCat = all.some((c) => c.kind === cat) ? cat : all.some((c) => c.kind === "nature") ? "nature" : "food";
  const items = all.filter((c) => c.kind === effectiveCat);
  const current = items[Math.min(sel, Math.max(0, items.length - 1))];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingHorizontal: 26, paddingBottom: 4 }}>
        <Pill icon="lock">Parents</Pill>
        <MuteButton silent={silent} onToggle={toggleSilent} />
      </View>

      <View style={{ paddingHorizontal: 40 }}>
        <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 40, color: C.ink }}>Coloring pages</Text>
        <Text style={{ fontFamily: F.displayItalic, fontSize: 20, color: C.accentD }}>A grown-up prints these — color them on paper</Text>
      </View>

      {all.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 60 }}>
          <Icon name="palette" size={54} color={C.inkFaint} fill />
          <Text style={{ fontFamily: F.body, fontSize: 18, color: C.inkSoft, textAlign: "center", marginTop: 14 }}>
            No coloring pages yet. Ask a grown-up to send a new book — the animals, plants and food of your trip will appear here to print.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: "row", gap: 22, paddingHorizontal: 40, paddingTop: 16, paddingBottom: 30 }}>
          {/* left: the printable sheet */}
          <View style={{ flex: 1.3, backgroundColor: "#fff", borderRadius: 18, boxShadow: SHADOW.card, padding: 16, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 22, color: C.ink, marginBottom: 8 }}>
              Color me — {current?.name}
            </Text>
            <View style={{ flex: 1, alignSelf: "stretch", borderWidth: 2, borderColor: "#ddd", borderStyle: "dashed", borderRadius: 12, overflow: "hidden" }}>
              {current ? <Image source={{ uri: current.uri }} resizeMode="contain" style={{ flex: 1, width: "100%" }} /> : null}
            </View>
            <Text style={{ fontFamily: F.body, fontSize: 11, color: "#bbb", letterSpacing: 3, marginTop: 8 }}>TALETRIP</Text>
          </View>

          {/* right rail: Places/Food toggle + pickers + print */}
          <View style={{ width: 300, gap: 14 }}>
            <View style={{ flexDirection: "row", gap: 8, padding: 5, backgroundColor: C.cardInset, borderRadius: 999 }}>
              {(["nature", "food"] as const).map((k) => (
                <Pressable
                  key={k}
                  onPress={() => { setCat(k); setSel(0); }}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center", backgroundColor: effectiveCat === k ? C.card : "transparent", boxShadow: effectiveCat === k ? SHADOW.soft : undefined }}
                >
                  <Text style={{ fontFamily: F.bodySemi, fontSize: 15, color: effectiveCat === k ? C.ink : C.inkFaint }}>{k === "nature" ? "Animals & plants" : "Food"}</Text>
                </Pressable>
              ))}
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10 }}>
              {items.map((it, i) => {
                const active = it === current;
                return (
                  <Pressable
                    key={it.uri}
                    onPress={() => setSel(i)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 8, borderRadius: 14, backgroundColor: C.card, boxShadow: active ? `${SHADOW.soft}, 0 0 0 2px ${C.accent}` : SHADOW.soft }}
                  >
                    <Image source={{ uri: it.uri }} resizeMode="cover" style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: "#fff" }} />
                    <Text style={{ flex: 1, fontFamily: F.bodyMed, fontSize: 16, color: C.ink }} numberOfLines={2}>{it.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => current && printPages([current]).catch(() => {})}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, paddingVertical: 15, backgroundColor: C.navyBtn, boxShadow: SHADOW.soft, transform: [{ scale: pressed ? 0.99 : 1 }] })}
            >
              <Icon name="download" size={22} color="#f6ecd6" />
              <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 21, color: "#f6ecd6" }}>Print this page</Text>
            </Pressable>
            <Pressable onPress={() => items.length && printPages(items).catch(() => {})}>
              <Text style={{ fontFamily: F.body, fontSize: 14, color: C.inkSoft, textAlign: "center" }}>Print all {items.length}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
