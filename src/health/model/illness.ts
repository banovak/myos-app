// Illnesses: a concern that comes in episodes. A concern is anchored to a place
// on the body and has one open stretch; an illness is anchored to time: one
// record per group ("Viral", "Bacterial", "Lupus"), an episode per bout with
// its own label ("Cold", "Norovirus", "Flare"), a start and an end that stays
// blank while it is still on. Counting episodes and days is display, nothing
// more: the app never says what the pattern means.
import { dayDiff, today } from "./dates";
import type { Concern, D, Episode } from "./types";
import { ALL_COLORS, isHex } from "./vocab";

export const isIllness = (c: Concern): boolean => c.kind === "illness";
export const illnesses = (D: D): Concern[] => D.concerns.filter(isIllness);
/** the groups offered when starting out; a chronic condition is its own named group (Lupus, Migraine), never a bucket */
export const ILLNESS_GROUPS = ["Viral", "Bacterial", "Not sure"];

/** the episodes of an illness, earliest first; an older row with none is read as one episode from its dates */
export const episodesOf = (c: Concern): Episode[] => (c.episodes && c.episodes.length ? c.episodes : c.started_on ? [{ from: c.started_on, to: c.resolved_on || null }] : []);
/** set the episodes; started_on, resolved_on and status follow (first start, last end; active while one is open) */
export function setEpisodes(c: Concern, eps: Episode[]): void {
  const s = eps.map((e) => ({ ...e, from: e.from, to: e.to || null, ...(e.label && e.label.trim() ? { label: e.label.trim() } : {}), ...(e.notes && e.notes.trim() ? { notes: e.notes.trim() } : {}) }))
    .map((e) => { const o: Episode = { from: e.from, to: e.to }; if (e.label) o.label = e.label; if (e.notes) o.notes = e.notes; return o; })
    .sort((a, b) => (a.from < b.from ? -1 : 1));
  c.episodes = s;
  if (!s.length) return;
  const open = s.some((e) => !e.to);
  c.started_on = s[0].from;
  c.resolved_on = open ? null : s.reduce((m, e) => (e.to! > m ? e.to! : m), s[0].to!);
  c.status = open ? "active" : "resolved";
}
/** an episode covers the day */
export const sickOn = (c: Concern, on = today()): boolean => episodesOf(c).some((e) => e.from <= on && (!e.to || e.to >= on));
/** the episode still on, if any */
export const openEpisode = (c: Concern): Episode | undefined => episodesOf(c).find((e) => !e.to);
/** the days of an episode, both ends counted; an open one runs to today */
export const episodeDays = (e: Episode, upTo = today()): number => Math.max(1, dayDiff(e.from, e.to && e.to <= upTo ? e.to : upTo) + 1);
export const episodeTitle = (c: Concern, e: Episode): string => e.label || c.title;
/** two episodes of one illness may not overlap; `skip` is the one being edited */
export function episodeClash(eps: Episode[], e: Episode, skip = -1): boolean {
  const T = "9999-12-31", a = e.from, b = e.to || T;
  return eps.some((x, i) => i !== skip && x.from <= b && (x.to || T) >= a);
}
/** days sick inside a window, both ends counted; an open episode runs to today */
export function sickDays(c: Concern, from: string, to: string): number {
  const T = today(), hi = to < T ? to : T;
  let n = 0;
  for (const e of episodesOf(c)) {
    const a = e.from > from ? e.from : from, end = e.to || T, b = end < hi ? end : hi;
    if (a <= b) n += dayDiff(a, b) + 1;
  }
  return n;
}
export const yearStart = (): string => today().slice(0, 4) + "-01-01";
export const sickDaysThisYear = (c: Concern): number => sickDays(c, yearStart(), today());
export const episodesThisYear = (c: Concern): number => episodesOf(c).filter((e) => e.from >= yearStart()).length;
/** the colour an illness draws in: its own, or one from the palette by its place among the illnesses */
export function illnessColor(D: D, c: Concern): string {
  if (c.color) return c.color;
  const pool = ALL_COLORS.filter((x) => isHex(x)), i = illnesses(D).findIndex((x) => x.id === c.id);
  return pool[((i < 0 ? 0 : i) * 3) % pool.length];
}
/** the labels used before, most recent first, to offer as chips */
export function recentLabels(D: D): string[] {
  const seen = new Map<string, string>();
  illnesses(D).forEach((c) => episodesOf(c).forEach((e) => { if (e.label) { const k = e.label.toLowerCase(); if (!seen.has(k) || seen.get(k)! < e.from) seen.set(k, e.from); } }));
  const label = (k: string) => { for (const c of illnesses(D)) for (const e of episodesOf(c)) if (e.label && e.label.toLowerCase() === k) return e.label; return k; };
  return [...seen.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([k]) => label(k));
}
/** find the group by name, or make it */
export function groupNamed(D: D, name: string, mk: () => Concern): Concern {
  const n = name.trim().toLowerCase();
  const have = illnesses(D).find((c) => c.title.trim().toLowerCase() === n);
  if (have) return have;
  const c = mk();
  D.concerns.push(c);
  return c;
}
