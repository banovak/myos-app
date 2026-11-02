// Chart maths shared by the SVG chart: ranges, layout zones, smoothing, ticks.
import { addDays, today, uid } from "./dates";
import { getSeries } from "./series";
import { bandSrc } from "./regimens";
import type { Chart, D } from "./types";
import { ALL_COLORS, DEFAULT_Y1, DEFAULT_Y2 } from "./vocab";

export const LAYOUTS: [string, string][] = [["stack", "One column"], ["two", "Two columns"], ["three", "Three columns"], ["top", "One large, two columns below"], ["side", "Wide column, narrow column"]];
export const LAYOUT_DEF: Record<string, { top: boolean; cols: string[] }> = { stack: { top: false, cols: ["1fr"] }, two: { top: false, cols: ["1fr", "1fr"] }, three: { top: false, cols: ["1fr", "1fr", "1fr"] }, top: { top: true, cols: ["1fr", "1fr"] }, side: { top: false, cols: ["2fr", "1fr"] } };
export const zoneCount = (k: string): number => (LAYOUT_DEF[k] || LAYOUT_DEF.top).cols.length + ((LAYOUT_DEF[k] || LAYOUT_DEF.top).top ? 1 : 0);
export const STYLES: [string, string][] = [["line", "Line"], ["area", "Area"], ["column", "Column"], ["dots", "Dots"]];

export function normalizeZones(D: D): void {
  if (!LAYOUT_DEF[D.chartLayout]) D.chartLayout = "top";
  const n = zoneCount(D.chartLayout);
  if (!Array.isArray(D.chartZones) || D.chartZones.length !== n) return distributeZones(D, D.chartZones ? D.chartZones.flat() : D.charts.map((c) => c.id));
  const ids = new Set(D.charts.map((c) => c.id)), seen = new Set<string>();
  D.chartZones = D.chartZones.map((z) => z.filter((id) => ids.has(id) && !seen.has(id) && !!seen.add(id)));
  D.charts.forEach((c) => {
    if (!seen.has(c.id)) {
      const z = D.chartZones!.reduce((bi, zz, i, a) => (zz.length < a[bi].length ? i : bi), 0);
      D.chartZones![z].push(c.id);
    }
  });
}
export function distributeZones(D: D, order: string[]): void {
  const def = LAYOUT_DEF[D.chartLayout] || LAYOUT_DEF.top, n = zoneCount(D.chartLayout), ids = new Set(D.charts.map((c) => c.id));
  const list = [...new Set([...(order || []).filter((id) => ids.has(id)), ...D.charts.map((c) => c.id)])];
  D.chartZones = Array.from({ length: n }, () => [] as string[]);
  list.forEach((id, i) => {
    if (def.top) { if (i === 0) D.chartZones![0].push(id); else D.chartZones![1 + ((i - 1) % def.cols.length)].push(id); }
    else D.chartZones![i % n].push(id);
  });
}
/** phone order: zones flattened, top zone first */
export function chartOrder(D: D): Chart[] {
  normalizeZones(D);
  const byId = (id: string) => D.charts.find((c) => c.id === id)!;
  return D.chartZones!.flat().map(byId).filter(Boolean);
}
export function moveChart(D: D, id: string, dir: 1 | -1): void {
  normalizeZones(D);
  const order = D.chartZones!.flat(), i = order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  distributeZones(D, order);
}

export function chartRange(D: D, c: Chart): [string, string] {
  const T = today();
  if (c.range === "custom" && c.from && c.to && c.from < c.to) return [c.from, c.to];
  if (c.range === "all") {
    const ds: string[] = [];
    [c.y1, c.y2, ...(c.y1More || []), ...(c.y2More || [])].forEach((id) => { const s = id && getSeries(D, id); if (s && s.kind === "line") s.points.forEach((p) => ds.push(p.d)); });
    c.bands.forEach((id) => { const r = bandSrc(D, id); if (r) ds.push(r.started_on); });
    c.photos.forEach((rg) => D.entries.forEach((e) => { if (e.photos.length && e.regions.includes(rg)) ds.push(e.occurred_at); }));
    ds.sort();
    return [ds[0] && ds[0] < T ? addDays(ds[0], -10) : addDays(T, -365), T];
  }
  const spans: Record<string, number> = { "3m": 91, "6m": 182, "12m": 365 };
  return [addDays(T, -(spans[c.range] || 365)), T];
}

/** the colour of the i-th extra line on an axis: spread through the palette, away from the axis colours */
export function extraColor(i: number, avoid: string[]): string {
  const pool = ALL_COLORS.filter((c) => !avoid.includes(c));
  return pool[(i * 3) % pool.length] || ALL_COLORS[0];
}
export function niceStep(range: number, count: number): number {
  const raw = range / count, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}
export function smoothPath(p: [number, number][]): string {
  if (p.length < 3) return p.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
  const n = p.length, dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = dx[i] ? (p[i + 1][1] - p[i][1]) / dx[i] : 0; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const s = 3 / Math.sqrt(h); t[i] = s * a * m[i]; t[i + 1] = s * b * m[i]; }
  }
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(p[i][0] + h).toFixed(1)} ${(p[i][1] + t[i] * h).toFixed(1)} ${(p[i + 1][0] - h).toFixed(1)} ${(p[i + 1][1] - t[i + 1] * h).toFixed(1)} ${p[i + 1][0].toFixed(1)} ${p[i + 1][1].toFixed(1)}`;
  }
  return d;
}
export const onDashboard = (D: D, id: string): boolean => [...D.widgets.left, ...D.widgets.right].some((w) => w.type === "savedchart" && w.chartId === id);
export function newChart(D: D, o: Partial<Chart> = {}): Chart {
  const T = today();
  const c: Chart = { id: "ch-" + uid(), title: "New chart", y1: "m:weight", y1Type: "line", y1Color: DEFAULT_Y1, y2: null, y2Type: "line", y2Color: DEFAULT_Y2, bands: [], photos: [], range: "12m", from: addDays(T, -180), to: T, ...o };
  D.charts.unshift(c);
  normalizeZones(D);
  D.chartZones!.forEach((z) => { const i = z.indexOf(c.id); if (i >= 0) z.splice(i, 1); });
  D.chartZones![0].unshift(c.id);
  return c;
}
