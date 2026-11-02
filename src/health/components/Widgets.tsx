// Dashboard widgets. White ones follow the selected body area; tinted ones
// always show everything. Tapping a widget (not one of its items) opens its
// page. Customising outlines each widget in the accent, reorders, removes,
// adds (one Add widget button, after the last widget; the phone shows the
// web's two columns one after the other).
import { useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { ago, fmt, fmtShort, money, span, today } from "../model/dates";
import { byDateDesc } from "../model/dates";
import { challengeStats, chOnly, ruleStatus, ruleTitle } from "../model/experiments";
import { statusColor } from "../theme";
import { adherence, logsOf, regimenActive, stintsOf } from "../model/regimens";
import { fmtV, getSeries, lastVal, metric, mkind } from "../model/series";
import { planCats, planStats, planStatus, plansFor, YEAR } from "../model/plans";
import { quickTitle } from "../model/reminders";
import type { Entry, Regimen, Suggestion, Widget } from "../model/types";
import { FILTERED, FLOW, SYMPTOMS, WIDGETS, WIDGET_TAB, flowName, kindLabel, rl, srcLabel } from "../model/vocab";
import { cycleDayOf } from "../model/cycle";
import { labsOnly } from "../model/reports";
import { useHealth, type Tab } from "../state/HealthContext";
import { Btn, Card, CardH, Chip, Chips, Donut, Empty, Field, Icon, Input, Pill, Row, RowText, TypeIco, ValInput, emptyVal, readVal, useT } from "../ui";
import { PhotoView } from "./PhotoView";
import { ChartLegend, ChartSvg } from "./ChartSvg";
import { CycleChartBody } from "./CycleCalendar";
import { RegimenMonthBody } from "./RegimenCalendar";
import { TeethWidget } from "./ToothChart";
import { openAppleHealth, openCycleDay, openEntry, openForm, openLab, openRegimen, openRemind, openWidgetLib } from "../sheets";

export function ChallengeBlock(props: { c: Parameters<typeof challengeStats>[1] }) {
  const h = useHealth();
  const t = useT();
  const s = challengeStats(h.D, props.c), soon = s.elapsed === 0;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <Text style={{ fontFamily: t.fontUIBold, fontSize: 15, color: t.ink, flex: 1, minWidth: 0 }}>{props.c.title}</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{fmtShort(props.c.started_on)} – {fmtShort(s.end)}</Text>
          <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{soon ? `${s.total} days` : `Day ${s.elapsed} of ${s.total}`}</Text>
        </View>
      </View>
      {s.rules.map((r, i) => { const st = ruleStatus(h.D, props.c, r); return (
        <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 13, fontFamily: t.fontUIBold, color: t.ink, flex: 1, minWidth: 0 }}>{ruleTitle(r)}</Text>
          <Text style={{ fontSize: 12.5, fontFamily: t.fontUIBold, color: statusColor(t, st.st) }}>{st.label}</Text>
        </View>
      ); })}
    </View>
  );
}

export function SuggestionCards(props: { items: Suggestion[] }) {
  const h = useHealth();
  const t = useT();
  return (
    <>
      {props.items.map((s) => (
        <View key={s.id} style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: t.muted, borderRadius: 16, padding: 14, gap: 6 }}>
          <Text style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontFamily: t.fontUIBold, color: t.muted }}>Found on your calendar</Text>
          <Text style={{ fontFamily: t.fontUIBold, color: t.ink }}>{s.title}</Text>
          <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{fmt(s.occurred_at)} · {s.found}</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Btn kind="dark" small label="Add" onPress={() => openForm(h, "appointment", { title: s.title, occurred_at: s.occurred_at, details: { ...s.details, status: "upcoming" }, source: "calendar", fromSuggestion: s.id })} />
            <Btn small label="Dismiss" onPress={() => h.mutate((D) => { const x = D.suggestions.find((y) => y.id === s.id); if (x) x.status = "dismissed"; })} />
          </View>
        </View>
      ))}
    </>
  );
}

