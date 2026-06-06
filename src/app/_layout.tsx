import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ModelManager } from '@/models/model-manager';

// 快速启动入口：dev 构建（dev-client / Expo Go）冷启动直接落在 Bench 跑测页，
// 省去每次冷启动手动切 tab；release 构建仍正常开 Home。Home/Explore 两个 tab 照常可点。
// 注：改回只需把下面这行删掉（或把 initialRouteName 改回 'index'）。
export const unstable_settings = {
  initialRouteName: __DEV__ ? 'bench' : 'index',
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
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
