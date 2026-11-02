// Zoom and position a photo inside its box: pinch to scale, drag to move, with
// the body or face outline over it so the figure's points line up. Saves a
// `fit` on the photo: the scale, the offset as fractions of the box and a tilt,
// all relative to the whole photo fitted inside the box (contain), so it carries
// to any box of the same shape (the dashboard figure is 200:460).
import { useEffect, useRef, useState } from "react";
import { Modal, PanResponder, Pressable, StyleSheet, Switch, Text, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import { Image } from "expo-image";
import type { Fit, Photo } from "../model/types";
import { usePhotoUri } from "./PhotoView";
import { FaceOutline, FigureOutline } from "./Figure";
import { useT } from "../ui";

const FIG_A = 200 / 460;
const ONE: Fit = { s: 1, x: 0, y: 0, r: 0 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const isOne = (f: Fit) => Math.abs(f.s - 1) < 0.01 && Math.abs(f.x) < 0.005 && Math.abs(f.y) < 0.005 && Math.abs(f.r || 0) < 0.3;
/** the shortest way round from angle a to b, in degrees */
const turn = (a: number, b: number) => (((b - a + 540) % 360) - 180);

type Touch = { n: number; d: number; a: number; cx: number; cy: number };
function summarize(e: GestureResponderEvent): Touch {
  const ts = e.nativeEvent.touches;
  if (ts.length >= 2) { const dx = ts[1].pageX - ts[0].pageX, dy = ts[1].pageY - ts[0].pageY; return { n: 2, d: Math.hypot(dx, dy), a: (Math.atan2(dy, dx) * 180) / Math.PI, cx: (ts[0].pageX + ts[1].pageX) / 2, cy: (ts[0].pageY + ts[1].pageY) / 2 }; }
  return { n: ts.length, d: 0, a: 0, cx: ts[0] ? ts[0].pageX : 0, cy: ts[0] ? ts[0].pageY : 0 };
}

export function AdjustPhoto(props: { photo: Photo | null; outline?: "body" | "face" | null; onClose: () => void; onSave: (fit: Fit | null) => void }) {
  const t = useT();
  const win = useWindowDimensions();
  const { uri } = usePhotoUri(props.photo);
  const [fit, setFit] = useState<Fit>(props.photo?.fit || ONE);
  const [showOutline, setShowOutline] = useState(true);
  useEffect(() => { setFit(props.photo?.fit || ONE); }, [props.photo]);
  const aspect = props.outline === "body" ? FIG_A : 4 / 5;
  const boxH = Math.min(win.height - 250, (win.width - 40) / aspect), boxW = boxH * aspect;
  const ref = useRef({ fit, boxW, boxH });
  ref.current = { fit, boxW, boxH };
  const start = useRef<{ fit: Fit; t: Touch } | null>(null);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { start.current = { fit: ref.current.fit, t: summarize(e) }; },
    onPanResponderMove: (e) => {
      const now = summarize(e), st = start.current;
      if (!st) return;
      if (now.n !== st.t.n) { start.current = { fit: ref.current.fit, t: now }; return; } // a finger added or lifted: start again from here
      const { boxW, boxH } = ref.current;
      const k = st.t.n === 2 && st.t.d > 0 ? now.d / st.t.d : 1;
      const r = st.t.n === 2 ? clamp((st.fit.r || 0) + turn(st.t.a, now.a), -45, 45) : st.fit.r || 0;
      setFit({ s: clamp(st.fit.s * k, 0.5, 5), x: clamp(st.fit.x + (now.cx - st.t.cx) / boxW, -1.5, 1.5), y: clamp(st.fit.y + (now.cy - st.t.cy) / boxH, -1.5, 1.5), r });
    },
    onPanResponderRelease: () => { start.current = null; },
    onPanResponderTerminate: () => { start.current = null; },
    onPanResponderTerminationRequest: () => false,
  })).current;
  const pill = (label: string, onPress: () => void, strong?: boolean) => (
    <Pressable key={label} onPress={onPress} style={[st.pill, strong && { backgroundColor: "#fff" }]} accessibilityRole="button">
      <Text style={{ color: strong ? "#000" : "#fff", fontWeight: "700", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible={!!props.photo} animationType="fade" onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: 14, padding: 20 }}>
        <View {...pan.panHandlers} style={{ width: boxW, height: boxH, borderRadius: 18, overflow: "hidden", backgroundColor: "#1C1C1E" }} accessibilityLabel="Photo. Pinch to zoom, drag to move, twist to straighten">
          {uri ? <Image source={{ uri }} style={[StyleSheet.absoluteFill, { transform: [{ translateX: fit.x * boxW }, { translateY: fit.y * boxH }, { rotate: `${fit.r || 0}deg` }, { scale: fit.s }] }]} contentFit="contain" contentPosition="center" cachePolicy="memory" /> : null}
          {props.outline && showOutline ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>{props.outline === "body" ? <FigureOutline /> : <FaceOutline />}</View> : null}
        </View>
        <Text style={{ color: "#9A9A9E", fontSize: 13 }}>Pinch to zoom, drag to move, twist to straighten.</Text>
        {props.outline ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Outline</Text><Switch value={showOutline} onValueChange={setShowOutline} trackColor={{ true: t.accent }} /></View> : null}
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {pill("Cancel", props.onClose)}
          {pill("Reset", () => setFit(ONE))}
          {pill("Done", () => { props.onSave(isOne(fit) ? null : fit); props.onClose(); }, true)}
        </View>
      </View>
    </Modal>
  );
}
const st = StyleSheet.create({ pill: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1.5, borderColor: "#fff" } });
