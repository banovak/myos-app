// Regimens: stints (stopped and started again), active/past, adherence logs,
// dose history, periods on charts.
import { addDays, pd, iso, today } from "./dates";
import { hkUse } from "./hkuse";
import { episodesOf, illnessColor } from "./illness";
import type { D, Episode, Per, RegLog, Regimen, Stint } from "./types";

/** the stints of a regimen, earliest first: the one stretch of its dates unless it was started again */
export const stintsOf = (r: Pick<Regimen, "started_on" | "ended_on" | "periods">): Stint[] => (r.periods && r.periods.length ? r.periods : [{ from: r.started_on, to: r.ended_on }]);
/** set the stints; started_on and ended_on follow (first start, last stop). A single stint lives on those two alone */
export function setStints(r: Regimen, ps: Stint[]): void {
  const s = ps.map((p) => ({ from: p.from, to: p.to || null })).sort((a, b) => (a.from < b.from ? -1 : 1));
  if (!s.length) return;
  r.started_on = s[0].from; r.ended_on = s[s.length - 1].to;
  if (s.length > 1) r.periods = s; else delete r.periods;
}
/** doing it on that day: some stint covers it */
export const regimenActive = (r: Regimen, on = today()): boolean => stintsOf(r).some((p) => p.from <= on && (!p.to || p.to >= on));
/** stopped as of that day: every stint ended before it (a future stop, or a future start, keeps it current) */
export const regimenStopped = (r: Regimen, on = today()): boolean => stintsOf(r).every((p) => !!p.to && p.to < on);
export const regColor = (r: { color?: string | null }): string => r.color || "#9EA6FA";

export function periodStart(per: Per): string {
  const d = pd(today());
  if (per === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (per === "month") d.setDate(1);
  return iso(d);
}

export const logsOf = (D: D, id: string, from?: string, to?: string): RegLog[] =>
  (D.regLogs || []).filter((l) => l.regimen_id === id && (!from || l.on_date >= from) && (!to || l.on_date <= to) && (l.source !== "apple_health" || hkUse(D, "workouts") !== "off")).sort((a, b) => (a.on_date < b.on_date ? 1 : -1));

export function adherence(D: D, r: Regimen): { done: number; target: number; per: Per } | null {
  const t = r.target;
  if (!t || !t.count) return null;
  return { done: logsOf(D, r.id, periodStart(t.per || "week"), today()).length, target: +t.count, per: t.per || "week" };
}

export type RegPart = { from: string; to: string; label: string };
export function regParts(r: Regimen): RegPart[] {
  const ch = (r.changes || []).slice().sort((a, b) => (a.on < b.on ? -1 : 1)), T = today();
  const lbl = (dose: string) => `${r.name}${dose ? " · " + dose : ""}`;
  const parts: RegPart[] = [];
  for (const st of stintsOf(r)) {
    const end = st.to || T;
    if (!ch.length) { parts.push({ from: st.from, to: end, label: r.name }); continue; }
    // the dose at the stint's start is the last change on or before it, or what the first change replaced
    const before = ch.filter((c) => c.on <= st.from), cuts = ch.filter((c) => c.on > st.from && c.on <= end);
    let from = st.from, dose = before.length ? before[before.length - 1].dose : ch[0].prev_dose;
    for (const c of cuts) { parts.push({ from, to: addDays(c.on, -1), label: lbl(dose) }); from = c.on; dose = c.dose; }
    parts.push({ from, to: end, label: lbl(dose) });
  }
  return parts.filter((p) => p.from <= p.to);
}

/** what a band id points at: a regimen, a course of care ("k:"), or an illness ("i:", a part per episode) */
export function bandSrc(D: D, id: string): { name: string; started_on: string; ended_on: string | null; color?: string | null; regimen?: Regimen; episodes?: Episode[] } | null {
  if (id.startsWith("i:")) {
    const c = D.concerns.find((x) => x.id === id.slice(2));
    return c ? { name: c.title, started_on: c.started_on || today(), ended_on: c.resolved_on, color: illnessColor(D, c), episodes: episodesOf(c) } : null;
  }
  if (id.startsWith("k:")) {
    const k = D.courses.find((x) => x.id === id.slice(2));
    return k ? { name: k.title, started_on: k.started_on, ended_on: k.ended_on, color: k.color || "#86C1CC" } : null;
  }
  const r = D.regimens.find((x) => x.id === id);
  return r ? { name: r.name, started_on: r.started_on, ended_on: r.ended_on, color: r.color, regimen: r } : null;
}
