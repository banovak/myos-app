// Experiments: challenge | phases | before_after. ruleHit is the rule of what
// counts as done; the phone and the web must agree on it.
import { addDays, avg, byDateDesc, dayDiff, fmtShort, today } from "./dates";
import { mkind } from "./series";
import { logsOf } from "./regimens";
import type { Challenge, D, Entry, ExpKind, Rule } from "./types";

export const EXP_LABEL: Record<ExpKind, string> = { challenge: "Check-in challenge", phases: "Phases", before_after: "Before and after" };
export const expKind = (c: Challenge): ExpKind => c.kind || "challenge";
export const chOnly = (D: D): Challenge[] => D.challenges.filter((c) => expKind(c) === "challenge");

export function ruleHit(D: D, r: Rule, a: string, b: string): boolean {
  if (r.kind === "regimen") return logsOf(D, r.regimen!, a, b).length > 0;
  return D.entries.some(
    (e) => e.occurred_at >= a && e.occurred_at <= b && (r.kind === "photo" ? e.photos.length > 0 && e.regions.includes(r.region!) : e.type === "measurement" && e.details.metric === r.metric),
  );
}
/** "Daily face photo", "Weekly weight", "Daily Vitamin D": a check-in as a heading */
export const ruleTitle = (r: Rule): string => {
  const p = r.per === "day" ? "Daily" : r.per === "week" ? "Weekly" : "Monthly";
  return `${p} ${r.kind === "regimen" ? r.label : r.label.charAt(0).toLowerCase() + r.label.slice(1)}`;
};
/** "days" / "week" / "months": the unit of a check-in's periods */
export const perUnit = (per: string, n: number): string => (per === "day" ? "day" : per) + (n === 1 ? "" : "s");
export type RuleStatus = { st: "soon" | "behind" | "due" | "ok" | "done"; label: string; /** the label with what was missed, for the challenge's own page */ detail: string; hit: number; n: number };
/** where a check-in stands right now: due, or up to date (the current period is done). A missed period cannot be
 * caught up, so it is not "behind": the detail says how many were missed, the headline only where today stands */
export function ruleStatus(D: D, c: Challenge, r: Rule): RuleStatus {
  const cells = ruleCells(D, c, r), n = cells.length, hit = cells.filter((x) => x.st === "hit").length, miss = cells.filter((x) => x.st === "miss").length;
  const open = cells.some((x) => x.st === "open"), fut = cells.some((x) => x.st === "fut");
  if (c.started_on > today()) { const l = "Starts " + fmtShort(c.started_on); return { st: "soon", label: l, detail: l, hit, n }; }
  if (!open && !fut) { const l = `Finished, ${hit} of ${n}`; return { st: "done", label: l, detail: l, hit, n }; }
  const label = open ? (r.per === "day" ? "Due today" : `Due this ${r.per}`) : "Up to date";
  return { st: open ? "due" : "ok", label, detail: miss ? `${label} · ${miss} missed` : label, hit, n };
}
export const perDays = (per: string): number => (per === "day" ? 1 : per === "week" ? 7 : 30);

export type ChallengeStats = { end: string; total: number; elapsed: number; rules: (Rule & { hit: number; periods: number })[] };
export function challengeStats(D: D, c: Challenge): ChallengeStats {
  const total = c.days || 1, end = addDays(c.started_on, total - 1), elapsed = Math.max(0, Math.min(total, dayDiff(c.started_on, today()) + 1));
  const rules = c.rules.map((r) => {
    const per = perDays(r.per), periods = Math.max(1, Math.ceil(Math.min(elapsed, total) / per));
    let hit = 0;
    for (let i = 0; i < periods; i++) {
      const a = addDays(c.started_on, i * per), b = addDays(c.started_on, (i + 1) * per - 1);
      if (ruleHit(D, r, a, b)) hit++;
    }
    return { ...r, hit, periods };
  });
  return { end, total, elapsed, rules };
}

export function statIn(D: D, k: string, from: string, to: string): { n: number; avg: number | null } {
  const night = mkind(D, k) === "time_night";
  const vs = D.entries.filter((e) => e.type === "measurement" && e.details.metric === k && e.occurred_at >= from && e.occurred_at <= to).map((e) => {
    const v = +e.details.value;
    return night && v < 720 ? v + 1440 : v;
  });
  return { n: vs.length, avg: avg(vs) };
}
export const lastPhotoIn = (D: D, region: string, from: string, to: string): Entry | undefined =>
  D.entries.filter((e) => e.photos.length && e.regions.includes(region) && e.details.series !== "body" && e.occurred_at >= from && e.occurred_at <= to).sort(byDateDesc())[0];

export function expRange(c: Challenge): { from: string; to: string } {
  const k = expKind(c), cf = c.config || {};
  if (k === "challenge") return { from: c.started_on, to: addDays(c.started_on, (c.days || 1) - 1) };
  if (k === "phases") {
    const ps = cf.phases || [];
    return { from: ps[0] ? ps[0].from : c.started_on, to: ps.length ? ps[ps.length - 1].to : today() };
  }
  const w = +(cf.window || 90);
  return { from: addDays(cf.event_date!, -w), to: addDays(cf.event_date!, w - 1) };
}
export const expRegions = (c: Challenge): string[] => (expKind(c) === "challenge" ? c.rules.filter((r) => r.kind === "photo").map((r) => r.region!) : (c.config || {}).photo_region ? [c.config.photo_region!] : []);
export const expMetrics = (c: Challenge): string[] => (expKind(c) === "challenge" ? c.rules.filter((r) => r.kind === "metric").map((r) => r.metric!) : (c.config || {}).measures || []);
export const expRegs = (D: D, c: Challenge) =>
  [...new Set([...(c.regimen_ids || []), ...(c.rules || []).filter((r) => r.kind === "regimen").map((r) => r.regimen!)])].map((i) => D.regimens.find((r) => r.id === i)).filter(Boolean) as D["regimens"];

export type CellState = "fut" | "hit" | "open" | "miss";
export function ruleCells(D: D, c: Challenge, r: Rule): { a: string; b: string; st: CellState }[] {
  const per = perDays(r.per), n = Math.ceil((c.days || 1) / per), out: { a: string; b: string; st: CellState }[] = [];
  for (let i = 0; i < n; i++) {
    const a = addDays(c.started_on, i * per), b = addDays(c.started_on, (i + 1) * per - 1);
    const st: CellState = a > today() ? "fut" : ruleHit(D, r, a, b) ? "hit" : b >= today() ? "open" : "miss";
    out.push({ a, b, st });
  }
  return out;
}
export function expPhotos(D: D, c: Challenge, from: string, to: string): Entry[] {
  const rs = expRegions(c);
  if (!rs.length) return [];
  return D.entries.filter((e) => e.photos.length && (e.details.series !== "body" || rs.includes("whole_body")) && e.occurred_at >= from && e.occurred_at <= to && e.regions.some((r) => rs.includes(r))).sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1));
}
