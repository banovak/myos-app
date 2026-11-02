// Experiment forms: challenge (length + check-ins), phases, before and after.
import { useState } from "react";
import { Text, View } from "react-native";
import { addDays, today, uid } from "../model/dates";
import { cycleOn } from "../model/cycle";
import { regimenActive } from "../model/regimens";
import { metric } from "../model/series";
import type { Challenge, Per, Rule } from "../model/types";
import { PER_LABEL, REG, rl } from "../model/vocab";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, Check, DateField, Err, Field, Half, Input, NumInput, Select, SheetH, Two, TypeIco, useT } from "../ui";
import { Chip, Chips } from "../ui";
import { MetricChips } from "./common";

export function openChallenge(h: Health, pre: Partial<Challenge> = {}): void { h.openSheet(<ChallengeForm pre={pre} />); }
export function openPhases(h: Health, pre: Partial<Challenge> = {}): void { h.openSheet(<PhasesForm pre={pre} />); }
export function openBeforeAfter(h: Health, pre: Partial<Challenge> = {}): void { h.openSheet(<BeforeAfterForm pre={pre} />); }

function upsert(h: Health, o: Challenge) {
  h.mutate((D) => { const i = D.challenges.findIndex((x) => x.id === o.id); if (i >= 0) D.challenges[i] = o; else D.challenges.push(o); });
  h.closeSheet();
}
const phRegs = (D: Health["D"]) => [...new Set(D.entries.filter((e) => e.photos.length && e.details.series !== "body").flatMap((e) => e.regions))];

