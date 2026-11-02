// Series: anything that can be plotted or summarised. Port of seriesList /
// getSeries and the value formatters.
import { episodesOf, illnesses, sickDays } from "./illness";
import { hkKeyForMetric, hkUse, hkUseFor, measurePoints, metricForHk } from "./hkuse";
import { labsOnly } from "./reports";
import { byDateDesc, dur, fmtShort, hhmm, today, iso, pd } from "./dates";
import { logsOf, stintsOf } from "./regimens";
import { lbFromKg, unitPref } from "./units";
import type { D, Metric, MetricKind } from "./types";
import { ratingRange, rl } from "./vocab";
import { cycleRec } from "./cycle";

export const metric = (D: D, k: string): Metric => D.metrics[k] || { l: k, u: "" };
export const mkind = (D: D, k: string): MetricKind => {
  const m = metric(D, k);
  return m.kind || (m.rating ? "rating" : "number");
};
export const fmtV = (v: number | string, u?: string): string =>
  `${+(+v).toFixed(2)}${u ? (u.startsWith("/") || u === "%" ? u : " " + u) : ""}`;
export function fmtM(D: D, k: string, v: number | string): string {
  const kd = mkind(D, k);
  if (kd === "time" || kd === "time_night") return hhmm(+v);
  if (kd === "duration") return dur(+v);
  return fmtV(v, metric(D, k).u);
}
export const unitLabel = (u: string): string => (u && u.startsWith("/") ? (u === "/10" ? "rating 0–10" : "rating 1–5") : u);

export type SeriesPoint = { d: string; v: number; flag?: string; range?: string; unit?: string; /** where it came from when not typed in: "Apple Health" */ src?: string };
export type Series =
  | { kind: "line"; label: string; unit: string; points: SeriesPoint[]; mkind?: MetricKind; fmt?: (v: number) => string; rating?: boolean; lab?: boolean; sub?: string; /** the finest axis step worth drawing (0.5 kg, 2 lb) */ step?: number; /** a rating's scale */ scale?: { lo: number; hi: number }; /** a count per month: one point a month, dated its first day; drawn as a column over the month, stacked with others on the axis */ monthly?: boolean }
  | { kind: "bars"; label: string; sub?: string; segments: { from: string; to: string; label: string; open: boolean }[] }
  | { kind: "dots"; label: string; sub?: string; dots: { d: string; id: string }[] };

export function seriesList(D: D): { id: string; label: string; group: string }[] {
  const out: { id: string; label: string; group: string }[] = [];
  Object.keys(D.metrics).forEach((k) => {
    // a measure with values typed in, or with Health values merged into it (weight, body fat)
    if (measurePoints(D, k).length) out.push({ id: "m:" + k, label: metric(D, k).l, group: "Measurements" });
  });
  [...new Set(labsOnly(D).flatMap((l) => l.results.map((r) => r.marker)))].forEach((m) => out.push({ id: "lab:" + m, label: m, group: "Lab results" }));
  D.regimens.filter((r) => r.category !== "diet").forEach((r) => out.push({ id: "r:" + r.id, label: r.name, group: "Regimens & diet" }));
  if (D.regimens.some((r) => r.category === "diet")) out.push({ id: "diet", label: "Diet", group: "Regimens & diet" });
  [...new Set(D.entries.filter((e) => e.photos.length && !(e.details.series === "body")).flatMap((e) => e.regions))].forEach((r) =>
    out.push({ id: "ph:" + r, label: `${rl(D, r)} photos`, group: "Photos" }),
  );
  if ((D.cycle || []).length) out.push({ id: "cy:flow", label: "Period flow", group: "Cycle" });
  // counts per month: sick days (all illnesses, or one), days a regimen was done
  const ills = illnesses(D);
  if (ills.length) out.push({ id: "sick:all", label: "Sick days", group: "Per month" });
  if (ills.length > 1) ills.forEach((c) => out.push({ id: "sick:" + c.id, label: `${c.title} sick days`, group: "Per month" }));
  D.regimens.filter((r) => r.category !== "diet").forEach((r) => out.push({ id: "done:" + r.id, label: `${r.name} days`, group: "Per month" }));
  Object.keys(D.hk || {}).forEach((k) => {
    // weight and body fat sit under Measurements; items turned off stay out of the list
    if ((D.hk[k] || []).length && !metricForHk(k) && hkUseFor(D, k) !== "off") out.push({ id: "hk:" + k, label: HK_LABEL[k] ? `${HK_LABEL[k]} (Apple Health)` : `${k} (Apple Health)`, group: "Apple Health" });
  });
  return out;
}

