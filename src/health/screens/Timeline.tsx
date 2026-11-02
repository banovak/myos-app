// The list view of History: everything by date, filtered by type, body area
// or concern. Measurements and body progress photos live under their own
// filters. historyItems is the one list the month and bar views draw from too.
import { Pressable, Text, View } from "react-native";
import { MONTHS, fmtShort, pd, today } from "../model/dates";
import { EXP_LABEL, expKind } from "../model/experiments";
import type { Challenge, D, Entry, Lab, Regimen } from "../model/types";
import { isLab, kindName, reportIcon, reportKind, reportTitle } from "../model/reports";
import { catLabel } from "../model/vocab";
import { useHealth, type View as HView } from "../state/HealthContext";
import { Card, CardH, Empty, Pill, Sub, TypeIco, useT } from "../ui";
import { EntryRow } from "../components/EntryRow";
import { stintsOf } from "../model/regimens";
import { openLab, openRegimen } from "../sheets";

export type Item = { kind: "entry"; d: string; e: Entry } | { kind: "lab"; d: string; l: Lab } | { kind: "reg"; d: string; r: Regimen; edge: "start" | "end" } | { kind: "ch"; d: string; c: Challenge };

export const HIST_FILTERS: [string, string][] = [["all", "All"], ["photo", "Photos"], ["appointment", "Appointments"], ["measurement", "Measurements"], ["procedure", "Procedures"], ["observation", "Observations"], ["food_trial", "Food trials"], ["lab", "Reports"], ["reg", "Regimens & diet"]];

/** what the current filters show, newest first */
export function historyItems(D: D, V: HView): Item[] {
  const T = today();
  const items: Item[] = D.entries.map((e) => ({ kind: "entry", d: e.occurred_at, e } as Item));
  D.labs.forEach((l) => items.push({ kind: "lab", d: l.date, l }));
  D.regimens.forEach((r) => stintsOf(r).forEach((p) => { items.push({ kind: "reg", d: p.from, r, edge: "start" }); if (p.to && p.to <= T) items.push({ kind: "reg", d: p.to, r, edge: "end" }); }));
  D.challenges.forEach((c) => items.push({ kind: "ch", d: c.started_on, c }));
  return items.filter((it) => {
    if (V.type === "all") return !(it.kind === "entry" && ((it.e.type === "photo" && it.e.details.series === "body") || it.e.type === "measurement"));
    if (V.type === "lab") return it.kind === "lab";
    if (V.type === "reg") return it.kind === "reg" || it.kind === "ch";
    return it.kind === "entry" && it.e.type === V.type;
  }).filter((it) => {
    if (V.region) { const regs = it.kind === "entry" ? it.e.regions : it.kind === "reg" ? it.r.regions : ["whole_body"]; if (!regs.includes(V.region)) return false; }
    if (V.concern) { if (it.kind === "entry") return it.e.concern_id === V.concern; if (it.kind === "reg") return it.r.concern_id === V.concern; return false; }
    return true;
  }).sort((a, b) => (a.d < b.d ? 1 : -1));
}

export function TimelineList(props: { items: Item[]; title?: string }) {
  const t = useT();
  let cur = "";
  const out: React.ReactNode[] = [];
  props.items.forEach((it, i) => {
    const d = pd(it.d), k = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (k !== cur) { out.push(<Text key={"m" + k} style={{ fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: t.muted, fontFamily: t.fontUIBold, marginTop: i ? 14 : 0, marginBottom: 6 }}>{k}</Text>); cur = k; }
    out.push(<ItemRow key={i} it={it} />);
  });
  return <Card>{props.title ? <CardH title={props.title} sub={out.length ? String(props.items.length) : ""} /> : null}{out.length ? out : <Empty>Nothing here yet.</Empty>}</Card>;
}

export function ItemRow(props: { it: Item }) {
  const h = useHealth();
  const t = useT();
  const it = props.it;
  if (it.kind === "entry") return <EntryRow e={it.e} />;
  const row = (k: string, onPress: () => void, title: string, bits: React.ReactNode, d: string) => (
    <Pressable onPress={onPress} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 8, paddingHorizontal: 8 }} accessibilityRole="button">
      <TypeIco k={k} />
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ fontFamily: t.fontUIBold, color: t.ink, fontSize: 14 }}>{title}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 2 }}>{bits}</View></View>
      <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontData }}>{fmtShort(d)}</Text>
    </Pressable>
  );
  if (it.kind === "lab") {
    const fl = it.l.results.filter((r) => r.flag).length, lab = isLab(it.l);
    return row(reportIcon(it.l), () => openLab(h, it.l.id), lab ? `Lab report, ${it.l.lab}` : reportTitle(it.l), <><Sub>{lab ? `${it.l.results.length} results${fl ? ` · ${fl} flagged by the lab` : ""}` : [kindName(reportKind(it.l)), it.l.lab].filter(Boolean).join(" · ")}</Sub>{it.l.file ? <Pill kind="src">File</Pill> : null}</>, it.d);
  }
  if (it.kind === "reg") return row(it.r.category === "diet" ? "diet" : "regimen", () => openRegimen(h, it.r), `${it.edge === "start" ? "Started" : "Stopped"}: ${it.r.name}`, <><Sub>{catLabel(it.r.category)}{it.r.dose ? ` · ${it.r.dose}` : ""}</Sub>{it.edge === "start" && !it.r.ended_on && stintsOf(it.r)[stintsOf(it.r).length - 1].from === it.d ? <Pill kind="up">Ongoing</Pill> : null}</>, it.d);
  return row("challenge", () => h.go("plan", { exp: it.c.id }), `Challenge started: ${it.c.title}`, <Sub>{it.c.days ? it.c.days + " days" : EXP_LABEL[expKind(it.c)]}</Sub>, it.d);
}
