// Providers: your doctor, dentist, physio. Kept in settings.providers (with a
// photo, address, link and an archived flag); the health card's providers
// rows are a strings-only mirror of the active ones, so the web app shows the
// same list. Archiving keeps every appointment and just takes them off the
// active list; deleting removes the card and leaves the appointments.
import { uid } from "./dates";
import type { Course, D, Entry, Provider } from "./types";

export function providersOf(D: D): Provider[] {
  if (D.settings.providers) return D.settings.providers;
  // first run on this phone: seeded from the health card rows
  return ((D.settings.card || {}).providers || []).map((r, i) => ({ id: "pv-seed-" + i, name: r.name || "", role: r.role || "", practice: r.practice || "", phone: r.phone || "" }));
}
export function ensureProviders(D: D): Provider[] {
  if (!D.settings.providers) D.settings.providers = providersOf(D).map((p) => ({ ...p }));
  return D.settings.providers;
}
export const activeProviders = (D: D): Provider[] => providersOf(D).filter((p) => !p.archived);
export const providerOf = (D: D, id: string | undefined | null): Provider | undefined => (id ? providersOf(D).find((p) => p.id === id) : undefined);
const sameName = (a?: string, b?: string): boolean => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
/** appointments with this provider: linked by id, or (older entries) by the same name, newest first */
export const providerEntries = (D: D, p: Provider): Entry[] =>
  D.entries.filter((e) => e.type === "appointment" && (e.details.provider_id === p.id || (!e.details.provider_id && sameName(e.details.provider, p.name)))).sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
export const providerCourses = (D: D, p: Provider): Course[] => D.courses.filter((k) => sameName(k.provider, p.name));
export const providerSpend = (es: Entry[]): number => es.reduce((s, e) => s + (+e.details.cost || 0), 0);
export const initials = (name: string): string => name.replace(/^dr\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
export const newProviderId = (): string => "pv-" + uid();

/** the health card's rows, for the web app: active providers, strings only */
export function mirrorCard(D: D): void {
  D.settings.card = D.settings.card || {};
  D.settings.card.providers = activeProviders(D).map((p) => ({ name: p.name, role: p.role || "", practice: p.practice || "", phone: p.phone || "" }));
}
export function upsertProvider(D: D, p: Provider): void {
  const ps = ensureProviders(D), i = ps.findIndex((x) => x.id === p.id);
  if (i >= 0) ps[i] = p; else ps.push(p);
  mirrorCard(D);
}
export function removeProvider(D: D, id: string): void {
  D.settings.providers = ensureProviders(D).filter((x) => x.id !== id);
  mirrorCard(D);
}
export function setArchived(D: D, id: string, v: boolean): void {
  const p = ensureProviders(D).find((x) => x.id === id);
  if (p) p.archived = v;
  mirrorCard(D);
}
