// Cycle tracking: one record per day per source; manual wins over imports.
// Averages of the user's own records only. Nothing here predicts anything.
import { avg, dayDiff, today } from "./dates";
import { hkUse } from "./hkuse";
import type { CycleDay, D } from "./types";

/** the cycle rows in play: your own, and imported ones unless the Apple Health cycle item is switched off */
export const cycleRows = (D: D): CycleDay[] => (D.cycle || []).filter((c) => c.source === "manual" || hkUse(D, "cycle") !== "off");

export function cycleRec(D: D, d: string): CycleDay | null {
  const rs = cycleRows(D).filter((c) => c.on_date === d);
  return rs.find((c) => c.source === "manual") || rs[0] || null;
}
export type Period = { start: string; end: string; len: number };
export function cyclePeriods(D: D): Period[] {
  const days = [...new Set(cycleRows(D).map((c) => c.on_date))].sort().filter((d) => {
    const r = cycleRec(D, d);
    return r && ["light", "medium", "heavy", "unspecified"].includes(r.flow);
  });
  const out: Period[] = [];
  days.forEach((d) => {
    const last = out[out.length - 1];
    if (last && dayDiff(last.end, d) <= 2) last.end = d;
    else out.push({ start: d, end: d, len: 1 });
  });
  out.forEach((p) => (p.len = dayDiff(p.start, p.end) + 1));
  return out;
}
export function cycleDayOf(D: D, d: string): number | null {
  const ps = cyclePeriods(D).filter((p) => p.start <= d), p = ps[ps.length - 1];
  if (!p) return null;
  const n = dayDiff(p.start, d) + 1;
  return n <= 60 ? n : null;
}
export function cycleLengths(D: D): { start: string; len: number }[] {
  const ps = cyclePeriods(D);
  return ps.slice(1).map((p, i) => ({ start: ps[i].start, len: dayDiff(ps[i].start, p.start) }));
}
export function cycleStatsIn(D: D, from: string, to: string) {
  const ps = cyclePeriods(D).filter((p) => p.start >= from && p.start <= to), cl = cycleLengths(D).filter((c) => c.start >= from && c.start <= to);
  return { periods: ps.length, cycleLen: avg(cl.map((c) => c.len)), periodLen: avg(ps.map((p) => p.len)) };
}
export const cycleOn = (D: D): boolean => !!(D.settings.cycle_on || cycleRows(D).length);

export type CycleStats = { cd: number | null; last: Period | null; avgCycle: number | null; avgPeriod: number | null; nCycles: number; imported: boolean };
export function cycleStats(D: D): CycleStats {
  const ps = cyclePeriods(D), last = ps[ps.length - 1] || null, cl = cycleLengths(D).slice(-6);
  return {
    cd: cycleDayOf(D, today()), last,
    avgCycle: cl.length ? Math.round(avg(cl.map((x) => x.len))!) : null,
    avgPeriod: ps.length ? Math.round(avg(ps.slice(-6).map((p) => p.len))!) : null,
    nCycles: cl.length,
    imported: cycleRows(D).some((x) => x.source !== "manual"),
  };
}
