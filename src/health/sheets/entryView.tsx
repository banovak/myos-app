// One entry in full, a lab report in full, and "what came before" an
// observation (nearby, never caused).
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import * as Sharing from "expo-sharing";
import { ago, dur, fmt, money, tfmt, today } from "../model/dates";
import { cycleDayOf, cycleOn } from "../model/cycle";
import { regimenActive } from "../model/regimens";
import { isLab, kindName, reportIcon, reportKind, reportTitle } from "../model/reports";
import { fmtM, fmtV, metric, readingFor } from "../model/series";
import type { Entry, FileRef, Lab } from "../model/types";
import { TYPES, kindLabel, rl } from "../model/vocab";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, Chip, Chips, Icon, P, Pill, Row, RowText, Sec, SheetH, TypeIco, useT } from "../ui";
import { PhotoView } from "../components/PhotoView";
import { EntryRow } from "../components/EntryRow";
import { openForm } from "./entryForm";
import { openBeforeAfter } from "./experiments";
import { openTooth } from "./tooth";
import { alertSheet } from "./common";

export function openEntry(h: Health, id: string): void { h.openSheet(<EntryView id={id} />); }
export function openLab(h: Health, id: string): void { h.openSheet(<LabView id={id} />); }
export function openBefore(h: Health, id: string, hours = 48): void { h.openSheet(<BeforeView id={id} hours={hours} />); }
export function openBeforeConcern(h: Health, cid: string, hours = 48): void { h.openSheet(<BeforeConcernView cid={cid} hours={hours} />); }

async function openFile(h: Health, f: FileRef | string | null) {
  try {
    const u = await h.fileUri(f);
    if (!u) return alertSheet(h, "Locked on this device", "Unlock your photos and files first.");
    if (/^https?:/.test(u)) return Linking.openURL(u);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(u, { UTI: (f as FileRef)?.type?.includes("pdf") ? "com.adobe.pdf" : undefined, mimeType: (f as FileRef)?.type || undefined });
  } catch (e: any) { alertSheet(h, "Could not open that file", e?.message || String(e)); }
}

function KV(props: { rows: [string, string][] }) {
  const t = useT();
  return <View style={{ gap: 6 }}>{props.rows.map(([k, v], i) => <View key={i} style={{ flexDirection: "row", gap: 14 }}><Text style={{ width: 110, color: t.muted, fontFamily: t.fontUISemi, fontSize: 13.5 }}>{k}</Text><Text style={{ flex: 1, color: t.ink, fontFamily: t.fontUI, fontSize: 13.5 }}>{v}</Text></View>)}</View>;
}

