// One photo: decrypted into the cache on demand, a striped block while locked,
// the outline figure or a gradient for sample placeholders. No text on the
// image; the date shows on press-and-hold.
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import type { Photo } from "../model/types";
import { fmt } from "../model/dates";
import { useHealth } from "../state/HealthContext";
import { useT } from "../ui";
import { FigureSvg } from "./Figure";

// decrypted uris by storage path, so a remounted view draws at once instead of waiting for the lookup (a flash)
const KNOWN = new Map<string, string>();
export function usePhotoUri(p: Photo | null | undefined): { uri: string | null; locked: boolean } {
  const h = useHealth();
  const [uri, setUri] = useState<string | null>(p?.src || (p?.path && KNOWN.get(p.path)) || null);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    let live = true;
    if (!p) return;
    if (p.src) { setUri(p.src); setLocked(false); return; }
    if (!p.path) { setUri(null); return; }
    h.photoUri(p).then((u) => { if (u && p.path) KNOWN.set(p.path, u); if (!live) return; setUri(u); setLocked(!u); }).catch(() => { if (live) { setUri(null); setLocked(true); } });
    return () => { live = false; };
  }, [p?.src, p?.path, h.vault, h.store]);
  return { uri, locked };
}

export function PhotoView(props: { photo: Photo | null | undefined; date?: string; style?: StyleProp<ViewStyle>; radius?: number; onPress?: () => void; fit?: "cover" | "contain"; /** where a covering photo is anchored; the top by default, so a face stays in a portrait tile */ position?: "center" | "top center"; transition?: number; box?: { w: number; h: number }; bg?: string }) {
  const t = useT();
  const p = props.photo;
  const { uri, locked } = usePhotoUri(p);
  const [showDate, setShowDate] = useState(false);
  const [measured, setSz] = useState({ w: 0, h: 0 });
  const sz = props.box && props.box.w ? props.box : measured; // a caller that knows the size spares the first, untransformed frame after a remount
  const r = props.radius ?? 12;
  const f = p && p.fit && sz.w ? { transform: [{ translateX: p.fit.x * sz.w }, { translateY: p.fit.y * sz.h }, { rotate: `${p.fit.r || 0}deg` }, { scale: p.fit.s }] } : null;
  let body;
  if (uri) body = <Image source={{ uri }} style={[StyleSheet.absoluteFill, f]} contentFit={p && p.fit ? "contain" : props.fit || "cover"} contentPosition={p && p.fit ? "center" : props.position || "top center"} cachePolicy="memory" transition={props.transition ?? 120} accessibilityLabel={props.date ? `Photo, ${fmt(props.date)}` : "Photo"} />;
  else if (p && p.ph === "body") body = <View style={[StyleSheet.absoluteFill, { backgroundColor: t.card }]}><FigureSvg w={p.w || 1} /></View>;
  else if (p && p.ph) body = <View style={[StyleSheet.absoluteFill, { backgroundColor: `hsl(${p.hue ?? 200}, 45%, 62%)` }]}><Text style={{ position: "absolute", top: 8, left: 8, fontSize: 9.5, letterSpacing: 1, color: "#fff", backgroundColor: "rgba(0,0,0,.35)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: "hidden", fontFamily: t.fontUIBold }}>SAMPLE</Text></View>;
  else if (locked || (p && p.enc)) body = <View style={[StyleSheet.absoluteFill, { backgroundColor: t.line, alignItems: "center", justifyContent: "center" }]}><Text style={{ color: t.muted, fontSize: 11, fontFamily: t.fontUISemi }}>Locked</Text></View>;
  else body = <View style={[StyleSheet.absoluteFill, { backgroundColor: t.soft }]} />;
  const box = { borderRadius: r, overflow: "hidden" as const, backgroundColor: props.bg ?? t.soft };
  const inner = (
    <>
      {body}
      {props.date && showDate ? <View style={st.date}><Text style={{ color: "#fff", fontSize: 11, fontFamily: t.fontUIBold }}>{fmt(props.date)}</Text></View> : null}
    </>
  );
  const measure = (e: { nativeEvent: { layout: { width: number; height: number } } }) => setSz({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  if (!props.onPress && !props.date) return <View style={[box, props.style]} onLayout={measure}>{inner}</View>;
  // the touch layer takes the caller's size; the box fills it (an absolute-fill style on a sizeless wrapper would collapse to nothing)
  return (
    <Pressable onPress={props.onPress} onLongPress={() => setShowDate(true)} onPressOut={() => setShowDate(false)} delayLongPress={250} accessibilityRole={props.onPress ? "button" : undefined} style={props.style}>
      <View style={[box, StyleSheet.absoluteFill]} onLayout={measure}>{inner}</View>
    </Pressable>
  );
}
const st = StyleSheet.create({ date: { position: "absolute", left: 8, bottom: 8, backgroundColor: "rgba(0,0,0,.5)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 } });

/** a photo full screen on a dark ground; tap anywhere to close */
export function Lightbox(props: { photo: Photo | null; onClose: () => void }) {
  const { uri } = usePhotoUri(props.photo);
  return (
    <Modal visible={!!props.photo} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable onPress={props.onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.93)", alignItems: "center", justifyContent: "center" }} accessibilityRole="button" accessibilityLabel="Close">
        {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="contain" cachePolicy="none" /> : null}
      </Pressable>
    </Modal>
  );
}
