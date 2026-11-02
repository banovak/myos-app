// Teeth: one chart, a status per tooth, stored by FDI number in
// profile.settings.teeth. Geometry ported from teethSVG() so the phone and
// web draw the same chart. The stored blob is untrusted: unknown keys and
// statuses are ignored on read.
import { byDateDesc } from "./dates";
import type { D, Entry, ToothRec, ToothStatus } from "./types";

export const TOOTH_STATUS: [ToothStatus, string, string][] = [
  ["watch", "Watching", "#E0A63B"], ["cavity", "Cavity", "#D9534F"], ["filled", "Filled", "#4F5BF5"], ["crown", "Crown", "#8556B5"], ["root_canal", "Root canal", "#C2693F"],
  ["implant", "Implant", "#5C6470"], ["bridge", "Bridge", "#3C9A8F"], ["extracted", "Removed", ""], ["missing", "Never grew", ""],
];
export const TS_KEYS = new Set<string>(TOOTH_STATUS.map((x) => x[0]));
export const TS_FILL: ToothStatus[] = ["cavity", "watch", "root_canal", "crown", "implant", "bridge", "filled"];
export const TOOTH_NAME = ["central incisor", "lateral incisor", "canine", "first premolar", "second premolar", "first molar", "second molar", "wisdom tooth"];
export const QUAD_NAME: Record<number, string> = { 1: "upper right", 2: "upper left", 3: "lower left", 4: "lower right" };
export const ALL_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_SET = new Set(ALL_TEETH.map(String));

/** sanitised view of profile.settings.teeth: only the 32 FDI keys, only known statuses */
export function teethData(D: D): Record<string, ToothRec> {
  const raw = D.settings.teeth;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, ToothRec> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!ALL_SET.has(k) || !v || typeof v !== "object") continue;
    const s = Array.isArray((v as any).s) ? ((v as any).s as unknown[]).filter((x): x is ToothStatus => typeof x === "string" && TS_KEYS.has(x)) : [];
    out[k] = { s, since: typeof (v as any).since === "string" ? (v as any).since : "", note: typeof (v as any).note === "string" ? (v as any).note : "" };
  }
  return out;
}
export const toothNum = (D: D, n: number): string => {
  if (D.settings.toothNumbering !== "universal") return String(n);
  const q = Math.floor(n / 10), d = n % 10;
  return String(q === 1 ? 9 - d : q === 2 ? 8 + d : q === 3 ? 25 - d : 24 + d);
};
export const toothLabel = (D: D, n: number): string => `Tooth ${toothNum(D, n)}: ${QUAD_NAME[Math.floor(n / 10)]} ${TOOTH_NAME[(n % 10) - 1]}`;
export const toothGone = (r?: ToothRec): boolean => !!r && Array.isArray(r.s) && r.s.some((s) => s === "extracted" || s === "missing");
export const statusLabel = (k: string): string => (TOOTH_STATUS.find((x) => x[0] === k) || [, k])[1] as string;
export const statusColor = (k: string): string => (TOOTH_STATUS.find((x) => x[0] === k) || [, , ""])[2] as string;

export function toothEntries(D: D, n: number): Entry[] {
  const re = new RegExp(`(^|\\D)${n}(\\D|$)`), reT = new RegExp(`tooth\\s*${n}\\b`, "i");
  return D.entries.filter((e) => (e.details && e.details.tooth && re.test(String(e.details.tooth))) || reT.test(e.title || "")).sort(byDateDesc());
}

export function toothPath(d: number, w: number, h: number): string {
  const x = w / 2, y = h / 2;
  if (d <= 2) return `M${-x},${-y + 1} Q0,${-y - 2.5} ${x},${-y + 1} Q${x - 0.5},${h * 0.12} ${w * 0.14},${y} Q0,${y + 1.5} ${-w * 0.14},${y} Q${-x + 0.5},${h * 0.12} ${-x},${-y + 1}Z`;
  if (d === 3) return `M0,${-y - 1} Q${x},${-y} ${x},${-h * 0.05} Q${x - 1},${y} 0,${y} Q${-x + 1},${y} ${-x},${-h * 0.05} Q${-x},${-y} 0,${-y - 1}Z`;
  const r = d <= 5 ? w * 0.38 : w * 0.3, b = d <= 5 ? 1 : 2;
  return `M${-x + r},${-y} Q${-w / 4},${-y - b} 0,${-y + 0.5} Q${w / 4},${-y - b} ${x - r},${-y} Q${x},${-y} ${x},${-y + r} Q${x + b},0 ${x},${y - r} Q${x},${y} ${x - r},${y} Q${w / 4},${y + b} 0,${y - 0.5} Q${-w / 4},${y + b} ${-x + r},${y} Q${-x},${y} ${-x},${y - r} Q${-x - b},0 ${-x},${-y + r} Q${-x},${-y} ${-x + r},${-y}Z`;
}
export function toothGrooves(d: number, w: number, h: number): string {
  if (d <= 3) return "";
  if (d <= 5) return `M${-w * 0.28},${h * 0.02} Q0,${h * 0.12} ${w * 0.28},${h * 0.02}`;
  return `M${-w * 0.32},${-h * 0.04} Q${-w * 0.1},${h * 0.1} 0,${-h * 0.02} Q${w * 0.12},${h * 0.1} ${w * 0.32},${-h * 0.06} M${-w * 0.04},${-h * 0.34} Q${w * 0.08},${-h * 0.12} ${-w * 0.02},${h * 0.02} Q${-w * 0.1},${h * 0.18} ${w * 0.04},${h * 0.34}`;
}

export type ToothGeom = { n: number; d: number; up: boolean; x: number; y: number; ang: number; lx: number; ly: number; w: number; h: number; path: string; grooves: string; rec?: ToothRec; ss: ToothStatus[]; gone: boolean; col: string };
/** the same layout as the web's teethSVG(): viewBox 0 0 400 560 */
export function teethGeometry(D: D): ToothGeom[] {
  const W = [25, 19, 22, 21, 20, 30, 28, 25], H = [19, 18, 22, 24, 24, 30, 29, 27], GAP = 2, td = teethData(D);
  const half = W.reduce((a, b) => a + b + GAP, 0), MAXT = Math.PI * 0.54;
  return ALL_TEETH.map((n) => {
    const q = Math.floor(n / 10), d = n % 10, up = q <= 2, left = q === 1 || q === 4;
    let cum = W[d - 1] / 2 + GAP / 2;
    for (let i = 0; i < d - 1; i++) cum += W[i] + GAP;
    const t = (cum / half) * MAXT * (left ? -1 : 1);
    const R = up ? { rx: 132, ry: 166, cy: 250 } : { rx: 126, ry: 158, cy: 332 }, s = Math.sin(t), c = Math.cos(t);
    const x = 200 + R.rx * s, y = up ? R.cy - R.ry * c : R.cy + R.ry * c, ang = (Math.atan2(up ? R.ry * s : -R.ry * s, R.rx * c) * 180) / Math.PI;
    const lx = 200 + (R.rx + 32) * s, ly = up ? R.cy - (R.ry + 32) * c : R.cy + (R.ry + 32) * c;
    const rec = td[n], ss = rec ? rec.s : [], gone = toothGone(rec), fillK = TS_FILL.find((k) => ss.includes(k)), col = fillK ? statusColor(fillK) : "";
    const w = W[d - 1], h = H[d - 1];
    return { n, d, up, x, y, ang, lx, ly, w, h, path: toothPath(d, w, h), grooves: toothGrooves(d, w, h), rec, ss, gone, col };
  });
}
