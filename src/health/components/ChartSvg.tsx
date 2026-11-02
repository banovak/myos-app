// Values over time, drawn with react-native-svg from the same maths as the
// web's drawChart(): up to two axes (line / area / column / dots, 7-day
// average; a count per month as a column over the month, stacked with the
// other counts on its axis),
// period bands in lanes, entry markers, photo and session markers along the
// bottom, a readout on touch. The axis columns are fixed and the plot sits in
// a sideways scroller: when the chart is set to scroll, the range is how far
// back the data goes and the window how much shows at once, the plot opens at
// today, and the readout is hold-then-drag; otherwise the plot fits and a
// plain drag reads. A fixed y range clips the series to it. No trend lines
// between layers, no statistics.
import { useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { NoSwipe } from "../../shell/NoSwipe";
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { MONTHS, addDays, avg, dayDiff, fmt, fmtShort, iso, money, monthLabel, pd, today } from "../model/dates";
import { chartRange, extraColor, niceStep, smoothPath } from "../model/charts";
import { cycleDayOf, cyclePeriods } from "../model/cycle";
import { bandSrc, logsOf, regColor, regParts } from "../model/regimens";
import { appts, fmtV, getSeries, metric, readingFor, unitLabel, type Series, type SeriesPoint } from "../model/series";
import type { Chart, D } from "../model/types";
import { DEFAULT_Y1, DEFAULT_Y2, rl } from "../model/vocab";
import { useHealth } from "../state/HealthContext";
import { colorOf } from "../theme";
import { Swatch, useT } from "../ui";
import { openEntry } from "../sheets";

type Scale = { pts: SeriesPoint[]; lo: number; hi: number; st: number; y: (v: number) => number; monthly?: boolean };
type Line_ = Series & { kind: "line" };
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, Math.floor(n) - 1)) + "…" : s);
/** a fixed y range when both ends are numbers and in order */
export const fixedRange = (r?: [number | null, number | null]): [number, number] | null => (r && typeof r[0] === "number" && typeof r[1] === "number" && r[0] < r[1] ? [r[0], r[1]] : null);
/** how many days of the range show at once when the chart scrolls */
const windowDays = (to: string, months: number): number => { const d = pd(to); d.setMonth(d.getMonth() - months); return Math.max(28, dayDiff(iso(d), to)); };

