// src/storypack/packs/lisbon-mia.ts
// The Studio-generated "Mia's trip to Lisbon" pack, bundled as an app asset and
// adapted into the Reader view model. (Generated on the Mac by
// studio/generate-storypack.mjs; bundled here to close the loop without P2P yet.)
import type { ImageSourcePropType } from "react-native";
import { adaptPack } from "../adapter";
import type { StoryPack } from "../types";

const packJson = require("@/assets/packs/lisbon-mia/storypack.json") as StoryPack;

const images: ImageSourcePropType[] = [
  require("@/assets/packs/lisbon-mia/p0.png"),
  require("@/assets/packs/lisbon-mia/p1.png"),
  require("@/assets/packs/lisbon-mia/p2.png"),
  require("@/assets/packs/lisbon-mia/p3.png"),
  require("@/assets/packs/lisbon-mia/p4.png"),
];

export const LISBON_MIA = adaptPack(packJson, images);
