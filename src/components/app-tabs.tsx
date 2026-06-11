import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

// TaleTrip Kid app — bottom tabs. Home cover + the activity sections + the P2P
// "Get a book" receiver. SF Symbols keep the bar crisp on iPad.
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="reader">
        <NativeTabs.Trigger.Label>Read</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="book.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="activities">
        <NativeTabs.Trigger.Label>Play</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="hunt">
        <NativeTabs.Trigger.Label>Hunt</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="binoculars.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="camera">
        <NativeTabs.Trigger.Label>Camera</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="camera.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="p2p">
        <NativeTabs.Trigger.Label>Get a book</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="qrcode.viewfinder" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