function EntryView(props: { id: string }) {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const e = D.entries.find((x) => x.id === props.id);
  const [confirm, setConfirm] = useState(false);
  if (!e) return <View><SheetH title="Entry" onClose={h.closeSheet} /><P>This entry was removed.</P></View>;
  const T = TYPES[e.type], c = D.concerns.find((c) => c.id === e.concern_id), parent = D.entries.find((x) => x.id === e.parent_entry_id), kids = D.entries.filter((x) => x.parent_entry_id === e.id).sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  const rows: [string, string][] = [["Date", `${fmt(e.occurred_at)} (${ago(e.occurred_at)})`]];
  if (e.details.time) rows.push(["Time", tfmt(e.details.time)]);
  if (e.details.end_date || e.details.end_time) { const a = new Date(`${e.occurred_at}T${e.details.time || "00:00"}`), b = new Date(`${e.details.end_date || e.occurred_at}T${e.details.end_time || "00:00"}`); rows.push(["Lasted", b > a ? dur((b.getTime() - a.getTime()) / 60000) : `until ${fmt(e.details.end_date || e.occurred_at)}${e.details.end_time ? " " + tfmt(e.details.end_time) : ""}`]); }
  if (e.type === "measurement" && e.details.metric) rows.push(["Value", fmtM(D, e.details.metric, e.details.value)]);
  T.fields.forEach((f) => { let v = e.details[f.k]; if (v == null || v === "") return; if (f.t === "kind") v = kindLabel(D, v); else if (f.t === "metric") v = metric(D, v).l; else if (f.t === "plan") v = (D.plans.find((p) => p.id === v) || { title: v }).title; else if (f.t === "course") v = (D.courses.find((k) => k.id === v) || { title: v }).title; else if (f.k === "cost") v = money(v); else if (f.t === "select") { const o = f.o!.find((o) => o[0] === String(v)); v = o ? o[1] : v; } else if (f.t === "date") v = fmt(v); rows.push([f.l, String(v)]); });
  if (e.regions.length) rows.push(["Body areas", e.regions.map((r) => rl(D, r)).join(", ")]);
  if (c) rows.push(["Concern", c.title]);
  if (parent) rows.push(["Follows", parent.title]);
  if (e.notes) rows.push(["Notes", e.notes]);
  if (e.source !== "manual") rows.push(["Source", e.source]);
  if (e.type === "appointment") { const r = readingFor(D, e.id); if (r) { const M = metric(D, r.details.metric); rows.splice(1, 0, [`Your ${M.l.toLowerCase()}`, fmtV(r.details.value, M.u)]); } }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={e.title} icon={<TypeIco k={e.type} small />} onClose={h.closeSheet} />
      <KV rows={rows} />
      {(e.files || []).length ? <View><Sec>Files</Sec><Chips>{e.files.map((f, i) => <Pressable key={i} onPress={() => openFile(h, f)} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: t.soft, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 }}><Icon k="file" size={14} /><Text style={{ fontSize: 12.5, fontFamily: t.fontUISemi, color: t.ink }}>{f.name}{f.size ? <Text style={{ color: t.muted, fontFamily: t.fontUI }}> {Math.max(1, Math.round(f.size / 1024))} KB</Text> : null}</Text></Pressable>)}</Chips></View> : null}
      {e.photos.length ? <View><Sec>Photos</Sec><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{e.photos.map((p, i) => <PhotoView key={i} photo={p} date={e.occurred_at} style={{ width: 110, height: 130 }} />)}</View></View> : null}
      {kids.length ? <View><Sec>Follow-ups</Sec>{kids.map((k) => <EntryRow key={k.id} e={k} />)}</View> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {e.type === "appointment" && e.details.status === "upcoming" ? <Btn kind="accent" label="Record how it went" onPress={() => openForm(h, "appointment", { ...e, details: { ...e.details, status: "done" } })} /> : null}
        {e.details && e.details.tooth && /\d{2}/.test(String(e.details.tooth)) ? <Btn label="Tooth chart" onPress={() => openTooth(h, +String(e.details.tooth).match(/\d{2}/)![0])} /> : null}
        {e.type === "observation" ? <Btn label="What came before" onPress={() => openBefore(h, e.id)} /> : null}
        {["procedure", "appointment", "food_trial"].includes(e.type) && e.occurred_at <= today() ? <Btn label="Compare before and after" onPress={() => openBeforeAfter(h, { config: { event_date: e.occurred_at, label: e.title } })} /> : null}
        <Btn label="+ Follow-up" onPress={() => openForm(h, "observation", { parent_entry_id: e.id, regions: e.regions, concern_id: e.concern_id })} />
        <Btn label="Edit" onPress={() => openForm(h, e.type, e)} />
        <Btn label="Delete entry" onPress={() => setConfirm(true)} />
      </View>
      {confirm ? <View style={{ backgroundColor: t.accentSoft, borderRadius: 16, padding: 14, gap: 8 }}><Text style={{ fontFamily: t.fontUIBold, color: t.ink }}>Delete this entry?</Text><View style={{ flexDirection: "row", gap: 8 }}><Btn kind="dark" small label="Delete" onPress={() => { h.mutate((D) => { D.entries = D.entries.filter((x) => x.id !== e.id); D.entries.forEach((x) => { if (x.parent_entry_id === e.id) x.parent_entry_id = null; }); }); h.closeSheet(); h.setV({ frame: null }); }} /><Btn small label="Keep" onPress={() => setConfirm(false)} /></View></View> : null}
    </View>
  );
}

