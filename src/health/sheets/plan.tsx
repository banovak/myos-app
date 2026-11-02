// Plan items, courses of care, a course's sessions, and plan categories.
import { useState } from "react";
import { Text, View } from "react-native";
import { fmt, fmtShort, money, today, uid } from "../model/dates";
import { courseStats, planCats } from "../model/plans";
import { fmtV, readingFor, unitLabel } from "../model/series";
import type { Course, Plan, PlanCat } from "../model/types";
import { DEF_PLAN_CATS, allKinds } from "../model/vocab";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, DateField, Err, Field, Half, Input, NumInput, P, Select, SheetH, Stat, Stats, Two, TypeIco, useT } from "../ui";
import { openEntry } from "./entryView";
import { openForm } from "./entryForm";
import { ConcernSelect, Hint, resolveConcern } from "./common";

export function openPlan(h: Health, pre: Partial<Plan> = {}): void { h.openSheet(<PlanForm pre={pre} />); }
export function openCourseForm(h: Health, pre: Partial<Course> = {}): void { h.openSheet(<CourseForm pre={pre} />); }
export function openCourseSessions(h: Health, id: string): void { h.openSheet(<CourseSessions id={id} />); }
export function openPlanCats(h: Health): void { h.openSheet(<PlanCats />); }

function PlanForm(props: { pre: Partial<Plan> }) {
  const h = useHealth();
  const pre = props.pre, cats = planCats(h.D);
  const [title, setTitle] = useState(pre.title || "");
  const [kind, setKind] = useState(pre.kind || "doctor");
  const [year, setYear] = useState(String(pre.year || h.V.planYear));
  const [n, setN] = useState(String(pre.per_year || 1));
  const [cat, setCat] = useState(pre.category ?? cats[0]?.id ?? "");
  const [notes, setNotes] = useState(pre.notes || "");
  const [err, setErr] = useState("");
  const [armed, setArmed] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={pre.id ? "Edit plan item" : "Plan item"} icon={<TypeIco k="appointment" small />} onClose={h.closeSheet} />
      <Field label="What"><Input value={title} onChange={setTitle} placeholder="Annual physical, DEXA scan, my fitness test" /></Field>
      <Two>
        <Half><Field label="Kind"><Select value={kind} options={allKinds(h.D)} onChange={setKind} /></Field></Half>
        <Half><Field label="Year"><NumInput value={year} onChange={setYear} integer /></Field></Half>
        <Half><Field label="Times a year"><NumInput value={n} onChange={setN} integer /></Field></Half>
        <Half><Field label="Category"><Select value={cat} options={[...cats.map((c) => [c.id, c.name] as [string, string]), ["", "Other"]]} onChange={setCat} /></Field></Half>
      </Two>
      <Field label="Notes"><Input value={notes} onChange={setNotes} multiline placeholder="What it involves" /></Field>
      <Acts left={pre.id ? <Btn label={armed ? "Tap again to delete" : "Delete"} onPress={() => { if (!armed) return setArmed(true); h.mutate((D) => { D.plans = D.plans.filter((p) => p.id !== pre.id); }); h.closeSheet(); }} /> : undefined}
        right={<Btn kind="accent" label="Save" onPress={() => { const tt = title.trim(); if (!tt) return setErr("Name the plan item."); const p: Plan = { id: pre.id || "p-" + uid(), title: tt, kind, per_year: Math.max(1, +n || 1), year: +year || h.V.planYear, notes, category: cat }; h.mutate((D) => { const i = D.plans.findIndex((x) => x.id === p.id); if (i >= 0) D.plans[i] = p; else D.plans.push(p); }); h.closeSheet(); }} />} />
      <Err>{err}</Err>
    </View>
  );
}

