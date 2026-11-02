// The outline body figure, the same geometry as the web (figureSVG), so points
// land in the same places on both. The head drawing (the web's headSVG) is
// drawn onto the figure's head at HEAD_S scale, so there is one figure: from a
// distance only the outline and hair show; the face and its points fade in as
// you zoom. Head-zone points keep the web's head-drawing coordinates and are
// mapped with headToBody / bodyToHead.
import { useState, type ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Ellipse, G, Path } from "react-native-svg";
import { useT } from "../ui";

// An SVG that fills whatever box it is placed in. react-native-svg wants
// numbers for width and height, so the box is measured first.
export function FitSvg(props: { viewBox: string; children: ReactNode; label?: string; interactive?: boolean }) {
  const [sz, setSz] = useState({ w: 0, h: 0 });
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setSz({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} pointerEvents={props.interactive ? "auto" : "none"}>
      {sz.w > 0 && sz.h > 0 ? <Svg width={sz.w} height={sz.h} viewBox={props.viewBox} accessibilityLabel={props.label}>{props.children}</Svg> : null}
    </View>
  );
}

// right half of a front-facing figure (viewBox 200×460), neck to crotch; mirrored for the left.
// Proportions of a standing adult: the head a seventh of the height (top 6, chin 68),
// the crotch just past halfway (240), the wrists at the crotch, feet at 450.
const FIG_RIGHT: [number, number][] = [[108, 70], [110, 85], [124, 92], [142, 97], [151, 106], [155, 123], [159, 144], [164, 164], [169, 185], [174, 204], [178, 215], [183, 225], [183, 236], [177, 241], [170, 238], [168, 228], [165, 219], [159, 200], [152, 180], [146, 159], [141, 140], [138, 128], [137, 146], [133, 167], [128, 188], [132, 206], [137, 225], [138, 256], [134, 295], [129, 330], [131, 365], [127, 404], [124, 427], [130, 441], [127, 450], [108, 450], [107, 436], [108, 420], [106, 383], [106, 342], [104, 300], [103, 265], [100, 240]];
function smoothClosed(pts: [number, number][], k = 7): string {
  const n = pts.length, P = (i: number) => pts[(i + n) % n];
  let d = `M${P(0)[0].toFixed(1)} ${P(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += ` C${(p1[0] + (p2[0] - p0[0]) / k).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / k).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / k).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / k).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + " Z";
}
export function figurePath(w = 1): string {
  const sx = (x: number) => 100 + (x - 100) * w;
  const right = FIG_RIGHT.map(([x, y]) => [sx(x), y] as [number, number]);
  const left = FIG_RIGHT.slice(0, -1).reverse().map(([x, y]) => [sx(200 - x), y] as [number, number]);
  return smoothClosed([...right, ...left]);
}
const FIG_D = figurePath();

// The head drawing (viewBox 200×250) sits on the figure (viewBox 200×460) at
// this scale, its face centre (100, 110) on the figure's head centre (100, 37):
// hair top at 6, chin at 68, ears 20 either side.
export const HEAD_S = 0.34;
/** a head-drawing point (% of 200×250) as a figure point (% of 200×460) */
export const headToBody = (x: number, y: number): { x: number; y: number } => ({ x: (100 + (2 * x - 100) * HEAD_S) / 2, y: (37 + (2.5 * y - 110) * HEAD_S) / 4.6 });
/** a figure point as a head-drawing point */
export const bodyToHead = (X: number, Y: number): { x: number; y: number } => ({ x: ((2 * X - 100) / HEAD_S + 100) / 2, y: ((4.6 * Y - 37) / HEAD_S + 110) / 2.5 });
/** the head drawing's box on the figure, in % of the figure */
export const HEAD_BOX = { left: (100 - 100 * HEAD_S) / 2, top: (37 - 110 * HEAD_S) / 4.6, width: 100 * HEAD_S, height: (250 * HEAD_S) / 4.6 };
/** whether a head-drawing point lands on the face or hair (not the space around it) */
export const onHead = (hx: number, hy: number): boolean => hx >= 12 && hx <= 88 && hy >= 4 && hy <= 84;

const FACE = "M100 30 C148 30 160 68 158 110 C156 158 136 196 100 201 C64 196 44 158 42 110 C40 68 52 30 100 30Z";
const HAIR = "M44 104 C38 44 72 18 100 18 C128 18 162 44 156 104 C152 72 132 46 100 46 C68 46 48 72 44 104Z";
// the hair from behind: over the whole back of the head, down to the nape
const BACK_HAIR = "M44 104 C38 44 72 18 100 18 C128 18 162 44 156 104 C158 148 146 176 128 188 C110 182 90 182 72 188 C54 176 42 148 44 104Z";

/** the features: eyes, brows, nose, mouth, in the head drawing's units */
function Features() {
  return (
    <>
      <Path d="M63 109 Q76 100 89 109 Q76 116 63 109Z" /><Path d="M111 109 Q124 100 137 109 Q124 116 111 109Z" />
      <Path d="M62 97 Q76 90 90 96 M110 96 Q124 90 138 97" strokeOpacity={0.55} />
      <Path d="M100 114 Q97 132 92 141 Q100 146 108 141" />
      <Path d="M83 165 Q92 159 100 162 Q108 159 117 165 Q100 175 83 165Z" />
    </>
  );
}

