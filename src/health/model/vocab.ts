// Fixed vocabulary shared with the web app: regions, entry types and their
// fields, appointment kinds, regimen categories, palettes, cycle flows.
import type { D, EntryType, MetricKind, Per } from "./types";

export const BASE_REGIONS: Record<string, string> = {
  // regions: on the body
  scalp: "Scalp & hair", face: "Face", neck: "Neck", chest: "Chest", abdomen: "Abdomen", back: "Back", lower_back: "Lower back",
  arm_l: "Left arm", arm_r: "Right arm", leg_l: "Left leg", leg_r: "Right leg", foot_l: "Left foot", foot_r: "Right foot",
  // points: on a region's canvas
  eyes: "Eyes", nose: "Nose", ears: "Ears", mouth: "Mouth", teeth: "Teeth",
  shoulder_l: "Left shoulder", elbow_l: "Left elbow", hand_l: "Left hand", shoulder_r: "Right shoulder", elbow_r: "Right elbow", hand_r: "Right hand",
  thigh_l: "Left thigh", knee_l: "Left knee", shin_l: "Left shin & calf", thigh_r: "Right thigh", knee_r: "Right knee", shin_r: "Right shin & calf",
  heel_l: "Left heel", arch_l: "Left arch", toes_l: "Left toes", heel_r: "Right heel", arch_r: "Right arch", toes_r: "Right toes",
  skin: "Skin (all over)", whole_body: "Whole body",
  // older areas, kept so entries tagged with them keep their names
  arms: "Arms", hands: "Hands", legs: "Legs", feet: "Feet",
};
export const REG = (D: D): Record<string, string> => ({ ...BASE_REGIONS, ...(D.customRegions || {}) });
export const rl = (D: D, r: string): string => REG(D)[r] || r;

// The regions on the body, where they sit on the figure (% of it). The figure
// faces you, so its right arm is on the left of the screen. The back ones show
// on the back view.
export const DEFAULT_POINTS_RAW: [string, number, number, ("front" | "back")?][] = [
  ["scalp", 50, 3.2], ["face", 50, 7.6], ["neck", 50, 15.7], ["chest", 50, 25], ["abdomen", 50, 41],
  ["arm_r", 22.5, 38], ["arm_l", 77.5, 38], ["leg_r", 40, 71.7], ["leg_l", 60, 71.7], ["foot_r", 41.5, 96], ["foot_l", 58.5, 96],
  ["back", 50, 27, "back"], ["lower_back", 50, 44, "back"],
];
// The points a region starts with, on its canvas (% of the 4:5 canvas; the
// face's canvas is the head drawing, so these sit on its features).
export const DEFAULT_SUB_RAW: [string, string, number, number][] = [
  ["face", "eyes", 38, 43.5], ["face", "eyes", 62, 43.5], ["face", "nose", 50, 55], ["face", "ears", 18.5, 47.5], ["face", "ears", 81.5, 47.5], ["face", "mouth", 40, 66.5], ["face", "teeth", 55, 65.5],
  ["arm_l", "shoulder_l", 50, 10], ["arm_l", "elbow_l", 50, 50], ["arm_l", "hand_l", 50, 88],
  ["arm_r", "shoulder_r", 50, 10], ["arm_r", "elbow_r", 50, 50], ["arm_r", "hand_r", 50, 88],
  ["leg_l", "thigh_l", 50, 18], ["leg_l", "knee_l", 50, 50], ["leg_l", "shin_l", 50, 78],
  ["leg_r", "thigh_r", 50, 18], ["leg_r", "knee_r", 50, 50], ["leg_r", "shin_r", 50, 78],
  ["foot_l", "heel_l", 50, 22], ["foot_l", "arch_l", 50, 52], ["foot_l", "toes_l", 50, 86],
  ["foot_r", "heel_r", 50, 22], ["foot_r", "arch_r", 50, 52], ["foot_r", "toes_r", 50, 86],
];
/** the region whose canvas this area is a point on, or null for a region (or an area with no point) */
export const parentOf = (D: D, r: string): string | null => { const p = D.points.find((q) => q.region === r && q.parent); return p ? p.parent! : null; };
/** the areas with a point on this region's canvas, in the order of the points */
export const childRegions = (D: D, r: string): string[] => [...new Set(D.points.filter((p) => p.parent === r).map((p) => p.region))];
/** the regions on the body in the figure's order, then whole body, skin and custom areas with no point; `extra` ids (an entry's older tags) are kept at the end */
export function topRegions(D: D, extra?: Iterable<string>): string[] {
  const out: string[] = [];
  const add = (r: string) => { if (!out.includes(r)) out.push(r); };
  const l1 = D.points.filter((p) => !p.parent).map((p) => p.region);
  DEFAULT_POINTS_RAW.forEach(([r]) => { if (l1.includes(r)) add(r); });
  l1.forEach(add);
  add("whole_body"); add("skin");
  const used = new Set(D.points.map((p) => p.region));
  Object.keys(D.customRegions || {}).forEach((r) => { if (!used.has(r)) add(r); });
  if (extra) for (const r of extra) if (!parentOf(D, r)) add(r);
  return out;
}

