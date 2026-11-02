// Date helpers, a straight port of the web app's. Dates are YYYY-MM-DD strings
// in the phone's local time zone. today() is a function, not a constant: the
// app can stay open across midnight.
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Mar 2026" for any day in it */
export const monthLabel = (d: string): string => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

export const pd = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (s: string, n: number): string => {
  const d = pd(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const fmt = (s?: string | null): string => {
  if (!s) return "";
  const d = pd(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};
export const fmtShort = (s?: string | null): string => {
  if (!s) return "";
  const d = pd(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};
export const today = (): string => iso(new Date());
/** the time now as HH:MM, for an entry logged as it happens */
export const nowHHMM = (): string => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
export const dayDiff = (a: string, b: string): number => Math.round((pd(b).getTime() - pd(a).getTime()) / 864e5);

export function ago(s: string): string {
  const days = dayDiff(s, today());
  if (days < 0) {
    const f = -days;
    return f === 1 ? "tomorrow" : f < 31 ? `in ${f} days` : `in ${Math.round(f / 30)} months`;
  }
  if (days === 0) return "today";
  if (days < 31) return `${days} day${days > 1 ? "s" : ""} ago`;
  const m = Math.round(days / 30.4);
  return m < 12 ? `${m} month${m > 1 ? "s" : ""} ago` : `${(days / 365).toFixed(1)} years ago`;
}
export function span(a: string, b?: string | null): string {
  const n = dayDiff(a, b || today());
  if (n < 60) return `${n} days`;
  return `${Math.round(n / 30.4)} months`;
}

export const hhmm = (minIn: number): string => {
  const min = ((Math.round(minIn) % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60), m = min % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
export const toHHMM = (minIn: number): string => {
  const min = ((Math.round(minIn) % 1440) + 1440) % 1440;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
};
export const tfmt = (s?: string | null): string => {
  if (!s) return "";
  const [h, m] = s.split(":").map(Number);
  return hhmm(h * 60 + m);
};
export const dur = (minIn: number): string => {
  const min = Math.round(minIn);
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
};
export const money = (n: unknown): string => "$" + Math.round(+(n as number) || 0).toLocaleString();
export const avg = (a: number[]): number | null => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

// 8 random base-36 chars, like the web's uid(); crypto-random on the phone.
import { getRandomBytes } from "expo-crypto";
export function uid(): string {
  const bytes = getRandomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += (bytes[i] % 36).toString(36);
  return s;
}
export const byDateDesc = <T extends Record<string, any>>(k = "occurred_at") => (a: T, b: T): number =>
  a[k] < b[k] ? 1 : a[k] > b[k] ? -1 : 0;
export const byDateAsc = <T extends { occurred_at: string }>(a: T, b: T): number => (a.occurred_at < b.occurred_at ? -1 : 1);
