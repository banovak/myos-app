// The body card, sized so the whole of it (figure, weight / body fat / height)
// ends above the bottom nav on the phone, whatever sits above it (stories,
// banners). The figure is narrow, so the three measurements stand beside it.
//
// One zoom. The figure has a scale and an offset (K, TX, TY); a pinch changes
// them, and the card names the band in the middle ("Upper body"). Below a
// small zoom the figure snaps back beside the measurements. The regions on it
// (face, chest, left arm…) keep their size on screen whatever the zoom and
// show their names once zoomed in; the face's features fade in as the zoom
// grows. The figure is laid out at its zoomed size and only transformed while
// it moves (see `rest`), so at rest it is sharp whatever the zoom. The figure
// turns round: the back view has its own regions and its own photos (the
// entry's photo labelled Back).
// Tapping a region opens its canvas: its photos, with its own points on them
// (the face: eyes, nose, ears, mouth, teeth; an arm: shoulder, elbow, hand).
// Tapping a point opens that point's photos. Two levels, no more.
// The pencil edits the regions (on the body) or the points (on a canvas),
// full screen: tap to add one, hold one to pick it up and drag it, tap one to
// rename or remove it; Save keeps the changes, Cancel puts every one back.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Animated, Easing, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { fmt, fmtShort, nowHHMM, today, uid as newId } from "../model/dates";
import { getSeries } from "../model/series";
import { measurePoints } from "../model/hkuse";
import { numIn, showMeasure, toggleUnit, unitWord } from "../model/units";
import { DEFAULT_POINTS_RAW, parentOf, rl } from "../model/vocab";
import type { Entry, Photo, Point } from "../model/types";
import { useHealth, type BodyZone } from "../state/HealthContext";
import { pageScroll } from "../state/pageScroll";
import { Btn, Card, CardH, Icon, Seg, useT } from "../ui";
import { FaceSvg, ZoomFigure } from "./Figure";
import { PhotoView } from "./PhotoView";
import { AdjustPhoto } from "./AdjustPhoto";
import { TeethLegend, TeethSvg } from "./ToothChart";
import { NAV_HEIGHT } from "./BottomNav";
import { NoSwipe } from "../../shell/NoSwipe";
import { Portal } from "../ui/Portal";
import { openCard, openForm, openPointForm, openTooth, openPoint } from "../sheets";
import { teethData } from "../model/teeth";

type Frame = { date: string; photo: Photo; entry?: Entry; base?: boolean };
type Zone = "head" | BodyZone;

// bands of the figure, in percent of its height, for tapping and for the label
export const ZONES: Record<BodyZone, { y0: number; y1: number; label: string }> = {
  upper: { y0: 15, y1: 41, label: "Upper body" },
  middle: { y0: 41, y1: 62, label: "Middle" },
  lower: { y0: 62, y1: 100, label: "Legs and feet" },
};
const HEAD_BAND = 15;
// what a tap on a band frames: its rows, how wide the figure is there (so arms
// are not cut off), and a cap on the zoom
const FRAME: Record<Zone, { y0: number; y1: number; x0: number; x1: number; max: number }> = {
  head: { y0: 0, y1: 17.5, x0: 33, x1: 67, max: 6.5 },
  upper: { y0: 12, y1: 43, x0: 9, x1: 91, max: 4 },
  middle: { y0: 39, y1: 64, x0: 8, x1: 92, max: 4 },
  lower: { y0: 60, y1: 100, x0: 28, x1: 72, max: 4 },
};
const FIG_A = 200 / 460;
const STATS_MIN = 132;
const CARD_PAD = 18;
const EDIT_PAD = 0; // the editor's side margin: none, the photo has the width
const ZOOM_MS = 380;
const HOLD_MS = 260;
const LIFT = 36; // a picked-up point rides this far above the finger, so you can see where it will land
type Group = "one" | "all";
const ZOOMED = 1.35; // from here the card counts as zoomed in
const K_MAX = 8;
const zoneLabel = (z: Zone) => (z === "head" ? "Head" : ZONES[z].label);

/** an entry's photo of one side of the body, by its label; an unlabelled photo counts as the front */
export function sidePhoto(ps: Photo[], side: "front" | "back"): Photo | null {
  const lab = (p: Photo) => (p.label || "").trim().toLowerCase();
  const hit = ps.find((p) => lab(p) === side);
  if (hit) return hit;
  return side === "front" ? ps.find((p) => lab(p) !== "back") || null : null;
}
export function frames(D: ReturnType<typeof useHealth>["D"], region: string | null, side: "front" | "back" = "front"): Frame[] {
  const T = today();
  if (!region) {
    const f: Frame[] = [];
    D.entries.filter((e) => e.details.series === "body" && e.photos.length).sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1)).forEach((e) => { const p = sidePhoto(e.photos, side); if (p) f.push({ date: e.occurred_at, photo: p, entry: e }); });
    if (side === "front" && (D.basePhoto || D.basePhotoPath)) f.push({ date: T, photo: D.basePhoto ? { src: D.basePhoto } : { path: D.basePhotoPath!, enc: D.basePhotoEnc }, base: true });
    return f;
  }
  const f: Frame[] = [];
  D.entries.filter((e) => e.regions.includes(region) && e.photos.length && (e.details.series !== "body" || region === "whole_body")).sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1)).forEach((e) => e.photos.forEach((p) => f.push({ date: e.occurred_at, photo: p, entry: e })));
  return f;
}

const clamp01 = (v: number) => Math.max(0, Math.min(100, v));
type XF = { k: number; tx: number; ty: number };
type Rest = XF & { moving: boolean; n: number }; // n: counts layouts; the moving layer is remounted for each