export function ChartSvg(props: { c: Chart; height?: number; small?: boolean }) {
  const h = useHealth();
  const t = useT();
  const D = h.D, c = props.c;
  const [W, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null); // x in plot coordinates
  const [reading, setReading] = useState(false); // scroll mode: holding to read
  const sx = useRef(0); // the scroller's offset, for placing the readout
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startX = useRef(0);
  const s1 = c.y1 ? getSeries(D, c.y1) : null, s2 = c.y2 ? getSeries(D, c.y2) : null;
  const L1 = s1 && s1.kind === "line" ? s1 : null, L2 = s2 && s2.kind === "line" ? s2 : null;
  // more lines sharing an axis's scale
  const lines = (ids: string[] | undefined) => (ids || []).map((id) => getSeries(D, id)).filter((s): s is Line_ => !!s && s.kind === "line");
  const X1 = lines(c.y1More), X2 = lines(c.y2More);
  const sessions = c.sessions || [];
  const H = props.height || Math.round(Math.min(420, Math.max(210, W * 0.42)));
  const scrollOn = !!c.scroll;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: (e) => setHover(e.nativeEvent.locationX),
    onPanResponderMove: (e) => setHover(e.nativeEvent.locationX),
    onPanResponderRelease: () => setHover(null),
    onPanResponderTerminate: () => setHover(null),
  })).current;

  if (!L1 && !L2 && !c.bands.length && !c.photos.length && !sessions.length) return <Text style={{ color: t.muted, fontSize: 13, fontFamily: t.fontUI }}>Pick something to chart.</Text>;
  const [from, to] = chartRange(D, c), a = pd(from).getTime(), b = pd(to).getTime();
  const PS = c.photos.length || sessions.length ? 22 : 0, T = 8, AX = 22, ph = H - T - AX - PS;
  const col1 = colorOf(c.y1Color, t, DEFAULT_Y1), col2 = colorOf(c.y2Color, t, DEFAULT_Y2), gid = "g" + c.id.replace(/\W/g, "");

  // periods: soft blocks, overlapping ones split into lanes
  type Seg = { f: string; t: string; label: string; col: string; rid: string | null; lane: number };
  const segs: Seg[] = c.bands.flatMap((id) => {
    if (id === "cycle") return cyclePeriods(D).map((p) => { const f = p.start > from ? p.start : from, tt = p.end < to ? p.end : to; return f <= tt ? { f, t: tt, label: "Period", col: "#E05A7E", rid: null, lane: 0 } : null; }).filter(Boolean) as Seg[];
    const r = bandSrc(D, id);
    if (!r) return [];
    const parts = r.regimen ? regParts(r.regimen) : r.episodes ? r.episodes.map((e) => ({ from: e.from, to: e.to || today(), label: e.label || r.name })) : [{ from: r.started_on, to: r.ended_on || today(), label: r.name }];
    return parts.map((pt) => { const f = pt.from > from ? pt.from : from, tt = pt.to < to ? pt.to : to; return f <= tt ? { f, t: tt, label: pt.label, col: colorOf(r.color, t, regColor({})), rid: id.startsWith("k:") ? null : id, lane: 0 } : null; }).filter(Boolean) as Seg[];
  }).sort((p, q) => (p.f < q.f ? -1 : 1));
  const lanes: string[] = [];
  segs.forEach((s) => { let k = lanes.findIndex((end) => end < s.f); if (k < 0) { k = lanes.length; lanes.push(s.t); } else lanes[k] = s.t; s.lane = k; });
  const lh = ph / Math.max(1, lanes.length);

  const inRange = (s: Line_) => s.points.filter((p) => p.d >= from && p.d <= to);
  /** the counts per month on an axis: the main series when it is one, then the extras that are; they stack */
  const stackOf = (s: Line_ | null, extra: Line_[]): Line_[] => [...(s && s.monthly ? [s] : []), ...extra.filter((e) => e.monthly)];
  const scale = (s: Line_, type?: string, extra: Line_[] = [], fixed?: [number, number] | null): Scale | null => {
    const pts = inRange(s);
    let all = [...pts, ...extra.flatMap(inRange)]; // the scale covers every line on the axis
    const stack = stackOf(s, extra);
    if (stack.length > 1) {
      // stacked columns: the top is the month's total
      const sums: Record<string, number> = {};
      stack.forEach((m) => inRange(m).forEach((p) => { sums[p.d] = (sums[p.d] || 0) + p.v; }));
      all = [...all, ...Object.entries(sums).map(([d, v]) => ({ d, v }))];
    }
    if (!all.length) return null;
    const isTime = s.mkind === "time" || s.mkind === "time_night" || s.mkind === "duration";
    if (fixed) {
      // the range as set; the step from it, no rounding of the ends
      const [lo, hi] = fixed, st = isTime ? (hi - lo > 240 ? 60 : 30) : Math.max(niceStep(hi - lo, 4), s.step || 0);
      return { pts, lo, hi, st, y: (v) => T + (1 - (v - lo) / (hi - lo)) * ph, monthly: s.monthly };
    }
    let lo = Math.min(...all.map((p) => p.v)), hi = Math.max(...all.map((p) => p.v));
    const rs = s.scale || { lo: 1, hi: 5 };
    if (type === "column" || s.monthly) { lo = 0; if (s.rating) hi = Math.max(hi, rs.hi); } else if (s.rating) { lo = Math.min(lo, rs.lo); hi = Math.max(hi, rs.hi); }
    else {
      // room above and below: a tenth of the range, at least two steps, and a tenth of the value when there is no range at all
      const range = hi - lo, pad = Math.max(range * 0.1, (s.step || 0) * 2, range < 1e-9 ? Math.max(Math.abs(hi) * 0.1, 0.5) : 0);
      lo -= pad; hi += pad;
    }
    const st = isTime ? (hi - lo > 240 ? 60 : 30) : Math.max(niceStep(Math.max(hi - lo, s.rating ? rs.hi - rs.lo : 0.5), 4), s.step || 0);
    lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st; if (hi === lo) hi = lo + st;
    return { pts, lo, hi, st, y: (v) => T + (1 - (v - lo) / (hi - lo)) * ph, monthly: s.monthly };
  };
  const A1 = L1 && scale(L1, c.y1Type, X1, fixedRange(c.y1Range)), A2 = L2 && scale(L2, c.y2Type, X2, fixedRange(c.y2Range)), G0 = A1 || A2;
  const onAxis = (A: Scale, s: Line_): Scale => ({ ...A, pts: inRange(s), monthly: s.monthly });
  const xcol = (i: number) => extraColor(i, [col1, col2]);
  // axis labels: the whole number (63.5, not a clipped ".5"); the unit is in the legend. Times keep their own format
  const fmtAx = (s: Line_, v: number) => ((s.mkind === "time" || s.mkind === "time_night" || s.mkind === "duration") && s.fmt ? s.fmt(v) : String(+v.toFixed(2)));
  // each axis column is as wide as its longest label
  const axW = (s: Line_, A: Scale) => { let n = 0; for (let v = A.lo; v <= A.hi + 1e-9; v += A.st) n = Math.max(n, fmtAx(s, v).length); return Math.max(40, Math.round(n * 6.6 + 14)); };
  const L = A1 && L1 ? axW(L1, A1) : 10, R = A2 && L2 ? axW(L2, A2) : 10, pw = Math.max(1, W - L - R);
  // the plot: as wide as the scroller when the chart fits, wider when it scrolls
  const totalDays = Math.max(1, dayDiff(from, to)), visDays = scrollOn ? Math.min(totalDays, windowDays(to, c.window || 3)) : totalDays;
  const PW = Math.max(pw, Math.round((pw * totalDays) / visDays)), scrolls = PW > pw + 1;
  const x = (d: string) => ((pd(d).getTime() - a) / (b - a)) * PW;
  const both = !!(A1 && A2 && c.y1Type === "column" && c.y2Type === "column");
  const colW = (A: Scale) => { const xs = A.pts.map((p) => x(p.d)).sort((p, q) => p - q); let gap = PW; for (let i = 1; i < xs.length; i++) gap = Math.min(gap, xs[i] - xs[i - 1]); return Math.max(4, Math.min(28, gap * (both ? 0.36 : 0.56))); };
  const roll = (pts: SeriesPoint[]) => pts.map((p) => { const f = addDays(p.d, -6), win = pts.filter((q) => q.d >= f && q.d <= p.d); return { d: p.d, v: avg(win.map((q) => q.v))!, flag: p.flag }; });
  const plot: React.ReactNode[] = [], series: React.ReactNode[] = [], left: React.ReactNode[] = [], right: React.ReactNode[] = [];
  let key = 0;
  const K = () => String(key++);

  segs.forEach((s) => {
    const x1 = x(s.f), x2 = Math.max(x1 + 3, x(s.t)), y = T + s.lane * lh + 2;
    plot.push(<Rect key={K()} x={x1} y={y} width={x2 - x1} height={Math.max(1, lh - 4)} rx={8} fill={s.col} fillOpacity={0.2} />);
    if (s.rid) logsOf(D, s.rid, s.f, s.t).forEach((l) => plot.push(<Rect key={K()} x={x(l.on_date) - 1} y={y + lh - 13} width={2.2} height={7} rx={1.1} fill={s.col} />));
    if (x2 - x1 > 50 && lh > 20) plot.push(<SvgText key={K()} x={x1 + 9} y={y + 15} fill={t.ink} opacity={0.62} fontSize={10.5} fontFamily={t.fontUI}>{trunc(s.label, (x2 - x1 - 16) / 6)}</SvgText>);
  });
  if (G0 && c.grid) for (let v = G0.lo; v <= G0.hi + 1e-9; v += G0.st) plot.push(<Line key={K()} x1={0} x2={PW} y1={G0.y(v)} y2={G0.y(v)} stroke={t.line} opacity={0.7} />);
  if (A1 && L1) for (let v = A1.lo; v <= A1.hi + 1e-9; v += A1.st) left.push(<SvgText key={K()} x={L - 8} y={A1.y(v) + 3.5} textAnchor="end" fill={t.muted} fontSize={10.5} fontFamily={t.fontData}>{fmtAx(L1, v)}</SvgText>);
  if (A2 && L2) for (let v = A2.lo; v <= A2.hi + 1e-9; v += A2.st) right.push(<SvgText key={K()} x={8} y={A2.y(v) + 3.5} fill={t.muted} fontSize={10.5} fontFamily={t.fontData}>{fmtAx(L2, v)}</SvgText>);

  const drawCols = (A: Scale, col: string, shift: number) => {
    const bw = colW(A), r = Math.min(7, bw / 2), base = A.y(A.lo);
    A.pts.forEach((p) => {
      const cx = x(p.d) + shift * bw * 0.55, y = A.y(p.v), hh = Math.max(0, base - y), x0 = cx - bw / 2;
      series.push(hh > r ? <Path key={K()} d={`M${x0} ${base}V${y + r}Q${x0} ${y} ${x0 + r} ${y}H${x0 + bw - r}Q${x0 + bw} ${y} ${x0 + bw} ${y + r}V${base}Z`} fill={col} /> : <Rect key={K()} x={x0} y={y} width={bw} height={hh} fill={col} />);
      if (A.pts.length <= 14 && bw >= 14) series.push(<SvgText key={K()} x={cx} y={y - 6} textAnchor="middle" fill={t.muted} fontSize={10.5} fontFamily={t.fontUISemi}>{String(+(+p.v).toFixed(1))}</SvgText>);
      if (p.flag) series.push(<SvgText key={K()} x={cx} y={y - (A.pts.length <= 14 && bw >= 14 ? 18 : 6)} textAnchor="middle" fill={col} fontSize={10.5} fontFamily={t.fontUISemi}>{p.flag}</SvgText>);
    });
  };
  /** counts per month as columns over their month, stacked in order; the total sits on top */
  const drawMonthly = (A: Scale, stack: { pts: SeriesPoint[]; col: string }[]) => {
    const months = [...new Set(stack.flatMap((s) => s.pts.map((p) => p.d)))].sort();
    months.forEach((d) => {
      const n = pd(d), x0 = Math.max(0, x(d)), x1 = Math.min(PW, x(iso(new Date(n.getFullYear(), n.getMonth() + 1, 1)))), w = x1 - x0, bw = Math.max(3, w * 0.72), cx = (x0 + x1) / 2;
      let acc = 0;
      stack.forEach((s, si) => {
        const p = s.pts.find((q) => q.d === d);
        if (!p || !p.v) return;
        const y1 = A.y(acc + p.v), y0 = A.y(acc), hh = Math.max(1, y0 - y1), last = !stack.slice(si + 1).some((o) => (o.pts.find((q) => q.d === d) || { v: 0 }).v);
        series.push(<Rect key={K()} x={cx - bw / 2} y={y1} width={bw} height={hh} fill={s.col} rx={last ? Math.min(3, bw / 3) : 0} />);
        acc += p.v;
      });
      if (acc && w >= 22) series.push(<SvgText key={K()} x={cx} y={A.y(acc) - 5} textAnchor="middle" fill={t.muted} fontSize={10.5} fontFamily={t.fontUISemi}>{String(acc)}</SvgText>);
    });
  };
  const drawLine = (A: Scale, col: string, type: string, g: string, av?: boolean) => {
    const src = av ? roll(A.pts) : A.pts, xy = src.map((p) => [x(p.d), A.y(p.v)] as [number, number]);
    if (!xy.length) return;
    if (type === "dots") {
      // a scatter: each reading on its own, no line between them
      xy.forEach((p, j) => { series.push(<Circle key={K()} cx={p[0]} cy={p[1]} r={3.6} fill={col} stroke={t.card} strokeWidth={1.2} />); const f = A.pts[j] && A.pts[j].flag; if (f) series.push(<SvgText key={K()} x={p[0]} y={p[1] - 9} textAnchor="middle" fill={col} fontSize={10.5} fontFamily={t.fontUISemi}>{f}</SvgText>); });
      return;
    }
    const d = smoothPath(xy);
    if (av) A.pts.forEach((p) => series.push(<Circle key={K()} cx={x(p.d)} cy={A.y(p.v)} r={2.2} fill={col} fillOpacity={0.28} />));
    if (type === "area" && xy.length > 1) series.push(<Path key={K()} d={`${d} L${xy[xy.length - 1][0].toFixed(1)} ${T + ph} L${xy[0][0].toFixed(1)} ${T + ph} Z`} fill={`url(#${g})`} />);
    if (xy.length > 1) series.push(<Path key={K()} d={d} fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />);
    if (!av && xy.length <= 26 * Math.max(1, PW / pw)) xy.slice(0, -1).forEach((p) => series.push(<Circle key={K()} cx={p[0]} cy={p[1]} r={2.6} fill={t.card} stroke={col} strokeWidth={1.5} />));
    const l = xy[xy.length - 1];
    series.push(<Circle key={K()} cx={l[0]} cy={l[1]} r={5} fill={col} stroke={t.card} strokeWidth={2} />);
    A.pts.forEach((p, j) => { if (p.flag && !av) series.push(<SvgText key={K()} x={xy[j][0]} y={xy[j][1] - 9} textAnchor="middle" fill={col} fontSize={10.5} fontFamily={t.fontUISemi}>{p.flag}</SvgText>); });
  };
  // an axis's counts per month stack as columns over their month, whatever style is picked; the rest draw as set
  const monthlyStack = (A: Scale, main: Line_ | null, mainCol: string, extra: Line_[], off: number) => [...(main && main.monthly ? [{ pts: inRange(main), col: mainCol }] : []), ...extra.map((s, i) => ({ s, i })).filter(({ s }) => s.monthly).map(({ s, i }) => ({ pts: inRange(s), col: xcol(off + i) }))];
  if (A1 && L1) { const st = monthlyStack(A1, L1, col1, X1, 0); if (st.length) drawMonthly(A1, st); }
  if (A2 && L2) { const st = monthlyStack(A2, L2, col2, X2, X1.length); if (st.length) drawMonthly(A2, st); }
  if (A1 && L1 && !L1.monthly && c.y1Type === "column") drawCols(A1, col1, both ? -1 : 0);
  if (A2 && L2 && !L2.monthly && c.y2Type === "column") drawCols(A2, col2, both ? 1 : 0);
  if (A2 && L2 && !L2.monthly && c.y2Type !== "column") drawLine(A2, col2, c.y2Type || "line", gid + "b", c.y2Avg);
  if (A1 && L1 && !L1.monthly && c.y1Type !== "column") drawLine(A1, col1, c.y1Type || "line", gid + "a", c.y1Avg);
  if (A1) X1.forEach((s, i) => { if (s.monthly) return; const A = onAxis(A1, s); if (A.pts.length) drawLine(A, xcol(i), "line", gid + "x"); });
  if (A2) X2.forEach((s, i) => { if (s.monthly) return; const A = onAxis(A2, s); if (A.pts.length) drawLine(A, xcol(X1.length + i), "line", gid + "x"); });
  // the axis lines: the baseline across the plot, the left and right axes on their columns
  if (c.axes !== false && G0) {
    plot.push(<Line key={K()} x1={0} x2={PW} y1={T + ph} y2={T + ph} stroke={t.muted} strokeOpacity={0.55} />);
    if (A1) left.push(<Line key={K()} x1={L - 0.5} x2={L - 0.5} y1={T} y2={T + ph} stroke={t.muted} strokeOpacity={0.55} />);
    if (A2) right.push(<Line key={K()} x1={0.5} x2={0.5} y1={T} y2={T + ph} stroke={t.muted} strokeOpacity={0.55} />);
  }
  const missing = [L1 && !A1 ? L1.label : null, L2 && !A2 ? L2.label : null].filter(Boolean) as string[];
  if (missing.length) plot.push(<SvgText key={K()} x={Math.max(0, PW - pw) + 8} y={T + ph - 8} fill={t.muted} fontSize={11} fontFamily={t.fontUI}>{`No ${missing.join(" or ").toLowerCase()} values in this range`}</SvgText>);
  const evs = (c.markers || []).length ? D.entries.filter((e) => c.markers!.includes(e.type) && e.occurred_at >= from && e.occurred_at <= to) : [];
  evs.forEach((e) => { const xx = x(e.occurred_at); plot.push(<Line key={K()} x1={xx} x2={xx} y1={T} y2={T + ph} stroke={t.ink} strokeOpacity={0.38} strokeDasharray="3 3" />, <Circle key={K()} cx={xx} cy={T + 2} r={2.5} fill={t.ink} fillOpacity={0.5} />); });
  // month labels: thinned by how many days a pixel-width of the plot holds
  const days = (b - a) / 864e5, perPx = days / PW, step = perPx > 2.2 ? 6 : perPx > 1.15 ? 3 : perPx > 0.55 ? 2 : 1, s0 = pd(from);
  let mi = 0;
  for (let d = new Date(s0.getFullYear(), s0.getMonth() + 1, 1); d.getTime() <= b; d = new Date(d.getFullYear(), d.getMonth() + 1, 1), mi++) {
    if (mi % step) continue;
    plot.push(<SvgText key={K()} x={x(iso(d))} y={H - 5} textAnchor="middle" fill={t.muted} fontSize={10.5} fontFamily={t.fontData}>{MONTHS[d.getMonth()] + (d.getMonth() === 0 || mi === 0 ? ` ${String(d.getFullYear()).slice(2)}` : "")}</SvgText>);
  }
  // photo and session markers (tap opens the entry)
  const marks: { x: number; id: string; kind: "photo" | "sess" }[] = [];
  c.photos.forEach((rg) => D.entries.filter((e) => e.photos.length && e.regions.includes(rg) && e.details.series !== "body" && e.occurred_at >= from && e.occurred_at <= to).forEach((e) => marks.push({ x: x(e.occurred_at), id: e.id, kind: "photo" })));
  sessions.forEach((kid) => appts(D).filter((e) => e.details.course_id === kid && e.details.status === "done" && e.occurred_at >= from && e.occurred_at <= to).forEach((e) => marks.push({ x: x(e.occurred_at), id: e.id, kind: "sess" })));

  // readout
  let tip: React.ReactNode = null, cur: number | null = null;
  if (hover != null && hover >= 0 && hover <= PW && W) {
    cur = hover;
    const d = iso(new Date(a + (hover / PW) * (b - a)));
    const near = (A: Scale | null | undefined): SeriesPoint | null => {
      if (!A) return null;
      if (A.monthly) return A.pts.find((p) => p.d.slice(0, 7) === d.slice(0, 7)) || null;
      let best: SeriesPoint | null = null, bd = Infinity;
      for (const p of A.pts) { const dd = Math.abs(pd(p.d).getTime() - pd(d).getTime()); if (dd < bd) { bd = dd; best = p; } }
      return bd <= ((b - a) * visDays) / totalDays / 10 ? best : null;
    };
    const p1 = near(A1), p2 = near(A2);
    const rows: React.ReactNode[] = [<Text key="d" style={{ color: t.onDark, fontFamily: t.fontUIBold, fontSize: 12 }}>{fmt(d)}</Text>];
    const when = (s: Line_, p: SeriesPoint) => (s.monthly ? ` · ${monthLabel(p.d)}` : p.d !== d ? ` · ${fmtShort(p.d)}` : "");
    const sw = (s: Line_, type: string | undefined, col: string) => <Swatch type={s.monthly ? "column" : type} color={col} />;
    if (p1 && L1) rows.push(<View key="1" style={{ flexDirection: "row", alignItems: "center" }}>{sw(L1, c.y1Type, col1)}<Text style={{ color: t.onDark, fontSize: 12, fontFamily: t.fontUI }}>{L1.label} {L1.fmt ? L1.fmt(p1.v) : fmtV(p1.v, L1.unit)}{when(L1, p1)}{p1.src ? ` · ${p1.src}` : ""}</Text></View>);
    if (p2 && L2) rows.push(<View key="2" style={{ flexDirection: "row", alignItems: "center" }}>{sw(L2, c.y2Type, col2)}<Text style={{ color: t.onDark, fontSize: 12, fontFamily: t.fontUI }}>{L2.label} {L2.fmt ? L2.fmt(p2.v) : fmtV(p2.v, L2.unit)}{when(L2, p2)}{p2.src ? ` · ${p2.src}` : ""}</Text></View>);
    [...X1.map((s, i) => ({ s, A: A1, i })), ...X2.map((s, i) => ({ s, A: A2, i: X1.length + i }))].forEach(({ s, A, i }) => {
      const p = A ? near(onAxis(A, s)) : null;
      if (p) rows.push(<View key={"x" + i} style={{ flexDirection: "row", alignItems: "center" }}>{sw(s, "line", xcol(i))}<Text style={{ color: t.onDark, fontSize: 12, fontFamily: t.fontUI }}>{s.label} {s.fmt ? s.fmt(p.v) : fmtV(p.v, s.unit)}{when(s, p)}{p.src ? ` · ${p.src}` : ""}</Text></View>);
    });
    if (c.bands.includes("cycle")) { const cd = cycleDayOf(D, d); if (cd) rows.push(<Text key="cy" style={{ color: t.onDark, fontSize: 12, fontFamily: t.fontUI }}>Cycle day {cd}</Text>); }
    evs.filter((e) => e.occurred_at === d).forEach((e) => rows.push(<Text key={e.id} style={{ color: t.onDark, fontSize: 12, fontFamily: t.fontUI }}>▸ {e.title}</Text>));
    segs.filter((s) => s.f <= d && s.t >= d && s.label !== "Period").forEach((s, i) => rows.push(<View key={"s" + i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.col }} /><Text style={{ color: t.onDark, fontSize: 12, fontFamily: t.fontUI }}>{s.label}</Text></View>));
    const vx = L + hover - (scrolls ? sx.current : 0); // where the finger is on screen
    const leftPx = vx + 12 + 170 > W ? Math.max(4, vx - 12 - 170) : vx + 12;
    tip = <View pointerEvents="none" style={{ position: "absolute", top: T + 4, left: leftPx, width: 170, backgroundColor: t.darkC, borderRadius: 10, padding: 8, gap: 3 }}>{rows}</View>;
  }

  // scroll mode: hold to read, drag to scroll. The hold is a timer that a real drag cancels
  const clearHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };
  const touch = scrolls ? {
    onTouchStart: (e: any) => { const px = e.nativeEvent.locationX; startX.current = px; clearHold(); holdTimer.current = setTimeout(() => { holdTimer.current = null; setReading(true); setHover(px); }, 260); },
    onTouchMove: (e: any) => { const px = e.nativeEvent.locationX; if (reading) setHover(px); else if (Math.abs(px - startX.current) > 8) clearHold(); },
    onTouchEnd: () => { clearHold(); setReading(false); setHover(null); },
    onTouchCancel: () => { clearHold(); setReading(false); setHover(null); },
  } : pan.panHandlers;

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ width: "100%", height: H }}>
      {W > 0 ? (
        <NoSwipe><View style={{ flexDirection: "row", width: W, height: H }}>
          <Svg width={L} height={H} viewBox={`0 0 ${L} ${H}`}><G>{left}</G></Svg>
          <View style={{ width: pw, height: H }}>
            <ScrollView horizontal scrollEnabled={scrolls && !reading} showsHorizontalScrollIndicator={scrolls} bounces={false} contentOffset={{ x: Math.max(0, PW - pw), y: 0 }} scrollEventThrottle={16} onScroll={(e) => { sx.current = e.nativeEvent.contentOffset.x; }} onScrollBeginDrag={clearHold}>
              <View {...touch} style={{ width: PW, height: H }}>
                <Svg width={PW} height={H} viewBox={`0 0 ${PW} ${H}`}>
                  <Defs>
                    <LinearGradient id={gid + "a"} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={col1} stopOpacity={0.28} /><Stop offset="1" stopColor={col1} stopOpacity={0} /></LinearGradient>
                    <LinearGradient id={gid + "b"} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={col2} stopOpacity={0.28} /><Stop offset="1" stopColor={col2} stopOpacity={0} /></LinearGradient>
                    <ClipPath id={gid + "c"}><Rect x={0} y={0} width={PW} height={T + ph + 1} /></ClipPath>
                  </Defs>
                  <G>{plot}</G>
                  <G clipPath={`url(#${gid}c)`}>{series}</G>
                  {cur != null ? <Line x1={cur} x2={cur} y1={T} y2={T + ph} stroke={t.ink} strokeDasharray="3 3" opacity={0.5} /> : null}
                </Svg>
                {marks.map((m, i) => (
                  <Pressable key={i} onPress={() => openEntry(h, m.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel={m.kind === "photo" ? "Photo" : "Instance"}
                    style={{ position: "absolute", left: m.x - (m.kind === "photo" ? 5 : 4.5), top: T + ph + (m.kind === "photo" ? 6 : 9), width: m.kind === "photo" ? 10 : 9, height: m.kind === "photo" ? 15 : 9, borderRadius: m.kind === "photo" ? 3 : 5, backgroundColor: m.kind === "photo" ? t.tint("photo") : t.ink }} />
                ))}
              </View>
            </ScrollView>
          </View>
          <Svg width={R} height={H} viewBox={`0 0 ${R} ${H}`}><G>{right}</G></Svg>
          {tip}
        </View></NoSwipe>
      ) : null}
    </View>
  );
}