export type FieldDef = {
  k: string; l: string; t: "select" | "text" | "area" | "number" | "date" | "kind" | "plan" | "course" | "metric" | "provider";
  o?: [string, string][]; p?: string; full?: 1; only?: string;
};
export type TypeDef = { label: string; hint: string; fields: FieldDef[] };
export const TYPES: Record<EntryType, TypeDef> = {
  photo: { label: "Photo", hint: "Anything you want to see change: skin, hair, teeth, a mole, your body", fields: [{ k: "series", l: "Photo series", t: "select", o: [["none", "Not part of a series"], ["body", "Body progress"], ["face", "Face progress"]] }] },
  appointment: {
    label: "Appointment", hint: "Any visit or session: doctor, dentist, physio, a scan, your own fitness test", fields: [
      { k: "kind", l: "Kind", t: "kind" },
      { k: "status", l: "Status", t: "select", o: [["done", "Done"], ["upcoming", "Upcoming"], ["cancelled", "Cancelled"]] },
      { k: "provider", l: "Provider", t: "provider", p: "Dr. Lee" }, { k: "practice", l: "Practice", t: "text", p: "Clinic name" },
      { k: "plan_id", l: "Part of your plan", t: "plan" }, { k: "course_id", l: "Part of a course of care", t: "course" },
      { k: "reason", l: "What you went in for", t: "text", full: 1 }, { k: "what_was_done", l: "What was done", t: "area", full: 1 },
      { k: "what_they_said", l: "What they said", t: "area", full: 1 }, { k: "results", l: "Results", t: "area", full: 1 },
      { k: "cost", l: "Cost", t: "number" }, { k: "follow_up_on", l: "Follow-up on", t: "date" },
      { k: "tooth", l: "Tooth number", t: "text", p: "36", only: "dentist" },
    ],
  },
  measurement: { label: "Measurement", hint: "Weight, a lab-style number, or your own rating of anything", fields: [{ k: "metric", l: "Measure", t: "metric" }] },
  procedure: { label: "Procedure", hint: "One-off: a filling, a laser session, a removal", fields: [{ k: "name", l: "Procedure", t: "text", p: "Composite filling" }, { k: "provider", l: "Provider", t: "text" }] },
  observation: { label: "Observation", hint: "Something you noticed", fields: [{ k: "severity", l: "How much (1–5, optional)", t: "select", o: [["", "–"], ["1", "1 · barely"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5 · a lot"]] }] },
  food_trial: { label: "Food trial", hint: "Something you ate on purpose to see what happens", fields: [{ k: "food", l: "Food", t: "text", p: "Dairy" }, { k: "amount", l: "How much", t: "text", p: "A small yogurt" }] },
};

export const KIND_LABEL: Record<string, string> = { doctor: "Doctor", dentist: "Dentist", therapy: "Therapy", physio: "Physio", med_spa: "Med spa", specialist: "Specialist / scan", self: "Self check-in", other: "Appointment" };
export const kindLabel = (D: D | null, k: string | undefined): string =>
  (k && KIND_LABEL[k]) || ((D?.settings?.customKinds || {})[k || ""]) || (k ? String(k) : "");
export const allKinds = (D: D): [string, string][] => Object.entries({ ...KIND_LABEL, ...(D.settings.customKinds || {}) });

export const REG_CATS: [string, string][] = [["supplement", "Supplement"], ["medication", "Medication"], ["activity", "Activity or exercise"], ["skin", "Skin care"], ["hair", "Hair care"], ["other", "Other"]];
export const catLabel = (c: string): string => (REG_CATS.find((x) => x[0] === c) || [, c === "diet" ? "Diet" : c])[1] as string;

/** the scales a rating can use; the unit carries the scale, so "/10" means 0 to 10 */
export const RATING_SCALES: [string, string][] = [["/5", "1 to 5"], ["/10", "0 to 10, where 0 is none"]];
export const ratingRange = (u?: string | null): { lo: number; hi: number } => (u === "/10" ? { lo: 0, hi: 10 } : { lo: 1, hi: 5 });
export const KIND_OPTS: [MetricKind, string][] = [["number", "A number with a unit"], ["rating", "My own rating, 1 to 5 or 0 to 10"], ["time", "A time of day"], ["time_night", "A time around midnight, like bedtime"], ["duration", "A length of time"]];
export const PER_LABEL: Record<Per, string> = { day: "Every day", week: "Every week", month: "Every month" };

export const FLOW: [string, string][] = [["none", "None"], ["spotting", "Spotting"], ["light", "Light"], ["medium", "Medium"], ["heavy", "Heavy"]];
export const FLOW_COL: Record<string, string> = { spotting: "#F2B8C6", light: "#EE8FA8", medium: "#E05A7E", heavy: "#B8264F", unspecified: "#E05A7E" };
export const SYMPTOMS = ["Cramps", "Bloating", "Breast tenderness", "Headache", "Acne", "Mood changes", "Fatigue", "Back pain"];
export const SRC_NAME: Record<string, string> = { manual: "you", apple_health: "Apple Health" };
export const flowName = (v: string): string => (FLOW.find((f) => f[0] === v) || [, v])[1] as string;

// every app's activities arrive as Apple Health workouts once that app is allowed to write to Health; the source is a label for where they came from
export const SOURCES: [string, string][] = [["manual", "I tick it off"], ["apple_health", "An Apple Health workout"], ["strava", "A Strava activity, through Apple Health"], ["garmin", "A Garmin activity, through Apple Health"], ["oura", "An Oura activity, through Apple Health"], ["whoop", "A Whoop activity, through Apple Health"]];
export const srcLabel = (s: string): string => (SOURCES.find((x) => x[0] === s) || [, s])[1] as string;

export const MARKERS: [string, string][] = [["procedure", "Procedures"], ["appointment", "Appointments"], ["food_trial", "Food trials"], ["observation", "Observations"]];

// Chart and Lifestyle colours. The first Citrus swatch is the literal string
// "var(--accent)" = follow the user's accent; it is stored as-is, never resolved.
export const ACCENT_TOKEN = "var(--accent)";
export const PALETTES: [string, string[]][] = [
  ["Periwinkle", ["#4F5BF5", "#7480F7", "#9EA6FA", "#C6CBFC"]],
  ["Sage", ["#4F8A62", "#78AA87", "#A6C9AF", "#D0E3D4"]],
  ["Citrus", [ACCENT_TOKEN, "#B5DA4C", "#D3EB8E", "#EAF6C9"]],
  ["Clay", ["#C2693F", "#D8916B", "#E9B89B", "#F5DCCD"]],
  ["Plum", ["#8556B5", "#A684CE", "#C7B0E3", "#E5DAF2"]],
  ["Ocean", ["#1F7A8C", "#4B9DAD", "#86C1CC", "#C3E1E6"]],
  ["Graphite", ["#2E333B", "#5B6470", "#8E97A3", "#C4CAD2"]],
];
export const ALL_COLORS = PALETTES.flatMap((p) => p[1]);
export const DEFAULT_Y1 = "#4F5BF5", DEFAULT_Y2 = "#C2693F";
export const ACCENTS: [string, string][] = [["Soft Launched maroon", "#8B0000"], ["Lime", "#CDEE45"], ["Periwinkle", "#4F5BF5"], ["Sage", "#4F8A62"], ["Clay", "#C2693F"]];
export const DEFAULT_ACCENT = "#8B0000";
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

export const BLOOD = ["", "A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Not sure"];
export type CardField = [string, string, ("select" | "date" | "text")?, [string, string][]?];
export const CARD_SECS: [string, string, CardField[]][] = [
  ["allergies", "Allergies", [["what", "Allergic to"], ["reaction", "What happens"], ["severity", "Severity", "select", [["", "–"], ["mild", "Mild"], ["moderate", "Moderate"], ["severe", "Severe"]]]]],
  ["vaccines", "Vaccinations", [["name", "Vaccine"], ["date", "Date", "date"], ["booster", "Booster due", "date"]]],
  ["conditions", "Ongoing conditions", [["name", "Condition"], ["since", "Since", "date"], ["notes", "Notes"]]],
  ["providers", "Your providers", [["name", "Name"], ["role", "Role, e.g. family doctor"], ["practice", "Practice"], ["phone", "Phone"]]],
  ["contacts", "Emergency contacts", [["name", "Name"], ["relation", "Relationship"], ["phone", "Phone"]]],
];

export const DEF_PLAN_CATS = [{ id: "physical", name: "Physical health" }, { id: "oral", name: "Oral health" }, { id: "mental", name: "Mental health" }, { id: "skin", name: "Skin health" }, { id: "eyes", name: "Eye health" }, { id: "other", name: "Other" }];

export const TABS: [string, string][] = [["dashboard", "Dashboard"], ["history", "History"], ["routines", "Lifestyle"], ["plan", "Plan"], ["concerns", "Concerns"], ["charts", "Charts"], ["labs", "Reports"], ["photos", "Photos"], ["reports", "Summary"]];

export const WIDGETS: Record<string, { label: string; hint: string }> = {
  appointments: { label: "Appointments", hint: "Upcoming, and last visit by kind" },
  concerns: { label: "Concerns", hint: "Active and resolved" },
  regimens: { label: "Active regimens", hint: "Your diet, supplements, meds, products" },
  diet: { label: "Diet", hint: "What you are eating now" },
  challenge: { label: "Challenge", hint: "Progress on a time-boxed challenge" },
  savedchart: { label: "Chart", hint: "One of the charts you built on the Charts page" },
  labs: { label: "Latest lab results", hint: "Most recent report" },
  photos: { label: "Recent photos", hint: "Latest photos, any area" },
  recent: { label: "Recent entries", hint: "Latest things you logged" },
  teeth: { label: "Teeth", hint: "Your teeth chart: fillings, crowns, removed or never-grown teeth" },
  quick: { label: "Quick entry", hint: "Log one thing for today in a tap, like your cycle or a rating. Asks again each day." },
  plan: { label: "Yearly plan", hint: "Your appointment targets for the year" },
  integrations: { label: "Integrations", hint: "Apple Health, Oura, Garmin, Whoop" },
};
export const WIDGET_TAB: Record<string, string> = { appointments: "history", plan: "plan", suggestions: "history", concerns: "concerns", regimens: "routines", diet: "routines", challenge: "plan", savedchart: "charts", labs: "labs", photos: "photos", recent: "history" };
export const FILTERED = new Set(["appointments", "concerns", "regimens", "photos", "recent"]);

// entry-type tints (light / dark)
export const TINT: Record<string, [string, string]> = {
  photo: ["#8A6FD1", "#A893E6"], appointment: ["#3C78D8", "#6FA0EE"], measurement: ["#2E9C8F", "#4FC3B4"], procedure: ["#D9822B", "#EBA25A"],
  observation: ["#C2506A", "#E07A92"], lab: ["#5A6B8C", "#8FA2C8"], regimen: ["#4D8A3A", "#7DBE68"], diet: ["#9A7B2F", "#D2AE55"],
  food_trial: ["#B4652A", "#D98A4A"], cycle: ["#C9426B", "#E0668A"], challenge: ["#16180F", "#ECEFE5"],
  illness: ["#B8574A", "#E08A7E"], report: ["#5A6B8C", "#8FA2C8"],
};