// A point on the drawing, in figure coordinates. It is scaled by 1/k so it
// keeps its size on screen; its name sits under it once zoomed in. While
// editing: hold it to pick it up (it grows, turns the accent colour and rises
// above the finger, its name over it), drag, let go to place it where it
// shows; a plain tap opens it to rename or remove. `grouped` points are drawn
// in the accent colour and moved by their group's box, not one by one.
function Hot(props: {
  p: Point; label: string; active: boolean; editing: boolean; tappable: boolean; grouped?: boolean;
  dims: { w: number; h: number }; scale: () => number; lifted: { current: boolean };
  invK: Animated.AnimatedNode | number; labelOp: Animated.AnimatedInterpolation<number> | number; fade?: Animated.AnimatedInterpolation<number>;
  onPress: () => void; onMove: (x: number, y: number) => void;
}) {
  const t = useT();
  const live = useRef(props);
  live.current = props;
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [up, setUp] = useState(false);
  const g = useRef({ timer: null as ReturnType<typeof setTimeout> | null, lifted: false, moved: false, x0: 0, y0: 0 });
  const at = (dx: number, dy: number) => {
    const s = g.current, { dims, scale } = live.current, k = scale() || 1;
    return { x: +clamp01(s.x0 + (dx / (dims.w * k)) * 100).toFixed(1), y: +clamp01(s.y0 + ((dy - LIFT) / (dims.h * k)) * 100).toFixed(1) };
  };
  const drop = () => {
    const s = g.current;
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    if (s.lifted) pageScroll.setLock(false);
    s.lifted = false; live.current.lifted.current = false;
    setUp(false); setDrag(null);
  };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => live.current.editing,
    onMoveShouldSetPanResponder: () => live.current.editing && g.current.lifted,
    onPanResponderGrant: () => {
      const s = g.current;
      s.lifted = false; s.moved = false; s.x0 = +live.current.p.x; s.y0 = +live.current.p.y;
      s.timer = setTimeout(() => { s.timer = null; if (!s.moved) { s.lifted = true; live.current.lifted.current = true; pageScroll.setLock(true); setUp(true); if (live.current.dims.w) setDrag(at(0, 0)); } }, HOLD_MS);
    },
    onPanResponderMove: (_e, gs) => {
      const s = g.current;
      if (!s.lifted) {
        if (Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8) { s.moved = true; if (s.timer) { clearTimeout(s.timer); s.timer = null; } }
        return;
      }
      if (live.current.dims.w) setDrag(at(gs.dx, gs.dy));
    },
    onPanResponderRelease: (_e, gs) => {
      const s = g.current;
      if (s.lifted && live.current.dims.w) { const q = at(gs.dx, gs.dy); live.current.onMove(q.x, q.y); }
      else if (!s.moved) live.current.onPress();
      drop();
    },
    onPanResponderTerminate: drop,
    onPanResponderTerminationRequest: () => !g.current.lifted,
  })).current;
  const n = 24, d = 8;
  const px = drag ? drag.x : props.p.x, py = drag ? drag.y : props.p.y;
  const on = props.editing, tint = on || !!props.grouped;
  return (
    <Animated.View
      style={{ position: "absolute", left: `${px}%`, top: `${py}%`, width: n, height: n, marginLeft: -n / 2, marginTop: -n / 2, zIndex: up ? 5 : 1, opacity: props.fade ?? 1, transform: [{ scale: props.invK as any }, { scale: up ? 1.7 : 1 }] }}
      pointerEvents={props.tappable || on ? "auto" : "none"}
      {...(on ? pan.panHandlers : {})}
    >
      <Pressable onPress={props.onPress} disabled={on} style={{ flex: 1, alignItems: "center", justifyContent: "center" }} accessibilityRole="button" accessibilityLabel={props.label} hitSlop={6}>
        <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: tint ? t.accent : t.card, borderWidth: 1.5, borderColor: tint ? t.accent : t.ink, shadowColor: up ? t.accent : t.card, shadowOpacity: up ? 0.6 : 0.8, shadowRadius: up ? 6 : 2, shadowOffset: { width: 0, height: 0 } }} />
        {up ? <View style={{ position: "absolute", width: d + 10, height: d + 10, borderRadius: (d + 10) / 2, borderWidth: 1, borderColor: t.accent, opacity: 0.6 }} /> : null}
        {props.active && !on ? <View style={{ position: "absolute", top: 4, right: 4, width: 5, height: 5, borderRadius: 4, backgroundColor: t.tint("observation") }} /> : null}
        {/* the name, under the point (over it while it is picked up); a tap on it counts as a tap on the point */}
        <Animated.View style={{ position: "absolute", top: up ? -(n - 6) : n - 3, left: -60, width: n + 120, alignItems: "center", opacity: up ? 1 : props.labelOp }}>
          <Text numberOfLines={1} style={{ fontSize: 10.5, fontFamily: t.fontUISemi, color: t.ink, backgroundColor: t.card, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, overflow: "hidden" }}>{props.label}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function IconBtn(props: { k: string; label: string; onPress: () => void; accent?: boolean }) {
  const t = useT();
  return (
    <Pressable onPress={props.onPress} accessibilityRole="button" accessibilityLabel={props.label} hitSlop={6} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: props.accent ? t.accent : t.card, borderWidth: props.accent ? 0 : 1, borderColor: t.line, opacity: pressed ? 0.7 : 1 })}>
      <Icon k={props.k} size={18} color={props.accent ? t.onAccent : t.ink} />
    </Pressable>
  );
}
function DonePill(props: { label: string; onPress: () => void; text?: string }) {
  const t = useT();
  return (
    <Pressable onPress={props.onPress} accessibilityRole="button" accessibilityLabel={props.label} style={{ backgroundColor: t.accent, borderRadius: 18, height: 36, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: t.onAccent, fontFamily: t.fontUIBold, fontSize: 13 }}>{props.text || "Done"}</Text>
    </Pressable>
  );
}
/** the dashboard's layout button (above the body card, beside the stories): customise the widgets, Done while doing so */
export function LayoutBtn() {
  const h = useHealth();
  return h.V.customizing ? <DonePill label="Done customising" onPress={() => h.setV({ customizing: false })} /> : <IconBtn k="layout" label="Customise the dashboard" onPress={() => h.setV({ customizing: true })} />;
}