export function RegAdh(props: { r: Regimen }) {
  const h = useHealth();
  const t = useT();
  const r = props.r;
  if (r.category === "diet" || !regimenActive(r)) return null;
  const a = adherence(h.D, r), todayN = logsOf(h.D, r.id, today(), today()).length, auto = r.match && r.match.source && r.match.source !== "manual";
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 }}>
        <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{a ? <><Text style={{ color: t.ink, fontFamily: t.fontUIBold }}>{a.done} of {a.target}</Text> this {a.per}</> : todayN ? "Logged today" : "Not logged today"}</Text>
        {auto ? <Pill kind="src">from {srcLabel(r.match!.source).replace(/^An? /, "")} when connected</Pill> : null}
      </View>
      <Btn small label={todayN ? "+ Log again" : "Log today"} onPress={() => h.mutate((D) => { D.regLogs.push({ id: "rl-" + newId(), regimen_id: r.id, on_date: today(), time: null, source: "manual", note: "" }); })} />
    </View>
  );
}

function QuickBody(props: { w: Widget }) {
  const h = useHealth();
  const t = useT();
  const D = h.D, T = today(), s = props.w.src || "cycle";
  const [flow, setFlow] = useState<string | null>(null);
  const [sym, setSym] = useState<Set<string>>(new Set());
  const [newSym, setNewSym] = useState("");
  const [note, setNote] = useState("");
  const [val, setVal] = useState(emptyVal());
  const [err, setErr] = useState("");
  const done = (title: string, sub: string, onEdit: () => void) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.accentSoft, borderRadius: 14, padding: 12, paddingHorizontal: 14 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: t.onAccent, fontWeight: "800" }}>✓</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ fontFamily: t.fontUIBold, color: t.ink }}>{title}</Text><Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{sub}</Text></View>
      <Btn small label="Edit" onPress={onEdit} />
    </View>
  );
  if (s === "cycle") {
    const r = (D.cycle || []).find((c) => c.on_date === T && c.source === "manual"), cd = cycleDayOf(D, T);
    if (r) return done(`${flowName(r.flow)}${(r.symptoms || []).length ? " · " + r.symptoms.join(", ") : ""}${r.note ? " · " + r.note : ""}`, `Logged for today${cd ? ` · cycle day ${cd}` : ""}. It'll ask again tomorrow.`, () => openCycleDay(h, T));
    return (
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{cd ? `Cycle day ${cd}. ` : ""}How's today?</Text>
        <Chips>{FLOW.map(([v, l]) => <Chip key={v} label={l} on={flow === v} onPress={() => setFlow(v)} />)}</Chips>
        <Chips>{SYMPTOMS.map((x) => <Chip key={x} label={x} on={sym.has(x)} onPress={() => setSym((p) => { const n = new Set(p); n.has(x) ? n.delete(x) : n.add(x); return n; })} />)}</Chips>
        <Input value={newSym} onChange={setNewSym} placeholder="Add another symptom" />
        <Field label="Note (optional)"><Input value={note} onChange={setNote} multiline placeholder="Anything else about today" /></Field>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Btn kind="accent" small label="Save today" onPress={() => {
            if (!flow) return setErr("Pick a flow, or None.");
            h.mutate((D) => {
              D.cycle = (D.cycle || []).filter((c) => !(c.on_date === T && c.source === "manual"));
              D.cycle.push({ on_date: T, source: "manual", flow: flow as any, symptoms: [...sym, ...newSym.split(",").map((x) => x.trim()).filter(Boolean)], note: note.trim(), source_ref: null });
              if (!D.settings.cycle_on) D.settings.cycle_on = true;
            });
          }} />
          {err ? <Text style={{ color: t.tint("observation"), fontSize: 13, fontFamily: t.fontUISemi }}>{err}</Text> : null}
        </View>
      </View>
    );
  }
  const k = s.slice(2);
  if (!D.metrics[k]) return <Empty>This measure was removed.</Empty>;
  const e = D.entries.filter((x) => x.type === "measurement" && x.details.metric === k && x.occurred_at === T).sort(byDateDesc())[0];
  const { fmtM } = require("../model/series") as typeof import("../model/series");
  if (e) return done(fmtM(D, k, e.details.value), "Logged for today. It'll ask again tomorrow.", () => openEntry(h, e.id));
  return (
    <View style={{ gap: 10 }}>
      <ValInput kind={mkind(D, k)} label={metric(D, k).l} value={val} onChange={setVal} unit={metric(D, k).u} />
      <Field label="Note (optional)"><Input value={note} onChange={setNote} multiline placeholder="Anything else about today" /></Field>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Btn kind="accent" small label="Save today" onPress={() => {
          const v = readVal(mkind(D, k), val);
          if (v == null) return setErr("Enter a value.");
          h.mutate((D) => { D.entries.push({ id: newId(), type: "measurement", occurred_at: T, title: `${metric(D, k).l} ${fmtM(D, k, v)}`, notes: note.trim(), regions: ["whole_body"], concern_id: null, parent_entry_id: null, details: { metric: k, value: v }, source: "manual", photos: [], files: [] }); });
        }} />
        {err ? <Text style={{ color: t.tint("observation"), fontSize: 13, fontFamily: t.fontUISemi }}>{err}</Text> : null}
      </View>
    </View>
  );
}