export function ChartLegend(props: { c: Chart }) {
  const h = useHealth();
  const t = useT();
  const D = h.D, c = props.c;
  const it: React.ReactNode[] = [];
  const s1 = c.y1 && getSeries(D, c.y1), s2 = c.y2 && getSeries(D, c.y2);
  const lg = (k: string, sw: React.ReactNode, label: string, em?: string) => it.push(<View key={k} style={{ flexDirection: "row", alignItems: "center" }}>{sw}<Text style={{ fontSize: 12, color: t.ink, fontFamily: t.fontUI }}>{label}{em ? <Text style={{ color: t.muted }}> {em}</Text> : null}</Text></View>);
  // a count per month shows its total over the range instead of a unit
  const [from, to] = chartRange(D, c);
  const em = (s: Series & { kind: "line" }) => (s.monthly ? `${s.points.filter((p) => p.d >= from && p.d <= to).reduce((a, p) => a + p.v, 0)} ${s.unit} in range` : s.unit ? unitLabel(s.unit) : "");
  const swt = (s: Series & { kind: "line" }, type: string | undefined, col: string) => <Swatch type={s.monthly ? "column" : type} color={col} />;
  if (s1 && s1.kind === "line") lg("y1", swt(s1, c.y1Type, colorOf(c.y1Color, t, DEFAULT_Y1)), s1.label, em(s1) || undefined);
  if (s2 && s2.kind === "line") lg("y2", swt(s2, c.y2Type, colorOf(c.y2Color, t, DEFAULT_Y2)), s2.label, (em(s2) ? em(s2) + " · " : "") + "right");
  const avoid = [colorOf(c.y1Color, t, DEFAULT_Y1), colorOf(c.y2Color, t, DEFAULT_Y2)], n1 = (c.y1More || []).length;
  (c.y1More || []).forEach((id, i) => { const s = getSeries(D, id); if (s && s.kind === "line") lg("x1" + id, swt(s, "line", extraColor(i, avoid)), s.label, em(s) || undefined); });
  (c.y2More || []).forEach((id, i) => { const s = getSeries(D, id); if (s && s.kind === "line") lg("x2" + id, swt(s, "line", extraColor(n1 + i, avoid)), s.label, (em(s) ? em(s) + " · " : "") + "right"); });
  c.bands.forEach((id) => { const r = bandSrc(D, id); if (r) lg("b" + id, <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colorOf(r.color, t, regColor({})), opacity: 0.45, marginRight: 6 }} />, r.name); });
  (c.sessions || []).forEach((id) => { const k = D.courses.find((x) => x.id === id); if (k) lg("s" + id, <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.ink, marginRight: 6 }} />, `${k.title} instances`); });
  if (c.bands.includes("cycle")) lg("cy", <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: "#E05A7E", opacity: 0.45, marginRight: 6 }} />, "Periods");
  if ((c.markers || []).length) lg("mk", <View style={{ width: 14, borderTopWidth: 2, borderStyle: "dashed", borderColor: t.muted, marginRight: 6 }} />, c.markers!.map((k) => ({ procedure: "Procedures", appointment: "Appointments", food_trial: "Food trials", observation: "Observations" } as Record<string, string>)[k] || k).join(", "));
  c.photos.forEach((rg) => lg("p" + rg, <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.tint("photo"), marginRight: 6 }} />, `${rl(D, rg)} photos`));
  if (c.scroll) lg("sc", <Text style={{ fontSize: 11, color: t.muted, marginRight: 4 }}>⇆</Text>, "", "scroll back in time · hold to read");
  if (!it.length) return null;
  return <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, columnGap: 16, marginTop: 14 }}>{it}</View>;
}

export function sessionReadout(D: D, id: string): string {
  const e = D.entries.find((x) => x.id === id);
  if (!e) return "";
  const r = readingFor(D, e.id), M = r && metric(D, r.details.metric);
  return [e.details.what_was_done, r && M ? `${M.l}: ${fmtV(r.details.value, M.u)}` : null, e.details.cost ? money(e.details.cost) : null].filter(Boolean).join(" · ");
}