function CourseForm(props: { pre: Partial<Course> }) {
  const h = useHealth();
  const { D } = h;
  const pre = props.pre, T = today();
  const [title, setTitle] = useState(pre.title || "");
  const [kind, setKind] = useState(pre.kind || "physio");
  const [cad, setCad] = useState(pre.cadence || "");
  const [prov, setProv] = useState(pre.provider || "");
  const [prac, setPrac] = useState(pre.practice || "");
  const [from, setFrom] = useState(pre.started_on || T);
  const [to, setTo] = useState(pre.ended_on || "");
  const [cost, setCost] = useState(pre.cost != null ? String(pre.cost) : "");
  const [concern, setConcern] = useState(pre.concern_id || "");
  const [newConcern, setNewConcern] = useState("");
  const [met, setMet] = useState(pre.metric || "");
  const [newMet, setNewMet] = useState("");
  const [notes, setNotes] = useState(pre.notes || "");
  const [err, setErr] = useState("");
  const [armed, setArmed] = useState(false);
  function save() {
    const tt = title.trim();
    if (!tt) return setErr("Name the course.");
    if (to && to < from) return setErr("The end date is before the start date.");
    let failed = "";
    h.mutate((D) => {
      let m = met;
      if (m === "__new") { const nn = newMet.trim(); if (!nn) { failed = "Name the rating."; return; } m = "x_" + uid(); D.metrics[m] = { l: nn, u: "/5", kind: "rating", rating: true }; }
      const c = resolveConcern(D, concern, newConcern, new Set(), from);
      if (c.err) { failed = c.err; return; }
      const k: Course = { id: pre.id || "k-" + uid(), title: tt, kind, provider: prov.trim(), practice: prac.trim(), cadence: cad.trim(), started_on: from, ended_on: to || null, concern_id: c.id, metric: m || null, cost: cost ? +cost : null, notes, color: pre.color };
      const i = D.courses.findIndex((x) => x.id === k.id);
      if (i >= 0) D.courses[i] = k; else D.courses.push(k);
    });
    if (failed) return setErr(failed);
    h.closeSheet();
  }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={pre.id ? "Edit course of care" : "Course of care"} icon={<TypeIco k="appointment" small />} onClose={h.closeSheet} />
      <Field label="Name"><Input value={title} onChange={setTitle} placeholder="Physio, right knee" /></Field>
      <Two>
        <Half><Field label="Kind"><Select value={kind} options={allKinds(D)} onChange={setKind} /></Field></Half>
        <Half><Field label="How often"><Input value={cad} onChange={setCad} placeholder="Every 3 weeks" /></Field></Half>
        <Half><Field label="Provider"><Input value={prov} onChange={setProv} /></Field></Half>
        <Half><Field label="Practice"><Input value={prac} onChange={setPrac} /></Field></Half>
        <Half><Field label="Started"><DateField value={from} onChange={setFrom} /></Field></Half>
        <Half><Field label="Ended (blank if ongoing)"><DateField value={to} onChange={setTo} clearable placeholder="Ongoing" /></Field></Half>
        <Half><Field label="Cost per session"><NumInput value={cost} onChange={setCost} placeholder="95" /></Field></Half>
      </Two>
      <ConcernSelect value={concern} onChange={setConcern} newName={newConcern} onNewName={setNewConcern} />
      <Field label="Your reading at each session (optional)" hint="Something you can judge yourself each visit, like pain 1–5 or pain-free running distance. It's what lets you see over time whether anything changed.">
        <Select value={met} options={[["", "None"], ...Object.entries(D.metrics).map(([k, m]) => [k, `${m.l} (${m.rating ? unitLabel(m.u) : m.u})`] as [string, string]), ["__new", "New rating…"]]} onChange={setMet} />
      </Field>
      {met === "__new" ? <Field label="Name the rating"><Input value={newMet} onChange={setNewMet} placeholder="Knee pain" /></Field> : null}
      <Field label="Notes"><Input value={notes} onChange={setNotes} multiline placeholder="What you hope to get out of it" /></Field>
      <Acts left={pre.id ? <Btn label={armed ? "Tap again to delete" : "Delete"} onPress={() => { if (!armed) return setArmed(true); h.mutate((D) => { D.courses = D.courses.filter((k) => k.id !== pre.id); }); h.closeSheet(); }} /> : undefined} right={<Btn kind="accent" label="Save" onPress={save} />} />
      <Err>{err}</Err>
    </View>
  );
}

