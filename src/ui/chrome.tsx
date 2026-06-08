// src/ui/chrome.tsx
// Shared TaleTrip chrome — Card, Pill, Circ button, Btn, MuteButton, StatusChips.
// Ported from the design bundle (taletrip.css + ui.jsx) to RN primitives.
import type { ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { Icon } from "./icon";
import { C, F, SHADOW } from "./tokens";

const ring = (shadow: string, line = C.hairline) => `${shadow}, 0 0 0 1px ${line}`;

export function Card({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: C.card, borderRadius: 20, boxShadow: SHADOW.card } as ViewStyle, style]}>
      {children}
    </View>
  );
}

export function Pill({
  children,
  icon,
  iconColor = C.ink,
  color = C.inkSoft,
  style,
}: {
  children?: ReactNode;
  icon?: string;
  iconColor?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 9,
          paddingHorizontal: 16,
          borderRadius: 999,
          backgroundColor: C.card,
          boxShadow: ring(SHADOW.soft),
        } as ViewStyle,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={iconColor} /> : null}
      {typeof children === "string" ? (
        <Text style={{ fontFamily: F.body, fontSize: 15, color }}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export function Circ({
  icon,
  onPress,
  label,
  dark = false,
  size = 54,
  iconSize = 24,
  style,
}: {
  icon: string;
  onPress?: () => void;
  label?: string;
  dark?: boolean;
  size?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: dark ? C.navyBtn : C.card,
          boxShadow: ring(SHADOW.soft),
          transform: [{ scale: pressed ? 0.97 : 1 }],
        } as ViewStyle,
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={dark ? "#f3e7cf" : C.ink} />
    </Pressable>
  );
}

type BtnVariant = "primary" | "secondary" | "accent";
const BTN_BG: Record<BtnVariant, string> = { primary: C.navyBtn, secondary: C.card, accent: C.accent };
const BTN_FG: Record<BtnVariant, string> = { primary: "#f6ecd6", secondary: C.ink, accent: "#fdf4e6" };

export function Btn({
  title,
  onPress,
  variant = "primary",
  icon,
  iconRight,
  iconFill = false,
  fontSize = 25,
  style,
  textStyle,
  children,
}: {
  title?: string;
  onPress?: () => void;
  variant?: BtnVariant;
  icon?: string;
  iconRight?: string;
  iconFill?: boolean;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: ReactNode;
}) {
  const fg = BTN_FG[variant];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderRadius: 18,
          paddingVertical: 16,
          paddingHorizontal: 24,
          backgroundColor: BTN_BG[variant],
          boxShadow: variant === "secondary" ? SHADOW.card : SHADOW.soft,
          transform: [{ translateY: pressed ? 0 : 0 }, { scale: pressed ? 0.99 : 1 }],
        } as ViewStyle,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={fontSize - 1} color={fg} fill={iconFill} /> : null}
      {children ??
        (title ? (
          <Text style={[{ fontFamily: F.display, fontSize, fontWeight: "600", color: fg }, textStyle]}>{title}</Text>
        ) : null)}
      {iconRight ? <Icon name={iconRight} size={fontSize - 3} color={fg} /> : null}
    </Pressable>
  );
}

export function MuteButton({
  silent,
  onToggle,
  compact = false,
}: {
  silent: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={silent ? "Sound is off" : "Sound is on"}
      onPress={onToggle}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 999,
        paddingVertical: 10,
        paddingLeft: compact ? 9 : 12,
        paddingRight: compact ? 9 : 18,
        backgroundColor: silent ? C.accent : C.card,
        boxShadow: silent ? SHADOW.soft : ring(SHADOW.soft),
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: silent ? "rgba(255,255,255,0.22)" : C.cardInset,
        }}
      >
        <Icon name={silent ? "mute" : "audio"} size={22} color={silent ? "#fdf4e6" : C.ink} />
      </View>
      {!compact && (
        <Text style={{ fontFamily: F.display, fontSize: 20, fontWeight: "600", color: silent ? "#fdf4e6" : C.ink }}>
          {silent ? "Sound off" : "Sound on"}
        </Text>
      )}
    </Pressable>
  );
}

export function StatusChips({ silent }: { silent: boolean }) {
  return (
    <View style={{ gap: 8, alignItems: "flex-start" }}>
      <Pill icon="wifiOff" iconColor={C.ink}>
        No Internet · 100% Offline
      </Pill>
      {silent ? (
        <Pill icon="headphones" iconColor={C.accent} color={C.accent}>
          Silent Mode on
        </Pill>
      ) : null}
    </View>
  );
}