function LabView(props: { id: string }) {
  const h = useHealth();
  const t = useT();
  const l = h.D.labs.find((x) => x.id === props.id);
  const [armed, setArmed] = useState(false);
  if (!l) return <View><SheetH title="Report" onClose={h.closeSheet} /><P>This report was removed.</P></View>;
  const fname = typeof l.file === "string" ? l.file : l.file?.name;
  const lab = isLab(l);
  const kv: [string, string][] = lab ? [["Collected", fmt(l.date)]] : [["Kind", kindName(reportKind(l))], ["Dated", fmt(l.date)], ...(l.lab ? [["From", l.lab] as [string, string]] : [])];
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={reportTitle(l)} icon={<TypeIco k={reportIcon(l)} small />} onClose={h.closeSheet} />
      <KV rows={kv} />
      {l.file ? <Pressable onPress={() => openFile(h, l.file)} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: t.soft, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, alignSelf: "flex-start" }}><Icon k="file" size={14} /><Text style={{ fontSize: 12.5, fontFamily: t.fontUISemi, color: t.ink }}>{fname}</Text></Pressable> : null}
      {l.results.length ? (
        <View>
          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: t.line, paddingVertical: 6 }}>{(lab ? ["Marker", "Value", "Lab range", "Flag"] : ["Name", "Value", "Note", ""]).map((s, i) => <Text key={i} style={{ flex: i === 0 ? 1.4 : i === 3 ? 0.5 : 1, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: t.muted, fontFamily: t.fontUIBold }}>{s}</Text>)}</View>
          {l.results.map((r, i) => <View key={i} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: t.line, paddingVertical: 8 }}><Text style={{ flex: 1.4, color: t.ink, fontFamily: t.fontUI, fontSize: 13 }}>{r.marker}</Text><Text style={{ flex: 1, color: t.ink, fontFamily: t.fontData, fontSize: 13 }}>{r.value} {r.unit}</Text><Text style={{ flex: 1, color: t.muted, fontFamily: t.fontData, fontSize: 12 }}>{r.range}</Text><View style={{ flex: 0.5 }}>{r.flag ? <Pill kind="flag">{r.flag}</Pill> : null}</View></View>)}
        </View>
      ) : null}
      {l.notes ? <P>{l.notes}</P> : null}
      {lab ? <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>Ranges and flags as printed by the lab.</Text> : null}
      <Acts right={<Btn label={armed ? "Tap again to delete" : "Delete report"} onPress={() => { if (!armed) return setArmed(true); h.mutate((D) => { D.labs = D.labs.filter((x) => x.id !== l.id); }); h.closeSheet(); }} />} />
    </View>
  );
}

type BeforeItem = { t: Date; ico: string; label: string; sub: string; entry?: string; key: string | null };
function beforeItems(D: ReturnType<typeof useHealth>["D"], e: Entry, hours: number) {
  const entryTime = (x: Entry) => new Date(`${x.occurred_at}T${(x.details && x.details.time) || "12:00"}`);
  const end = entryTime(e), start = new Date(end.getTime() - hours * 3600e3), items: BeforeItem[] = [];
  D.entries.forEach((x) => { if (x.id === e.id) return; const tt = entryTime(x); if (tt >= start && tt < end) items.push({ t: tt, ico: x.type, label: x.title, sub: TYPES[x.type] ? TYPES[x.type].label : "", entry: x.id, key: x.type === "food_trial" ? `Food: ${x.details.food || x.title}` : x.type === "procedure" ? x.title : null }); });
  (D.regLogs || []).forEach((l) => { const tt = new Date(`${l.on_date}T${l.time || "12:00"}`); if (tt >= start && tt < end) { const r = D.regimens.find((z) => z.id === l.regimen_id); if (r) items.push({ t: tt, ico: "regimen", label: r.name, sub: "Logged", key: r.name }); } });
  const diet = D.regimens.find((r) => r.category === "diet" && regimenActive(r, e.occurred_at));
  return { items: items.sort((a, b) => b.t.getTime() - a.t.getTime()), diet, cd: cycleOn(D) ? cycleDayOf(D, e.occurred_at) : null, end };
}
const hoursAgo = (ms: number) => { const hh = Math.round(ms / 3600e3); return hh < 1 ? "under an hour before" : hh < 48 ? `${hh} h before` : `${Math.round(hh / 24)} days before`; };

