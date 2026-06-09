# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Critical version note

This is **Expo SDK 56** with **React 19.2** and **React Native 0.85**. Expo's APIs changed substantially in recent SDKs — consult the versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing or changing any Expo/React Native code. Do not rely on patterns from older SDKs.

## Commands

```bash
npm start          # Start Metro / Expo dev server (press i, a, w to open targets)
npm run ios        # Build & run the native iOS app (expo run:ios)
npm run android    # Build & run the native Android app (expo run:android)
npm run web        # Run in the browser (expo start --web)
npm run lint       # Lint via expo lint (ESLint)
npm run reset-project   # Move starter code aside and scaffold a blank app/ dir
```

There is no test runner configured. Type-check with `npx tsc --noEmit` (strict mode is on).

## Architecture

Expo Router app using **file-based routing**. Routes live in `src/app/` (not the default `app/`); the entry point is `expo-router/entry` (see `package.json` `main`). `typedRoutes` and React Compiler are enabled in `app.json`, so route hrefs are type-checked and components must follow Rules of Hooks strictly.

- **`src/app/_layout.tsx`** — root layout. Wraps the app in `ThemeProvider` (light/dark) and renders `AnimatedSplashOverlay` + `AppTabs`. Each file in `src/app/` is a tab route (`index.tsx` → Home, `explore.tsx` → Explore).
- **`src/components/`** — shared UI. `Themed*` components read colors from the active theme.
- **`src/constants/theme.ts`** — single source of design tokens: `Colors` (light/dark), `Fonts` (platform-selected), `Spacing` (use `Spacing.one`…`Spacing.six`, never raw pixels), plus `BottomTabInset` and `MaxContentWidth`.
- **`src/hooks/`** — `use-theme` resolves the current `Colors` set; `use-color-scheme` has a web variant that defers to `'light'` until hydration for static rendering.

### Platform-specific files

The codebase relies on Metro's platform-extension resolution. A module can have `.tsx` (native), `.web.tsx` (web), and `.module.css` (web styling) variants — Metro picks the right one at build time. Key examples:

- `app-tabs.tsx` uses native `NativeTabs` (`expo-router/unstable-native-tabs`); `app-tabs.web.tsx` builds a custom top tab bar with `expo-router/ui`.
- `animated-icon.tsx` vs `animated-icon.web.tsx` / `animated-icon.module.css`.

When adding a component with native and web behavior, follow this split rather than branching on `Platform.OS` inside one file (small inline branches via `Platform.select`/`Platform.OS` are still used for minor differences, e.g. in `theme.ts` and `themed-text.tsx`).

### Theming conventions

Never hardcode colors or spacing. Use `ThemedText` (`type` for typography variant, `themeColor` for color) and `ThemedView` (`type` selects a background token). Web fonts come from CSS variables defined in `src/global.css` (imported by `theme.ts`); native uses the platform system fonts via `Fonts`.

## Imports

Path aliases (`tsconfig.json`): `@/*` → `src/*`, `@/assets/*` → `assets/*`. Use these instead of relative paths. VS Code is configured to auto-fix, organize, and sort imports on save.

## Native projects

`ios/` and `android/` are generated and git-ignored — treat them as build output. Configure native behavior through `app.json` (plugins, icons, splash, bundle identifiers) and regenerate, rather than hand-editing native files.