function ChallengeForm(props: { pre: Partial<Challenge> }) {
  const h = useHealth();
  const { D } = h;
  const pre = props.pre, T = today();
  const rs = D.regimens.filter((r) => r.category !== "diet" && (regimenActive(r) || (pre.regimen_ids || []).includes(r.id)));
  const rv = (r?: Rule) => (!r ? "" : r.kind === "photo" ? "p:" + r.region : r.kind === "regimen" ? "g:" + r.regimen : "m:" + r.metric);
  const [title, setTitle] = useState(pre.title || "");
  const [start, setStart] = useState(pre.started_on || T);
  const [days, setDays] = useState(String(pre.days || 90));
  const [sel, setSel] = useState<Set<string>>(new Set(pre.regimen_ids || []));
  const [rows, setRows] = useState<{ w: string; per: Per }[]>(() => { const r = (pre.rules || []).map((x) => ({ w: rv(x), per: x.per })); while (r.length < 2) r.push({ w: "", per: "week" }); return r; });
  const [notes, setNotes] = useState(pre.notes || "");
  const [err, setErr] = useState("");
  const groups: Record<string, [string, string][]> = { "": [["", "None"]], "Photo of": Object.entries(REG(D)).map(([k, l]) => ["p:" + k, l + " photo"]), Measurement: Object.entries(D.metrics).map(([k, m]) => ["m:" + k, m.l]), "Logged from Lifestyle": rs.map((r) => ["g:" + r.id, r.name]) };
  function save() {
    if (!title.trim()) return setErr("Name the challenge.");
    if (!(+days > 0)) return setErr("Set a length in days.");
    const rules: Rule[] = rows.filter((r) => r.w).map((r) => { const [k, v] = [r.w.slice(0, 1), r.w.slice(2)]; return k === "p" ? { label: `${rl(D, v)} photo`, kind: "photo", region: v, per: r.per } : k === "g" ? { label: (D.regimens.find((x) => x.id === v) || { name: "Regimen" }).name, kind: "regimen", regimen: v, per: r.per } : { label: metric(D, v).l, kind: "metric", metric: v, per: r.per }; });
    upsert(h, { ...(pre as Challenge), id: pre.id || "ch-" + uid(), kind: "challenge", title: title.trim(), started_on: start || T, days: +days, regimen_ids: [...sel], rules, notes: notes.trim(), config: pre.config || {} });
  }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={pre.id ? "Edit challenge" : "Start a challenge"} icon={<TypeIco k="challenge" small />} onClose={h.closeSheet} />
      <Field label="Name"><Input value={title} onChange={setTitle} placeholder="90 days of magnesium" /></Field>
      <Two><Half><Field label="Starts"><DateField value={start} onChange={setStart} /></Field></Half><Half><Field label="Length in days"><NumInput value={days} onChange={setDays} integer /></Field></Half></Two>
      {rs.length ? <Field label="Regimens that are part of it"><Chips>{rs.map((r) => <Chip key={r.id} label={r.name} on={sel.has(r.id)} onPress={() => setSel((p) => { const n = new Set(p); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} />)}</Chips></Field> : null}
      {rows.map((r, i) => (
        <Two key={i}>
          <Half><Field label={`Check-in ${i + 1}`}><Select value={r.w} options={[]} groups={groups} onChange={(v) => setRows((p) => p.map((x, j) => (j === i ? { ...x, w: v } : x)))} /></Field></Half>
          <Half><Field label="How often"><Select value={r.per} options={(["day", "week", "month"] as Per[]).map((p) => [p, PER_LABEL[p]])} onChange={(v) => setRows((p) => p.map((x, j) => (j === i ? { ...x, per: v as Per } : x)))} /></Field></Half>
        </Two>
      ))}
      <Btn small label="+ Check-in" onPress={() => setRows((p) => [...p, { w: "", per: "week" }])} />
      <Field label="Notes (optional)"><Input value={notes} onChange={setNotes} multiline placeholder="Why you're doing it, what you're watching for" /></Field>
      <Acts right={<Btn kind="accent" label={pre.id ? "Save" : "Start"} onPress={save} />} />
      <Err>{err}</Err>
    </View>
  );
}

function PhasesForm(props: { pre: Partial<Challenge> }) {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const pre = props.pre, cf = pre.config || {}, T = today();
  const [title, setTitle] = useState(pre.title || "");
  const [phases, setPhases] = useState<{ name: string; from: string; to: string }[]>((cf.phases || []).length ? cf.phases!.map((p) => ({ ...p })) : [{ name: "", from: T, to: addDays(T, 55) }, { name: "", from: addDays(T, 56), to: addDays(T, 111) }]);
  const [sel, setSel] = useState<Set<string>>(new Set(cf.measures || []));
  const [photo, setPhoto] = useState(cf.photo_region || "");
  const [notes, setNotes] = useState(pre.notes || "");
  const [err, setErr] = useState("");
  const upd = (i: number, p: Partial<{ name: string; from: string; to: string }>) => setPhases((ps) => ps.map((x, j) => (j === i ? { ...x, ...p } : x)));
  function save() {
    if (!title.trim()) return setErr("Name it.");
    const ok = phases.filter((p) => p.name.trim() && p.from && p.to).map((p) => ({ ...p, name: p.name.trim() }));
    if (!ok.length) return setErr("Add at least one phase with a name and dates.");
    if (ok.some((p) => p.to < p.from)) return setErr("A phase ends before it starts.");
    ok.sort((a, b) => (a.from < b.from ? -1 : 1));
    upsert(h, { ...(pre as Challenge), id: pre.id || "ch-" + uid(), kind: "phases", title: title.trim(), started_on: ok[0].from, days: null, regimen_ids: pre.regimen_ids || [], rules: [], notes: notes.trim(), config: { phases: ok, measures: [...sel], photo_region: photo || "" } });
  }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={pre.id ? "Edit phases" : "Phases"} icon={<TypeIco k="challenge" small />} onClose={h.closeSheet} />
      <Field label="Name"><Input value={title} onChange={setTitle} placeholder="Posture: what helps" /></Field>
      <Field label="Phases">
        <View style={{ gap: 10 }}>{phases.map((p, i) => (
          <View key={i} style={{ gap: 6, backgroundColor: t.soft, borderRadius: 12, padding: 10 }}>
            <View style={{ flexDirection: "row", gap: 6 }}><View style={{ flex: 1 }}><Input value={p.name} onChange={(v) => upd(i, { name: v })} placeholder="Phase name" /></View><Btn small label="✕" onPress={() => setPhases((ps) => ps.filter((_, j) => j !== i))} /></View>
            <View style={{ flexDirection: "row", gap: 6 }}><View style={{ flex: 1 }}><DateField value={p.from} onChange={(v) => upd(i, { from: v })} /></View><View style={{ flex: 1 }}><DateField value={p.to} onChange={(v) => upd(i, { to: v })} /></View></View>
          </View>
        ))}</View>
        <Btn small label="+ Phase" onPress={() => setPhases((ps) => [...ps, { name: "", from: "", to: "" }])} />
      </Field>
      <Field label="Measures to compare"><MetricChips value={sel} onChange={setSel} /></Field>
      <Field label="Photos (optional)"><Select value={photo} options={[["", "None"], ...phRegs(D).map((r) => [r, rl(D, r)] as [string, string])]} onChange={setPhoto} /></Field>
      <Field label="Notes (optional)"><Input value={notes} onChange={setNotes} multiline /></Field>
      <Acts right={<Btn kind="accent" label={pre.id ? "Save" : "Create"} onPress={save} />} />
      <Err>{err}</Err>
    </View>
  );
}

