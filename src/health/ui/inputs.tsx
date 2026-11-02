// Form inputs: text, multi-line, number, date, time, select (a picker sheet),
// segmented control, rating (1 to 5, or 0 to 10), and the value input for any measure kind.
import { useState, type ReactNode } from "react";
import { ratingRange } from "../model/vocab";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { fmt, iso, pd, tfmt, toHHMM, dur } from "../model/dates";
import type { MetricKind } from "../model/types";
import { useT } from "./primitives";

export function Field(props: { label?: string; children: ReactNode; hint?: string; style?: StyleProp<ViewStyle>; full?: boolean }) {
  const t = useT();
  return (
    <View style={[{ gap: 5, minWidth: 0 }, props.full ? { width: "100%" } : null, props.style]}>
      {props.label ? <Text style={{ fontSize: 12, fontFamily: t.fontUIBold, color: t.muted }}>{props.label}</Text> : null}
      {props.children}
      {props.hint ? <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{props.hint}</Text> : null}
    </View>
  );
}
export function Two(props: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{props.children}</View>;
}
export function Half(props: { children: ReactNode }) {
  return <View style={{ flexBasis: "45%", flexGrow: 1, minWidth: 0 }}>{props.children}</View>;
}
export function Input(props: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; keyboard?: "default" | "numeric" | "decimal-pad" | "email-address" | "number-pad"; secure?: boolean; autoCapitalize?: "none" | "sentences" | "words"; style?: StyleProp<TextStyle>; maxLength?: number; autoFocus?: boolean; textContentType?: any; autoComplete?: any }) {
  const t = useT();
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChange}
      placeholder={props.placeholder}
      placeholderTextColor={t.muted}
      multiline={props.multiline}
      keyboardType={props.keyboard}
      secureTextEntry={props.secure}
      autoCapitalize={props.autoCapitalize ?? (props.keyboard && props.keyboard !== "default" ? "none" : "sentences")}
      autoCorrect={props.keyboard === "email-address" ? false : undefined}
      maxLength={props.maxLength}
      autoFocus={props.autoFocus}
      textContentType={props.textContentType}
      autoComplete={props.autoComplete}
      style={[st.input, { borderColor: t.line, backgroundColor: t.card, color: t.ink, fontFamily: t.fontUI }, props.multiline && { minHeight: 70, textAlignVertical: "top" }, props.style]}
    />
  );
}
export function NumInput(props: { value: number | string | null | undefined; onChange: (v: string) => void; placeholder?: string; integer?: boolean; style?: StyleProp<TextStyle> }) {
  return <Input value={props.value == null ? "" : String(props.value)} onChange={props.onChange} placeholder={props.placeholder} keyboard={props.integer ? "number-pad" : "decimal-pad"} style={props.style} />;
}