export function BodyStage() {
  const h = useHealth();
  const t = h.t;
  const { D, V } = h;
  const win = useWindowDimensions();
  const [cardW, setCardW] = useState(0);
  const [cardStageH, setStageH] = useState(340);
  const [editH, setEditH] = useState(0); // the editor's stage, measured
  const cardRef = useRef<View>(null);
  const stageRef = useRef<View>(null);
  const meas = useRef({ top: -1, cardH: 0, rowH: 0, passes: 0 });
  const stageHRef = useRef(cardStageH);
  stageHRef.current = cardStageH;
  const stageH = V.editing ? editH || Math.max(300, win.height - 240) : cardStageH;

  const fr = frames(D, V.region, V.side);
  const frame = V.frame == null || V.frame >= fr.length ? fr.length - 1 : V.frame;
  const cur = fr[frame];
  // the photos as a stack, all mounted, only the current one visible: scrubbing never reloads an image
  const [adj, setAdj] = useState<Frame | null>(null);
  const near = (i: number) => fr.length <= 60 || Math.abs(i - frame) <= 8;
  const stack = (mode?: "cover" | "contain", box?: { w: number; h: number }) => fr.map((f, i) => (near(i) ? (
    <View key={f.entry ? f.entry.id + ":" + i : "base"} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: i === frame ? 1 : 0 }]}>
      <PhotoView photo={f.photo} date={f.base ? undefined : f.date} style={StyleSheet.absoluteFill as any} radius={18} fit={mode} transition={0} box={box} bg={mode ? undefined : "transparent"} />
    </View>
  ) : null));
  const adjustModal = (
    <AdjustPhoto photo={adj ? adj.photo : null} outline={!V.region ? "body" : V.region === "face" ? "face" : null} onClose={() => setAdj(null)} onSave={(fit) => {
      const a = adj; if (!a || !a.entry) return;
      h.mutate((D) => { const e = D.entries.find((x) => x.id === a.entry!.id); const p = e && e.photos.find((q) => (q.path && q.path === a.photo.path) || (q.src && q.src === a.photo.src)); if (p) { if (fit) p.fit = fit; else delete p.fit; } });
    }} />
  );
  const active = new Set(D.concerns.filter((c) => c.status !== "resolved").flatMap((c) => c.regions));
  const teethView = V.region === "teeth" && V.mouthView !== "photos";
  const bodyMode = !V.region;
  const cardInnerW = (cardW || win.width - 28) - CARD_PAD * 2;
  const innerW = V.editing ? win.width - 2 * EDIT_PAD : cardInnerW;
  const zoomed = !!V.zoom;

  // ----- the one zoom: scale and offset of the figure in the stage -----
  const cw0 = Math.max(80, Math.min(stageH * FIG_A, V.editing ? innerW : innerW - STATS_MIN - 16)), ch0 = cw0 / FIG_A;
  const C0 = { x: cw0 / 2, y: stageH / 2 }; // the figure's centre in the stage when not moved
  const S = { x: innerW / 2, y: stageH / 2 }; // the stage's centre, which a transform of the stage turns about
  const mx = Math.round(innerW / 2), my = Math.round(stageH / 2); // the drawing reaches this far beyond the stage, to pan into
  const txCentre = innerW / 2 - cw0 / 2;
  const K = useRef(new Animated.Value(1)).current;
  const TX = useRef(new Animated.Value(0)).current;
  const TY = useRef(new Animated.Value(0)).current;
  const SO = useRef(new Animated.Value(0)).current; // 1 = the measurements have slid out
  const xf = useRef<XF>({ k: 1, tx: 0, ty: 0 });
  const self = useRef(false); // the next V.zoom change is ours, already animated
  // The figure is laid out at `rest`: its box is cw0 × rest.k wide and the
  // drawing is cropped to the stage, so at rest nothing is scaled and it is
  // sharp at any zoom. While it moves (a pinch, a zoom animation) the stage
  // gets a transform for the difference between the live K, TX, TY and rest,
  // and a long pinch lays the figure out again part way, so it is never
  // magnified much. Laying it out again is seamless, as the transform is
  // relative to the layout. Each layout gets a fresh moving layer (keyed by
  // rest.n): on the new architecture a view whose transform Animated has set
  // natively never takes a transform from React again, so the old layer's
  // last transform would otherwise stay on top of the new layout.
  const [rest, setRestState] = useState<Rest>({ k: 1, tx: 0, ty: 0, moving: false, n: 0 });
  const restRef = useRef(rest);
  restRef.current = rest;
  const setRest = (v: XF & { moving: boolean }) => setRestState((p) => ({ k: v.k, tx: v.tx, ty: v.ty, moving: v.moving, n: p.n + 1 }));
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const liftedRef = useRef(false);
  const editingRef = useRef(V.editing);
  editingRef.current = V.editing;
  const gest = useRef({ mode: "none" as "none" | "pinch" | "pan", k0: 1, tx0: 0, ty0: 0, d0: 1, qx: 0, qy: 0, gdx0: 0, gdy0: 0 });
  const statsFor = (k: number) => Math.max(editingRef.current ? 1 : 0, Math.min(1, (k - 1) / 0.5));

  function lim(size: number, span: number, c: number): [number, number] {
    return size >= span ? [span - c - size / 2, size / 2 - c] : [size / 2 - c, span - c - size / 2];
  }
  function clampXF(v: XF): XF {
    const [x0, x1] = lim(cw0 * v.k, innerW, C0.x), [y0, y1] = lim(ch0 * v.k, stageH, C0.y);
    return { k: v.k, tx: Math.max(x0, Math.min(x1, v.tx)), ty: Math.max(y0, Math.min(y1, v.ty)) };
  }
  function target(z: Zone | null, editing: boolean): XF {
    if (!z) return { k: 1, tx: editing ? txCentre : 0, ty: 0 };
    const b = FRAME[z];
    const k = Math.min(b.max, innerW / (((b.x1 - b.x0) / 100) * cw0), stageH / (((b.y1 - b.y0) / 100) * ch0));
    const cy = ((b.y0 + b.y1) / 200 - 0.5) * ch0; // band centre, from the figure's centre
    return clampXF({ k, tx: txCentre, ty: -cy * k });
  }
  /** the transform of the stage that shows the figure at v while it is laid out at r */
  function relOf(v: XF, r: XF) {
    const s = v.k / r.k;
    return { s, dx: C0.x - S.x + v.tx - s * (C0.x + r.tx - S.x), dy: C0.y - S.y + v.ty - s * (C0.y + r.ty - S.y) };
  }
  function apply(v: XF) {
    xf.current = v;
    K.setValue(v.k); TX.setValue(v.tx); TY.setValue(v.ty); SO.setValue(statsFor(v.k));
  }
  function stopAnim() {
    if (!anim.current) return;
    anim.current.stop(); anim.current = null;
    apply(xf.current); // where it was going; it is put there outright
  }
  /** the figure at v with no motion: the values and the layout together */
  function place(v: XF) {
    stopAnim();
    apply(v);
    setRest({ k: v.k, tx: v.tx, ty: v.ty, moving: false });
  }
  function animateTo(v: XF, ms = ZOOM_MS) {
    stopAnim();
    xf.current = v;
    // laid out at the larger of the two zooms while it moves, so it is shrunk (sharp) rather than magnified (soft)
    const r = restRef.current;
    if (v.k > r.k + 0.001) setRest({ k: v.k, tx: v.tx, ty: v.ty, moving: true });
    else if (!r.moving) setRest({ ...r, moving: true });
    const tm = (a: Animated.Value, toValue: number) => Animated.timing(a, { toValue, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const a = Animated.parallel([tm(K, v.k), tm(TX, v.tx), tm(TY, v.ty), tm(SO, statsFor(v.k))]);
    anim.current = a;
    a.start(({ finished }) => {
      if (anim.current !== a) return;
      anim.current = null;
      if (finished) { apply(v); setRest({ k: v.k, tx: v.tx, ty: v.ty, moving: false }); }
    });
  }
  function zoomTo(z: Zone | null) {
    animateTo(target(z, V.editing));
    if (z !== V.zoom) { self.current = true; h.setV({ zoom: z, frame: null }); }
  }
  /** the band at the centre of the stage, for the label after a pinch */
  function zoneAt(v: XF): Zone {
    const yc = (((stageH / 2 - (C0.y + v.ty)) / v.k + ch0 / 2) / ch0) * 100;
    if (yc < HEAD_BAND) return "head";
    for (const z of Object.keys(ZONES) as BodyZone[]) if (yc < ZONES[z].y1) return z;
    return "lower";
  }
  // V.zoom set from elsewhere (a link to the head, say): frame it
  useEffect(() => {
    if (self.current) { self.current = false; return; }
    place(target(V.zoom, V.editing));
  }, [V.zoom]);
  // the stage changed size: keep the framing
  useEffect(() => { if (V.zoom) place(target(V.zoom, V.editing)); else if (V.editing) place({ k: 1, tx: txCentre, ty: 0 }); }, [cw0, stageH, innerW]);
  // editing starts or ends: the measurements slide out and the figure takes the middle
  useEffect(() => {
    if (gest.current.mode !== "none") return;
    if (!V.zoom) { const v = { k: 1, tx: V.editing ? txCentre : 0, ty: 0 }; if (Math.abs(v.tx - xf.current.tx) > 0.5 || xf.current.k !== 1) animateTo(v, 280); else SO.setValue(statsFor(1)); }
    else Animated.timing(SO, { toValue: statsFor(xf.current.k), duration: 200, useNativeDriver: true }).start();
  }, [V.editing]);

  // pinch to zoom, one finger to pan once zoomed
  const stageWin = useRef({ x: 0, y: 0, scrollY: 0 });
  function focal(ts: { pageX: number; pageY: number }[]) {
    const w = stageWin.current;
    let x = 0, y = 0;
    ts.forEach((p) => { x += p.pageX; y += p.pageY; });
    return { x: x / ts.length - w.x, y: y / ts.length - (w.y - (pageScroll.y - w.scrollY)) };
  }
  function begin(e: any, g: any) {
    const p = gest.current, ts = e.nativeEvent.touches;
    if (p.mode === "none") { stopAnim(); if (!restRef.current.moving) setRest({ ...restRef.current, moving: true }); }
    const c = xf.current;
    p.k0 = c.k; p.tx0 = c.tx; p.ty0 = c.ty; p.gdx0 = g.dx; p.gdy0 = g.dy;
    if (ts.length >= 2) {
      const [a, b] = ts, F = focal(ts);
      p.mode = "pinch"; p.d0 = Math.max(10, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY));
      p.qx = (F.x - C0.x - c.tx) / c.k; p.qy = (F.y - C0.y - c.ty) / c.k; // the figure point under the fingers stays under them
    } else p.mode = "pan";
  }
  function settle() {
    const p = gest.current;
    p.mode = "none";
    pageScroll.setLock(false);
    const c = xf.current;
    if (c.k < ZOOMED) {
      animateTo({ k: 1, tx: V.editing ? txCentre : 0, ty: 0 }, 240);
      if (V.zoom) { self.current = true; h.setV({ zoom: null }); }
      return;
    }
    setRest({ k: c.k, tx: c.tx, ty: c.ty, moving: false });
    const z = zoneAt(c);
    if (z !== V.zoom) { self.current = true; h.setV({ zoom: z }); }
  }
  function move(e: any, g: any) {
    const p = gest.current, ts = e.nativeEvent.touches;
    let v: XF;
    if (ts.length >= 2) {
      if (p.mode !== "pinch") begin(e, g);
      const [a, b] = ts;
      const d = Math.max(10, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY));
      const k = Math.max(1, Math.min(K_MAX, (p.k0 * d) / p.d0));
      const F = focal(ts);
      v = clampXF({ k, tx: F.x - C0.x - p.qx * k, ty: F.y - C0.y - p.qy * k });
    } else {
      if (p.mode !== "pan") begin(e, g);
      v = clampXF({ k: xf.current.k, tx: p.tx0 + g.dx - p.gdx0, ty: p.ty0 + g.dy - p.gdy0 });
    }
    apply(v);
    // far from the layout (magnified much, or panned near the drawn margin): lay it out again here
    const d = relOf(v, restRef.current);
    if (d.s > 1.6 || d.s < 0.62 || Math.abs(d.dx) > mx * 0.6 || Math.abs(d.dy) > my * 0.6) setRest({ k: v.k, tx: v.tx, ty: v.ty, moving: true });
  }
  // the responder is created once, so it reaches this render's functions (and geometry) through a ref
  const fn = useRef({ begin, move, settle });
  fn.current = { begin, move, settle };
  const pinchPan = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: (e, g) => {
      if (liftedRef.current) return false;
      const n = e.nativeEvent.touches.length;
      if (n >= 2) return true;
      return xf.current.k > 1.02 && n === 1 && (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6);
    },
    onPanResponderGrant: (e, g) => { fn.current.begin(e, g); pageScroll.setLock(true); },
    onPanResponderMove: (e, g) => fn.current.move(e, g),
    onPanResponderRelease: () => fn.current.settle(),
    onPanResponderTerminate: () => fn.current.settle(),
    onPanResponderTerminationRequest: () => false,
  })).current;
  const onStageLayout = () => {
    stageRef.current?.measureInWindow((x, y) => { stageWin.current.x = x; stageWin.current.y = y; stageWin.current.scrollY = pageScroll.y; });
  };
  // the page must not scroll under a pinch or a pan of the zoomed figure; the
  // lock goes on at the first touch, before the scroll view can start
  const onTouchStart = (e: any) => { if (xf.current.k > 1.02 || e.nativeEvent.touches.length >= 2) pageScroll.setLock(true); };
  const onTouchEnd = (e: any) => { if (e.nativeEvent.touches.length === 0 && gest.current.mode === "none") pageScroll.setLock(false); };

  // Fit: the figure takes whatever is left above the bottom nav once where
  // the card sits (measured each layout, so stories above it count) and the
  // rest of the card (header, scrubber, notes) are known. The rest is measured
  // against the stage, whose height is what is being set, so it does not
  // chase itself; a few passes at most, more only if the card moves.
  function refit() {
    const m = meas.current;
    if (m.top < 0 || !m.cardH || !m.rowH || !bodyMode || m.passes >= 4) return;
    const rest = m.cardH - m.rowH;
    const want = Math.round(Math.max(240, Math.min(520, win.height - m.top - rest - NAV_HEIGHT - 10)));
    if (Math.abs(want - stageHRef.current) > 2) { m.passes++; setStageH(want); }
  }
  const [bodyCardH, setBodyCardH] = useState(0); // the body card's height: the region views keep to it, so the section never jumps
  const onCardLayout = (e: LayoutChangeEvent) => {
    setCardW(e.nativeEvent.layout.width);
    if (!bodyMode) return; // a region's card is a different card; its height is not the body's
    meas.current.cardH = e.nativeEvent.layout.height;
    if (!V.editing && Math.abs(e.nativeEvent.layout.height - bodyCardH) > 1) setBodyCardH(Math.round(e.nativeEvent.layout.height));
    cardRef.current?.measureInWindow((_x, y) => {
      if (pageScroll.y < 0) return;
      const top = y + pageScroll.y;
      if (Math.abs(top - meas.current.top) > 6) { meas.current.top = top; meas.current.passes = 0; }
      refit();
    });
  };
  const onRowLayout = (e: LayoutChangeEvent) => {
    meas.current.rowH = e.nativeEvent.layout.height;
    refit();
  };

  // regions on the body (this side), or points on the canvas being viewed
  const figDims = { w: cw0 * rest.k, h: ch0 * rest.k }; // the figure's box as laid out
  const figScale = () => xf.current.k / restRef.current.k;
  const onSide = V.side === "back" ? { side: "back" as const } : {};
  function addPoint(pt: { x: number; y: number; parent?: string; side?: "back" }) {
    openPointForm(h, pt.parent ? "Add a point" : "Add a region", null, (region) => h.mutate((D) => { D.points.push({ id: newId(), region, ...pt }); }));
  }
  function addPointAt(e: any) {
    if (!V.editing || !cw0) return;
    const { locationX, locationY } = e.nativeEvent;
    addPoint({ x: +clamp01((locationX / figDims.w) * 100).toFixed(1), y: +clamp01((locationY / figDims.h) * 100).toFixed(1), ...onSide });
  }
  /** one at the middle of what is in view, to drag into place */
  function addPointCentre() {
    if (!bodyMode) { addPoint({ x: 50, y: 50, parent: V.region! }); return; }
    if (!cw0) return;
    const c = xf.current;
    const X = (((S.x - (C0.x + c.tx)) / c.k + cw0 / 2) / cw0) * 100, Y = (((S.y - (C0.y + c.ty)) / c.k + ch0 / 2) / ch0) * 100;
    addPoint({ x: +clamp01(X).toFixed(1), y: +clamp01(Y).toFixed(1), ...onSide });
  }
  // Save keeps what was done; Cancel puts the points back as they were when editing began
  const snap = useRef<Point[] | null>(null);
  useEffect(() => { if (V.editing) snap.current = D.points.map((p) => ({ ...p })); }, [V.editing]);
  function cancelEdit() { const s = snap.current; snap.current = null; if (s) h.mutate((D) => { D.points = s; }); h.setV({ editing: false, zoom: null }); }
  function saveEdit() { snap.current = null; h.setV({ editing: false, zoom: null }); }
  const movePoint = (id: string) => (x: number, y: number) => h.mutate((D) => {
    const p = D.points.find((q) => q.id === id);
    if (!p) return;
    p.x = +x.toFixed(1); p.y = +y.toFixed(1);
  });
  const setRegion = (r: string) => h.setV({ region: r, concern: null, frame: null, editing: false });
  const pts = D.points.filter((p) => !p.parent && (p.side || "front") === V.side);
  // ----- moving the body's regions as one: a box round them that drags and pinches -----
  const [group, setGroup] = useState<Group>("one");
  const [info, setInfo] = useState(false); // the editor's explanation, behind an info button
  useEffect(() => { if (!V.editing) { setGroup("one"); setInfo(false); } }, [V.editing]);
  const [gen, setGen] = useState(0); // a fresh box (and fresh animated values) after each move is committed
  const gv = useRef({ x: new Animated.Value(0), y: new Animated.Value(0), f: new Animated.Value(1) });
  const inGroup = (_p: Point) => group === "all";
  const gpts = V.editing && group !== "one" ? pts.filter(inGroup) : [];
  const gbox = useMemo(() => {
    if (!gpts.length || !figDims.w) return null;
    const ds = gpts;
    const padX = (26 / figDims.w) * 100, padY = (26 / figDims.h) * 100;
    const x0 = Math.min(...ds.map((p) => p.x)) - padX, x1 = Math.max(...ds.map((p) => p.x)) + padX;
    const y0 = Math.min(...ds.map((p) => p.y)) - padY, y1 = Math.max(...ds.map((p) => p.y)) + padY;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [gpts.map((p) => p.id + ":" + p.x + ":" + p.y).join(","), figDims.w, figDims.h]);
  const gg = useRef({ base: { tx: 0, ty: 0, f: 1 }, acc: { tx: 0, ty: 0, f: 1 }, c0: { x: 0, y: 0 }, d0: 0, n: 0 });
  function gBegin(e: any) {
    const ts = e.nativeEvent.touches, p = gg.current;
    let x = 0, y = 0; ts.forEach((q: any) => { x += q.pageX; y += q.pageY; });
    p.c0 = { x: x / (ts.length || 1), y: y / (ts.length || 1) };
    p.d0 = ts.length >= 2 ? Math.max(10, Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY)) : 0;
    p.n = ts.length; p.base = { ...p.acc };
  }
  function gMove(e: any) {
    const ts = e.nativeEvent.touches, p = gg.current;
    if (ts.length !== p.n) { gBegin(e); return; } // a finger added or lifted: carry on from here
    const s = figScale() || 1;
    let x = 0, y = 0; ts.forEach((q: any) => { x += q.pageX; y += q.pageY; });
    const cx = x / ts.length, cy = y / ts.length;
    const f = p.n >= 2 && p.d0 ? Math.max(0.3, Math.min(3, (p.base.f * Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY)) / p.d0)) : p.base.f;
    p.acc = { tx: p.base.tx + (cx - p.c0.x) / s, ty: p.base.ty + (cy - p.c0.y) / s, f };
    gv.current.x.setValue(p.acc.tx); gv.current.y.setValue(p.acc.ty); gv.current.f.setValue(p.acc.f);
  }
  function gEnd() {
    const p = gg.current, a = p.acc;
    liftedRef.current = false; pageScroll.setLock(false);
    if (gbox && (Math.abs(a.tx) > 0.01 || Math.abs(a.ty) > 0.01 || Math.abs(a.f - 1) > 0.001)) {
      // the box scales about its centre and then moves; each point the same way, in figure %
      const cx = gbox.x + gbox.w / 2, cy = gbox.y + gbox.h / 2, Tx = (a.tx / figDims.w) * 100, Ty = (a.ty / figDims.h) * 100;
      const ids = new Set(gpts.map((q) => q.id));
      h.mutate((D) => D.points.forEach((q) => {
        if (!ids.has(q.id)) return;
        const X = clamp01(cx + Tx + (q.x - cx) * a.f), Y = clamp01(cy + Ty + (q.y - cy) * a.f);
        q.x = +X.toFixed(1); q.y = +Y.toFixed(1);
      }));
    }
    p.acc = { tx: 0, ty: 0, f: 1 }; p.base = { tx: 0, ty: 0, f: 1 };
    gv.current = { x: new Animated.Value(0), y: new Animated.Value(0), f: new Animated.Value(1) };
    setGen((g) => g + 1);
  }
  const gfn = useRef({ gBegin, gMove, gEnd });
  gfn.current = { gBegin, gMove, gEnd };
  const groupPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { liftedRef.current = true; pageScroll.setLock(true); gfn.current.gBegin(e); },
    onPanResponderMove: (e) => gfn.current.gMove(e),
    onPanResponderRelease: () => gfn.current.gEnd(),
    onPanResponderTerminate: () => gfn.current.gEnd(),
    onPanResponderTerminationRequest: () => false,
  })).current;
  function pickGroup(g: Group) {
    setGroup(g);
    if (g === "all" && V.zoom) zoomTo(null);
  }
  /** the regions back where the drawing has them, by area */
  function snapGroup() {
    const defs = DEFAULT_POINTS_RAW.filter(([, , , s]) => (s || "front") === V.side);
    const ids = new Set(gpts.map((q) => q.id));
    h.mutate((D) => {
      const by = new Map<string, Point[]>();
      D.points.forEach((q) => { if (!ids.has(q.id)) return; const l = by.get(q.region); if (l) l.push(q); else by.set(q.region, [q]); });
      by.forEach((list, r) => {
        const d = defs.filter(([rr]) => rr === r).sort((a, b) => a[1] - b[1]);
        if (!d.length) return;
        list.sort((a, b) => a.x - b.x).forEach((q, i) => { const dd = d[Math.min(i, d.length - 1)]; q.x = dd[1]; q.y = dd[2]; });
      });
    });
  }
  const hasPhoto = fr.length > 0;
  const labelOp = useMemo(() => K.interpolate({ inputRange: [ZOOMED, 1.9], outputRange: [0, 1], extrapolate: "clamp" }), []);
  const faceOp = useMemo(() => K.interpolate({ inputRange: [1.8, 3.2], outputRange: [0, 1], extrapolate: "clamp" }), []);
  const statsOp = useMemo(() => SO.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), []);
  const statsX = useMemo(() => SO.interpolate({ inputRange: [0, 1], outputRange: [0, innerW - cw0] }), [innerW, cw0]);
  // the stage's transform while the figure moves: the live values against the layout (identity at rest)
  const rel = useMemo(() => {
    const s = Animated.divide(K, rest.k);
    const dx = Animated.add(Animated.subtract(TX, Animated.multiply(s, C0.x + rest.tx - S.x)), C0.x - S.x);
    const dy = Animated.add(Animated.subtract(TY, Animated.multiply(s, C0.y + rest.ty - S.y)), C0.y - S.y);
    return { s, dx, dy, inv: Animated.divide(1, s) };
  }, [rest.k, rest.tx, rest.ty, C0.x, C0.y, S.x, S.y]);
  // the group box's points keep their size on screen through the stage's motion and the box's own scale
  const ginv = useMemo(() => (rest.moving ? Animated.multiply(rel.inv, Animated.divide(1, gv.current.f)) : Animated.divide(1, gv.current.f)), [rest.moving, rest.n, gen]);
  // the figure's box at rest, and the part of it that is drawn (the stage and a margin to pan into)
  const fx = C0.x + rest.tx - figDims.w / 2, fy = C0.y + rest.ty - figDims.h / 2;
  const drawn = { x: -fx - mx, y: -fy - my, w: innerW + 2 * mx, h: stageH + 2 * my };

  // a photo of what is in view: the title, area and time are filled in
  function onCamera() {
    if (h.needVault()) return;
    const z = V.zoom, back = V.side === "back";
    const pre: Partial<Entry> = z === "head"
      ? { title: "My face", regions: ["face"], details: { series: "face", time: nowHHMM() } }
      : z ? { title: zoneLabel(z), regions: ["whole_body"], details: { series: "none", time: nowHHMM() } }
      : { title: back ? "Whole body, from behind" : "Whole body", regions: ["whole_body"], details: { series: "body", time: nowHHMM() } };
    const label = !z ? (back ? "Back" : "Front") : undefined;
    const first = !z && !hasPhoto;
    Alert.alert(
      first ? "Replace with your own photo" : "Add a photo",
      first ? "A full-length photo takes the place of the drawing, and your points sit on it. Every photo you add is kept, so you build up a record; the newest one is what is shown here." : "Choose a photo or take one now?",
      [
        { text: first ? "Not now" : "Cancel", style: "cancel" },
        { text: "Choose a photo", onPress: () => openForm(h, "photo", pre, { library: true, label }) },
        { text: "Take one now", onPress: () => openForm(h, "photo", pre, { camera: true, label }) },
      ],
    );
  }

  // ----- the editor: a layer over the page with the content as large as the screen allows, the controls over it -----
  const hint = !bodyMode
    ? "Tap the photo to add a point there, or use + Point. Hold a point to pick it up: it rises above your finger so you can see where it will land. Tap a point or its name to rename or remove it."
    : group === "one"
    ? "Tap the figure to add a region there, or use + Region. Hold a region to pick it up: it rises above your finger so you can see where it will land. Tap a region or its name to rename or remove it. Pinch to zoom in."
    : "Drag the box to move every region together. Pinch inside it to spread them out or gather them in; pinch outside it to zoom.";
  const editorLayer = (content: ReactNode, top: ReactNode, middle: ReactNode) => (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: 54, paddingBottom: 30 }}>{/* clear of the status bar and the home indicator, as the top bar and the nav are */}
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: 50, paddingBottom: 58 }}>
          <View style={{ flex: 1 }} onLayout={(e) => setEditH(Math.round(e.nativeEvent.layout.height))}>
            <NoSwipe style={{ flex: 1 }}>{content}</NoSwipe>
          </View>
        </View>
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View pointerEvents="box-none" style={{ position: "absolute", top: 8, left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 36 }} />
            <View pointerEvents="box-none" style={{ flex: 1, flexDirection: "row", justifyContent: "center" }}>{top}</View>
            <IconBtn k="info" label="How editing works" accent={info} onPress={() => setInfo((v) => !v)} />
          </View>
          {info ? (
            <Pressable onPress={() => setInfo(false)} accessibilityRole="button" accessibilityLabel="Close the explanation" style={{ position: "absolute", top: 52, right: 12, maxWidth: 320, backgroundColor: t.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: t.line, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
              <Text style={{ fontSize: 12.5, color: t.ink, fontFamily: t.fontUI, lineHeight: 18 }}>{hint}</Text>
            </Pressable>
          ) : null}
          <View pointerEvents="box-none" style={{ position: "absolute", bottom: 10, left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Btn label="Cancel" onPress={cancelEdit} />
            <View pointerEvents="box-none" style={{ flex: 1, flexDirection: "row", justifyContent: "center" }}>{middle}</View>
            <DonePill label={bodyMode ? "Save the regions" : "Save the points"} text="Save" onPress={saveEdit} />
          </View>
        </View>
      </View>
    </View>
  );

  // ----- a region's canvas (its photos, its points on them), a point's photos, or the teeth: a plain, fixed stage -----
  if (!bodyMode) {
    const parent = parentOf(D, V.region!); // a point's view sits under its region's
    const canvas = !parent && !teethView;
    const cpts = canvas ? D.points.filter((p) => p.parent === V.region) : [];
    let boxW: number, boxH: number, bg: string, clip = false;
    const hMax = Math.max(200, cardStageH - 56);
    if (teethView) { const a = 400 / 560; boxW = Math.min(cardInnerW, 440, hMax * a); boxH = boxW / a; bg = t.card; clip = true; }
    else { const a = 4 / 5; boxW = Math.min(cardInnerW, 420, hMax * a); boxH = boxW / a; bg = t.soft; }
    const title = rl(D, V.region!);
    const nPhotos = `${fr.length} photo${fr.length === 1 ? "" : "s"}`;
    const sub = teethView ? (() => { const n = Object.keys(teethData(D)).length; return n ? `${n} ${n === 1 ? "tooth" : "teeth"} noted` : "Tap a tooth"; })() : canvas && cpts.length ? `${nPhotos} · ${cpts.length} point${cpts.length === 1 ? "" : "s"}` : nPhotos;
    const backLabel = parent ? `← ${rl(D, parent)}` : V.zoom ? `← ${zoneLabel(V.zoom)}` : "← Whole body";
    const goBack = () => h.setV({ region: parent || null, frame: null, editing: false });
    const empty = V.region === "face" ? <FaceSvg /> : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", padding: 24 }]}><Text style={{ color: t.muted, textAlign: "center", fontFamily: t.fontUI }}>No photos of this area yet.</Text></View>;
    // the photos (or the drawing) with the region's points over them; while editing, as large as the screen allows
    const canvasView = (w: number, hh: number, editing: boolean) => (
      <View style={{ width: w, height: hh, borderRadius: 18, backgroundColor: bg, overflow: "hidden" }}>
        <Pressable onPress={(e) => { const { locationX, locationY } = e.nativeEvent; addPoint({ x: +clamp01((locationX / w) * 100).toFixed(1), y: +clamp01((locationY / hh) * 100).toFixed(1), parent: V.region! }); }} disabled={!editing} style={StyleSheet.absoluteFill}>
          {cur ? stack("cover", { w, h: hh }) : empty}
        </Pressable>
        {cpts.map((p) => <Hot key={p.id} p={p} label={rl(D, p.region)} active={active.has(p.region)} editing={editing} tappable={!editing} dims={{ w, h: hh }} scale={() => 1} lifted={liftedRef} invK={1} labelOp={1} onMove={movePoint(p.id)} onPress={() => (editing ? openPoint(h, p.id) : setRegion(p.region))} />)}
      </View>
    );
    const stage = teethView ? <TeethSvg onTooth={(n) => openTooth(h, n)} /> : cur ? stack("cover", { w: boxW, h: boxH }) : empty;
    const eH0 = editH || Math.max(300, win.height - 240), eW = Math.min(win.width - 24, eH0 * 0.8), eH = eW / 0.8;
    const addPre: Partial<Entry> = { regions: parent ? [parent, V.region!] : [V.region!], details: { time: nowHHMM(), ...(V.region === "face" ? { series: "face" } : {}) } };
    return (
      <View ref={cardRef} onLayout={onCardLayout} collapsable={false}>
        <Card style={{ alignItems: "center", gap: 12, minHeight: bodyCardH || undefined }}>
          <CardH title={title} sub={sub} style={{ width: "100%" }} />
          {canvas ? (
            <View style={{ width: boxW }}>
              {canvasView(boxW, boxH, false)}
              <View style={{ position: "absolute", bottom: 6, right: 6 }}><IconBtn k="edit" label="Edit the points" onPress={() => h.setV({ editing: true })} /></View>
            </View>
          ) : <View style={{ width: boxW, height: boxH, borderRadius: 18, backgroundColor: bg, overflow: clip ? "hidden" : "visible" }}>{stage}</View>}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {V.region === "teeth" ? <Seg value={V.mouthView} options={[["teeth", "Teeth"], ["photos", "Photos"]]} onChange={(v) => h.setV({ mouthView: v as "teeth" | "photos" })} /> : null}
            <Btn kind="dark" label={backLabel} onPress={goBack} />
            {cur && cur.entry && !teethView ? <Btn label="Adjust photo" onPress={() => setAdj(cur)} /> : null}
            {!teethView ? <Btn label="+ Photo of this area" onPress={() => { if (!h.needVault()) openForm(h, "photo", addPre); }} /> : null}
          </View>
          {teethView ? <TeethLegend /> : <Scrubber frames={fr} frame={frame} onChange={(i) => h.setV({ frame: i })} />}
          {adjustModal}
          {V.editing && canvas ? (
            <Portal>{editorLayer(
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{canvasView(eW, eH, true)}</View>,
              <Text style={{ fontSize: 15, fontFamily: t.fontUIBold, color: t.ink }}>{title}</Text>,
              <Btn label="+ Point" onPress={addPointCentre} />,
            )}</Portal>
          ) : null}
        </Card>
      </View>
    );
  }

  // ----- the figure, the measurements, and the zoom -----
  const figure = (
    <Animated.View key={rest.n} style={[StyleSheet.absoluteFill, rest.moving ? { transform: [{ translateX: rel.dx }, { translateY: rel.dy }, { scale: rel.s }] } : null]}>
      <View style={{ position: "absolute", left: fx, top: fy, width: figDims.w, height: figDims.h }}>
        <Pressable onPress={addPointAt} disabled={!V.editing || group !== "one"} style={StyleSheet.absoluteFill}>
          {cur ? stack(undefined, figDims) : <ZoomFigure k={rest.k} box={figDims} win={drawn} face={faceOp} side={V.side} />}
        </Pressable>
        {pts.filter((p) => !inGroup(p)).map((p) => (
          <Hot key={p.id} p={p} label={rl(D, p.region)} active={active.has(p.region)} editing={V.editing && group === "one"} tappable={!V.editing} dims={figDims} scale={figScale} lifted={liftedRef} invK={rest.moving ? rel.inv : 1} labelOp={V.editing ? 1 : labelOp} onMove={movePoint(p.id)} onPress={() => (V.editing ? openPoint(h, p.id) : setRegion(p.region))} />
        ))}
        {gbox ? (
          <Animated.View key={"g" + gen} {...groupPan.panHandlers} accessibilityLabel="All the regions. Drag to move them together, pinch to spread or gather them" style={{ position: "absolute", left: `${gbox.x}%`, top: `${gbox.y}%`, width: `${gbox.w}%`, height: `${gbox.h}%`, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.accent, transform: [{ translateX: gv.current.x }, { translateY: gv.current.y }, { scale: gv.current.f }] }}>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.accent, opacity: 0.08, borderRadius: 12 }]} />
            {gpts.map((p) => (
              <Hot key={p.id} p={{ ...p, x: ((p.x - gbox.x) / gbox.w) * 100, y: ((p.y - gbox.y) / gbox.h) * 100 }} label={rl(D, p.region)} active={false} editing={false} tappable={false} grouped dims={figDims} scale={figScale} lifted={liftedRef} invK={ginv} labelOp={1} onMove={() => {}} onPress={() => {}} />
            ))}
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );

  const corner = zoomed || V.editing;
  const editBtn = (
    <View style={{ position: "absolute", bottom: 2, left: corner ? undefined : cw0 - 30, right: corner ? 2 : undefined }}>
      <IconBtn k="edit" label="Edit the regions" onPress={() => h.setV({ editing: true })} />
    </View>
  );
  // the stage: the figure and its gestures; on the card, the measurements beside it and the pencil
  const stageView = (
    <View ref={stageRef} onLayout={(e) => { if (!V.editing) onRowLayout(e); onStageLayout(); }} collapsable={false} style={{ width: innerW, height: stageH, alignSelf: "center" }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd} {...pinchPan.panHandlers}>
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: V.editing ? 0 : 18, overflow: "hidden" }}>
        {figure}
      </View>
      {!V.editing ? (
        <Animated.View pointerEvents={corner ? "none" : "auto"} style={{ position: "absolute", left: cw0 + 16, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", opacity: statsOp, transform: [{ translateX: statsX }] }}>
          <StatBlocks />
        </Animated.View>
      ) : null}
      {!V.editing ? editBtn : null}
    </View>
  );
  const editor = editorLayer(
    stageView,
    <Seg small value={group} options={[["one", "One by one"], ["all", "All together"]]} onChange={(v) => pickGroup(v as Group)} />,
    group === "one" ? <Btn label="+ Region" onPress={addPointCentre} /> : <Btn label="Snap to the drawing" onPress={snapGroup} />,
  );

  return (
    <View ref={cardRef} onLayout={onCardLayout} collapsable={false}>
      <Card style={{ alignItems: "center", gap: 10 }}>
        <View style={{ width: "100%", flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 }}>
          <IconBtn k="camera" label={hasPhoto || zoomed ? "Add a photo" : "Replace the drawing with your own photo"} onPress={onCamera} />
          {cur && cur.entry && !zoomed && !V.editing ? <IconBtn k="expand" label="Adjust photo" onPress={() => setAdj(cur)} /> : null}
          {!V.editing ? <IconBtn k="rotate" label={V.side === "front" ? "Turn round: the back" : "Turn round: the front"} accent={V.side === "back"} onPress={() => h.setV({ side: V.side === "front" ? "back" : "front", frame: null, zoom: null })} /> : null}
          {zoomed && !V.editing ? (
            <Pressable onPress={() => zoomTo(null)} accessibilityRole="button" accessibilityLabel="Back to the whole body" hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 2, minHeight: 36, paddingRight: 6 }}>
              <Icon k="back" size={18} stroke={2.2} />
              <Text style={{ fontSize: 15, fontFamily: t.fontUIBold, color: t.ink }}>{zoneLabel(V.zoom!)}</Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }} />
          <IconBtn k="card" label="Health card" onPress={() => openCard(h)} />
        </View>
        {V.editing
          ? <View onLayout={onRowLayout} style={{ width: cardInnerW, height: cardStageH, borderRadius: 18, backgroundColor: t.soft }} />
          : <NoSwipe off={!zoomed} style={{ width: "100%" }}>{stageView}</NoSwipe>}
        <Scrubber frames={fr} frame={frame} onChange={(i) => h.setV({ frame: i })} />
        {adjustModal}
        {V.editing ? <Portal>{editor}</Portal> : null}
      </Card>
    </View>
  );
}

