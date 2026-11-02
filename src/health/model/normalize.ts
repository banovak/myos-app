// Empty state and the normalizer that fills gaps in whatever the store loads.
import { uid } from "./dates";
import type { D, Regimen, Stint } from "./types";
import { DEFAULT_POINTS_RAW, DEFAULT_SUB_RAW } from "./vocab";

export function emptyData(): D {
  return {
    reminders: [], cycle: [], regLogs: [], settings: {}, entries: [], concerns: [], regimens: [], labs: [], challenges: [], plans: [], courses: [], hk: {}, suggestions: [], charts: [], chartZones: null,
    chartLayout: "top", basePhoto: null, basePhotoPath: null, basePhotoEnc: false, customRegions: {},
    points: [],
    metrics: { weight: { l: "Weight", u: "kg" }, body_fat: { l: "Body fat", u: "%" }, height: { l: "Height", u: "cm" } },
    widgets: { left: [{ id: uid(), type: "challenge" }, { id: uid(), type: "regimens" }], right: [{ id: uid(), type: "plan" }, { id: uid(), type: "appointments" }, { id: uid(), type: "concerns" }] },
  };
}

// Points come in two levels: regions on the body, and points on a region's
// canvas (`parent`). Older data had one level with the face's points marked
// `zone: "head"`: those become the face's points; arms, legs and feet become a
// left and a right; hands, mouth and the rest of the head move off the body
// (they are points now). Done once, then marked in the settings.
/** Regimens that were copied to start again (same name and kind, dates apart) become one regimen with stints;
 * once per profile. Logs, challenge links, reminders and chart bands follow to the kept one */
function mergeStints(d: any): void {
  if (d.settings.regimens_v === 2) return;
  d.settings.regimens_v = 2;
  const regs: Regimen[] = d.regimens, key = (r: Regimen) => `${r.category}|${(r.name || "").trim().toLowerCase()}`;
  const groups = new Map<string, Regimen[]>();
  regs.forEach((r) => { const k = key(r); groups.set(k, [...(groups.get(k) || []), r]); });
  const gone = new Map<string, string>(); // merged id → kept id
  groups.forEach((g) => {
    if (g.length < 2) return;
    g.sort((a, b) => (a.started_on < b.started_on ? -1 : 1));
    const keep = g[0];
    let stints: Stint[] = keep.periods && keep.periods.length ? keep.periods.slice() : [{ from: keep.started_on, to: keep.ended_on }];
    for (const r of g.slice(1)) {
      const last = stints[stints.length - 1];
      if (!last.to || last.to >= r.started_on) continue; // they overlap: two different things after all
      stints = [...stints, ...(r.periods && r.periods.length ? r.periods : [{ from: r.started_on, to: r.ended_on }])];
      if ((r.dose || "") !== (keep.dose || "") || (r.frequency || "") !== (keep.frequency || "")) {
        keep.changes = [...(keep.changes || []), { on: r.started_on, dose: r.dose || "", frequency: r.frequency || "", prev_dose: keep.dose || "", prev_frequency: keep.frequency || "" }].sort((a, b) => (a.on < b.on ? -1 : 1));
        keep.dose = r.dose; keep.frequency = r.frequency;
      }
      keep.changes = [...(keep.changes || []), ...(r.changes || [])].sort((a, b) => (a.on < b.on ? -1 : 1));
      if (r.notes && r.notes !== keep.notes) keep.notes = [keep.notes, r.notes].filter(Boolean).join("\n");
      if (r.photos && r.photos.length) { const have = new Set((keep.photos || []).map((p) => p.path || p.src)); keep.photos = [...(keep.photos || []), ...r.photos.filter((p) => !have.has(p.path || p.src))]; }
      keep.regions = [...new Set([...(keep.regions || []), ...(r.regions || [])])];
      if (!keep.concern_id) keep.concern_id = r.concern_id;
      if (!keep.target && r.target) keep.target = r.target;
      gone.set(r.id, keep.id);
    }
    const s = stints.map((p) => ({ from: p.from, to: p.to || null })).sort((a, b) => (a.from < b.from ? -1 : 1));
    keep.started_on = s[0].from; keep.ended_on = s[s.length - 1].to;
    if (s.length > 1) keep.periods = s; else delete keep.periods;
  });
  if (!gone.size) return;
  const to = (id: string) => gone.get(id) || id;
  d.regimens = regs.filter((r) => !gone.has(r.id));
  (d.regLogs || []).forEach((l: any) => { l.regimen_id = to(l.regimen_id); });
  (d.challenges || []).forEach((c: any) => { c.regimen_ids = [...new Set((c.regimen_ids || []).map(to))]; (c.rules || []).forEach((r: any) => { if (r.regimen) r.regimen = to(r.regimen); }); });
  (d.reminders || []).forEach((m: any) => { if (m.target_kind === "regimen" && m.target_id) m.target_id = to(m.target_id); });
  (d.charts || []).forEach((c: any) => {
    c.bands = [...new Set((c.bands || []).map(to))];
    (["y1", "y2"] as const).forEach((k) => { if (typeof c[k] === "string" && c[k].startsWith("r:")) c[k] = "r:" + to(c[k].slice(2)); });
  });
}