function WidgetBody(props: { w: Widget }) {
  const h = useHealth();
  const t = useT();
  const { D, V } = h;
  const w = props.w;
  const inRegion = (e: Entry) => !V.region || (e.regions || []).includes(V.region);
  switch (w.type) {
    case "teeth": return <TeethWidget />;
    case "quick": return <View><QuickBody w={w} /><View style={{ marginTop: 10 }}><RemindBtn kind="quick" id={w.id} /></View></View>;
    case "appointments": {
      const ap = D.entries.filter((e) => e.type === "appointment" && inRegion(e));
      const sug = D.suggestions.filter((s) => s.status === "pending");
      const up = ap.filter((e) => e.details.status === "upcoming").sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1));
      const kinds: Record<string, Entry> = {};
      ap.filter((e) => e.details.status === "done").sort(byDateDesc()).forEach((e) => { if (!kinds[e.details.kind]) kinds[e.details.kind] = e; });
      const rows = [...up.map((e) => <Row key={e.id} onPress={() => openEntry(h, e.id)}><RowText title={e.title} sub={`${fmt(e.occurred_at)} · ${ago(e.occurred_at)}`} /><Pill kind="up">Upcoming</Pill></Row>),
        ...(w.showPast === false ? [] : Object.values(kinds)).map((e) => <Row key={e.id} onPress={() => openEntry(h, e.id)}><RowText title={kindLabel(D, e.details.kind)} sub={`Last visit ${ago(e.occurred_at)}`} /><Pill kind="mut">{fmtShort(e.occurred_at)}</Pill></Row>)];
      return <View style={{ gap: 8 }}>{sug.length ? <SuggestionCards items={sug} /> : null}<Clip id={w.id} limit={4}>{rows.length ? rows : <Empty>No appointments.</Empty>}</Clip></View>;
    }
    case "concerns": {
      const cs = D.concerns.filter((c) => !V.region || c.regions.includes(V.region)).sort((a, b) => ((a.status === "resolved") as any) - ((b.status === "resolved") as any) || (a.started_on! < b.started_on! ? 1 : -1));
      return <Clip id={w.id}>{cs.length ? cs.map((c) => { const n = D.entries.filter((e) => e.concern_id === c.id).length; return <Row key={c.id} selected={V.concern === c.id} onPress={() => openConcernLazy(h, c.id)}><RowText title={c.title} sub={`${n} entries · since ${fmtShort(c.started_on)}`} /><Pill kind={c.status === "resolved" ? "mut" : "up"}>{c.status === "resolved" ? "Resolved" : "Active"}</Pill></Row>; }) : <Empty>No concerns.</Empty>}</Clip>;
    }
    case "regimens": {
      // the current diet counts as active too: it sits first, then the regimens
      const cur = D.regimens.find((r) => r.category === "diet" && regimenActive(r));
      const rs = [...(cur ? [cur] : []), ...D.regimens.filter((r) => r.category !== "diet" && regimenActive(r) && (!V.region || r.regions.includes(V.region)))];
      const sub = (r: Regimen) => (r.category === "diet" ? `Diet · ${span(stintsOf(r)[stintsOf(r).length - 1].from)}` : [r.dose, r.frequency].filter(Boolean).join(" · "));
      return <Clip id={w.id}>{rs.length ? rs.map((r) => <Row key={r.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}><Pressable onPress={() => openRegimen(h, r)} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><TypeIco k={r.category === "diet" ? "diet" : "regimen"} small /><RowText title={r.name} sub={sub(r)} /></Pressable><RegAdh r={r} /></Row>) : <Empty>Nothing active.</Empty>}</Clip>;
    }
    case "diet": {
      const cur = D.regimens.find((r) => r.category === "diet" && regimenActive(r));
      const past = D.regimens.filter((r) => r.category === "diet" && r !== cur).sort((a, b) => (a.started_on < b.started_on ? 1 : -1)).slice(0, 2);
      return (
        <View style={{ gap: 8 }}>
          {cur ? <Pressable onPress={() => openRegimen(h, cur)} style={{ backgroundColor: t.card, borderRadius: 16, padding: 14, gap: 4 }}><Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>Current diet · {span(stintsOf(cur)[stintsOf(cur).length - 1].from)}</Text><Text style={{ fontSize: 17, fontFamily: t.fontUIBold, color: t.ink }}>{cur.name}</Text>{cur.notes ? <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{cur.notes}</Text> : null}</Pressable> : <Empty>No current diet set.</Empty>}
          {past.map((r) => <Row key={r.id} onPress={() => openRegimen(h, r)} style={{ backgroundColor: t.card }}><RowText title={r.name} sub={`${fmtShort(r.started_on)} – ${fmtShort(r.ended_on)}`} /></Row>)}
        </View>
      );
    }
    case "challenge": {
      const T = today();
      const c = chOnly(D).filter((c) => { const { dayDiff } = require("../model/dates"); return dayDiff(c.started_on, T) < (c.days || 0); }).sort((a, b) => (a.started_on < b.started_on ? 1 : -1))[0] || chOnly(D)[0];
      if (!c) return <Empty>No challenge running. Start one from Plan.</Empty>;
      return <Pressable onPress={() => h.go("plan", { exp: c.id })} accessibilityRole="button"><ChallengeBlock c={c} /></Pressable>;
    }
    case "savedchart": {
      const c = D.charts.find((x) => x.id === w.chartId);
      if (!c) return <Empty>This chart was deleted.</Empty>;
      if (c.kind === "cycle") return <CycleChartBody months={1} small />;
      if (c.kind === "month") return <RegimenMonthBody regId={c.reg} months={1} small />;
      return <View><ChartSvg c={c} height={200} small /><ChartLegend c={c} /></View>;
    }
    case "labs": {
      const l = labsOnly(D).sort(byDateDesc("date"))[0];
      if (!l) return <Empty>No lab reports yet.</Empty>;
      return (
        <View>
          <Pressable onPress={() => openLab(h, l.id)}><Text style={{ fontFamily: t.fontUIBold, color: t.ink, textDecorationLine: "underline" }}>{l.lab} · {fmt(l.date)}</Text></Pressable>
          <View style={{ marginTop: 8 }}>{l.results.map((r, i) => <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: t.line }}><Text style={{ fontFamily: t.fontUISemi, color: t.ink, fontSize: 13 }}>{r.marker}</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Text style={{ fontFamily: t.fontData, color: t.ink, fontSize: 13 }}>{r.value} <Text style={{ color: t.muted, fontSize: 11 }}>{r.unit}</Text></Text>{r.flag ? <Pill kind="flag">{r.flag}</Pill> : null}</View></View>)}</View>
        </View>
      );
    }
    case "photos": {
      const ps = D.entries.filter((e) => e.photos.length && e.details.series !== "body" && inRegion(e)).sort(byDateDesc()).slice(0, 6);
      if (!ps.length) return <Empty>No photos yet.</Empty>;
      return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{ps.map((e) => <View key={e.id} style={{ width: "31%", flexGrow: 1 }}><PhotoView photo={e.photos[0]} date={e.occurred_at} style={{ aspectRatio: 4 / 5 }} onPress={() => openEntry(h, e.id)} /></View>)}</View>;
    }
    case "suggestions": { const s = D.suggestions.filter((s) => s.status === "pending"); return s.length ? <SuggestionCards items={s} /> : <Empty>Nothing new from your calendar.</Empty>; }
    case "recent": {
      const es = D.entries.filter(inRegion).filter((e) => !(e.type === "photo" && e.details.series === "body") && e.occurred_at <= today()).sort(byDateDesc()).slice(0, 5);
      return es.length ? <View style={{ gap: 8 }}>{es.map((e) => <Row key={e.id} onPress={() => openEntry(h, e.id)}><View style={{ flexDirection: "row", gap: 10, alignItems: "center", flex: 1, minWidth: 0 }}><TypeIco k={e.type} small /><Text style={{ fontFamily: t.fontUIBold, color: t.ink, fontSize: 13.5, flex: 1 }} numberOfLines={1}>{e.title}</Text></View><Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontData }}>{fmtShort(e.occurred_at)}</Text></Row>)}</View> : <Empty>Nothing yet.</Empty>;
    }
    case "plan": {
      const ps = plansFor(D, YEAR());
      return ps.length ? <View style={{ gap: 8 }}>{ps.map((p) => { const s = planStats(D, p), [st] = planStatus(p, s); return <Row key={p.id} onPress={() => h.go("plan")} style={{ backgroundColor: t.card }}><View style={{ flexDirection: "row", gap: 10, alignItems: "center", flex: 1, minWidth: 0 }}><Donut pct={s.done / s.target} size={30} stroke={5} color={s.done >= s.target ? t.accent : "#4F5BF5"} /><RowText title={p.title} sub={st} /></View><Text style={{ fontFamily: t.fontData, fontSize: 12, color: t.muted }}>{s.done}/{s.target}</Text></Row>; })}</View> : <Empty>No plan yet.</Empty>;
    }
    case "integrations":
      return <View style={{ gap: 8 }}>{[["Apple Health", "Tap to connect: ⋮ → Apple Health"], ["Oura", "Direct, v2"], ["Garmin", "Through Apple Health"], ["Whoop", "Through Apple Health"], ["MyFitnessPal", "Through Apple Health"]].map(([n, s]) => <Row key={n} style={{ backgroundColor: t.card }} onPress={n === "Apple Health" ? () => openAppleHealth(h) : undefined}><RowText title={n} sub={s} /><Pill kind="src">{n === "Apple Health" && D.hk && Object.keys(D.hk).length ? "Reading" : "Not connected"}</Pill></Row>)}</View>;
    default: return null;
  }
}

