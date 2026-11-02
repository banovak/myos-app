// Bits shared by several sheets: the region chips, the concern select with
// "start a new concern", the metric chips, a one-line alert.
import { useState } from "react";
import { Text, View } from "react-native";
import { uid } from "../model/dates";
import type { D } from "../model/types";
import { REG, childRegions, topRegions } from "../model/vocab";
import { useHealth, type Health } from "../state/HealthContext";
import { Chip, Chips, Field, Input, P, Select, SheetH, useT } from "../ui";

/** the regions of the body; a chosen region's points come up under it. A point goes with its region */
export function RegionChips(props: { value: Set<string>; onChange: (s: Set<string>) => void }) {
  const h = useHealth();
  const t = useT();
  const D = h.D, regs = REG(D);
  const top = topRegions(D, props.value);
  const kids = (r: string) => childRegions(D, r);
  const pick = (k: string, parent?: string) => {
    const n = new Set(props.value);
    if (n.has(k)) { n.delete(k); kids(k).forEach((c) => n.delete(c)); }
    else { n.add(k); if (parent) n.add(parent); }
    props.onChange(n);
  };
  const open = top.filter((k) => { const c = kids(k); return c.length && (props.value.has(k) || c.some((x) => props.value.has(x))); });
  return (
    <View style={{ gap: 6 }}>
      <Chips>{top.map((k) => <Chip key={k} label={regs[k] || k} on={props.value.has(k)} onPress={() => pick(k)} />)}</Chips>
      {open.map((k) => (
        <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={{ fontSize: 11.5, color: t.muted, fontFamily: t.fontUISemi }}>{regs[k] || k} ›</Text>
          {kids(k).map((c) => <Chip key={c} small label={regs[c] || c} on={props.value.has(c)} onPress={() => pick(c, k)} />)}
        </View>
      ))}
    </View>
  );
}
export function ConcernSelect(props: { value: string; onChange: (v: string) => void; newName: string; onNewName: (v: string) => void }) {
  const h = useHealth();
  const opts: [string, string][] = [["", "None"], ...h.D.concerns.map((c) => [c.id, c.title + (c.status === "resolved" ? " (resolved)" : "")] as [string, string]), ["__new", "Start a new concern…"]];
  return (
    <>
      <Field label="Concern"><Select value={props.value} options={opts} onChange={props.onChange} /></Field>
      {props.value === "__new" ? <Field label="New concern name"><Input value={props.newName} onChange={props.onNewName} placeholder="e.g. Eczema, inner elbow" /></Field> : null}
    </>
  );
}
/** resolves the concern select: creates the new concern in D when asked */
export function resolveConcern(D: D, val: string, newName: string, regs: Set<string>, date: string): { id: string | null; err?: string } {
  if (val !== "__new") return { id: val || null };
  const n = newName.trim();
  if (!n) return { id: null, err: "Name the new concern." };
  const id = "c-" + uid();
  D.concerns.push({ id, title: n, regions: [...regs], started_on: date, resolved_on: null, status: "active", tracking: {} });
  return { id };
}
export function MetricChips(props: { value: Set<string>; onChange: (s: Set<string>) => void }) {
  const h = useHealth();
  return <Chips>{Object.entries(h.D.metrics).map(([mk, m]) => <Chip key={mk} label={m.l} on={props.value.has(mk)} onPress={() => { const n = new Set(props.value); n.has(mk) ? n.delete(mk) : n.add(mk); props.onChange(n); }} />)}</Chips>;
}
export function useArmed(): [boolean, () => boolean] {
  const [armed, setArmed] = useState(false);
  return [armed, () => { if (armed) return true; setArmed(true); return false; }];
}
export function alertSheet(h: Health, title: string, msg: string): void {
  h.openSheet(<AlertBody title={title} msg={msg} />);
}
function AlertBody(props: { title: string; msg: string }) {
  const h = useHealth();
  return <View><SheetH title={props.title} onClose={h.closeSheet} /><P style={{ marginBottom: 0 }}>{props.msg}</P></View>;
}
export function Hint(props: { children: string }) {
  const t = useT();
  return <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI, lineHeight: 17 }}>{props.children}</Text>;
}
