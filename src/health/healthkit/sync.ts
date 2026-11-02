// Apple Health, read-only. Daily values → health.daily_metrics (source
// 'apple_health'), menstrual flow and symptoms → health.cycle_days (source
// 'apple_health', source_ref = sample uuid), workouts → health.regimen_logs for
// Lifestyle items that opted in. Writes go through the store's import path,
// which only touches source='apple_health' rows, so a manual save can never
// delete or overwrite them, and vice versa. Garmin, Oura, cycle apps, scales
// and MyFitnessPal arrive here when the user lets them write to Health.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { addDays, iso, today } from "../model/dates";
import type { D } from "../model/types";
import type { HealthStore } from "../store/types";
import type { SupabaseStore } from "../store/supabase";

const ON_KEY = "health.hk.on";
const LAST_KEY = "health.hk.last";
export const HK_DAYS = 90;

type HK = typeof import("@kingstinct/react-native-healthkit");
async function hk(): Promise<HK | null> {
  if (Platform.OS !== "ios") return null;
  try { return await import("@kingstinct/react-native-healthkit"); } catch { return null; }
}

const QUANTITY: { id: string; key: string; unit: string; stat: "cumulativeSum" | "discreteAverage" }[] = [
  { id: "HKQuantityTypeIdentifierStepCount", key: "steps", unit: "count", stat: "cumulativeSum" },
  { id: "HKQuantityTypeIdentifierActiveEnergyBurned", key: "active_kcal", unit: "kcal", stat: "cumulativeSum" },
  { id: "HKQuantityTypeIdentifierRestingHeartRate", key: "rhr", unit: "count/min", stat: "discreteAverage" },
  { id: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN", key: "hrv", unit: "ms", stat: "discreteAverage" },
  { id: "HKQuantityTypeIdentifierBodyMass", key: "weight", unit: "kg", stat: "discreteAverage" },
  { id: "HKQuantityTypeIdentifierBodyFatPercentage", key: "body_fat", unit: "%", stat: "discreteAverage" },
];
const SYMPTOM: [string, string][] = [
  ["HKCategoryTypeIdentifierAbdominalCramps", "cramps"], ["HKCategoryTypeIdentifierBloating", "bloating"], ["HKCategoryTypeIdentifierBreastPain", "breast_tenderness"], ["HKCategoryTypeIdentifierHeadache", "headache"],
  ["HKCategoryTypeIdentifierAcne", "acne"], ["HKCategoryTypeIdentifierMoodChanges", "mood"], ["HKCategoryTypeIdentifierFatigue", "fatigue"], ["HKCategoryTypeIdentifierLowerBackPain", "back_pain"],
];
export const READ_TYPES: string[] = [...QUANTITY.map((q) => q.id), "HKCategoryTypeIdentifierSleepAnalysis", "HKCategoryTypeIdentifierMenstrualFlow", "HKCategoryTypeIdentifierIntermenstrualBleeding", ...SYMPTOM.map((s) => s[0]), "HKWorkoutTypeIdentifier"];
export const READ_LABELS = ["Steps", "Active energy", "Resting heart rate", "HRV", "Weight", "Body fat", "Sleep", "Menstrual flow and spotting", "Cycle symptoms", "Workouts"];

export async function appleHealthAvailable(): Promise<boolean> {
  const H = await hk();
  if (!H) return false;
  try { return await H.isHealthDataAvailableAsync(); } catch { return false; }
}
export const appleHealthOn = async (): Promise<boolean> => (await AsyncStorage.getItem(ON_KEY)) === "1";
export const appleHealthLast = async (): Promise<string | null> => AsyncStorage.getItem(LAST_KEY);
export async function connectAppleHealth(): Promise<boolean> {
  const H = await hk();
  if (!H) return false;
  const ok = await H.requestAuthorization({ toRead: READ_TYPES as any });
  if (ok) await AsyncStorage.setItem(ON_KEY, "1");
  return ok;
}
export async function disconnectAppleHealth(): Promise<void> {
  await AsyncStorage.multiRemove([ON_KEY, LAST_KEY]);
}

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
const flowOf = (v: number): string => ({ 1: "unspecified", 2: "light", 3: "medium", 4: "heavy", 5: "none" } as Record<number, string>)[v] || "unspecified";

export type HkImport = { daily: { on_date: string; key: string; value: number }[]; cycle: { on_date: string; flow: string; symptoms: string[]; note: string; source_ref: string }[]; logs: { id: string; regimen_id: string; on_date: string; at_time: string | null; source_ref: string; note: string }[] };

/** read the last HK_DAYS days from Apple Health and shape them as rows */
export async function readAppleHealth(D: D, days = HK_DAYS): Promise<HkImport> {
  const H = await hk();
  const out: HkImport = { daily: [], cycle: [], logs: [] };
  if (!H) return out;
  const end = new Date(), start = new Date(); start.setDate(start.getDate() - days); start.setHours(0, 0, 0, 0);
  const filter = { date: { startDate: start, endDate: end } };
  // daily aggregates
  for (const q of QUANTITY) {
    try {
      const stats = await H.queryStatisticsCollectionForQuantity(q.id as any, [q.stat], start, { day: 1 }, { filter, unit: q.unit as any });
      for (const s of stats) {
        const qty = q.stat === "cumulativeSum" ? s.sumQuantity : s.averageQuantity;
        if (!qty || !s.startDate) continue;
        const v = +qty.quantity;
        if (!isFinite(v) || v === 0 && q.stat === "cumulativeSum") continue;
        out.daily.push({ on_date: iso(new Date(s.startDate)), key: q.key, value: +v.toFixed(2) });
      }
    } catch { /* type not granted or unavailable: skip it */ }
  }
  // sleep: asleep time per night, attributed to the morning it ended; bedtime and wake as minutes of the day
  try {
    const samples = await H.queryCategorySamples("HKCategoryTypeIdentifierSleepAnalysis" as any, { filter, limit: -1, ascending: true });
    const nights: Record<string, { asleep: number; first: Date | null; last: Date | null }> = {};
    for (const s of samples) {
      const sd = new Date(s.startDate), ed = new Date(s.endDate), v = +(s.value as number);
      const key = iso(ed);
      const n = (nights[key] = nights[key] || { asleep: 0, first: null, last: null });
      if (v !== 2) { if (!n.first || sd < n.first) n.first = sd; if (!n.last || ed > n.last) n.last = ed; }
      if (v === 1 || v === 3 || v === 4 || v === 5) n.asleep += (ed.getTime() - sd.getTime()) / 36e5;
    }
    for (const [d, n] of Object.entries(nights)) {
      if (n.asleep > 0) out.daily.push({ on_date: d, key: "sleep_hours", value: +n.asleep.toFixed(2) });
      if (n.first) out.daily.push({ on_date: d, key: "bedtime", value: minutesOfDay(n.first) });
      if (n.last) out.daily.push({ on_date: d, key: "wake", value: minutesOfDay(n.last) });
    }
  } catch { /* sleep not granted */ }
  // cycle: one row per day; flow wins, spotting fills in, symptoms merge
  const byDay: Record<string, { flow: string | null; spotting: boolean; symptoms: Set<string>; ref: string }> = {};
  const day = (d: string) => (byDay[d] = byDay[d] || { flow: null, spotting: false, symptoms: new Set(), ref: "" });
  try {
    const flows = await H.queryCategorySamples("HKCategoryTypeIdentifierMenstrualFlow" as any, { filter, limit: -1, ascending: true });
    for (const s of flows) { const d = day(iso(new Date(s.startDate))); d.flow = flowOf(+(s.value as number)); d.ref = d.ref || (s as any).uuid || ""; }
  } catch { /* not granted */ }
  try {
    const sp = await H.queryCategorySamples("HKCategoryTypeIdentifierIntermenstrualBleeding" as any, { filter, limit: -1, ascending: true });
    for (const s of sp) { const d = day(iso(new Date(s.startDate))); d.spotting = true; d.ref = d.ref || (s as any).uuid || ""; }
  } catch { /* not granted */ }
  for (const [id, name] of SYMPTOM) {
    try {
      const ss = await H.queryCategorySamples(id as any, { filter, limit: -1, ascending: true });
      for (const s of ss) { if (+(s.value as number) === 1) continue; const d = day(iso(new Date(s.startDate))); d.symptoms.add(name); d.ref = d.ref || (s as any).uuid || ""; }
    } catch { /* not granted */ }
  }
  for (const [on_date, d] of Object.entries(byDay)) {
    const flow = d.flow || (d.spotting ? "spotting" : "none");
    if (flow === "none" && !d.symptoms.size) continue;
    out.cycle.push({ on_date, flow, symptoms: [...d.symptoms], note: "", source_ref: d.ref || on_date });
  }
  // workouts → Lifestyle items that chose "An Apple Health workout" of a matching type
  // any app's source counts (Strava, Garmin, Oura, Whoop): their activities reach us as Health workouts
  const matchers = D.regimens.filter((r) => r.match && r.match.source !== "manual" && (r.match.activity || "").trim());
  if (matchers.length) {
    try {
      const ws = await H.queryWorkoutSamples({ filter, limit: -1, ascending: true } as any);
      const names: Record<number, string> = (H as any).WorkoutActivityType || {};
      for (const w of ws as any[]) {
        const typeName = String(names[w.workoutActivityType] || "").toLowerCase();
        if (!typeName) continue;
        for (const r of matchers) {
          const want = r.match!.activity!.trim().toLowerCase().replace(/[^a-z]/g, "");
          if (typeName.replace(/[^a-z]/g, "") !== want) continue;
          const sd = new Date(w.startDate);
          const uuid = String(w.uuid || `${r.id}-${sd.toISOString()}`);
          out.logs.push({ id: "rl-hk-" + uuid.replace(/[^a-z0-9]/gi, "").slice(0, 24).toLowerCase(), regimen_id: r.id, on_date: iso(sd), at_time: `${String(sd.getHours()).padStart(2, "0")}:${String(sd.getMinutes()).padStart(2, "0")}`, source_ref: uuid, note: "" });
        }
      }
    } catch { /* workouts not granted */ }
  }
  return out;
}

/** read, then write through the import path (synced) or merge into D (sample mode) */
export async function syncAppleHealth(store: HealthStore, D: D): Promise<{ daily: number; cycle: number; logs: number }> {
  const rows = await readAppleHealth(D);
  if (store.mode === "supabase") {
    const s = store as SupabaseStore;
    await s.upsertImported("daily_metrics", rows.daily.map((r) => ({ ...r })));
    await s.upsertImported("cycle_days", rows.cycle.map((r) => ({ ...r })));
    await s.upsertImported("regimen_logs", rows.logs.map((r) => ({ ...r })));
  } else {
    const hkm: D["hk"] = {};
    rows.daily.forEach((r) => (hkm[r.key] = hkm[r.key] || []).push({ d: r.on_date, v: r.value }));
    Object.values(hkm).forEach((a) => a.sort((p, q) => (p.d < q.d ? -1 : 1)));
    D.hk = { ...D.hk, ...hkm };
    D.cycle = [...D.cycle.filter((c) => c.source !== "apple_health"), ...rows.cycle.map((r) => ({ ...r, source: "apple_health", flow: r.flow as any }))];
    D.regLogs = [...D.regLogs.filter((l) => l.source !== "apple_health"), ...rows.logs.map((r) => ({ ...r, source: "apple_health", time: r.at_time }))];
  }
  await AsyncStorage.setItem(LAST_KEY, new Date().toISOString());
  return { daily: rows.daily.length, cycle: rows.cycle.length, logs: rows.logs.length };
}
/** on app open: sync when connected and the last sync is older than an hour */
export async function maybeSyncAppleHealth(store: HealthStore, D: D): Promise<boolean> {
  if (!(await appleHealthOn())) return false;
  const last = await appleHealthLast();
  if (last && Date.now() - new Date(last).getTime() < 3600e3) return false;
  await syncAppleHealth(store, D);
  return true;
}
export const hkWindowLabel = (): string => `${addDays(today(), -HK_DAYS)} to today`;
