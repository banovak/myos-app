// Concerns, laid out like Lifestyle: what is live at the top, the Archive at
// the bottom. General (anchored to a place on the body, one stretch
// each), then Illnesses (anchored to time: a group such as Viral or Lupus, a
// bout at a time), then the Archive of resolved concerns with a search. A
// course of care belongs to a concern or an illness and lives on its page; any
// left unattached are listed last with a nudge to tie them to something.
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { fmt, fmtShort } from "../model/dates";
import { episodeTitle, episodesOf, illnessColor, isIllness, sickDaysThisYear, sickOn } from "../model/illness";
import type { Concern } from "../model/types";
import { rl } from "../model/vocab";
import { useHealth } from "../state/HealthContext";
import { colorOf } from "../theme";
import { Btn, Card, CardH, Empty, InfoBtn, Input, PageH, Pill, PlusBtn, useT } from "../ui";
import { CourseCard } from "../components/CourseCard";
import { ConcernBody } from "../sheets/concern";
import { openConcernNew, openCourseForm, openIllnessNew } from "../sheets";

const INFO = "A concern is something you are keeping an eye on: a mole, hair thinning, knee pain. It sits on a place on the body and has one stretch, from when you noticed it until you mark it resolved.\n\nAn illness comes in bouts: a cold, a stomach bug, a flare-up. One record per kind (Viral, Bacterial, or a condition of your own, like Lupus), an episode each time, so you can see how often and how long.\n\nA course of care is recurring treatment for one of these: physio, laser sessions, a specialist. Add it from the concern's or illness's page, and it lives there.";

/** a concern as a card: its colour bar, name, areas, dates, what it holds */
function ConcernCard(props: { c: Concern }) {
  const h = useHealth();
  const t = useT();
  const { D } = h, c = props.c, ill = isIllness(c);
  const col = ill ? colorOf(illnessColor(D, c), t, t.tint("illness")) : t.tint("observation");
  const n = D.entries.filter((e) => e.concern_id === c.id).length, ks = D.courses.filter((k) => k.concern_id === c.id).length;
  const bits = (xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" · ");
  let line1 = "", line2 = "";
  if (ill) {
    const eps = episodesOf(c), lastEp = eps[eps.length - 1], days = sickDaysThisYear(c);
    line1 = bits([`${eps.length} ${eps.length === 1 ? "episode" : "episodes"}`, `${days} ${days === 1 ? "day" : "days"} this year`, c.regions.length ? c.regions.map((r) => rl(D, r)).join(", ") : ""]);
    line2 = lastEp ? `Last: ${episodeTitle(c, lastEp)}, ${fmtShort(lastEp.from)}${lastEp.to ? ` – ${fmtShort(lastEp.to)}` : ", still on"}` : "";
  } else {
    line1 = bits([c.regions.length ? c.regions.map((r) => rl(D, r)).join(", ") : "", c.started_on ? `since ${fmt(c.started_on)}` : "", c.resolved_on ? `resolved ${fmt(c.resolved_on)}` : ""]);
    line2 = bits([`${n} ${n === 1 ? "entry" : "entries"}`, ks ? `${ks} ${ks === 1 ? "course of care" : "courses of care"}` : ""]);
  }
  const pill = ill ? (sickOn(c) ? ["up", "Sick now"] : ["mut", "Well"]) : c.status === "resolved" ? ["mut", "Resolved"] : ["up", "Active"];
  return (
    <Pressable onPress={() => h.setV({ concernPage: c.id })} accessibilityRole="button" style={{ backgroundColor: t.soft, borderRadius: 16, padding: 14, gap: 4, borderLeftWidth: 4, borderLeftColor: col }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: col }} />
        <Text style={{ flex: 1, fontFamily: t.fontUIBold, color: t.ink, fontSize: 14 }}>{c.title}</Text>
        <Pill kind={pill[0] as "up" | "mut"}>{pill[1]}</Pill>
      </View>
      {line1 ? <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{line1}</Text> : null}
      {line2 ? <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{line2}</Text> : null}
    </Pressable>
  );
}