/** long lists show 5 with See all */
function Clip(props: { id: string; children: React.ReactNode; limit?: number }) {
  const h = useHealth();
  const t = useT();
  const kids = (Array.isArray(props.children) ? props.children.flat() : [props.children]).filter(Boolean) as React.ReactNode[];
  const flat: React.ReactNode[] = [];
  kids.forEach((k: any) => (Array.isArray(k) ? flat.push(...k) : flat.push(k)));
  const lim = props.limit || 5;
  const open = h.V.expanded.has(props.id);
  const shown = open ? flat : flat.slice(0, lim);
  return (
    <View style={{ gap: 8 }}>
      {shown}
      {flat.length > lim ? <Pressable onPress={() => h.setV({ expanded: new Set(open ? [...h.V.expanded].filter((x) => x !== props.id) : [...h.V.expanded, props.id]) })} style={{ paddingTop: 4 }}><Text style={{ fontFamily: t.fontUIBold, fontSize: 13, color: t.ink, textDecorationLine: "underline" }}>{open ? "Show less" : `See all ${flat.length}`}</Text></Pressable> : null}
    </View>
  );
}

export function RemindBtn(props: { kind: "challenge" | "concern" | "regimen" | "quick"; id: string }) {
  const h = useHealth();
  const t = useT();
  const { remFor, schedText } = require("../model/reminders") as typeof import("../model/reminders");
  const r = remFor(h.D, props.kind, props.id);
  return (
    <Pressable onPress={() => openRemind(h, { kind: props.kind, id: props.id })} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: r && r.enabled ? "transparent" : t.line, backgroundColor: r && r.enabled ? t.accentSoft : t.card }} accessibilityRole="button">
      <Icon k="bell" size={14} stroke={2} />
      <Text style={{ fontSize: 12, fontFamily: t.fontUISemi, color: t.ink }}>{r ? (r.enabled ? schedText(r.schedule || {}) : "Reminder paused") : "Remind me"}</Text>
    </Pressable>
  );
}

