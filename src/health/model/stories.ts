// Needs-you circles at the top of the dashboard: an appointment in the next
// week, a calendar suggestion, a check-in due, a challenge check-in open, a
// concern gone quiet, locked photos. Each carries a corner badge (a count,
// days, or a small icon: a camera for a photo to take, a plus for something to
// log) and, when there is one, a real photo for the circle: the provider's,
// or the latest progress photo. Dismissals live in settings.dismissedStories.
import { addDays, ago, byDateDesc, dayDiff, today } from "./dates";
import { challengeStats, chOnly, lastPhotoIn, perDays, ruleHit } from "./experiments";
import { episodeDays, illnesses, isIllness, openEpisode } from "./illness";
import { providerOf } from "./providers";
import { dueMetrics, tracked } from "./reminders";
import { periodStart } from "./regimens";
import type { Challenge, Concern, D, Entry, Episode, Photo, Suggestion } from "./types";

type Base = { key: string; label: string; sub: string; title: string; badge: string; badgeIco?: "camera" | "plus"; photo?: Photo | null };
export type Story = Base & (
  | { ico: "appointment"; kind: "calendar"; pending: Suggestion[] }
  | { ico: "appointment"; kind: "appt"; entry: Entry }
  | { ico: "challenge"; kind: "challenge"; challenge: Challenge; ruleIndex: number; when: string }
  | { ico: "measurement"; kind: "checkin"; concern: Concern; due: string[] }
  | { ico: "observation"; kind: "quiet"; concern: Concern; last?: Entry; quiet: number }
  | { ico: "illness"; kind: "sick"; concern: Concern; episode: Episode; days: number }
  | { ico: "lock"; kind: "vault" }
);

export function storyItems(D: D, vaultLocked: boolean): Story[] {
  const T = today(), out: Story[] = [], soon = addDays(T, 7), dis = (D.settings && D.settings.dismissedStories) || {};
  const pend = D.suggestions.filter((x) => x.status === "pending");
  if (pend.length) out.push({ key: "cal:" + pend.map((x) => x.id).sort().join(","), ico: "appointment", label: "Calendar", sub: `${pend.length} to review`, badge: String(pend.length), title: "Found on your calendar", kind: "calendar", pending: pend });
  D.entries.filter((e) => e.type === "appointment" && e.details.status === "upcoming" && e.occurred_at >= T && e.occurred_at <= soon).sort((p, q) => (p.occurred_at < q.occurred_at ? -1 : 1))
    .forEach((e) => {
      const n = dayDiff(T, e.occurred_at), prov = providerOf(D, e.details.provider_id);
      out.push({ key: "appt:" + e.id + ":" + e.occurred_at, ico: "appointment", label: e.title, sub: ago(e.occurred_at), badge: n <= 0 ? "now" : `${n}d`, title: e.title, kind: "appt", entry: e, photo: (prov && prov.photo) || null });
    });
  chOnly(D).forEach((c) => {
    const st = challengeStats(D, c);
    if (st.elapsed >= st.total || dayDiff(c.started_on, T) < 0) return;
    c.rules.forEach((r, ri) => {
      const per = perDays(r.per), i = Math.floor(dayDiff(c.started_on, T) / per), from = addDays(c.started_on, i * per), to = addDays(from, per - 1);
      const when = r.per === "day" ? "today" : "this " + r.per;
      if (ruleHit(D, r, from, to)) return;
      const photo = r.kind === "photo" ? lastPhotoIn(D, r.region!, "0000-01-01", T) : undefined;
      out.push({ key: `ch:${c.id}:${ri}:${from}`, ico: "challenge", label: r.label, sub: when, badge: "", badgeIco: r.kind === "photo" ? "camera" : "plus", photo: photo ? photo.photos[0] : null, title: c.title, kind: "challenge", challenge: c, ruleIndex: ri, when });
    });
  });
  tracked(D).forEach((c) => {
    const due = dueMetrics(D, c);
    if (!due.length) return;
    const per = c.tracking!.per || "week";
    out.push({ key: `ck:${c.id}:${periodStart(per)}`, ico: "measurement", label: c.title, sub: "check-in due", badge: "", badgeIco: "plus", title: c.title, kind: "checkin", concern: c, due });
  });
  // an illness still on: a nudge to say when it ended, so the days get counted right
  illnesses(D).forEach((c) => {
    const e = openEpisode(c);
    if (!e || e.from > T) return;
    const days = episodeDays(e), name = e.label || c.title;
    out.push({ key: `sick:${c.id}:${e.from}`, ico: "illness", label: name, sub: "still sick?", badge: `${days}d`, title: name, kind: "sick", concern: c, episode: e, days });
  });
  D.concerns.filter((c) => c.status !== "resolved" && !isIllness(c) && !((c.tracking || {}).metrics || []).length).forEach((c) => {
    const last = D.entries.filter((e) => e.concern_id === c.id).sort(byDateDesc())[0];
    const quiet = last ? dayDiff(last.occurred_at, T) : dayDiff(c.started_on || T, T);
    if (quiet >= 14) out.push({ key: `cq:${c.id}:${last ? last.id : "none"}`, ico: "observation", label: c.title, sub: `${quiet} days quiet`, badge: "!", title: c.title, kind: "quiet", concern: c, last, quiet });
  });
  if (vaultLocked) out.unshift({ key: "vault:" + T, ico: "lock", label: "Photos", sub: "locked", badge: "", title: "Photos are locked on this device", kind: "vault" });
  return out.filter((i) => !dis[i.key]);
}
export function dismissStory(D: D, key: string): void {
  const T = today();
  D.settings.dismissedStories = D.settings.dismissedStories || {};
  D.settings.dismissedStories[key] = T;
  for (const [k, v] of Object.entries(D.settings.dismissedStories)) if (dayDiff(v, T) > 90) delete D.settings.dismissedStories[k];
}