function BeforeAfterForm(props: { pre: Partial<Challenge> }) {
  const h = useHealth();
  const { D } = h;
  const pre = props.pre, cf = pre.config || {}, T = today();
  const [label, setLabel] = useState(cf.label || "");
  const [ev, setEv] = useState(cf.event_date || T);
  const [w, setW] = useState(String(cf.window || 90));
  const [photo, setPhoto] = useState(cf.photo_region || "");
  const [sel, setSel] = useState<Set<string>>(new Set(cf.measures || []));
  const [cyc, setCyc] = useState(cf.cycle !== false);
  const [notes, setNotes] = useState(pre.notes || "");
  const [err, setErr] = useState("");
  function save() {
    const l = label.trim();
    if (!l) return setErr("Name the change.");
    const win = +w;
    upsert(h, { ...(pre.id ? (pre as Challenge) : ({} as Challenge)), id: pre.id || "ch-" + uid(), kind: "before_after", title: `${l}: before and after`, started_on: addDays(ev, -win), days: null, regimen_ids: pre.regimen_ids || [], rules: [], notes: notes.trim(), config: { event_date: ev, label: l, window: win, measures: [...sel], cycle: cycleOn(D) ? cyc : false, photo_region: photo || "" } });
  }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={pre.id ? "Edit before and after" : "Before and after"} icon={<TypeIco k="challenge" small />} onClose={h.closeSheet} />
      <Two>
        <Half><Field label="The change"><Input value={label} onChange={setLabel} placeholder="Started a new medication" /></Field></Half>
        <Half><Field label="On"><DateField value={ev} onChange={setEv} /></Field></Half>
        <Half><Field label="Compare"><Select value={w} options={[30, 60, 90, 180].map((n) => [String(n), `${n} days either side`])} onChange={setW} /></Field></Half>
        <Half><Field label="Photos (optional)"><Select value={photo} options={[["", "None"], ...phRegs(D).map((r) => [r, rl(D, r)] as [string, string])]} onChange={setPhoto} /></Field></Half>
      </Two>
      <Field label="Measures to compare"><MetricChips value={sel} onChange={setSel} /></Field>
      {cycleOn(D) ? <Check value={cyc} onChange={setCyc} label="Include cycle and period length" /> : null}
      <Field label="Notes (optional)"><Input value={notes} onChange={setNotes} multiline /></Field>
      <Text style={{ fontSize: 13, color: h.t.muted, fontFamily: h.t.fontUI }}>If the change is still ahead, this starts a baseline: keep logging these and the comparison fills in after.</Text>
      <Acts right={<Btn kind="accent" label={pre.id ? "Save" : "Create"} onPress={save} />} />
      <Err>{err}</Err>
    </View>
  );
}