/** a select: tap to open a list; `options` as [value, label] */
export function Select(props: { value: string; options?: [string, string][]; onChange: (v: string) => void; placeholder?: string; groups?: Record<string, [string, string][]>; disabledValues?: string[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const all = props.groups ? Object.values(props.groups).flat() : props.options || [];
  const label = (all.find((o) => o[0] === props.value) || [])[1] ?? (props.placeholder || "");
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[st.input, { borderColor: t.line, backgroundColor: t.card, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]} accessibilityRole="button">
        <Text style={{ color: label ? t.ink : t.muted, fontFamily: t.fontUI, fontSize: 15, flex: 1 }} numberOfLines={1}>{label || props.placeholder || "Choose"}</Text>
        <Text style={{ color: t.muted }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={st.scrim} onPress={() => setOpen(false)} />
        <View style={[st.pick, { backgroundColor: t.card }]}>
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {(props.groups ? Object.entries(props.groups) : [["", props.options || []] as [string, [string, string][]]]).map(([g, opts]) => (
              <View key={g}>
                {g ? <Text style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: t.muted, fontFamily: t.fontUIBold, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 }}>{g}</Text> : null}
                {opts.map(([v, l]) => {
                  const dis = props.disabledValues?.includes(v);
                  return (
                    <Pressable key={v + l} disabled={dis} onPress={() => { props.onChange(v); setOpen(false); }} style={[st.opt, v === props.value && { backgroundColor: t.accentSoft }, dis && { opacity: 0.4 }]}>
                      <Text style={{ color: t.ink, fontFamily: v === props.value ? t.fontUIBold : t.fontUI, fontSize: 15 }}>{l}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

export function DateField(props: { value: string; onChange: (v: string) => void; clearable?: boolean; placeholder?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const d = props.value ? pd(props.value) : new Date();
  return (
    <>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Pressable onPress={() => setOpen(true)} style={[st.input, { flex: 1, borderColor: t.line, backgroundColor: t.card }]} accessibilityRole="button" accessibilityLabel="Pick a date">
          <Text style={{ color: props.value ? t.ink : t.muted, fontFamily: t.fontUI, fontSize: 15 }}>{props.value ? fmt(props.value) : props.placeholder || "Pick a date"}</Text>
        </Pressable>
        {props.clearable && props.value ? <Pressable onPress={() => props.onChange("")} style={[st.x, { backgroundColor: t.soft }]} accessibilityLabel="Clear date"><Text style={{ color: t.ink }}>✕</Text></Pressable> : null}
      </View>
      {open ? (
        Platform.OS === "ios" ? (
          <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
            <Pressable style={st.scrim} onPress={() => setOpen(false)} />
            <View style={[st.pick, { backgroundColor: t.card, padding: 10 }]}>
              <DateTimePicker value={d} mode="date" display="inline" onChange={(_e, nd) => { if (nd) props.onChange(iso(nd)); }} themeVariant={t.dark ? "dark" : "light"} accentColor={t.accent} />
              <Pressable onPress={() => setOpen(false)} style={{ alignSelf: "flex-end", padding: 10 }}><Text style={{ color: t.ink, fontFamily: t.fontUIBold }}>Done</Text></Pressable>
            </View>
          </Modal>
        ) : (
          <DateTimePicker value={d} mode="date" display="default" onChange={(e, nd) => { setOpen(false); if (e.type === "set" && nd) props.onChange(iso(nd)); }} />
        )
      ) : null}
    </>
  );
}
export function TimeField(props: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const base = new Date();
  if (props.value) { const [h, m] = props.value.split(":").map(Number); base.setHours(h, m, 0, 0); }
  const toStr = (nd: Date) => `${String(nd.getHours()).padStart(2, "0")}:${String(nd.getMinutes()).padStart(2, "0")}`;
  return (
    <>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Pressable onPress={() => setOpen(true)} style={[st.input, { flex: 1, borderColor: t.line, backgroundColor: t.card }]} accessibilityRole="button" accessibilityLabel="Pick a time">
          <Text style={{ color: props.value ? t.ink : t.muted, fontFamily: t.fontUI, fontSize: 15 }}>{props.value ? tfmt(props.value) : props.placeholder || "–"}</Text>
        </Pressable>
        {props.value ? <Pressable onPress={() => props.onChange("")} style={[st.x, { backgroundColor: t.soft }]} accessibilityLabel="Clear time"><Text style={{ color: t.ink }}>✕</Text></Pressable> : null}
      </View>
      {open ? (
        Platform.OS === "ios" ? (
          <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
            <Pressable style={st.scrim} onPress={() => setOpen(false)} />
            <View style={[st.pick, { backgroundColor: t.card, padding: 10 }]}>
              <DateTimePicker value={base} mode="time" display="spinner" onChange={(_e, nd) => { if (nd) props.onChange(toStr(nd)); }} themeVariant={t.dark ? "dark" : "light"} />
              <Pressable onPress={() => { if (!props.value) props.onChange(toStr(base)); setOpen(false); }} style={{ alignSelf: "flex-end", padding: 10 }}><Text style={{ color: t.ink, fontFamily: t.fontUIBold }}>Done</Text></Pressable>
            </View>
          </Modal>
        ) : (
          <DateTimePicker value={base} mode="time" display="default" onChange={(e, nd) => { setOpen(false); if (e.type === "set" && nd) props.onChange(toStr(nd)); }} />
        )
      ) : null}
    </>
  );
}

export function Seg(props: { value: string; options: [string, string][]; onChange: (v: string) => void; small?: boolean; wrap?: boolean }) {
  const t = useT();
  return (
    <View style={[st.seg, { backgroundColor: t.card, borderColor: t.line }, props.wrap && { flexWrap: "wrap", alignSelf: "stretch" }]} accessibilityRole="radiogroup">
      {props.options.map(([v, l]) => (
        <Pressable key={v} onPress={() => props.onChange(v)} style={[st.segBtn, props.small && { paddingVertical: 3, paddingHorizontal: 9 }, v === props.value && { backgroundColor: t.darkC }]} accessibilityRole="radio" accessibilityState={{ checked: v === props.value }}>
          <Text style={{ fontSize: props.small ? 11.5 : 12, fontFamily: t.fontUISemi, color: v === props.value ? t.onDark : t.muted }}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Rating(props: { value: number | null; onChange: (v: number) => void; lo?: number; hi?: number }) {
  const t = useT();
  const lo = props.lo ?? 1, hi = props.hi ?? 5, ns = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), wide = ns.length > 6;
  return (
    <View style={[st.seg, { backgroundColor: t.card, borderColor: t.line }]}>
      {ns.map((n) => (
        <Pressable key={n} onPress={() => props.onChange(n)} style={[st.segBtn, wide ? { flex: 1, minWidth: 0, paddingHorizontal: 0, paddingVertical: 8 } : { minWidth: 44, paddingVertical: 8 }, props.value === n && { backgroundColor: t.darkC }]} accessibilityRole="radio" accessibilityState={{ checked: props.value === n }}>
          <Text style={{ fontSize: wide ? 13 : 15, fontFamily: t.fontUIBold, color: props.value === n ? t.onDark : t.muted, textAlign: "center" }}>{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Check(props: { value: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const t = useT();
  return (
    <Pressable onPress={() => props.onChange(!props.value)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }} accessibilityRole="checkbox" accessibilityState={{ checked: props.value }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: props.value ? t.darkC : t.line, backgroundColor: props.value ? t.darkC : t.card, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        {props.value ? <Text style={{ color: t.onDark, fontSize: 14, fontWeight: "800" }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontFamily: t.fontUI, fontSize: 13.5 }}>{props.label}</Text>
        {props.hint ? <Text style={{ color: t.muted, fontFamily: t.fontUI, fontSize: 12 }}>{props.hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/** value state for a measure of any kind: number (string), rating (number), time ("HH:MM"), duration ({h,m}) */
export type ValState = { num: string; rate: number | null; time: string; h: string; m: string };
export const emptyVal = (): ValState => ({ num: "", rate: null, time: "", h: "", m: "" });
export function valFrom(kd: MetricKind, v: number | null | undefined): ValState {
  const s = emptyVal();
  if (v == null || isNaN(+v)) return s;
  if (kd === "rating") s.rate = +v;
  else if (kd === "time" || kd === "time_night") s.time = toHHMM(+v);
  else if (kd === "duration") { s.h = String(Math.floor(+v / 60)); s.m = String(Math.round(+v % 60)); }
  else s.num = String(v);
  return s;
}
export function readVal(kd: MetricKind, s: ValState): number | null {
  if (kd === "rating") return s.rate;
  if (kd === "time" || kd === "time_night") { if (!s.time) return null; const [h, m] = s.time.split(":").map(Number); return h * 60 + m; }
  if (kd === "duration") { if (s.h === "" && s.m === "") return null; return (+s.h || 0) * 60 + (+s.m || 0); }
  if (s.num.trim() === "") return null;
  const n = +s.num.replace(",", ".");
  return isNaN(n) ? null : n;
}
export function ValInput(props: { kind: MetricKind; label: string; value: ValState; onChange: (v: ValState) => void; /** the measure's unit; for a rating, its scale */ unit?: string }) {
  const t = useT();
  const v = props.value, set = (p: Partial<ValState>) => props.onChange({ ...v, ...p });
  if (props.kind === "rating") { const r = ratingRange(props.unit); return <Field label={props.label}><Rating value={v.rate} onChange={(n) => set({ rate: n })} lo={r.lo} hi={r.hi} /></Field>; }
  if (props.kind === "time" || props.kind === "time_night") return <Field label={props.label}><TimeField value={v.time} onChange={(time) => set({ time })} /></Field>;
  if (props.kind === "duration")
    return (
      <Field label={props.label}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <NumInput value={v.h} onChange={(h) => set({ h })} integer style={{ width: 80 }} /><Text style={{ color: t.muted }}>h</Text>
          <NumInput value={v.m} onChange={(m) => set({ m })} integer style={{ width: 80 }} /><Text style={{ color: t.muted }}>min</Text>
          {v.h || v.m ? <Text style={{ color: t.muted, fontSize: 12 }}>{dur((+v.h || 0) * 60 + (+v.m || 0))}</Text> : null}
        </View>
      </Field>
    );
  return <Field label={props.label}><NumInput value={v.num} onChange={(num) => set({ num })} /></Field>;
}

export const st = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 11, fontSize: 15, minWidth: 0 },
  scrim: { flex: 1, backgroundColor: "rgba(10,12,8,.45)" },
  pick: { position: "absolute", left: 16, right: 16, bottom: 40, borderRadius: 18, paddingVertical: 6, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  opt: { paddingVertical: 11, paddingHorizontal: 14 },
  x: { width: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  seg: { flexDirection: "row", borderWidth: 1, borderRadius: 999, padding: 3, alignSelf: "flex-start" },
  segBtn: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 },
});
