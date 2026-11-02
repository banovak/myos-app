// Log a cycle day: flow, symptoms, note. Manual wins over imports.
import { useState } from "react";
import { View } from "react-native";
import { today } from "../model/dates";
import { FLOW, SRC_NAME, SYMPTOMS } from "../model/vocab";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, Chip, Chips, DateField, Field, Input, P, SheetH, TypeIco } from "../ui";

export function openCycleDay(h: Health, date?: string): void { h.openSheet(<CycleDayForm date={date || today()} />); }

function CycleDayForm(props: { date: string }) {
  const h = useHealth();
  const { D } = h;
  const [d, setD] = useState(props.date);
  const cur = (D.cycle || []).find((c) => c.on_date === d && c.source === "manual") || { flow: "none", symptoms: [] as string[], note: "" };
  const imp = (D.cycle || []).find((c) => c.on_date === d && c.source !== "manual");
  const [flow, setFlow] = useState<string>(cur.flow || "none");
  const [sym, setSym] = useState<Set<string>>(new Set(cur.symptoms || []));
  const [nw, setNw] = useState("");
  const [note, setNote] = useState(cur.note || "");
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="Cycle day" icon={<TypeIco k="cycle" small />} onClose={h.closeSheet} />
      <Field label="Date"><DateField value={d} onChange={(v) => { setD(v); const c = (D.cycle || []).find((x) => x.on_date === v && x.source === "manual"); setFlow(c?.flow || "none"); setSym(new Set(c?.symptoms || [])); setNote(c?.note || ""); }} /></Field>
      {imp ? <P>Also recorded by {SRC_NAME[imp.source] || imp.source}: {imp.flow}. What you enter here is shown instead.</P> : null}
      <Field label="Flow"><Chips>{FLOW.map(([v, l]) => <Chip key={v} label={l} on={flow === v} onPress={() => setFlow(v)} />)}</Chips></Field>
      <Field label="Symptoms (optional)"><Chips>{[...new Set([...SYMPTOMS, ...sym])].map((s) => <Chip key={s} label={s} on={sym.has(s)} onPress={() => setSym((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; })} />)}</Chips><Input value={nw} onChange={setNw} placeholder="Add another symptom" /></Field>
      <Field label="Note (optional)"><Input value={note} onChange={setNote} multiline /></Field>
      <Acts right={<Btn kind="accent" label="Save" onPress={() => {
        const s = new Set(sym); const extra = nw.trim(); if (extra) s.add(extra);
        h.mutate((D) => { D.cycle = (D.cycle || []).filter((c) => !(c.on_date === d && c.source === "manual")); if (flow !== "none" || s.size || note.trim()) D.cycle.push({ on_date: d, source: "manual", flow: flow as any, symptoms: [...s], note: note.trim(), source_ref: null }); });
        h.closeSheet();
      }} />} />
    </View>
  );
}