function CourseSessions(props: { id: string }) {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const k = D.courses.find((x) => x.id === props.id);
  if (!k) return null;
  const s = courseStats(D, k), m = k.metric ? D.metrics[k.metric] : null;
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={k.title} icon={<TypeIco k="appointment" small />} onClose={h.closeSheet} />
      <Stats><View style={{ flexDirection: "row", width: "100%", gap: 10 }}><Stat value={String(s.done.length)} label="sessions" /><Stat value={money(s.spent)} label="spent" /><Stat value={k.cadence || "–"} label={`since ${fmtShort(k.started_on)}`} /></View></Stats>
      <View style={{ gap: 8 }}>{s.done.length ? s.done.slice().reverse().map((e) => { const r = readingFor(D, e.id); return (
        <View key={e.id} onTouchEnd={() => openEntry(h, e.id)} style={{ backgroundColor: t.soft, borderRadius: 14, padding: 10, paddingHorizontal: 12, gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}><Text style={{ fontFamily: t.fontUIBold, color: t.ink, fontSize: 13 }}>{fmt(e.occurred_at)}</Text><Text style={{ color: t.muted, fontFamily: t.fontData, fontSize: 12 }}>{r && m ? `${m.l} ${fmtV(r.details.value, m.u)}` : ""}{e.details.cost ? ` · ${money(e.details.cost)}` : ""}</Text></View>
          {e.details.what_was_done ? <Text style={{ fontSize: 12.5, color: t.muted, fontFamily: t.fontUI }}>{e.details.what_was_done}</Text> : null}
          {e.details.what_they_said ? <Text style={{ fontSize: 12.5, color: t.muted, fontFamily: t.fontUI }}>They said: {e.details.what_they_said}</Text> : null}
        </View>
      ); }) : <P>No sessions logged yet.</P>}</View>
      <Acts right={<Btn kind="accent" label="+ Log session" onPress={() => { const c = D.concerns.find((x) => x.id === k.concern_id); openForm(h, "appointment", { title: k.title, regions: c ? c.regions : [], concern_id: k.concern_id, details: { kind: k.kind, status: "done", provider: k.provider, practice: k.practice, course_id: k.id, cost: k.cost } }); }} />} />
    </View>
  );
}

function PlanCats() {
  const h = useHealth();
  const [rows, setRows] = useState<PlanCat[]>(planCats(h.D).map((c) => ({ ...c })));
  const upd = (i: number, name: string) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, name } : x)));
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="Plan categories" onClose={h.closeSheet} />
      <P>Group your yearly plan however suits you. Removing a category moves its items to Other; nothing is deleted.</P>
      <View style={{ gap: 8 }}>{rows.map((c, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 6 }}>
          <View style={{ flex: 1 }}><Input value={c.name} onChange={(v) => upd(i, v)} placeholder="Category name" /></View>
          <Btn small label="↑" onPress={() => setRows((rs) => { if (!i) return rs; const n = rs.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} />
          <Btn small label="✕" onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))} />
        </View>
      ))}</View>
      <Btn small label="+ Category" onPress={() => setRows((rs) => [...rs, { id: "", name: "" }])} />
      <Acts left={<Btn label="Back to the default four" onPress={() => setRows(DEF_PLAN_CATS.map((c) => ({ ...c })))} />} right={<Btn kind="accent" label="Save" onPress={() => {
        const used = new Set<string>();
        const out = rows.map((r) => { const name = r.name.trim(); if (!name) return null; let id = r.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "c"; while (used.has(id)) id += "-" + uid().slice(0, 3); used.add(id); return { id, name }; }).filter(Boolean) as PlanCat[];
        h.mutate((D) => { D.settings.planCats = out; }); h.closeSheet();
      }} />} />
      <Hint>Tip: tap ↑ to move a category up.</Hint>
    </View>
  );
}
