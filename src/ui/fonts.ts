// src/ui/fonts.ts
// Load the design's serif faces (Cormorant Garamond display + Lora body) at
// runtime via expo-font. No native rebuild needed for the fonts themselves —
// @expo-google-fonts packages ship the TTFs and expo-font loads them.
import { useFonts } from "expo-font";
import {
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
  CormorantGaramond_500Medium_Italic,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Lora_400Regular,
  Lora_500Medium,
  Lora_600SemiBold,
} from "@expo-google-fonts/lora";

export function useTaleFonts(): boolean {
  const [loaded] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    CormorantGaramond_500Medium_Italic,
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
  });
  return loaded;
}
