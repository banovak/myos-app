// What to do with each thing Apple Health provides. Weight and body fat are the
// same measure whether typed in or read from Health, so they merge into one
// series: Both (a day with both shows Health's figure), Health only, or Manual
// only. Everything else is simply on or off. Lives in settings.hkUse, keyed by
// the item; absent means Both / On.
import type { D } from "./types";

export type HkUse = "both" | "health" | "manual" | "off";
export type HkItem = { key: string; label: string; merge?: string; hk: string[] };
/** the items on the Apple Health sheet: `merge` is the manual measure the Health values join; `hk` the D.hk keys they cover */
export const HK_ITEMS: HkItem[] = [
  { key: "weight", label: "Weight", merge: "weight", hk: ["weight"] },
  { key: "body_fat", label: "Body fat", merge: "body_fat", hk: ["body_fat"] },
  { key: "steps", label: "Steps", hk: ["steps"] },
  { key: "active_kcal", label: "Active energy", hk: ["active_kcal"] },
  { key: "rhr", label: "Resting heart rate", hk: ["rhr"] },
  { key: "hrv", label: "HRV", hk: ["hrv"] },
  { key: "sleep", label: "Sleep, bedtime and wake time", hk: ["sleep_hours", "bedtime", "wake", "sleep"] },
  { key: "cycle", label: "Menstrual flow, spotting and symptoms", hk: [] },
  { key: "workouts", label: "Workouts, as ticks on a regimen", hk: [] },
];
export const hkUse = (D: D, key: string): HkUse => ((D.settings.hkUse || {})[key] as HkUse) || "both";
/** the setting that covers a D.hk key */
export const hkUseFor = (D: D, hkKey: string): HkUse => { const it = HK_ITEMS.find((x) => x.hk.includes(hkKey)); return it ? hkUse(D, it.key) : "both"; };
/** the Health key that merges into a manual measure, if any */
export const hkKeyForMetric = (metricKey: string): string | null => { const it = HK_ITEMS.find((x) => x.merge === metricKey); return it ? it.hk[0] : null; };
/** the manual measure a Health key merges into, if any */
export const metricForHk = (hkKey: string): string | null => { const it = HK_ITEMS.find((x) => x.merge && x.hk.includes(hkKey)); return it ? it.merge! : null; };

export type MeasurePoint = { d: string; v: number; src?: string };
/** a measure's stored values by day, manual and Health together under the item's setting: Health wins a day that has both, unless set to Manual only */
export function measurePoints(D: D, key: string): MeasurePoint[] {
  const manual: MeasurePoint[] = D.entries.filter((e) => e.type === "measurement" && e.details.metric === key && e.details.value != null).map((e) => ({ d: e.occurred_at, v: +e.details.value }));
  const hkKey = hkKeyForMetric(key), mode = hkKey ? hkUse(D, hkKey) : "manual";
  const health: MeasurePoint[] = hkKey && mode !== "manual" && mode !== "off" ? (D.hk[hkKey] || []).map((p) => ({ d: p.d, v: p.v, src: "Apple Health" })) : [];
  const days = new Set(health.map((p) => p.d));
  const pts = mode === "health" ? health : [...manual.filter((p) => !days.has(p.d)), ...health];
  return pts.sort((a, b) => (a.d < b.d ? -1 : 1));
}