function migratePoints(d: any): void {
  const defaults = () => [
    ...DEFAULT_POINTS_RAW.map(([region, x, y, side]) => ({ id: uid(), region, x, y, ...(side === "back" ? { side } : {}) })),
    ...DEFAULT_SUB_RAW.map(([parent, region, x, y]) => ({ id: uid(), region, x, y, parent })),
  ];
  if (!d.points.length) { d.points = defaults(); d.settings.points_v = 2; return; }
  if (d.settings.points_v !== 2) {
    const out: any[] = [];
    for (const p0 of d.points) {
      const p = { ...p0 };
      if (p.zone === "head") { delete p.zone; if (["face", "scalp", "neck"].includes(p.region)) continue; p.parent = "face"; out.push(p); continue; }
      delete p.zone;
      if (p.parent) { out.push(p); continue; }
      const lr = (l: string, r: string) => (+p.x < 50 ? r : l); // the figure faces you
      if (p.region === "arms") p.region = lr("arm_l", "arm_r");
      else if (p.region === "legs") p.region = lr("leg_l", "leg_r");
      else if (p.region === "feet") p.region = lr("foot_l", "foot_r");
      else if (["hands", "mouth", "eyes", "nose", "ears", "teeth"].includes(p.region)) continue;
      out.push(p);
    }
    DEFAULT_POINTS_RAW.forEach(([region, x, y, side]) => { if (!out.some((p) => !p.parent && p.region === region)) out.push({ id: uid(), region, x, y, ...(side === "back" ? { side } : {}) }); });
    new Set(DEFAULT_SUB_RAW.map((s) => s[0])).forEach((par) => { if (!out.some((p) => p.parent === par)) DEFAULT_SUB_RAW.filter((s) => s[0] === par).forEach(([parent, region, x, y]) => out.push({ id: uid(), region, x, y, parent })); });
    d.points = out; d.settings.points_v = 2;
  }
  // older software may still add head-drawing points; they are the face's points already
  d.points = d.points.filter((p: any) => p.zone !== "head");
  d.points.forEach((p: any) => { delete p.zone; });
}

export function normalize(input: Partial<D> | null | undefined): D {
  const base = emptyData();
  const d: any = input ? { ...input } : {};
  (["entries", "concerns", "regimens", "labs", "challenges", "plans", "courses", "suggestions", "charts"] as const).forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
  if (!d.metrics || !Object.keys(d.metrics).length) d.metrics = base.metrics;
  if (!d.hk) d.hk = {};
  if (!Array.isArray(d.points)) d.points = [];
  if (!d.settings) d.settings = {};
  migratePoints(d);
  mergeStints(d);
  if (!d.customRegions) d.customRegions = {};
  if (!d.widgets || !d.widgets.left) d.widgets = base.widgets;
  if (!Array.isArray(d.widgets.right)) d.widgets.right = [];
  if (!d.chartLayout) d.chartLayout = "top";
  if (!d.settings) d.settings = {};
  if (!Array.isArray(d.regLogs)) d.regLogs = [];
  if (!Array.isArray(d.cycle)) d.cycle = [];
  if (!Array.isArray(d.reminders)) d.reminders = [];
  d.challenges.forEach((c: any) => { if (!c.kind) c.kind = "challenge"; if (!c.config) c.config = {}; if (!Array.isArray(c.rules)) c.rules = []; if (!Array.isArray(c.regimen_ids)) c.regimen_ids = []; });
  d.concerns.forEach((c: any) => {
    if (!c.tracking) c.tracking = {}; if (!Array.isArray(c.regions)) c.regions = [];
    if (c.kind === "illness") {
      // an illness keeps its episodes; a side that did not know them may have moved the dates, so the first and last episode follow the row's dates
      if (!Array.isArray(c.episodes) || !c.episodes.length) c.episodes = c.started_on ? [{ from: c.started_on, to: c.resolved_on || null }] : [];
      c.episodes = c.episodes.filter((e: any) => e && e.from).map((e: any) => ({ from: e.from, to: e.to || null, ...(e.label ? { label: e.label } : {}), ...(e.notes ? { notes: e.notes } : {}) })).sort((a: any, b: any) => (a.from < b.from ? -1 : 1));
      if (c.episodes.length) {
        const first = c.episodes[0], last = c.episodes[c.episodes.length - 1];
        if (c.started_on && c.started_on !== first.from && c.started_on < (first.to || "9999")) first.from = c.started_on;
        if ((c.resolved_on || null) !== (last.to || null) && (!c.resolved_on || c.resolved_on >= last.from)) last.to = c.resolved_on || null;
        c.started_on = first.from; c.resolved_on = c.episodes.some((e: any) => !e.to) ? null : c.episodes.reduce((m: string, e: any) => (e.to > m ? e.to : m), last.to);
        c.status = c.resolved_on ? "resolved" : "active";
      }
    } else if (c.kind) delete c.kind;
  });
  d.charts.forEach((c: any) => {
    if (c.kind === "days") {
      // the old bars chart: a count per month is a series on the left axis now, drawn as columns
      const pre = c.count === "sessions" ? "done:" : "sick:", g: string[] = (c.groups || []).map((id: string) => pre + id);
      const ids = g.length ? g : ["sick:all"];
      c.y1 = ids[0]; if (ids.length > 1) c.y1More = ids.slice(1); c.y1Type = "column";
      c.range = (c.months || 12) >= 24 ? "all" : (c.months || 12) <= 6 ? "6m" : "12m";
      delete c.kind; delete c.count; delete c.groups; delete c.months;
    }
    c.y1Type = c.y1Type || "line"; c.y2Type = c.y2Type || "line"; c.bands = c.bands || []; c.photos = c.photos || []; c.sessions = c.sessions || [];
  });
  d.entries.forEach((e: any) => { e.photos = e.photos || []; e.files = e.files || []; e.details = e.details || {}; e.regions = e.regions || []; });
  d.labs.forEach((l: any) => { if (!Array.isArray(l.results)) l.results = []; if (!l.kind) l.kind = "lab"; });
  if (d.basePhoto === undefined) d.basePhoto = null;
  if (d.basePhotoPath === undefined) d.basePhotoPath = null;
  d.basePhotoEnc = !!d.basePhotoEnc;
  return d as D;
}