function Scrubber(props: { frames: Frame[]; frame: number; onChange: (i: number) => void }) {
  const t = useT();
  const [w, setW] = useState(0);
  const n = props.frames.length;
  const cur = props.frames[props.frame];
  // the track's place on screen, so a finger is measured against the track itself whatever it is over
  const trackRef = useRef<View>(null);
  const left = useRef(0);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { const x = e.nativeEvent.pageX; trackRef.current?.measureInWindow((wx) => { left.current = wx; pick(x - wx); }); },
    onPanResponderMove: (e) => pick(e.nativeEvent.pageX - left.current),
    onPanResponderTerminationRequest: () => false,
  })).current;
  const stateRef = useRef({ w, n, frame: props.frame, onChange: props.onChange });
  stateRef.current = { w, n, frame: props.frame, onChange: props.onChange };
  function pick(x: number) {
    const { w, n, frame, onChange } = stateRef.current;
    if (!w || n < 2) return;
    const i = Math.max(0, Math.min(n - 1, Math.round((x / w) * (n - 1))));
    if (i !== frame) onChange(i);
  }
  if (n < 2) return null;
  const step = Math.max(1, Math.ceil(n / 40));
  return (
    <NoSwipe style={[st.scrub, { backgroundColor: t.soft }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ fontFamily: t.fontUIBold, fontSize: 14, color: t.ink }}>{cur?.base ? "Today" : fmt(cur?.date)}</Text>
        <Text style={{ fontSize: 11.5, color: t.muted, fontFamily: t.fontUI }}>{n} photos · {fmtShort(props.frames[0].date)} – {fmtShort(props.frames[n - 1].date)}</Text>
      </View>
      <View ref={trackRef} collapsable={false} onLayout={(e) => { setW(e.nativeEvent.layout.width); trackRef.current?.measureInWindow((wx) => { left.current = wx; }); }} {...pan.panHandlers} style={{ paddingTop: 6, paddingBottom: 8 }} accessibilityRole="adjustable" accessibilityLabel="Scrub through photos by date" accessibilityValue={{ text: cur?.base ? "Today" : fmt(cur?.date) }}>
        <View pointerEvents="none" style={{ flexDirection: "row", justifyContent: "space-between", height: 12, alignItems: "flex-end", paddingHorizontal: 8 }}>
          {props.frames.map((_, i) => (i % step === 0 || i === props.frame ? <View key={i} style={{ width: 2, height: i === props.frame ? 12 : 7, borderRadius: 1, backgroundColor: i === props.frame ? t.ink : t.line }} /> : <View key={i} style={{ width: 0 }} />))}
        </View>
        <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: t.line, marginTop: 6 }}>
          <View style={{ position: "absolute", top: -8, left: `${(props.frame / (n - 1)) * 100}%`, marginLeft: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: t.ink }} />
        </View>
      </View>
    </NoSwipe>
  );
}

