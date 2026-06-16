// src/app/(play)/_layout.tsx
// The "Play" tab is a hub: its index (activities) launches Scavenger Hunt and
// Photo story, which live here as pushable stack screens (NOT separate bottom
// tabs). Each screen renders its own full-bleed chrome, so no native header.
import { Stack } from "expo-router";

// Tapping the Play tab always lands on the activities hub.
export const unstable_settings = { initialRouteName: "activities" };

export default function PlayLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="activities" />
      <Stack.Screen name="hunt" />
      <Stack.Screen name="camera" />
    </Stack>
  );
}
