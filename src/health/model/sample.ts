// Fictional sample data, the same as the web app's sample(), so the phone can
// be explored (and developed) without touching a real account. Photo
// placeholders ({ph, hue, w}) draw as gradients and the outline figure.
import { addDays, hhmm, today, uid } from "./dates";
import { setEpisodes } from "./illness";
import type { Concern, D, Entry, EntryType } from "./types";

export function sample(): D {
  const T = today();
  const E: Entry[] = [];
  const add = (o: Partial<Entry> & { type: EntryType; occurred_at: string; title: string }): Entry => {
    const e: Entry = { id: uid(), notes: "", regions: [], photos: [], files: [], details: {}, source: "manual", concern_id: null, parent_entry_id: null, ...o } as Entry;
    E.push(e);
    return e;
  };
  const C: D["concerns"] = [
    { id: "c-eczema", title: "Eczema, hands", regions: ["hands"], started_on: "2026-01-08", resolved_on: null, status: "active", tracking: { metrics: ["itch"], per: "month" } },
    { id: "c-tired", title: "Tiredness", regions: ["whole_body"], started_on: addDays(T, -21), resolved_on: null, status: "active", notes: "Flat in the afternoons. Want to see how it lines up with sleep and B12.", tracking: { metrics: ["energy", "refreshed", "bedtime"], per: "day" } },
    { id: "c-rash", title: "Rash, left cheek", regions: ["face"], started_on: "2026-04-20", resolved_on: "2026-05-22", status: "resolved" },
    { id: "c-tooth", title: "Cavity, tooth 36", regions: ["teeth"], started_on: "2026-03-12", resolved_on: "2026-03-26", status: "resolved" },
    { id: "c-mole", title: "Mole, left shoulder", regions: ["back"], started_on: addDays(T, -60), resolved_on: null, status: "active", notes: "Keep an eye on size and colour." },
    { id: "c-knee", title: "Right knee", regions: ["legs"], started_on: "2025-10-20", resolved_on: null, status: "active" },
  ];
  const metrics: D["metrics"] = {
    weight: { l: "Weight", u: "kg" }, body_fat: { l: "Body fat", u: "%" }, height: { l: "Height", u: "cm" },
    itch: { l: "Hand itch", u: "/5", rating: true }, skin_clarity: { l: "Skin clarity", u: "/5", rating: true }, knee_pain: { l: "Knee pain", u: "/5", rating: true },
    energy: { l: "Energy", u: "/5", kind: "rating", rating: true }, refreshed: { l: "Refreshed on waking", u: "/5", kind: "rating", rating: true }, bedtime: { l: "Ready for bed", u: "", kind: "time_night" },
    five_k: { l: "5k time", u: "min" }, squat_1rm: { l: "Squat 1RM", u: "kg" },
  };
  const months = ["2026-01-10", "2026-02-11", "2026-03-09", "2026-04-12", "2026-05-10", "2026-06-14", "2026-07-12", "2026-08-09", "2026-09-13", "2026-10-11"];
  const w = [71.6, 71.2, 70.9, 71.0, 70.4, 70.1, 69.8, 69.9, 69.5, 69.2], hd = [4, 4, 4, 3, 3, 3, 2, 2, 2, 2], sk = [4, 4, 3, 2, 3, 4, 4, 4, 4, 4];
  months.forEach((d, i) => {
    add({ type: "measurement", occurred_at: d, title: `Weight ${w[i]} kg`, regions: ["whole_body"], details: { metric: "weight", value: w[i] } });
    add({ type: "measurement", occurred_at: d, title: `Hand itch ${hd[i]}/5`, regions: ["hands"], concern_id: "c-eczema", details: { metric: "itch", value: hd[i] } });
    add({ type: "measurement", occurred_at: d, title: `Skin clarity ${sk[i]}/5`, regions: ["face"], details: { metric: "skin_clarity", value: sk[i] } });
    add({ type: "photo", occurred_at: d, title: "Body progress", regions: ["whole_body"], details: { series: "body" }, photos: [{ ph: "body", w: 1.06 - i * 0.012 }] });
    if (i < 6) add({ type: "photo", occurred_at: d, title: "Hands, back view", regions: ["hands"], concern_id: "c-eczema", photos: [{ ph: "hands", hue: 8 + i * 3 }] });
  });
  ([["2026-01-10", 22.4], ["2026-04-12", 21.8], ["2026-07-12", 21.1], ["2026-10-11", 20.5]] as [string, number][]).forEach(([d, v]) => add({ type: "measurement", occurred_at: d, title: `Body fat ${v}%`, regions: ["whole_body"], details: { metric: "body_fat", value: v } }));
  add({ type: "measurement", occurred_at: "2026-01-10", title: "Height 175 cm", regions: ["whole_body"], details: { metric: "height", value: 175 } });
  for (let k = 0; k < 13; k++) {
    if (k === 4 || k === 9) continue;
    const d = addDays("2026-07-20", k * 7 + 1);
    if (d > T) break;
    add({ type: "photo", occurred_at: d, title: "Hands, weekly", regions: ["hands"], concern_id: "c-eczema", photos: [{ ph: "hands", hue: 20 + k }] });
  }
  add({ type: "observation", occurred_at: "2026-01-08", title: "Cracked, itchy skin on both hands", regions: ["hands"], concern_id: "c-eczema", details: { severity: "3" }, notes: "Worse after washing up, for about a month." });
  const gp1 = add({ type: "appointment", occurred_at: "2026-01-15", title: "GP, eczema on hands", regions: ["hands"], concern_id: "c-eczema", details: { kind: "doctor", status: "done", provider: "Dr. Patel", practice: "Riverside Family Health", reason: "Itchy, cracked hands for about a month", what_they_said: "Fragrance-free emollient after every wash. Ordered routine bloodwork: CBC, B12, TSH, lipids.", results: "See lab report Jan 20." } });
  add({ type: "appointment", occurred_at: "2026-01-29", title: "GP, bloodwork results", regions: ["whole_body"], concern_id: "c-eczema", parent_entry_id: gp1.id, details: { kind: "doctor", status: "done", provider: "Dr. Patel", practice: "Riverside Family Health", reason: "Go over results", what_they_said: "B12 on the low side: suggested 1000 mcg daily. Retest in about three months.", results: "", follow_up_on: "2026-05-12" } });
  const dent = add({ type: "appointment", occurred_at: "2026-03-12", title: "Dental cleaning", regions: ["teeth"], concern_id: "c-tooth", details: { kind: "dentist", status: "done", provider: "Dr. Okafor", practice: "Harbour Dental", reason: "Six-month cleaning", plan_id: "p-dental", cost: 180, what_they_said: "Small cavity on the lower left molar. Booked a filling.", results: "X-rays taken.", tooth: "36" } });
  add({ type: "procedure", occurred_at: "2026-03-26", title: "Filling, tooth 36", regions: ["teeth"], concern_id: "c-tooth", parent_entry_id: dent.id, details: { name: "Composite filling", provider: "Dr. Okafor" } });
  add({ type: "observation", occurred_at: "2026-04-20", title: "Red patch on left cheek", regions: ["face"], concern_id: "c-rash", details: { severity: "3" }, notes: "Started after switching moisturiser.", photos: [{ ph: "face", hue: 350 }] });
  add({ type: "appointment", occurred_at: "2026-05-08", title: "GP, cheek rash", regions: ["face"], concern_id: "c-rash", details: { kind: "doctor", status: "done", provider: "Dr. Patel", practice: "Riverside Family Health", reason: "Rash on left cheek", what_they_said: "Said it looked like a reaction to a product. Stop the new moisturiser; cream for 7 days." } });
  add({ type: "photo", occurred_at: "2026-05-22", title: "Cheek, cleared", regions: ["face"], concern_id: "c-rash", photos: [{ ph: "face", hue: 25 }] });
  add({ type: "appointment", occurred_at: "2026-06-18", title: "Laser resurfacing consult", regions: ["face"], details: { kind: "med_spa", status: "done", provider: "Maya R., RN", practice: "Lumen Aesthetics", reason: "Texture and fine lines", what_they_said: "Three fractional sessions, four weeks apart." } });
  add({ type: "procedure", occurred_at: "2026-07-09", title: "Fractional laser, session 1", regions: ["face"], details: { name: "Fractional laser resurfacing", provider: "Lumen Aesthetics" }, photos: [{ ph: "face", hue: 15 }] });
  add({ type: "observation", occurred_at: "2025-10-20", title: "Right knee sore after runs", regions: ["legs"], concern_id: "c-knee", details: { severity: "2" } });
  add({ type: "observation", occurred_at: addDays(T, -40), title: "New mole on left shoulder", regions: ["back"], concern_id: "c-mole", notes: "About 4 mm, flat, light brown." });
  const K: D["courses"] = [{ id: "k-physio", title: "Physio, right knee", kind: "physio", provider: "Sam Chen", practice: "Motion Physio", cadence: "Every 3 weeks", started_on: "2025-11-04", ended_on: null, concern_id: "c-knee", metric: "knee_pain", cost: 95, notes: "Goal: run 10k without knee pain." }];
  const work = ["Assessment. Kneecap tracking issue, given three exercises.", "Manual therapy and taping. Progressed exercises.", "Dry needling (quad). Reviewed form.", "Ultrasound. Added single-leg squats.", "Same program. Added hopping drills."];
  const pain = [3, 3, 4, 3, 3, 2, 3, 3, 3, 4, 3, 3, 2, 3, 3, 3, 3, 3, 3];
  for (let k = 0; k < 40; k++) {
    const d = addDays("2025-11-04", k * 21);
    if (d > T) { add({ type: "appointment", occurred_at: d, title: "Physio, right knee", regions: ["legs"], concern_id: "c-knee", details: { kind: "physio", status: "upcoming", provider: "Sam Chen", practice: "Motion Physio", course_id: "k-physio", cost: 95 } }); break; }
    const ap = add({ type: "appointment", occurred_at: d, title: "Physio, right knee", regions: ["legs"], concern_id: "c-knee", details: { kind: "physio", status: "done", provider: "Sam Chen", practice: "Motion Physio", course_id: "k-physio", cost: 95, what_was_done: work[k % work.length], what_they_said: k === 0 ? "Expect six to eight weeks to settle." : "" } });
    add({ type: "measurement", occurred_at: d, title: `Knee pain ${pain[k % pain.length]}/5`, regions: ["legs"], concern_id: "c-knee", details: { metric: "knee_pain", value: pain[k % pain.length], from_appt: ap.id } });
  }
  const year = +T.slice(0, 4);
  const PL: D["plans"] = [
    { id: "p-physical", title: "Annual physical", kind: "doctor", per_year: 1, notes: "", year, category: "physical" },
    { id: "p-dental", title: "Dental cleaning", kind: "dentist", per_year: 2, notes: "", year, category: "oral" },
    { id: "p-dexa", title: "DEXA scan", kind: "specialist", per_year: 1, notes: "Body composition and bone density.", year, category: "physical" },
    { id: "p-fitness", title: "Personal fitness test", kind: "self", per_year: 1, notes: "Timed 5k, then 1RM squat, deadlift and bench.", year, category: "physical" },
    { id: "p-fitness-25", title: "Personal fitness test", kind: "self", per_year: 1, notes: "Timed 5k, then 1RM squat.", year: year - 1, category: "physical" },
    { id: "p-therapy", title: "Therapy", kind: "therapy", per_year: 12, notes: "Monthly with Dr. Reyes.", category: "mental", year },
    { id: "p-skin", title: "Full skin check", kind: "specialist", per_year: 1, notes: "Dermatologist mole map.", category: "skin", year },
  ];
  for (let m = 1; m <= 12; m++) {
    const d = `${T.slice(0, 4)}-${String(m).padStart(2, "0")}-14`;
    if (d > addDays(T, 31)) break;
    add({ type: "appointment", occurred_at: d, title: "Therapy, Dr. Reyes", regions: ["whole_body"], details: { kind: "therapy", status: d <= T ? "done" : "upcoming", provider: "Dr. Reyes", plan_id: "p-therapy" } });
  }
  ([["2025-06-07", 31.4, 55, "p-fitness-25"], ["2026-06-06", 29.6, 62.5, "p-fitness"]] as [string, number, number, string][]).forEach(([d, t, sq, pid]) => {
    const ap = add({ type: "appointment", occurred_at: d, title: "Personal fitness test", regions: ["whole_body"], details: { kind: "self", status: "done", plan_id: pid, what_was_done: "Timed 5k on the track, then 1RM squat.", results: `5k ${t} min · squat ${sq} kg` } });
    add({ type: "measurement", occurred_at: d, title: `5k time ${t} min`, regions: ["whole_body"], details: { metric: "five_k", value: t, from_appt: ap.id } });
    add({ type: "measurement", occurred_at: d, title: `Squat 1RM ${sq} kg`, regions: ["legs"], details: { metric: "squat_1rm", value: sq, from_appt: ap.id } });
  });
  add({ type: "appointment", occurred_at: addDays(T, 4), title: "Dental cleaning", regions: ["teeth"], details: { kind: "dentist", status: "upcoming", provider: "Dr. Okafor", practice: "Harbour Dental", plan_id: "p-dental" } });
  const R: D["regimens"] = [
    { id: "r-b12", name: "Vitamin B12", category: "supplement", dose: "500 mcg", frequency: "Daily", started_on: "2026-02-01", ended_on: "2026-07-31", changes: [{ on: "2026-05-15", dose: "500 mcg", frequency: "Daily", prev_dose: "1000 mcg", prev_frequency: "Daily" }], regions: ["whole_body"], concern_id: null, notes: "Taken with breakfast." },
    { id: "r-yoga", name: "Yoga", category: "activity", dose: "60 min class", frequency: "2× a week", started_on: addDays(T, -56), ended_on: null, regions: ["back"], concern_id: null, notes: "", target: { count: 2, per: "week" }, match: { source: "strava", activity: "Yoga" } },
    { id: "r-omega", name: "Omega-3 fish oil", category: "supplement", dose: "1 g", frequency: "Daily", started_on: "2026-02-01", ended_on: null, regions: ["whole_body"], concern_id: null, notes: "" },
    { id: "r-emollient", name: "Fragrance-free emollient", category: "skin", dose: "", frequency: "After every hand wash", started_on: "2026-01-15", ended_on: null, regions: ["hands"], concern_id: "c-eczema", notes: "" },
    { id: "r-gloves", name: "Cotton gloves at night", category: "skin", dose: "", frequency: "3× a week", started_on: "2026-04-01", ended_on: null, regions: ["hands"], concern_id: "c-eczema", notes: "Over a thick layer of emollient." },
    { id: "r-hc", name: "Hydrocortisone 1% cream", category: "medication", dose: "Thin layer, twice a day", frequency: "Twice daily", started_on: "2026-05-08", ended_on: "2026-05-15", regions: ["face"], concern_id: "c-rash", notes: "" },
    { id: "r-d1", name: "Mediterranean", category: "diet", started_on: "2026-01-01", ended_on: "2026-03-31", regions: ["whole_body"], concern_id: null, notes: "" },
    { id: "r-d2", name: "High protein, about 120 g a day", category: "diet", started_on: "2026-04-01", ended_on: "2026-06-30", regions: ["whole_body"], concern_id: null, notes: "" },
    { id: "r-d3", name: "No alcohol", category: "diet", started_on: "2026-07-01", ended_on: addDays(T, -31), regions: ["whole_body"], concern_id: null, notes: "A dry summer, to see what changes." },
    { id: "r-d4", name: "Low FODMAP, adding one group back a week", category: "diet", started_on: addDays(T, -30), ended_on: null, regions: ["whole_body"], concern_id: null, notes: "" },
  ];
  const RC: Record<string, string> = { "r-yoga": "#4B9DAD", "r-b12": "#7480F7", "r-omega": "#E9B89B", "r-emollient": "#C7B0E3", "r-gloves": "#78AA87", "r-hc": "#C7B0E3", "r-d1": "#A6C9AF", "r-d2": "#D3EB8E", "r-d3": "#E9B89B", "r-d4": "#C3E55A" };
  const mkLab = (id: string, date: string, file: string, rows: [string, number, string, string, string][]): D["labs"][number] => ({ id, date, lab: "Northside Labs", file, results: rows.map(([marker, value, unit, range, flag]) => ({ marker, value, unit, range, flag })) });
  const L: D["labs"] = [
    mkLab("l1", "2026-01-20", "bloodwork-2026-01-20.pdf", [["Hemoglobin", 141, "g/L", "120–160", ""], ["Vitamin B12", 138, "pmol/L", "150–700", "L"], ["LDL cholesterol", 3.7, "mmol/L", "<3.5", "H"], ["TSH", 2.4, "mIU/L", "0.32–4.00", ""]]),
    mkLab("l2", "2026-05-12", "bloodwork-2026-05-12.pdf", [["Hemoglobin", 139, "g/L", "120–160", ""], ["Vitamin B12", 296, "pmol/L", "150–700", ""], ["LDL cholesterol", 3.4, "mmol/L", "<3.5", ""], ["TSH", 2.2, "mIU/L", "0.32–4.00", ""]]),
    mkLab("l3", "2026-08-20", "bloodwork-2026-08-20.pdf", [["Hemoglobin", 140, "g/L", "120–160", ""], ["Vitamin B12", 412, "pmol/L", "150–700", ""], ["LDL cholesterol", 3.1, "mmol/L", "<3.5", ""]]),
    { id: "l-rx", kind: "prescription", title: "Glasses prescription", date: "2026-02-10", lab: "Dr. Nguyen, Optometrist", file: "glasses-rx-2026-02-10.pdf", notes: "Distance only. Recheck in two years.", results: [["OD sphere", -1.25, "D", "", ""], ["OD cylinder", -0.5, "D", "axis 90", ""], ["OS sphere", -1.0, "D", "", ""], ["OS cylinder", -0.25, "D", "axis 85", ""]].map(([marker, value, unit, range, flag]) => ({ marker: marker as string, value: value as number, unit: unit as string, range: range as string, flag: flag as string })) },
    { id: "l-mri", kind: "scan", title: "Right knee MRI", date: "2025-12-02", lab: "Harbour Imaging", file: "knee-mri-2025-12-02.pdf", notes: "Report says: mild patellar tendinopathy, no tear.", results: [] },
  ];
  const CH: D["challenges"] = [
    { id: "ch1", kind: "challenge", title: "90-day hand check", started_on: "2026-07-20", days: 90, regimen_ids: ["r-gloves"], rules: [{ label: "Hand photo", kind: "photo", region: "hands", per: "week" }, { label: "Hand itch rating", kind: "metric", metric: "itch", per: "month" }], notes: "", config: {} },
    { id: "ch-handphases", kind: "phases", title: "Hands: what I was using", started_on: "2026-02-01", days: null, regimen_ids: [], rules: [], notes: "", config: { measures: ["itch"], phases: [{ name: "Emollient only", from: "2026-02-01", to: "2026-03-31" }, { name: "Emollient + night gloves", from: "2026-04-01", to: "2026-05-31" }, { name: "Plus fragrance-free soap", from: "2026-06-01", to: T }] } },
    { id: "ch-soap", kind: "before_after", title: "Fragrance-free soap: before and after", started_on: addDays("2026-06-01", -90), days: null, regimen_ids: [], rules: [], notes: "", config: { event_date: "2026-06-01", label: "Fragrance-free soap", window: 90, measures: ["itch", "skin_clarity"], cycle: true, photo_region: "hands" } },
  ];
  const HK: D["hk"] = { sleep_hours: [], rhr: [] };
  for (let k = 0; k < 41; k++) {
    const d = addDays("2026-01-05", k * 7);
    if (d > T) break;
    HK.sleep_hours.push({ d, v: +(6.9 + 0.5 * Math.sin(k / 4) + (k > 20 ? 0.25 : 0)).toFixed(1) });
    HK.rhr.push({ d, v: Math.round(61 - k * 0.06 + 2 * Math.sin(k / 3)) });
  }
  const S: D["suggestions"] = [
    { id: uid(), source: "calendar", source_ref: null, title: "Annual physical, Dr. Patel", occurred_at: "2026-10-28", details: { kind: "doctor", provider: "Dr. Patel", plan_id: "p-physical" }, status: "pending", found: 'Calendar: "Physical – Dr Patel"' },
    { id: uid(), source: "calendar", source_ref: null, title: "Lumen Aesthetics, session 2", occurred_at: "2026-11-12", details: { kind: "med_spa", provider: "Lumen Aesthetics" }, status: "pending", found: 'Calendar: "Lumen laser #2"' },
  ];
  for (let d = 1; d <= 14; d++) {
    const day = addDays(T, -d), en = [3, 2, 3, 2, 2, 3, 4, 3, 2, 2, 3, 3, 2, 3][d - 1], rf = [2, 2, 3, 2, 1, 3, 3, 2, 2, 1, 3, 2, 2, 3][d - 1], bt = [1350, 1395, 1320, 1410, 1440, 1335, 1290, 1365, 1425, 1455, 1350, 1380, 1440, 1320][d - 1] % 1440;
    add({ type: "measurement", occurred_at: day, title: `Energy ${en}/5`, regions: ["whole_body"], concern_id: "c-tired", details: { metric: "energy", value: en } });
    add({ type: "measurement", occurred_at: day, title: `Refreshed on waking ${rf}/5`, regions: ["whole_body"], concern_id: "c-tired", details: { metric: "refreshed", value: rf } });
    add({ type: "measurement", occurred_at: day, title: `Ready for bed ${hhmm(bt)}`, regions: ["whole_body"], concern_id: "c-tired", details: { metric: "bedtime", value: bt } });
  }
  const hives = add({ type: "observation", occurred_at: addDays(T, -3), title: "Hives after lunch", regions: ["chest", "arms"], details: { severity: "3", time: "13:40", end_date: addDays(T, -3), end_time: "16:10" }, notes: "Itchy welts on chest and forearms. Faded by late afternoon." });
  const RL: D["regLogs"] = [];
  const rlog = (rid: string, d: string) => RL.push({ id: "rl-" + uid(), regimen_id: rid, on_date: d, time: null, source: "manual", note: "" });
  for (let wk = 0; wk < 8; wk++) { const base = addDays(T, -7 * wk); [1, 4].forEach((o, j) => { if (!(wk === 0 && j === 1) && !(wk === 3 && j === 0)) rlog("r-yoga", addDays(base, -o)); }); }
  for (let d = 1; d <= 56; d++) { if (d % 7 === 0 || d % 7 === 3 || d % 7 === 5) rlog("r-gloves", addDays(T, -d)); }
  const CARD = {
    blood: "O+", allergies: [{ what: "Penicillin", reaction: "Rash", severity: "moderate" }], vaccines: [{ name: "Tetanus (Tdap)", date: "2021-03-10", booster: "2031-03-10" }, { name: "Influenza", date: "2025-10-20", booster: "" }], conditions: [],
    providers: [{ name: "Dr. Patel", role: "Family doctor", practice: "Riverside Family Health", phone: "" }, { name: "Dr. Okafor", role: "Dentist", practice: "Harbour Dental", phone: "" }, { name: "Sam Chen", role: "Physiotherapist", practice: "Motion Physio", phone: "" }], contacts: [],
  };
  const CY: D["cycle"] = [];
  let cst = addDays(T, -9);
  const clens = [28, 30, 27, 29, 31, 28, 29, 30, 28];
  for (let k = 0; k < 9; k++) {
    (["medium", "heavy", "medium", "light", "light"] as const).forEach((f, j) => CY.push({ on_date: addDays(cst, j), source: "manual", flow: f, symptoms: j === 0 ? ["Cramps"] : j === 1 ? ["Cramps", "Fatigue"] : [], note: "", source_ref: null }));
    CY.push({ on_date: addDays(cst, -1), source: "manual", flow: "spotting", symptoms: ["Breast tenderness"], note: "", source_ref: null });
    cst = addDays(cst, -clens[k]);
  }
  add({ type: "observation", occurred_at: "2026-06-01", title: "Switched to fragrance-free soap", regions: ["hands"], concern_id: "c-eczema", notes: "Kitchen and bathroom both." });
  C.push({ id: "c-allergy", title: "Food reactions", regions: ["chest", "arms"], started_on: addDays(T, -17), resolved_on: null, status: "active", notes: "Adding one food group back a week on low FODMAP.", tracking: {} });
  hives.concern_id = "c-allergy";
  // illnesses: a group with a bout at a time
  const viral: Concern = { id: "c-viral", title: "Viral", regions: [], started_on: null, resolved_on: null, status: "active", kind: "illness", episodes: [], tracking: {}, color: "#7480F7" };
  setEpisodes(viral, [{ from: "2026-01-14", to: "2026-01-21", label: "Cold" }, { from: "2026-03-03", to: "2026-03-06", label: "Norovirus", notes: "Whole household had it." }, { from: "2026-06-22", to: "2026-07-01", label: "Flu" }, { from: addDays(T, -2), to: null, label: "Cold" }]);
  const migraine: Concern = { id: "c-migraine", title: "Migraine", regions: ["face"], started_on: null, resolved_on: null, status: "active", kind: "illness", episodes: [], tracking: {}, color: "#C2693F", notes: "Usually the day before my period." };
  setEpisodes(migraine, [0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const f = addDays(T, -12 - k * 29); return { from: f, to: addDays(f, k % 3 === 0 ? 1 : 0) }; }));
  C.push(viral, migraine);
  add({ type: "appointment", occurred_at: "2026-06-24", title: "GP, flu", regions: ["whole_body"], concern_id: "c-viral", details: { kind: "doctor", status: "done", provider: "Dr. Patel", practice: "Riverside Family Health", reason: "Fever and aches for two days", what_they_said: "Flu. Rest, fluids, paracetamol. Back if it is not lifting in a week." } });
  add({ type: "observation", occurred_at: addDays(T, -2), title: "Sore throat, runny nose", regions: ["neck"], concern_id: "c-viral", details: { severity: "2" } });
  add({ type: "food_trial", occurred_at: addDays(T, -3), title: "Reintroduced garlic", regions: ["whole_body"], details: { food: "Garlic", amount: "Garlic in a pasta sauce", time: "12:30" } });
  add({ type: "food_trial", occurred_at: addDays(T, -10), title: "Reintroduced onion", regions: ["whole_body"], details: { food: "Onion", amount: "Half an onion, cooked", time: "19:00" } });
  add({ type: "food_trial", occurred_at: addDays(T, -17), title: "Reintroduced lactose", regions: ["whole_body"], details: { food: "Lactose", amount: "A glass of milk", time: "08:15" } });
  add({ type: "observation", occurred_at: addDays(T, -17), title: "Itchy throat", regions: ["neck"], concern_id: "c-allergy", details: { severity: "2", time: "10:30", end_date: addDays(T, -17), end_time: "11:15" } });
  add({ type: "food_trial", occurred_at: addDays(T, -24), title: "Reintroduced wheat", regions: ["whole_body"], details: { food: "Wheat", amount: "Slice of toast", time: "09:00" } });
  const RM: D["reminders"] = [
    { id: "rm-hands", title: "Hand photo", target_kind: "challenge", target_id: "ch1", schedule: { repeat: "weekly", days: [7], time: "09:00" }, private: false, skip_if_done: true, enabled: true },
    { id: "rm-cycle", title: "Log your cycle", target_kind: "quick", target_id: "w-qcycle", schedule: { repeat: "daily", time: "21:00" }, private: true, skip_if_done: true, enabled: true },
    { id: "rm-tired", title: "Check in: Tiredness", target_kind: "concern", target_id: "c-tired", schedule: { repeat: "weekly", days: [1], time: "20:00" }, private: false, skip_if_done: true, enabled: true },
    { id: "rm-skin", title: "Book the skin check", target_kind: "custom", target_id: null, schedule: { repeat: "once", date: addDays(T, 14), time: "10:00" }, private: false, skip_if_done: false, enabled: true },
  ];
  return {
    reminders: RM, cycle: CY, regLogs: RL,
    settings: { card: CARD, cycle_on: true, teeth: { 36: { s: ["filled"], since: "2026-03-26", note: "Composite filling." }, 46: { s: ["root_canal", "crown"], since: "2023-05-10", note: "" }, 15: { s: ["watch"], since: "2026-03-12", note: "Small shadow on the X-ray. Recheck at next cleaning." }, 18: { s: ["extracted"], since: "2014-07-02", note: "" }, 28: { s: ["extracted"], since: "2014-07-02", note: "" }, 48: { s: ["extracted"], since: "2014-07-02", note: "" }, 38: { s: ["missing"], since: "", note: "Never came in." } } },
    plans: PL, courses: K, entries: E, concerns: C, regimens: R.map((r) => ({ ...r, color: RC[r.id] })), labs: L, challenges: CH, metrics, hk: HK, suggestions: S,
    widgets: { left: [{ id: "w-qcycle", type: "quick", src: "cycle" }, { id: uid(), type: "teeth" }, { id: uid(), type: "challenge" }, { id: uid(), type: "regimens" }, { id: uid(), type: "savedchart", chartId: "ch-b12" }], right: [{ id: uid(), type: "plan" }, { id: uid(), type: "appointments" }, { id: uid(), type: "concerns" }] },
    chartLayout: "top", chartZones: [["ch-hands"], ["ch-b12", "ch-knee", "ch-sick"], ["ch-mycycle", "ch-weight", "ch-cycle"]],
    charts: [
      { id: "ch-sick", title: "Sick days", y1: "sick:all", y1Type: "column", y2: null, bands: [], photos: [], range: "12m" },
      { id: "ch-hands", title: "Hand itch and what I was using", y1: "m:itch", y1Type: "column", y1Color: "#4F5BF5", y2: null, y2Type: "line", y2Color: "#C2693F", bands: ["r-emollient", "r-gloves"], photos: ["hands"], range: "all" },
      { id: "ch-b12", title: "Vitamin B12", y1: "lab:Vitamin B12", y1Type: "area", y1Color: "#4F5BF5", y2: null, y2Type: "line", y2Color: "#C2693F", bands: ["r-b12"], photos: [], range: "all" },
      { id: "ch-knee", title: "Knee: physio and pain", y1: "m:knee_pain", y1Type: "line", y1Color: "#C2693F", y2: null, y2Type: "line", y2Color: "#4F5BF5", bands: ["k:k-physio"], sessions: ["k-physio"], photos: [], range: "all" },
      { id: "ch-mycycle", kind: "cycle", title: "My cycle", months: 3, y1: null, y2: null, bands: [], photos: [], range: "12m" },
      { id: "ch-cycle", title: "Cycle and skin", y1: "m:skin_clarity", y1Type: "column", y1Color: "#8556B5", y2: null, y2Type: "line", y2Color: "#C2693F", bands: ["cycle"], markers: ["procedure"], photos: [], range: "12m" },
      { id: "ch-weight", title: "Weight and sleep", y1: "m:weight", y1Type: "line", y1Color: "#4F5BF5", y2: "hk:sleep_hours", y2Type: "line", y2Color: "#D8916B", bands: ["r-d1", "r-d2", "r-d3"], photos: [], range: "12m" },
    ],
    points: [], customRegions: {}, basePhoto: null, basePhotoPath: null, basePhotoEnc: false,
  };
}
