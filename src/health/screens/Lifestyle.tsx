// Lifestyle: the current diet, the active regimens, and the Archive of
// everything stopped (diets too), with a toggle by kind and a search. Each
// card has its colour, its stints and its adherence line; an archived one can
// be started again, which adds a stint to the same record.
import { Pressable, Text, View } from "react-native";
import { fmtShort, span, today } from "../model/dates";
import { regColor, regimenStopped, stintsOf } from "../model/regimens";
import type { Photo, Regimen } from "../model/types";
import { catLabel } from "../model/vocab";
import { useHealth } from "../state/HealthContext";
import { colorOf } from "../theme";
import { Btn, Card, CardH, Empty, InfoBtn, Input, PageH, PlusBtn, Seg, useT } from "../ui";
import { RegAdh } from "../components/Widgets";
import { Lightbox, PhotoView } from "../components/PhotoView";
import { useState } from "react";
import { openRegimen } from "../sheets";

function RegCard(props: { r: Regimen; archived?: boolean }) {
  const h = useHealth();
  const t = useT();
  const r = props.r, col = colorOf(r.color, t, regColor({}));
  const [look, setLook] = useState<Photo | null>(null);
  return (
    <View style={{ backgroundColor: t.soft, borderRadius: 16, padding: 14, gap: 6, borderLeftWidth: 4, borderLeftColor: col }}>
      <Pressable onPress={() => openRegimen(h, r)} style={{ gap: 4 }} accessibilityRole="button">
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: col }} /><Text style={{ fontFamily: t.fontUIBold, color: t.ink, fontSize: 14 }}>{r.name}</Text></View>
        <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{catLabel(r.category)}{r.dose ? ` · ${r.dose}` : ""}{r.frequency ? ` · ${r.frequency}` : ""}</Text>
        {stintsOf(r).map((p, i) => <Text key={i} style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{fmtShort(p.from)} – {p.to ? fmtShort(p.to) : "ongoing"} · {span(p.from, p.to)}</Text>)}
      </Pressable>
      {r.photos && r.photos.length ? <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>{r.photos.map((p, i) => <PhotoView key={p.path || p.src || i} photo={p} style={{ width: 56, height: 56 }} radius={10} onPress={() => setLook(p)} />)}</View> : null}
      <RegAdh r={r} />
      {props.archived ? <View style={{ flexDirection: "row", marginTop: 2 }}><Btn small label="Start again" onPress={() => openRegimen(h, r, { again: true })} /></View> : null}
      <Lightbox photo={look} onClose={() => setLook(null)} />
    </View>
  );
}

export function LifestyleScreen() {
  const h = useHealth();
  const D = h.D, T = today();
  // current: not stopped as of today (a future stop date keeps it where it is until then)
  const current = (r: Regimen) => !regimenStopped(r, T);
  const diets = D.regimens.filter((r) => r.category === "diet" && current(r)).sort((a, b) => (a.started_on < b.started_on ? 1 : -1));
  const act = D.regimens.filter((r) => r.category !== "diet" && current(r));
  const [kind, setKind] = useState<"all" | "diet" | "reg">("all");
  const [q, setQ] = useState("");
  const past = D.regimens.filter((r) => !current(r)).sort((a, b) => ((a.ended_on || "") < (b.ended_on || "") ? 1 : -1));
  const needle = q.trim().toLowerCase();
  const shown = past.filter((r) => (kind === "all" || (kind === "diet") === (r.category === "diet")) && (!needle || [r.name, r.dose, r.frequency, r.notes, catLabel(r.category)].join(" ").toLowerCase().includes(needle)));
  return (
    <View style={{ gap: 16 }}>
      <PageH title="Lifestyle" right={<InfoBtn title="Diet and regimens" text={"Your diet is how you eat, in your own words, for a stretch of time. One at a time: setting a new one ends the last. Nutrition numbers can come from MyFitnessPal through Apple Health.\n\nA regimen is anything you do on a schedule: a supplement, a medication, a skin or hair product, an activity. Several can run at once, and each keeps its own record of the days you ticked it off."} />} />
      <Card><CardH title="Diet" right={<PlusBtn label="Set a diet" onPress={() => openRegimen(h, { category: "diet" })} />} /><View style={{ gap: 10 }}>{diets.length ? diets.map((r) => <RegCard key={r.id} r={r} />) : <Empty>No current diet.</Empty>}</View></Card>
      <Card><CardH title="Active regimens" sub={String(act.length)} right={<PlusBtn label="Add a regimen" onPress={() => openRegimen(h, {})} />} /><View style={{ gap: 10 }}>{act.length ? act.map((r) => <RegCard key={r.id} r={r} />) : <Empty>Nothing active.</Empty>}</View></Card>
      <Card>
        <CardH title="Archive" sub={String(past.length)} />
        {past.length ? (
          <View style={{ gap: 8, marginBottom: 10 }}>
            <Seg small value={kind} options={[["all", "All"], ["diet", "Diets"], ["reg", "Regimens"]]} onChange={(v) => setKind(v as typeof kind)} />
            <Input value={q} onChange={setQ} placeholder="Find by name, dose or notes" autoCapitalize="none" />
          </View>
        ) : null}
        <View style={{ gap: 10 }}>{shown.length ? shown.map((r) => <RegCard key={r.id} r={r} archived />) : <Empty>{past.length ? "Nothing matches." : "Nothing stopped yet."}</Empty>}</View>
      </Card>
    </View>
  );
}