function widgetTitle(D: ReturnType<typeof useHealth>["D"], w: Widget): string {
  if (w.type === "quick") return quickTitle(D, w);
  if (w.type === "savedchart") { const c = D.charts.find((x) => x.id === w.chartId); return c ? c.title : "Chart"; }
  return (WIDGETS[w.type] || { label: "" }).label;
}
function widgetSub(D: ReturnType<typeof useHealth>["D"], w: Widget, region: string | null): string {
  if (w.type === "savedchart") { const c = D.charts.find((x) => x.id === w.chartId); const s = c && c.y1 && getSeries(D, c.y1); const lp = lastVal(s || null); return lp && s && s.kind === "line" ? (s.monthly ? `${fmtV(lp.v, s.unit)} this month` : `${fmtV(lp.v, s.unit)} · ${fmtShort(lp.d)}`) : ""; }
  if (w.type === "concerns") return `${D.concerns.filter((c) => c.status !== "resolved" && (!region || c.regions.includes(region))).length} active`;
  return "";
}

/** the ⋯ on the Appointments widget: whether the last-visit rows show under what is booked */
function ApptMenu(props: { w: Widget }) {
  const h = useHealth();
  const t = useT();
  const [at, setAt] = useState<number | null>(null);
  const on = props.w.showPast !== false;
  const top = Math.min((at || 0) + 12, Dimensions.get("window").height - 90);
  return (
    <>
      <Pressable onPress={(e) => setAt(e.nativeEvent.pageY)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Appointments options" accessibilityRole="button"><Text style={{ color: t.ink, fontSize: 18, fontWeight: "700", lineHeight: 20 }}>⋯</Text></Pressable>
      <Modal visible={at !== null} transparent animationType="fade" onRequestClose={() => setAt(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setAt(null)} />
        <View style={{ position: "absolute", right: 24, top, backgroundColor: t.card, borderRadius: 14, padding: 6, minWidth: 240, borderWidth: 1, borderColor: t.line, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }} accessibilityRole="menu">
          <Pressable onPress={() => { setAt(null); h.mutate((D) => { const w = [...D.widgets.left, ...D.widgets.right].find((x) => x.id === props.w.id); if (w) w.showPast = !on; }); }} style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityRole="menuitem" accessibilityState={{ checked: on }}>
            <Text style={{ color: t.ink, fontFamily: t.fontUISemi, fontSize: 14, flex: 1 }}>Show past appointments</Text>
            {on ? <Icon k="check" size={16} stroke={2.5} color={t.ink} /> : null}
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

export function WidgetColumn(props: { col: "left" | "right" }) {
  const h = useHealth();
  const t = useT();
  const { D, V } = h;
  const ws = D.widgets[props.col];
  return (
    <View style={{ gap: 16 }}>
      {ws.map((w, i) => {
        const f = FILTERED.has(w.type);
        const tab = WIDGET_TAB[w.type];
        const go = tab ? () => h.go(tab as Tab, w.chartId ? { focusChart: w.chartId } : undefined) : undefined;
        return (
          <Card key={w.id} tinted={!f} style={V.customizing ? { borderWidth: 1.5, borderColor: t.accent, shadowColor: t.accent, shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } } : undefined}>
            {V.customizing ? (
              <View style={{ position: "absolute", top: 12, right: 12, flexDirection: "row", gap: 4, zIndex: 2 }}>
                {[["↑", -1], ["↓", 1]].map(([lbl, d]) => <Pressable key={lbl as string} onPress={() => h.mutate((D) => { const a = D.widgets[props.col], j = i + (d as number); if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; })} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, alignItems: "center", justifyContent: "center" }} accessibilityLabel={d === -1 ? "Move up" : "Move down"}><Text style={{ color: t.ink, fontSize: 12 }}>{lbl as string}</Text></Pressable>)}
                <Pressable onPress={() => h.mutate((D) => { D.widgets[props.col].splice(i, 1); })} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Remove widget"><Text style={{ color: t.ink, fontSize: 12 }}>✕</Text></Pressable>
              </View>
            ) : null}
            <CardH title={widgetTitle(D, w)} onPress={go} sub={f && V.region ? <Pill kind="flag">{rl(D, V.region)}</Pill> : widgetSub(D, w, V.region)} right={w.type === "appointments" && !V.customizing ? <ApptMenu w={w} /> : undefined} style={V.customizing ? { paddingRight: 100 } : undefined} />
            {go && !V.customizing ? <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={`Open ${widgetTitle(D, w)}`}><WidgetBody w={w} /></Pressable> : <WidgetBody w={w} />}
          </Card>
        );
      })}
      {V.customizing && props.col === "right" ? <Pressable onPress={() => openWidgetLib(h, props.col)} style={{ borderWidth: 2, borderStyle: "dashed", borderColor: t.line, borderRadius: 22, padding: 18, alignItems: "center" }} accessibilityRole="button"><Text style={{ color: t.muted, fontFamily: t.fontUIBold }}>+ Add widget</Text></Pressable> : null}
    </View>
  );
}
import { uid as newId } from "../model/dates";
import { openConcern as openConcernLazy } from "../sheets";