// weight, body fat, height in a column beside the figure, left-aligned with
// each other and centred in the column. Tap the unit to switch it.
function StatBlocks() {
  const h = useHealth();
  const t = h.t;
  const one = (k: string) => {
    // the stored values, in kg and cm: showMeasure converts once (the chart series already comes converted)
    const p = measurePoints(h.D, k); // typed in and from Apple Health together, by the Health setting
    const lp = p[p.length - 1];
    const delta = p.length > 1 && k !== "height" ? numIn(h.D, k, lp.v) - numIn(h.D, k, p[0].v) : null;
    const ch = delta != null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} since ${fmtShort(p[0].d)}` : lp ? `Recorded ${fmtShort(lp.d)}${lp.src ? ` · ${lp.src}` : ""}` : "";
    const m = h.D.metrics[k] || { l: k, u: "" };
    const shown = lp ? showMeasure(h.D, k, lp.v) : null;
    const switchable = k === "weight" || k === "height";
    const uw = unitWord(h.D, k);
    return (
      <Pressable key={k} onPress={() => openForm(h, "measurement", { details: { metric: k, time: nowHHMM() } })} style={{ gap: 1 }} accessibilityRole="button" accessibilityLabel={`Log a new ${m.l.toLowerCase()}`}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 11.5, color: t.muted, fontFamily: t.fontUISemi }}>{m.l}</Text>
          <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: t.onAccent, fontSize: 11, lineHeight: 13, fontWeight: "800" }}>+</Text></View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
          <Text style={{ fontSize: 23, fontFamily: t.fontUIHeavy, color: t.ink, letterSpacing: -0.5, lineHeight: 27 }}>{shown ? shown.value : "–"}</Text>
          {switchable ? (
            <Pressable onPress={() => h.mutate((D) => toggleUnit(D, k as "weight" | "height"))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Shown in ${uw}. Switch unit`} style={{ borderBottomWidth: 1, borderBottomColor: t.line, borderStyle: "dotted" }}>
              <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUISemi }}>{uw}</Text>
            </Pressable>
          ) : shown && shown.unit ? <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUISemi }}>{shown.unit}</Text> : null}
        </View>
        <Text style={{ fontSize: 11, color: t.muted, fontFamily: t.fontUI }} numberOfLines={1}>{lp ? ch : "Not recorded"}</Text>
      </Pressable>
    );
  };
  return <View style={{ gap: 12, alignItems: "flex-start" }}>{one("weight")}{one("body_fat")}{one("height")}</View>;
}

const st = StyleSheet.create({ scrub: { width: "100%", maxWidth: 520, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 } });
