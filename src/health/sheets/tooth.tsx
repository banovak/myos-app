// One tooth: what's true of it now, since when, a note, and its history.
import { useState } from "react";
import { Text, View } from "react-native";
import { today } from "../model/dates";
import { TOOTH_STATUS, teethData, toothEntries, toothLabel } from "../model/teeth";
import type { ToothStatus } from "../model/types";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, Chip, Chips, DateField, Field, Input, P, Sec, SheetH, useT } from "../ui";
import { EntryRow } from "../components/EntryRow";
import { openForm } from "./entryForm";

export function openTooth(h: Health, n: number): void { h.openSheet(<ToothSheet n={n} />); }

function ToothSheet(props: { n: number }) {
  const h = useHealth();
  const t = useT();
  const n = props.n, cur = teethData(h.D)[n] || { s: [], since: "", note: "" };
  const [sel, setSel] = useState<Set<ToothStatus>>(new Set(cur.s));
  const [since, setSince] = useState(cur.since || "");
  const [note, setNote] = useState(cur.note || "");
  const es = toothEntries(h.D, n);
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={toothLabel(h.D, n)} onClose={h.closeSheet} />
      <Field label="What's true of it now (pick any)" hint="Nothing picked means healthy, as far as you know.">
        <Chips>{TOOTH_STATUS.map(([k, l, c]) => <Chip key={k} label={l} dot={c || t.muted} on={sel.has(k)} onPress={() => setSel((p) => { const s = new Set(p); s.has(k) ? s.delete(k) : s.add(k); return s; })} />)}</Chips>
      </Field>
      <Field label="Since"><DateField value={since} onChange={setSince} clearable placeholder="–" /></Field>
      <Field label="Note (optional)"><Input value={note} onChange={setNote} multiline placeholder="Composite filling, sensitive to cold" /></Field>
      <Acts left={<Btn label="+ Dental visit for this tooth" onPress={() => openForm(h, "appointment", { regions: ["teeth"], title: "Dentist", details: { kind: "dentist", status: "done", tooth: String(n) } })} />} right={<Btn kind="accent" label="Save" onPress={() => {
        h.mutate((D) => { const td = (D.settings.teeth = D.settings.teeth && typeof D.settings.teeth === "object" ? D.settings.teeth : {}); const nn = note.trim(); if (sel.size || nn) td[String(n)] = { s: [...sel], since: since || (sel.size && !cur.since ? today() : since), note: nn }; else delete td[String(n)]; });
        h.closeSheet();
      }} />} />
      <Sec>History</Sec>
      {es.length ? es.map((e) => <EntryRow key={e.id} e={e} />) : <P>Nothing logged for this tooth yet. Dental visits with this tooth number show up here.</P>}
    </View>
  );
}
