import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ModelManager } from '@/models/model-manager';
import { useTaleFonts } from '@/ui/fonts';

// 冷启动进 Kid 封面 Home（→ Start Story → Reader）。
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
  useTaleFonts(); // load Cormorant Garamond + Lora (FOUT-tolerant; reader uses them)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { if (s === "background") ModelManager.unloadAll(); });
    return () => sub.remove();
  }, []);
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
