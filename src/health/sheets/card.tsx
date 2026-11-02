// The health card: blood type, allergies, vaccinations, conditions, providers,
// emergency contacts, plus current medications from Lifestyle.
import { useState } from "react";
import { Text, View } from "react-native";
import { regimenActive } from "../model/regimens";
import type { HealthCard } from "../model/types";
import { BLOOD, CARD_SECS } from "../model/vocab";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, DateField, Field, Input, P, PlusBtn, Row, RowText, Sec, Seg, Select, SheetH, useT } from "../ui";
import { setUnit, unitPref } from "../model/units";
import { activeProviders } from "../model/providers";
import { ProviderAvatar, openProvider, openProviderAdd } from "./providers";

export function openCard(h: Health): void { h.openSheet(<CardForm />); }

function CardForm() {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const [c, setC] = useState<HealthCard>(() => JSON.parse(JSON.stringify(D.settings.card || {})));
  const meds = D.regimens.filter((r) => (r.category === "medication" || r.category === "supplement") && regimenActive(r));
  const units = unitPref(D);
  const rows = (k: string) => ((c as any)[k] as Record<string, string>[] | undefined) || [];
  const setRow = (k: string, i: number, f: string, v: string) => setC((p) => ({ ...p, [k]: rows(k).map((r, j) => (j === i ? { ...r, [f]: v } : r)) }));
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="Health card" onClose={h.closeSheet} />
      <P>The fixed facts about you. Things that change over time, like weight, stay as measurements.</P>
      <Field label="Blood type"><Select value={c.blood || ""} options={BLOOD.map((b) => [b, b || "–"])} onChange={(v) => setC((p) => ({ ...p, blood: v }))} /></Field>
      <Field label="Preferred units" hint="How weight and height are entered and shown everywhere, charts included. Underneath they are kept in kilograms and centimetres, so switching changes nothing.">
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>Weight</Text><Seg small value={units.weight} options={[["kg", "Kilograms"], ["lb", "Pounds"]]} onChange={(v) => h.mutate((D) => setUnit(D, "weight", v as "kg" | "lb"))} /></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>Height</Text><Seg small value={units.height} options={[["cm", "Centimetres"], ["ft", "Feet, inches"]]} onChange={(v) => h.mutate((D) => setUnit(D, "height", v as "cm" | "ft"))} /></View>
        </View>
      </Field>
      {CARD_SECS.map(([k, l, fields]) => k === "providers" ? <ProvidersSection key={k} /> : (
        <View key={k}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Sec>{l}</Sec><PlusBtn label={"Add to " + l.toLowerCase()} onPress={() => setC((p) => ({ ...p, [k]: [...rows(k), {}] }))} /></View>
          <View style={{ gap: 8 }}>{rows(k).map((r, i) => (
            <View key={i} style={{ backgroundColor: t.soft, borderRadius: 12, padding: 10, gap: 6 }}>
              {fields.map(([fk, fl, ft, fo]) => ft === "select" ? <Select key={fk} value={r[fk] || ""} options={fo!} onChange={(v) => setRow(k, i, fk, v)} /> : ft === "date" ? <DateField key={fk} value={r[fk] || ""} onChange={(v) => setRow(k, i, fk, v)} clearable placeholder={fl} /> : <Input key={fk} value={r[fk] || ""} onChange={(v) => setRow(k, i, fk, v)} placeholder={fl} />)}
              <Btn small label="Remove" onPress={() => setC((p) => ({ ...p, [k]: rows(k).filter((_, j) => j !== i) }))} />
            </View>
          ))}</View>
        </View>
      ))}
      <Sec>Current medications and supplements</Sec>
      <View style={{ gap: 8 }}>{meds.length ? meds.map((r) => <Row key={r.id}><RowText title={r.name} sub={[r.dose, r.frequency].filter(Boolean).join(" · ")} /></Row>) : <Text style={{ color: t.muted, fontSize: 13, fontFamily: t.fontUI }}>None active. These come from Lifestyle.</Text>}</View>
      <Acts right={<Btn kind="accent" label="Save" onPress={() => { const out: HealthCard = { blood: c.blood }; CARD_SECS.forEach(([k]) => { (out as any)[k] = rows(k).map((r) => Object.fromEntries(Object.entries(r).map(([a, b]) => [a, (b || "").trim()]))).filter((o) => Object.values(o).some(Boolean)); }); h.mutate((D) => { D.settings.card = { ...out, providers: (D.settings.card || {}).providers || [] }; }); h.closeSheet(); }} />} />
    </View>
  );
}

/** the active providers, collapsed to name and role; the details live on each one's page */
function ProvidersSection() {
  const h = useHealth();
  const t = useT();
  const ps = activeProviders(h.D);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Sec>Active providers</Sec><PlusBtn label="Add a provider" onPress={() => openProviderAdd(h, "card")} /></View>
      <View style={{ gap: 8 }}>{ps.length ? ps.map((p) => <Row key={p.id} onPress={() => openProvider(h, p.id)}><ProviderAvatar p={p} size={36} /><RowText title={p.name} sub={[p.role, p.practice].filter(Boolean).join(" · ")} /></Row>) : <Text style={{ color: t.muted, fontSize: 13, fontFamily: t.fontUI }}>None yet. Everyone you see, so appointments can pick them.</Text>}</View>
    </View>
  );
}