export const HK_LABEL: Record<string, string> = { sleep: "Sleep", sleep_hours: "Sleep", rhr: "Resting heart rate", hrv: "HRV", steps: "Steps", active_kcal: "Active energy", weight: "Weight", body_fat: "Body fat", bedtime: "Bedtime", wake: "Wake time" };
export const HK_UNIT: Record<string, string> = { sleep: "h", sleep_hours: "h", rhr: "bpm", hrv: "ms", steps: "", active_kcal: "kcal", weight: "kg", body_fat: "%", bedtime: "", wake: "" };

export function getSeries(D: D, id: string): Series | null {
  const [k, ...rest] = id.split(":");
  const key = rest.join(":");
  if (k === "m") {
    const m = metric(D, key), kd = mkind(D, key), night = kd === "time_night";
    // weight and height are stored in kg and cm; shown in the unit chosen on the health card
    const u = unitPref(D), lb = key === "weight" && u.weight === "lb", inch = key === "height" && u.height === "ft";
    const unit = kd === "rating" ? (m.u && m.u.startsWith("/") ? m.u : "/5") : kd === "number" ? (lb ? "lb" : inch ? "in" : m.u) : "";
    const conv = (v: number) => (lb ? lbFromKg(v) : inch ? +(v / 2.54).toFixed(1) : v);
    const hkKey = hkKeyForMetric(key), mode = hkKey ? hkUse(D, hkKey) : "manual";
    const pts = measurePoints(D, key); // manual and Health together for weight and body fat
    return {
      kind: "line", label: m.l, unit, mkind: kd, fmt: (v) => (lb || inch ? fmtV(v, unit) : fmtM(D, key, v)),
      points: pts.map((p) => ({ d: p.d, v: conv(night && p.v < 720 ? p.v + 1440 : p.v), ...(p.src ? { src: p.src } : {}) })),
      ...(hkKey && mode === "health" ? { sub: "Apple Health" } : pts.some((p) => p.src) ? { sub: "with Apple Health" } : {}),
      rating: kd === "rating",
      ...(kd === "rating" ? { scale: ratingRange(unit) } : {}),
      ...(key === "weight" ? { step: lb ? 2 : 0.5 } : key === "height" ? { step: 1 } : {}),
    };
  }
  if (k === "lab") {
    const pts = labsOnly(D).flatMap((l) => l.results.filter((r) => r.marker === key).map((r) => ({ d: l.date, v: +r.value, flag: r.flag, range: r.range, unit: r.unit }))).sort((a, b) => (a.d < b.d ? -1 : 1));
    return { kind: "line", label: key, unit: pts[0] ? pts[0].unit : "", points: pts, lab: true };
  }
  if (k === "cy") {
    const lv: Record<string, number> = { none: 0, spotting: 1, light: 2, medium: 3, heavy: 4, unspecified: 2 }, nm = ["None", "Spotting", "Light", "Medium", "Heavy"];
    const pts = [...new Set((D.cycle || []).map((x) => x.on_date))].sort().map((d) => ({ d, v: lv[cycleRec(D, d)!.flow] || 0 }));
    return { kind: "line", label: "Period flow", unit: "", points: pts, fmt: (v) => (v < 0 || v > 4 || v % 1 ? "" : nm[v]) };
  }
  if (k === "hk") {
    const mk = metricForHk(key);
    if (mk) return getSeries(D, "m:" + mk); // older charts that picked the Health series: it is the measure now
    const pts = hkUseFor(D, key) === "off" ? [] : (D.hk[key] || []).slice();
    const kd: MetricKind | undefined = key === "bedtime" ? "time_night" : key === "wake" ? "time" : undefined;
    const lb = key === "weight" && unitPref(D).weight === "lb";
    return { kind: "line", label: HK_LABEL[key] || key, unit: lb ? "lb" : HK_UNIT[key] ?? "", points: pts.map((p) => ({ d: p.d, v: lb ? lbFromKg(p.v) : kd === "time_night" && p.v < 720 ? p.v + 1440 : p.v })), sub: "Apple Health", mkind: kd, fmt: kd ? (v) => hhmm(v) : undefined, ...(key === "weight" ? { step: lb ? 2 : 0.5 } : {}) };
  }
  if (k === "sick" || k === "done") {
    const r = k === "done" ? D.regimens.find((x) => x.id === key) : null;
    const cs = k === "sick" ? (key === "all" ? illnesses(D) : illnesses(D).filter((c) => c.id === key)) : [];
    if (k === "done" && !r) return null;
    if (k === "sick" && !cs.length) return null;
    const label = k === "done" ? `${r!.name} days` : key === "all" ? "Sick days" : `${cs[0].title} sick days`;
    return { kind: "line", label, unit: "days", points: monthlyPoints(D, k === "done" ? (f, t) => new Set(logsOf(D, key, f, t).map((l) => l.on_date)).size : (f, t) => cs.reduce((a, c) => a + sickDays(c, f, t), 0), k === "done" ? stintsOf(r!)[0].from : cs.map((c) => episodesOf(c)[0]?.from).filter(Boolean).sort()[0]), monthly: true };
  }
  if (k === "r") {
    const r = D.regimens.find((x) => x.id === key);
    if (!r) return null;
    return { kind: "bars", label: r.name, sub: [r.dose, r.frequency].filter(Boolean).join(" · "), segments: stintsOf(r).map((p) => ({ from: p.from, to: p.to || today(), label: r.dose || r.name, open: !p.to })) };
  }
  if (id === "diet") {
    return { kind: "bars", label: "Diet", sub: "Qualitative", segments: D.regimens.filter((r) => r.category === "diet").flatMap((r) => stintsOf(r).map((p) => ({ from: p.from, to: p.to || today(), label: r.name, open: !p.to }))).sort((a, b) => (a.from < b.from ? -1 : 1)) };
  }
  if (k === "ph") {
    const dates = D.entries.filter((e) => e.photos.length && e.regions.includes(key) && e.details.series !== "body").map((e) => ({ d: e.occurred_at, id: e.id }));
    return { kind: "dots", label: `${rl(D, key)} photos`, sub: `${dates.length} photos`, dots: dates };
  }
  return null;
}

/** one point a month from the month `since` falls in to this month, dated the first; months with nothing count as 0 */
function monthlyPoints(D: D, count: (from: string, to: string) => number, since?: string): SeriesPoint[] {
  if (!since) return [];
  const T = pd(today()), s = pd(since), pts: SeriesPoint[] = [];
  for (let d = new Date(s.getFullYear(), s.getMonth(), 1); d.getTime() <= T.getTime(); d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    pts.push({ d: iso(d), v: count(iso(d), iso(e)) });
  }
  return pts;
}
export const lastVal = (s: Series | null): SeriesPoint | null => (s && s.kind === "line" && s.points.length ? s.points[s.points.length - 1] : null);
export const lastShort = (D: D, k: string): string => {
  const s = getSeries(D, "m:" + k);
  const lp = lastVal(s);
  return lp ? `${fmtM(D, k, lp.v)} · ${fmtShort(lp.d)}` : "";
};
export const readingFor = (D: D, id: string) => D.entries.find((e) => e.type === "measurement" && e.details.from_appt === id);
export const appts = (D: D) => D.entries.filter((e) => e.type === "appointment");
export const sortDesc = byDateDesc;
