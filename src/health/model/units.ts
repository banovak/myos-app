// Weight and height are stored in kg and cm (the web app, Apple Health and
// the charts all assume that). Each can be shown and entered in the other
// unit on its own, since many people mix them: pounds for weight, centimetres
// for height, or the other way round.
import type { D } from "./types";

export type WeightUnit = "kg" | "lb";
export type HeightUnit = "cm" | "ft";
const LB_PER_KG = 2.2046226;
const CM_PER_IN = 2.54;

export function unitPref(D: D): { weight: WeightUnit; height: HeightUnit } {
  const u = D.settings.units || {};
  return { weight: u.weight === "lb" ? "lb" : "kg", height: u.height === "ft" ? "ft" : "cm" };
}
export function setUnit(D: D, k: "weight" | "height", u: WeightUnit | HeightUnit): void {
  D.settings.units = { ...(D.settings.units || {}), [k]: u };
}
export function toggleUnit(D: D, k: "weight" | "height"): void {
  const p = unitPref(D);
  setUnit(D, k, k === "weight" ? (p.weight === "kg" ? "lb" : "kg") : p.height === "cm" ? "ft" : "cm");
}

export const lbFromKg = (kg: number): number => +(kg * LB_PER_KG).toFixed(1);
export const kgFromLb = (lb: number): number => +(lb / LB_PER_KG).toFixed(2);
export const cmFromFtIn = (ft: number, inch: number): number => +((ft * 12 + inch) * CM_PER_IN).toFixed(1);
export function ftInFromCm(cm: number): { ft: number; inch: number } {
  const inches = cm / CM_PER_IN;
  let ft = Math.floor(inches / 12), inch = Math.round(inches - ft * 12);
  if (inch === 12) { ft++; inch = 0; }
  return { ft, inch };
}

/** a stored value in the unit the person chose: the number as text, and the unit word to show after it */
export function showMeasure(D: D, k: string, v: number): { value: string; unit: string } {
  const p = unitPref(D);
  if (k === "weight" && p.weight === "lb") return { value: String(lbFromKg(v)), unit: "lb" };
  if (k === "height" && p.height === "ft") { const { ft, inch } = ftInFromCm(v); return { value: `${ft}′ ${inch}″`, unit: "" }; }
  const m = D.metrics[k];
  return { value: String(+(+v).toFixed(2)), unit: m ? m.u : "" };
}
/** a stored value as a number in the chosen unit, for differences */
export function numIn(D: D, k: string, v: number): number {
  const p = unitPref(D);
  if (k === "weight" && p.weight === "lb") return lbFromKg(v);
  return v;
}
/** the unit word for the toggle beside a measurement */
export function unitWord(D: D, k: string): string {
  const p = unitPref(D);
  if (k === "weight") return p.weight;
  if (k === "height") return p.height === "ft" ? "ft in" : "cm";
  const m = D.metrics[k];
  return m ? m.u : "";
}
