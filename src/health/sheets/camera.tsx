// The native camera with a frame of the series' shape (the body outline, or
// the face) and a faint overlay of the last photo, so poses line up. The shot
// is cropped to the frame: a body photo comes out the figure's shape and a
// face photo the face canvas's (4:5), so it fits its box with no adjusting and
// the points sit where the outline had them. Returns a JPEG at the web's size.
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { Photo } from "../model/types";
import { cropJpeg, shrinkToJpeg } from "../store/media";
import { PhotoView } from "../components/PhotoView";
import { FaceOutline, FigureOutline } from "../components/Figure";
import { useT } from "../ui";

const GUIDE_A = { body: 200 / 460, face: 4 / 5 };
/** the largest box of aspect `a` in the preview, clear of the controls */
function frameIn(w: number, h: number, a: number) {
  const top = 80, bottom = 170, side = 24;
  const bw = Math.max(40, Math.min(w - 2 * side, (h - top - bottom) * a)), bh = bw / a;
  return { x: (w - bw) / 2, y: top + Math.max(0, h - top - bottom - bh) / 2, w: bw, h: bh };
}

export function CameraSheet(props: { open: boolean; overlay: Photo | null; onClose: () => void; onShot: (uri: string) => void; guide?: "body" | "face" | null }) {
  const t = useT();
  const [perm, ask] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [busy, setBusy] = useState(false);
  // the last photo in the series, when there is one, else the outline; each can be switched on and off
  const [showLast, setShowLast] = useState(!!props.overlay);
  const [showGuide, setShowGuide] = useState(!props.overlay);
  useEffect(() => { if (props.open) { setShowLast(!!props.overlay); setShowGuide(!props.overlay); } }, [props.open]);
  const cam = useRef<CameraView>(null);
  const [pv, setPv] = useState({ w: 0, h: 0 }); // the preview's size on screen
  const frame = props.guide && pv.w ? frameIn(pv.w, pv.h, GUIDE_A[props.guide]) : null;
  const geo = useRef({ pv, frame });
  geo.current = { pv, frame };
  async function shoot() {
    if (!cam.current || busy) return;
    setBusy(true);
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.92 });
      if (!pic?.uri) return;
      let uri = pic.uri, w = pic.width, h = pic.height;
      const { pv, frame } = geo.current;
      if (frame && w && h) {
        // the preview fills the screen (cover); the frame's place on it, in the picture's pixels
        if ((w > h) !== (pv.w > pv.h)) [w, h] = [h, w]; // the picture stands as the preview did
        const s = Math.max(pv.w / w, pv.h / h), ox = (pv.w - w * s) / 2, oy = (pv.h - h * s) / 2;
        const x0 = Math.max(0, Math.round((frame.x - ox) / s)), y0 = Math.max(0, Math.round((frame.y - oy) / s));
        const cw = Math.min(w - x0, Math.round(frame.w / s)), ch = Math.min(h - y0, Math.round(frame.h / s));
        if (cw > 20 && ch > 20) { const c = await cropJpeg(uri, { x: x0, y: y0, w: cw, h: ch }); uri = c.uri; w = cw; h = ch; }
      }
      const out = await shrinkToJpeg(uri, w, h);
      props.onShot(out.uri);
    } finally { setBusy(false); }
  }
  const inFrame = frame ? { position: "absolute" as const, left: frame.x, top: frame.y, width: frame.w, height: frame.h } : null;
  return (
    <Modal visible={props.open} animationType="slide" onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {!perm ? null : !perm.granted ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
            <Text style={{ color: "#fff", textAlign: "center", fontFamily: t.fontUI }}>The camera takes photos that are encrypted on this phone before they're stored in your own account.</Text>
            {perm.canAskAgain ? <Pressable onPress={ask} style={st.btn}><Text style={st.btnT}>Allow the camera</Text></Pressable> : <Text style={{ color: "#bbb", fontFamily: t.fontUI }}>Camera access is off. Turn it on in Settings.</Text>}
            <Pressable onPress={props.onClose} style={{ padding: 12 }}><Text style={{ color: "#bbb" }}>Close</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }} onLayout={(e) => setPv({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
              <CameraView ref={cam} style={{ flex: 1 }} facing={facing} mirror={facing === "front"} />
            </View>
            {props.overlay && showLast ? (
              <View pointerEvents="none" style={[inFrame || StyleSheet.absoluteFill, { opacity: 0.3 }]}><PhotoView photo={props.overlay} style={StyleSheet.absoluteFill as any} radius={inFrame ? 14 : 0} fit="cover" /></View>
            ) : null}
            {inFrame ? (
              <View pointerEvents="none" style={[inFrame, { borderWidth: 1.5, borderColor: "rgba(255,255,255,.6)", borderRadius: 14 }]} accessibilityLabel="The photo is cropped to this frame">
                {showGuide ? (props.guide === "body" ? <FigureOutline /> : <FaceOutline />) : null}
              </View>
            ) : null}
            {props.overlay || props.guide ? (
              <View style={st.toggles}>
                {props.overlay ? <View style={st.toggleRow}><Text style={st.toggleT}>Last photo</Text><Switch value={showLast} onValueChange={setShowLast} trackColor={{ true: t.accent }} accessibilityLabel="Show the last photo" /></View> : null}
                {props.guide ? <View style={st.toggleRow}><Text style={st.toggleT}>Outline</Text><Switch value={showGuide} onValueChange={setShowGuide} trackColor={{ true: t.accent }} accessibilityLabel="Show the outline" /></View> : null}
              </View>
            ) : null}
            <View style={st.bar}>
              <Pressable onPress={props.onClose} style={st.side}><Text style={st.sideT}>Cancel</Text></Pressable>
              <Pressable onPress={shoot} disabled={busy} style={[st.shutter, busy && { opacity: 0.5 }]} accessibilityLabel="Take photo" accessibilityRole="button"><View style={st.shutterIn} /></Pressable>
              <View style={st.side}>
                <Pressable onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}><Text style={st.sideT}>Flip</Text></Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
const st = StyleSheet.create({
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: 40, paddingTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 28, backgroundColor: "rgba(0,0,0,.35)" },
  side: { width: 80, gap: 10 }, sideT: { color: "#fff", fontSize: 15, fontWeight: "600" },
  toggles: { position: "absolute", right: 14, bottom: 150, backgroundColor: "rgba(0,0,0,.45)", borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, gap: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, toggleT: { color: "#fff", fontSize: 14, fontWeight: "600" },
  shutter: { width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterIn: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  btn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 22 }, btnT: { color: "#000", fontWeight: "700" },
});
