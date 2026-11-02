// Reminders: set in either app, delivered by the phone. remDone is the rule of
// "already done that day" that lets a reminder skip itself; port it exactly.
import { addDays, dayDiff, fmt, iso, pd, tfmt, today } from "./dates";
import { challengeStats, expKind, perDays, ruleHit } from "./experiments";
import { logsOf, periodStart } from "./regimens";
import type { Concern, D, Reminder, ReminderKind, Schedule, Widget } from "./types";
import { PER_LABEL } from "./vocab";
import { metric } from "./series";

export const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const ord = (n: number): string => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export const allWidgets = (D: D): Widget[] => [...D.widgets.left, ...D.widgets.right];
export const remFor = (D: D, kind: ReminderKind, id: string | null): Reminder | undefined => (D.reminders || []).find((r) => r.target_kind === kind && r.target_id === id);

export function quickTitle(D: D, w: Widget): string {
  const s = w.src || "cycle";
  return s === "cycle" ? "Cycle today" : `${metric(D, s.slice(2)).l} today`;
}
export function remTarget(D: D, r: { target_kind: ReminderKind; target_id: string | null }): { label: string; go: { tab?: string; exp?: string; concern?: string; regimen?: string } } | null {
  const k = r.target_kind, id = r.target_id;
  if (k === "challenge") { const c = D.challenges.find((x) => x.id === id); return c ? { label: c.title, go: { exp: c.id } } : null; }
  if (k === "concern") { const c = D.concerns.find((x) => x.id === id); return c ? { label: c.title, go: { concern: c.id } } : null; }
  if (k === "regimen") { const g = D.regimens.find((x) => x.id === id); return g ? { label: g.name, go: { regimen: g.id } } : null; }
  if (k === "quick") { const w = allWidgets(D).find((x) => x.id === id); return w ? { label: quickTitle(D, w) + " (dashboard)", go: { tab: "dashboard" } } : null; }
  return { label: "", go: {} };
}
export function remDefaultTitle(D: D, kind: ReminderKind, id: string | null): string {
  const t = remTarget(D, { target_kind: kind, target_id: id }) || { label: "" };
  return kind === "concern" ? `Check in: ${t.label}` : kind === "quick" ? t.label.replace(" (dashboard)", "").replace(/ today$/, "") : t.label || "";
}
export function schedText(sc: Schedule): string {
  const t = tfmt(sc.time || "09:00");
  return sc.repeat === "weekly"
    ? `${(sc.days || []).length === 7 ? "Every day" : (sc.days || []).slice().sort().map((d) => WD[d - 1]).join(", ") || "No days picked"} at ${t}`
    : sc.repeat === "monthly" ? `The ${ord(sc.monthday || 1)} of each month at ${t}`
    : sc.repeat === "once" ? `${fmt(sc.date || today())} at ${t}`
    : `Every day at ${t}`;
}
export const firesOn = (sc: Schedule, d: Date): boolean => {
  const wd = d.getDay() || 7;
  return sc.repeat === "weekly" ? (sc.days || []).includes(wd) : sc.repeat === "monthly" ? d.getDate() === +(sc.monthday || 1) : sc.repeat === "once" ? iso(d) === sc.date : true;
};
export function nextFire(r: Reminder, after = new Date()): Date | null {
  if (!r.enabled) return null;
  const sc = r.schedule || {}, [h, m] = (sc.time || "09:00").split(":").map(Number);
  for (let i = 0; i < 400; i++) {
    const d = new Date(after.getFullYear(), after.getMonth(), after.getDate() + i, h, m);
    if (d <= after) continue;
    if (firesOn(sc, d)) return d;
  }
  return null;
}
/** every firing within [from, to], soonest first */
export function firesBetween(r: Reminder, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let cur = nextFire(r, from);
  while (cur && cur <= to && out.length < 64) { out.push(cur); cur = nextFire(r, cur); }
  return out;
}

export function dueMetrics(D: D, c: Concern): string[] {
  const t = c.tracking || {};
  if (c.status === "resolved" || !(t.metrics || []).length) return [];
  const from = periodStart(t.per || "week");
  return t.metrics!.filter((k) => D.metrics[k] && !D.entries.some((e) => e.type === "measurement" && e.details.metric === k && e.occurred_at >= from && e.occurred_at <= today()));
}
export const tracked = (D: D): Concern[] => D.concerns.filter((c) => c.status !== "resolved" && ((c.tracking || {}).metrics || []).length > 0);

export function remDone(D: D, r: Reminder, day: string): boolean {
  const k = r.target_kind, id = r.target_id;
  if (k === "regimen") return logsOf(D, id!, day, day).length > 0;
  if (k === "quick") {
    const w = allWidgets(D).find((x) => x.id === id);
    if (!w) return false;
    const s = w.src || "cycle";
    return s === "cycle" ? (D.cycle || []).some((c) => c.on_date === day && c.source === "manual") : D.entries.some((e) => e.type === "measurement" && e.details.metric === s.slice(2) && e.occurred_at === day);
  }
  if (k === "concern") {
    const c = D.concerns.find((x) => x.id === id);
    return !!c && ((c.tracking || {}).metrics || []).length > 0 && dueMetrics(D, c).length === 0;
  }
  if (k === "challenge") {
    const c = D.challenges.find((x) => x.id === id);
    if (!c || expKind(c) !== "challenge" || !c.rules.length) return false;
    return c.rules.every((rl) => {
      const per = perDays(rl.per), i = Math.floor(dayDiff(c.started_on, day) / per);
      if (i < 0) return false;
      return ruleHit(D, rl, addDays(c.started_on, i * per), addDays(c.started_on, (i + 1) * per - 1));
    });
  }
  return false;
}
export const remStatus = (D: D, r: Reminder): string => {
  const t = remTarget(D, r), nf = nextFire(r);
  const done = r.target_kind !== "custom" && t && r.skip_if_done !== false && firesOn(r.schedule || {}, pd(today())) && remDone(D, r, today());
  if (!r.enabled) return "Paused";
  if (done) return "Done today";
  if (nf) return "Next " + (iso(nf) === today() ? "today" : `${nf.getMonth() + 1}/${nf.getDate()}`) + ", " + tfmt(`${nf.getHours()}:${String(nf.getMinutes()).padStart(2, "0")}`);
  return "–";
};
export const perLabel = (per?: string): string => PER_LABEL[(per as keyof typeof PER_LABEL) || "week"];
export { challengeStats };