/** the head's outline, ears and hair, placed on the figure; `sw` is in the head drawing's units */
function HeadShape(props: { sw: number; back?: boolean }) {
  const t = useT();
  return (
    <G transform={`translate(100 37) scale(${HEAD_S}) translate(-100 -110)`} strokeWidth={props.sw} strokeLinecap="round">
      <Ellipse cx={41} cy={119} rx={9} ry={17} /><Ellipse cx={159} cy={119} rx={9} ry={17} />
      <Path d={FACE} />
      <Path d={props.back ? BACK_HAIR : HAIR} fill={t.line} strokeOpacity={0.5} />
    </G>
  );
}

/** the face canvas with no photo: the head drawing (200×250, the canvas's 4:5), its points sit on the features */
export function FaceSvg() {
  const t = useT();
  return (
    <FitSvg viewBox="0 0 200 250" label="Outline of a face">
      <G fill={t.soft} stroke={t.muted} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" strokeOpacity={0.75}>
        <Ellipse cx={41} cy={119} rx={9} ry={17} /><Ellipse cx={159} cy={119} rx={9} ry={17} />
        <Path d={FACE} />
        <Path d={HAIR} fill={t.line} strokeOpacity={0.5} />
        <G fill="none"><Features /></G>
      </G>
    </FitSvg>
  );
}

/** the still figure: outline, head and hair, no face (placeholders) */
export function FigureSvg(props: { w?: number }) {
  const t = useT();
  return (
    <FitSvg viewBox="0 0 200 460" label="Outline of a body">
      <G fill={t.soft} stroke={t.muted} strokeWidth={1.3} strokeLinejoin="round" strokeOpacity={0.75}>
        <Path d={props.w && props.w !== 1 ? figurePath(props.w) : FIG_D} />
        <HeadShape sw={4.5} />
      </G>
    </FitSvg>
  );
}

/** the body outline alone, white, over the camera: a height and framing reference */
export function FigureOutline() {
  return (
    <FitSvg viewBox="0 0 200 460" label="Body outline guide">
      <G fill="none" stroke="#FFFFFF" strokeWidth={2} strokeOpacity={0.65} strokeLinejoin="round">
        <Path d={FIG_D} />
        <HeadShape sw={4.5} />
      </G>
    </FitSvg>
  );
}

/** the head alone, white, over the camera for face shots: the face canvas's shape, so a shot framed by it is the canvas */
export function FaceOutline() {
  return (
    <FitSvg viewBox="0 0 200 250" label="Face outline guide">
      <G fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeOpacity={0.65} strokeLinecap="round" strokeLinejoin="round">
        <Ellipse cx={41} cy={119} rx={9} ry={17} /><Ellipse cx={159} cy={119} rx={9} ry={17} />
        <Path d={FACE} />
        <Path d={HAIR} strokeOpacity={0.35} />
      </G>
    </FitSvg>
  );
}

export type Rect = { x: number; y: number; w: number; h: number };
const meet = (a: Rect, b: Rect): Rect | null => {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x && y1 > y ? { x, y, w: x1 - x, h: y1 - y } : null;
};

// The figure for the body card. Its box is the figure at the card's zoom k,
// so it can be far larger than the stage; only `win` (the stage and a margin
// around it, in the box's coordinates) is drawn, through a viewBox cropped to
// it. So the drawing is as sharp at 6× as at 1× and costs the same. Lines
// thin a little as k grows. The face fades in with `face`.
export function ZoomFigure(props: { k: number; box: { w: number; h: number }; win: Rect; face: Animated.AnimatedInterpolation<number>; side?: "front" | "back" }) {
  const t = useT();
  const { k, box, win } = props;
  const back = props.side === "back";
  const thin = Math.pow(k, 0.6);
  const vb = `${(win.x / box.w) * 200} ${(win.y / box.h) * 460} ${(win.w / box.w) * 200} ${(win.h / box.h) * 460}`;
  // the face: where the head drawing's box meets the window (in head-drawing units)
  const hb: Rect = { x: (HEAD_BOX.left / 100) * box.w, y: (HEAD_BOX.top / 100) * box.h, w: (HEAD_BOX.width / 100) * box.w, h: (HEAD_BOX.height / 100) * box.h };
  const fb = k >= 1.5 && !back ? meet(hb, win) : null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={win.w} height={win.h} viewBox={vb} style={{ position: "absolute", left: win.x, top: win.y }} accessibilityLabel="Outline of a body">
        <G fill={t.soft} stroke={t.muted} strokeWidth={1.3 / thin} strokeLinejoin="round" strokeOpacity={0.75}>
          <Path d={FIG_D} />
          <HeadShape sw={4.5 / thin} back={back} />
        </G>
      </Svg>
      {fb ? (
        <Animated.View style={{ position: "absolute", left: fb.x, top: fb.y, width: fb.w, height: fb.h, opacity: props.face }}>
          <Svg width={fb.w} height={fb.h} viewBox={`${((fb.x - hb.x) / hb.w) * 200} ${((fb.y - hb.y) / hb.h) * 250} ${(fb.w / hb.w) * 200} ${(fb.h / hb.h) * 250}`}>
            <G fill="none" stroke={t.muted} strokeWidth={1.6 / Math.pow(k, 0.25)} strokeLinejoin="round" strokeLinecap="round" strokeOpacity={0.8}>
              <Features />
            </G>
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