export function ConcernsScreen() {
  const h = useHealth();
  const t = useT();
  const { D, V } = h;
  const [q, setQ] = useState("");
  if (V.concernPage) return <ConcernPage id={V.concernPage} />;
  const general = D.concerns.filter((c) => !isIllness(c));
  const active = general.filter((c) => c.status !== "resolved").sort((a, b) => ((a.started_on || "") < (b.started_on || "") ? 1 : -1));
  const ills = D.concerns.filter(isIllness).sort((a, b) => (sickOn(b) as any) - (sickOn(a) as any) || ((a.resolved_on || "9999") < (b.resolved_on || "9999") ? 1 : -1));
  const past = general.filter((c) => c.status === "resolved").sort((a, b) => ((a.resolved_on || "") < (b.resolved_on || "") ? 1 : -1));
  const needle = q.trim().toLowerCase();
  const shown = past.filter((c) => !needle || [c.title, c.notes || "", ...c.regions.map((r) => rl(D, r))].join(" ").toLowerCase().includes(needle));
  const loose = D.courses.filter((k) => !k.concern_id || !D.concerns.some((c) => c.id === k.concern_id));
  const sick = ills.filter((c) => sickOn(c)).length;
  return (
    <View style={{ gap: 16 }}>
      <PageH title="Concerns" right={<InfoBtn title="Concerns, illnesses and courses of care" text={INFO} />} />
      <Card>
        <CardH title="General" sub={String(active.length)} right={<PlusBtn label="Add a concern" onPress={() => openConcernNew(h)} />} />
        <View style={{ gap: 10 }}>{active.length ? active.map((c) => <ConcernCard key={c.id} c={c} />) : <Empty>Nothing you are keeping an eye on right now.</Empty>}</View>
      </Card>
      <Card>
        <CardH title="Illnesses" sub={ills.length ? (sick ? `${ills.length} · ${sick} sick now` : String(ills.length)) : ""} right={<PlusBtn label="Add an illness" onPress={() => openIllnessNew(h)} />} />
        <View style={{ gap: 10 }}>{ills.length ? ills.map((c) => <ConcernCard key={c.id} c={c} />) : <Empty>Nothing yet. A cold, a bug, a flare-up: each bout is dated, so you can see how often and how long.</Empty>}</View>
      </Card>
      <Card>
        <CardH title="Archive" sub={String(past.length)} />
        {past.length > 3 ? <View style={{ marginBottom: 10 }}><Input value={q} onChange={setQ} placeholder="Find by name, area or notes" autoCapitalize="none" /></View> : null}
        <View style={{ gap: 10 }}>{shown.length ? shown.map((c) => <ConcernCard key={c.id} c={c} />) : <Empty>{past.length ? "Nothing matches." : "Nothing resolved yet."}</Empty>}</View>
      </Card>
      {loose.length ? (
        <Card>
          <CardH title="Courses of care not tied to anything" sub={String(loose.length)} />
          <Text style={{ fontSize: 12.5, color: t.muted, fontFamily: t.fontUI, marginBottom: 10 }}>A course of care belongs on a concern's or illness's page. Open one to pick what it treats.</Text>
          <View style={{ gap: 12 }}>{loose.map((k) => <View key={k.id} style={{ gap: 8 }}><CourseCard k={k} /><View style={{ flexDirection: "row" }}><Btn small label="Tie it to a concern" onPress={() => openCourseForm(h, k)} /></View></View>)}</View>
        </Card>
      ) : null}
    </View>
  );
}

function ConcernPage(props: { id: string }) {
  const h = useHealth();
  const t = useT();
  return (
    <View style={{ gap: 14 }}>
      <Pressable onPress={() => h.setV({ concernPage: null })} style={{ alignSelf: "flex-start" }} accessibilityRole="button"><Text style={{ fontFamily: t.fontUIBold, color: t.ink, textDecorationLine: "underline" }}>‹ Concerns</Text></Pressable>
      <Card><ConcernBody id={props.id} /></Card>
    </View>
  );
}
