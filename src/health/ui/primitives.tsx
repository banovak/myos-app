// Small building blocks that mirror the web app's CSS classes: card, row,
// pill, chip, buttons, section labels, donut, empty states.
import type { ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useHealth } from "../state/HealthContext";
import { SHADOW, type Tokens } from "../theme";
import { Icon } from "./Icon";

export const useT = (): Tokens => useHealth().t;

export function Card(props: { children: ReactNode; style?: StyleProp<ViewStyle>; tinted?: boolean }) {
  const t = useT();
  return <View style={[s.card, { backgroundColor: props.tinted ? t.accentSoft : t.card }, props.tinted ? null : SHADOW, props.style]}>{props.children}</View>;
}
export function CardH(props: { title: ReactNode; sub?: ReactNode; right?: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const title = typeof props.title === "string" ? (
    props.onPress ? (
      <Pressable onPress={props.onPress} style={s.wlink} accessibilityRole="link">
        <Text style={[s.h2, { color: t.ink, fontFamily: t.fontUIBold }]}>{props.title}</Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>↗</Text>
      </Pressable>
    ) : <Text style={[s.h2, { color: t.ink, fontFamily: t.fontUIBold }]}>{props.title}</Text>
  ) : props.title;
  return (
    <View style={[s.cardH, props.style]}>
      <View style={{ flexGrow: 1, flexShrink: 0, minWidth: 0, maxWidth: "70%" }}>{title}</View>
      {props.sub ? (typeof props.sub === "string" ? <Text style={[s.sub, { color: t.muted, fontFamily: t.fontUI }]} numberOfLines={2}>{props.sub}</Text> : props.sub) : null}
      {props.right}
    </View>
  );
}
export function H1(props: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useT();
  return <Text style={[s.h1, { color: t.ink, fontFamily: t.fontUIHeavy }, props.style]}>{props.children}</Text>;
}
export function Sub(props: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useT();
  return <Text style={[{ fontSize: 13, color: t.muted, fontFamily: t.fontUI }, props.style]}>{props.children}</Text>;
}
export function PageH(props: { title: string; sub?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <View style={s.pageH}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}><H1>{props.title}</H1>{props.children}</View>
        {props.sub ? (typeof props.sub === "string" ? <Sub>{props.sub}</Sub> : props.sub) : null}
      </View>
      {props.right}
    </View>
  );
}
export function Row(props: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; selected?: boolean; plain?: boolean; label?: string }) {
  const t = useT();
  const style = [s.row, { backgroundColor: props.plain ? "transparent" : t.soft }, props.selected && { borderWidth: 2, borderColor: t.ink }, props.style];
  if (props.onPress) return <Pressable onPress={props.onPress} style={style} accessibilityRole="button" accessibilityLabel={props.label}>{props.children}</Pressable>;
  return <View style={style}>{props.children}</View>;
}
export function RowText(props: { title: ReactNode; sub?: ReactNode; style?: StyleProp<ViewStyle>; titleStyle?: StyleProp<TextStyle> }) {
  const t = useT();
  return (
    <View style={[{ flex: 1, minWidth: 0 }, props.style]}>
      {typeof props.title === "string" ? <Text style={[s.rowT, { color: t.ink, fontFamily: t.fontUIBold }, props.titleStyle]}>{props.title}</Text> : props.title}
      {props.sub ? (typeof props.sub === "string" ? <Text style={[s.rowS, { color: t.muted, fontFamily: t.fontUI }]}>{props.sub}</Text> : props.sub) : null}
    </View>
  );
}
export function Pill(props: { children: ReactNode; kind?: "up" | "mut" | "src" | "flag" | "" }) {
  const t = useT();
  const k = props.kind || "";
  const bg = k === "up" ? t.accent : k === "flag" ? t.darkC : k === "src" ? "transparent" : t.soft;
  const col = k === "up" ? t.onAccent : k === "flag" ? t.onDark : k === "mut" || k === "src" ? t.muted : t.ink;
  return (
    <View style={[s.pill, { backgroundColor: bg }, k === "src" && { borderWidth: 1, borderColor: t.line }]}>
      <Text style={{ fontSize: 11, fontFamily: t.fontUIBold, color: col }}>{props.children}</Text>
    </View>
  );
}
export function Chip(props: { label: string; on?: boolean; onPress?: () => void; dot?: string; small?: boolean }) {
  const t = useT();
  return (
    <Pressable onPress={props.onPress} style={[s.chip, { borderColor: props.on ? t.darkC : t.line, backgroundColor: props.on ? t.darkC : t.card }, props.small && { paddingVertical: 3, paddingHorizontal: 9 }]} accessibilityRole="button" accessibilityState={{ selected: !!props.on }}>
      {props.dot ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: props.dot }} /> : null}
      <Text style={{ fontSize: props.small ? 11.5 : 12, fontFamily: t.fontUISemi, color: props.on ? t.onDark : t.ink }}>{props.label}</Text>
    </Pressable>
  );
}
export function Chips(props: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.chips, props.style]}>{props.children}</View>;
}
export function Btn(props: { label: string; onPress?: () => void; kind?: "accent" | "ghost" | "dark"; small?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; left?: ReactNode }) {
  const t = useT();
  const k = props.kind || "ghost";
  const bg = k === "accent" ? t.accent : k === "dark" ? t.darkC : t.card;
  const col = k === "accent" ? t.onAccent : k === "dark" ? t.onDark : t.ink;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={[s.btn, { backgroundColor: bg }, k === "ghost" && { borderWidth: 1, borderColor: t.line }, props.small && s.btnSm, props.disabled && { opacity: 0.5 }, props.style]}
      accessibilityRole="button"
    >
      {props.left}
      <Text style={{ color: col, fontFamily: t.fontUIBold, fontSize: props.small ? 12 : 14 }}>{props.label}</Text>
    </Pressable>
  );
}
export function Sec(props: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return <Text style={[s.sec, { color: t.muted, fontFamily: t.fontUIBold }, props.style as any]}>{props.children}</Text>;
}
export function Empty(props: { children: ReactNode }) {
  const t = useT();
  return <Text style={{ color: t.muted, fontSize: 13, paddingVertical: 8, paddingHorizontal: 2, fontFamily: t.fontUI }}>{props.children}</Text>;
}
/** a round accent + for a section header */
export function PlusBtn(props: { onPress: () => void; label: string }) {
  const t = useT();
  return (
    <Pressable onPress={props.onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={props.label} style={({ pressed }) => ({ width: 30, height: 30, borderRadius: 15, backgroundColor: t.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
      <Icon k="plus" size={16} color={t.onAccent} stroke={2.5} />
    </Pressable>
  );
}
/** a small i that explains something when tapped */
export function InfoBtn(props: { title: string; text: string }) {
  const t = useT();
  return (
    <Pressable onPress={() => Alert.alert(props.title, props.text)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`About ${props.title.toLowerCase()}`} style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}>
      <Icon k="info" size={18} color={t.muted} stroke={1.8} />
    </Pressable>
  );
}
export function Disclaim(props: { children: ReactNode; center?: boolean }) {
  const t = useT();
  return <Text style={{ fontSize: 12, color: t.muted, marginTop: 12, fontFamily: t.fontUI, lineHeight: 17, textAlign: props.center ? "center" : "left" }}>{props.children}</Text>;
}
export function P(props: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useT();
  return <Text style={[{ color: t.muted, fontSize: 13.5, lineHeight: 20, fontFamily: t.fontUI, marginBottom: 12 }, props.style]}>{props.children}</Text>;
}
export function Err(props: { children?: string | null }) {
  const t = useT();
  if (!props.children) return null;
  return <Text style={{ color: t.tint("observation"), fontSize: 13, fontFamily: t.fontUISemi }}>{props.children}</Text>;
}
/** a progress ring. onTint: it sits on a tinted or soft surface, so the track is white rather than the hairline grey */
export function Donut(props: { pct: number; size: number; stroke: number; color: string; center?: ReactNode; onTint?: boolean }) {
  const t = useT();
  const r = (props.size - props.stroke) / 2, C = 2 * Math.PI * r, p = Math.max(0, Math.min(1, props.pct || 0));
  const [track, trackOp] = props.onTint ? ["#FFFFFF", t.dark ? 0.16 : 1] : [t.line, 0.7];
  return (
    <View style={{ width: props.size, height: props.size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={props.size} height={props.size} viewBox={`0 0 ${props.size} ${props.size}`} style={StyleSheet.absoluteFill}>
        <Circle cx={props.size / 2} cy={props.size / 2} r={r} fill="none" stroke={track} strokeOpacity={trackOp} strokeWidth={props.stroke} />
        {p > 0 ? <Circle cx={props.size / 2} cy={props.size / 2} r={r} fill="none" stroke={props.color} strokeWidth={props.stroke} strokeLinecap="round" strokeDasharray={`${(C * p).toFixed(1)} ${C.toFixed(1)}`} transform={`rotate(-90 ${props.size / 2} ${props.size / 2})`} /> : null}
      </Svg>
      {props.center}
    </View>
  );
}
export function Stat(props: { value: ReactNode; label: string; big?: boolean }) {
  const t = useT();
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      {typeof props.value === "string" || typeof props.value === "number" ? <Text style={{ fontSize: props.big ? 24 : 17, fontFamily: t.fontUIHeavy, color: t.ink, letterSpacing: -0.3 }}>{props.value}</Text> : props.value}
      <Text style={{ fontSize: 11.5, color: t.muted, fontFamily: t.fontUI }}>{props.label}</Text>
    </View>
  );
}
export function Stats(props: { children: ReactNode }) {
  const t = useT();
  return <View style={[s.stats, { backgroundColor: t.soft }]}>{props.children}</View>;
}
export function Dot(props: { color: string; size?: number }) {
  const n = props.size ?? 9;
  return <View style={{ width: n, height: n, borderRadius: n / 2, backgroundColor: props.color }} />;
}
export function Swatch(props: { type?: string; color: string }) {
  if (props.type === "column") return <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: props.color, marginRight: 6 }} />;
  if (props.type === "dots") return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: props.color, marginRight: 6 }} />;
  return <View style={{ width: 14, height: 2.5, borderRadius: 2, backgroundColor: props.color, marginRight: 6 }} />;
}

export const s = StyleSheet.create({
  card: { borderRadius: 22, padding: 18, minWidth: 0 },
  cardH: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  h2: { fontSize: 15 },
  sub: { fontSize: 12, textAlign: "right", flexShrink: 1 },
  h1: { fontSize: 24, letterSpacing: -0.5 },
  wlink: { flexDirection: "row", alignItems: "center", gap: 6 },
  pageH: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  row: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "space-between", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, minWidth: 0 },
  rowT: { fontSize: 13.5 },
  rowS: { fontSize: 12, marginTop: 1 },
  pill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, alignSelf: "flex-start" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18, alignSelf: "flex-start" },
  btnSm: { paddingVertical: 6, paddingHorizontal: 12 },
  sec: { fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", marginTop: 16, marginBottom: 8 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, borderRadius: 14, padding: 12 },
});