function BeforeView(props: { id: string; hours: number }) {
  const h = useHealth();
  const [hours, setHours] = useState(props.hours);
  const e = h.D.entries.find((x) => x.id === props.id);
  if (!e) return null;
  const r = beforeItems(h.D, e, hours);
  return (
    <View style={{ gap: 10 }}>
      <SheetH title="What came before" icon={<TypeIco k="observation" small />} onClose={h.closeSheet} />
      <P>Everything logged in the {hours} hours before <Text style={{ fontWeight: "700" }}>{e.title}</Text> ({fmt(e.occurred_at)}{e.details.time ? " " + tfmt(e.details.time) : ""}). This shows what was nearby, not what caused anything.</P>
      <Chips>{[24, 48, 72].map((x) => <Chip key={x} label={`${x} hours`} on={x === hours} onPress={() => setHours(x)} />)}</Chips>
      {r.diet || r.cd ? <Chips>{r.diet ? <Pill>Diet: {r.diet.name}</Pill> : null}{r.cd ? <Pill>Cycle day {r.cd}</Pill> : null}</Chips> : null}
      <View style={{ gap: 8 }}>{r.items.length ? r.items.map((it, i) => <Row key={i} onPress={it.entry ? () => openEntry(h, it.entry!) : undefined}><View style={{ flexDirection: "row", gap: 10, alignItems: "center", flex: 1 }}><TypeIco k={it.ico} small /><RowText title={it.label} sub={it.sub} /></View><Text style={{ fontSize: 12, color: h.t.muted, fontFamily: h.t.fontUI }}>{hoursAgo(r.end.getTime() - it.t.getTime())}</Text></Row>) : <P>Nothing logged in that window.</P>}</View>
    </View>
  );
}
function BeforeConcernView(props: { cid: string; hours: number }) {
  const h = useHealth();
  const t = useT();
  const [hours, setHours] = useState(props.hours);
  const c = h.D.concerns.find((x) => x.id === props.cid);
  if (!c) return null;
  const obs = h.D.entries.filter((e) => e.concern_id === c.id && e.type === "observation").sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  const counts: Record<string, number> = {};
  const blocks = obs.map((o) => { const r = beforeItems(h.D, o, hours), keys = [...new Set(r.items.map((i) => i.key).filter(Boolean))] as string[]; keys.forEach((k) => (counts[k] = (counts[k] || 0) + 1)); return { o, r, keys }; });
  const rep = Object.entries(counts).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  return (
    <View style={{ gap: 10 }}>
      <SheetH title={`What came before: ${c.title}`} icon={<TypeIco k="observation" small />} onClose={h.closeSheet} />
      <P>For each observation, the food trials, procedures and regimens logged in the {hours} hours before it. Counts show what was nearby more than once; they don't show what caused anything.</P>
      <Chips>{[24, 48, 72].map((x) => <Chip key={x} label={`${x} hours`} on={x === hours} onPress={() => setHours(x)} />)}</Chips>
      {rep.length ? <View><Sec>Logged before more than one</Sec>{rep.map(([k, n]) => <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: t.line }}><Text style={{ fontFamily: t.fontUISemi, color: t.ink, fontSize: 13 }}>{k}</Text><Text style={{ fontFamily: t.fontUI, color: t.ink, fontSize: 13 }}>before {n} of {obs.length}</Text></View>)}</View> : null}
      <Sec>Each one</Sec>
      <View style={{ gap: 8 }}>{blocks.length ? blocks.map(({ o, r, keys }) => <View key={o.id} style={{ backgroundColor: t.soft, borderRadius: 12, padding: 12, gap: 6 }}><Pressable onPress={() => openEntry(h, o.id)}><Text style={{ fontFamily: t.fontUIBold, color: t.ink, textDecorationLine: "underline" }}>{o.title} <Text style={{ color: t.muted, fontFamily: t.fontUI, textDecorationLine: "none" }}>· {fmt(o.occurred_at)}</Text></Text></Pressable><Chips>{keys.length ? keys.map((k) => <Pill key={k}>{k}</Pill>) : <Text style={{ fontSize: 12, color: t.muted }}>Nothing logged before</Text>}{r.diet ? <Pill kind="mut">Diet: {r.diet.name}</Pill> : null}{r.cd ? <Pill kind="mut">Cycle day {r.cd}</Pill> : null}</Chips></View>) : <P>No observations on this concern yet.</P>}</View>
    </View>
  );
}
export type { Lab };
