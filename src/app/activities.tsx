// src/app/activities.tsx
// TaleTrip Kid · Activities hub — a 2x2 launcher (Read / Color / Hunt / Words),
// faithful to the Claude Design mockup. Each tile routes to a section.
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { MuteButton, Pill } from "@/ui/chrome";
import { Icon } from "@/ui/icon";
import { Mosaic } from "@/ui/mosaic";
import { useMuted } from "@/reading/mute";
import { C, F, SHADOW, type Mood } from "@/ui/tokens";

type Tile = { title: string; subtitle: string; icon: string; href: Href; mood: Mood; seed: number; iconFill?: boolean };

const TILES: Tile[] = [
  { title: "Read a story", subtitle: "Tap the colored words", icon: "book", href: "/reader", mood: "sky", seed: 12 },
  { title: "Get a book", subtitle: "Scan a grown-up's code", icon: "download", href: "/p2p", mood: "earth", seed: 31 },
  { title: "Scavenger hunt", subtitle: "Find it with the camera", icon: "search", href: "/hunt", mood: "garden", seed: 47 },
  { title: "Photo story", subtitle: "Snap photos, make a tale", icon: "camera", href: "/camera", mood: "sea", seed: 63 },
];

function TileCard({ tile }: { tile: Tile }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate(tile.href)}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: 22,
        overflow: "hidden",
        backgroundColor: C.card,
        boxShadow: SHADOW.card,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View style={{ height: 132, overflow: "hidden" }}>
        <Mosaic kind="facets" w={520} h={150} cols={7} rows={2} jitter={0.55} palette={tile.mood} seed={tile.seed} style={{ position: "absolute", inset: 0 }} />
        <View style={{ position: "absolute", left: 16, bottom: 14, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: C.card, boxShadow: SHADOW.soft }}>
          <Icon name={tile.icon} size={26} color={C.accentD} fill={tile.iconFill} />
        </View>
      </View>
      <View style={{ padding: 18, gap: 4 }}>
        <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 28, color: C.ink }}>{tile.title}</Text>
        <Text style={{ fontFamily: F.body, fontSize: 15, color: C.inkSoft }}>{tile.subtitle}</Text>
      </View>
    </Pressable>
  );
}

export default function Activities() {
  const [silent, toggleSilent] = useMuted();
  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <Mosaic kind="facets" w={1180} h={820} cols={11} rows={8} jitter={0.5} palette="muted" seed={9} opacity={0.5} style={{ position: "absolute", inset: 0 }} />
      <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(247,238,216,0.6)" }} />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingHorizontal: 26, paddingBottom: 4 }}>
        <Pill icon="lock">Parents</Pill>
        <MuteButton silent={silent} onToggle={toggleSilent} />
      </View>

      <View style={{ paddingHorizontal: 40, paddingTop: 6 }}>
        <Text style={{ fontFamily: F.display, fontWeight: "600", fontSize: 40, color: C.ink }}>Activities</Text>
        <Text style={{ fontFamily: F.displayItalic, fontSize: 21, color: C.accentD }}>Pick something to play</Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 40, paddingTop: 16, paddingBottom: 34, gap: 18 }}>
        <View style={{ flex: 1, flexDirection: "row", gap: 18 }}>
          <TileCard tile={TILES[0]} />
          <TileCard tile={TILES[1]} />
        </View>
        <View style={{ flex: 1, flexDirection: "row", gap: 18 }}>
          <TileCard tile={TILES[2]} />
          <TileCard tile={TILES[3]} />
        </View>
      </View>
    </View>
  );
}
