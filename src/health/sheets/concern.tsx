// A concern in full (its check-in plan, photos, courses of care and regimens,
// everything recorded): the body of its page on the Concerns tab. Also the
// new-concern sheet and the check-in sheet.
import { useState } from "react";
import { Text, View } from "react-native";
import { ago, fmt, fmtShort, today, uid } from "../model/dates";
import { episodeDays, episodeTitle, episodesOf, episodesThisYear, illnessColor, isIllness, openEpisode as openEp, sickDaysThisYear, sickOn } from "../model/illness";
import { dueMetrics, tracked } from "../model/reminders";
import { fmtM, metric, mkind } from "../model/series";
import type { Concern, MetricKind } from "../model/types";
import { KIND_OPTS, PER_LABEL, rl } from "../model/vocab";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, DateField, Err, Field, Half, Input, P, Pill, Row, RowText, Sec, Select, SheetH, Two, TypeIco, ValInput, emptyVal, readVal, useT, Chips } from "../ui";
import { PhotoView } from "../components/PhotoView";
import { EntryRow } from "../components/EntryRow";
import { RemindBtn } from "../components/Widgets";
import { CourseCard } from "../components/CourseCard";
import { openRegimen } from "./regimen";
import { openForm } from "./entryForm";
import { openBeforeConcern, openEntry } from "./entryView";
import { endEpisodeToday, openEpisode } from "./illness";
import { openCourseForm } from "./plan";
import { MetricChips, RegionChips, alertSheet, useArmed } from "./common";
import { PaletteRows } from "../screens/Charts";
import { colorOf } from "../theme";

/** a concern's page, on the Concerns tab */
export function openConcern(h: Health, id: string): void { h.closeSheet(); h.go("concerns", { concernPage: id }); }
export function openConcernNew(h: Health): void { h.openSheet(<ConcernNew />); }
export function openCheckin(h: Health, ids?: string[]): void {
  const tr = tracked(h.D);
  const cs = (ids && ids.length ? ids.map((i) => h.D.concerns.find((c) => c.id === i)) : tr.some((c) => dueMetrics(h.D, c).length) ? tr.filter((c) => dueMetrics(h.D, c).length) : tr).filter((c): c is Concern => !!c && ((c.tracking || {}).metrics || []).length > 0);
  if (!cs.length) return alertSheet(h, "Nothing to check in yet", "Open a concern and choose Set up under Check-in plan to pick what you want to track and how often.");
  h.openSheet(<Checkin ids={cs.map((c) => c.id)} />);
}

export function ConcernBody(props: { id: string }) {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const c = D.concerns.find((x) => x.id === props.id);
  const [planEdit, setPlanEdit] = useState(false);
  const [edit, setEdit] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set((c?.tracking || {}).metrics || []));
  const [peNew, setPeNew] = useState(""); const [peK, setPeK] = useState<MetricKind>("number"); const [peU, setPeU] = useState(""); const [pePer, setPePer] = useState((c?.tracking || {}).per || "week");
  const [eT, setET] = useState(c?.title || ""); const [eS, setES] = useState(c?.started_on || ""); const [eN, setEN] = useState(c?.notes || "");
  const [armed, arm] = useArmed();
  if (!c) return <P>This concern was removed.</P>;
  const es = D.entries.filter((e) => e.concern_id === c.id).sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  const regs = D.regimens.filter((r) => r.concern_id === c.id), ks = D.courses.filter((k) => k.concern_id === c.id);
  const photos = es.filter((e) => e.photos.length && e.details.series !== "body");
  const last = es[0], tr = c.tracking || {}, due = dueMetrics(D, c);
  // an illness: episodes instead of one stretch; sick now or well instead of active or resolved
  const ill = isIllness(c), eps = ill ? episodesOf(c) : [], open = ill ? openEp(c) : undefined, col = ill ? colorOf(illnessColor(D, c), t, t.tint("illness")) : "";
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><TypeIco k={ill ? "illness" : "observation"} /><Text style={{ flex: 1, fontSize: 22, fontFamily: t.fontUIHeavy, color: t.ink, letterSpacing: -0.4 }}>{c.title}</Text>{ill ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: col }} /> : null}</View>
      <Chips>{ill ? <Pill kind={sickOn(c) ? "up" : "mut"}>{sickOn(c) ? "Sick now" : "Well"}</Pill> : <Pill kind={c.status === "resolved" ? "mut" : "up"}>{c.status === "resolved" ? "Resolved" : "Active"}</Pill>}{c.regions.map((r) => <Pill key={r}>{rl(D, r)}</Pill>)}</Chips>
      <View style={{ gap: 4 }}>
        {ill ? (
          <>
            <Text style={{ fontSize: 13.5, color: t.ink, fontFamily: t.fontUI }}><Text style={{ color: t.muted, fontFamily: t.fontUISemi }}>Episodes </Text>{eps.length}{c.started_on ? ` · first ${fmt(c.started_on)}` : ""}</Text>
            <Text style={{ fontSize: 13.5, color: t.ink, fontFamily: t.fontUI }}><Text style={{ color: t.muted, fontFamily: t.fontUISemi }}>This year </Text>{sickDaysThisYear(c)} {sickDaysThisYear(c) === 1 ? "day" : "days"} in {episodesThisYear(c)} {episodesThisYear(c) === 1 ? "episode" : "episodes"}</Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 13.5, color: t.ink, fontFamily: t.fontUI }}><Text style={{ color: t.muted, fontFamily: t.fontUISemi }}>Since </Text>{c.started_on ? fmt(c.started_on) : "–"}</Text>
            {c.resolved_on ? <Text style={{ fontSize: 13.5, color: t.ink, fontFamily: t.fontUI }}><Text style={{ color: t.muted, fontFamily: t.fontUISemi }}>Resolved </Text>{fmt(c.resolved_on)}</Text> : null}
          </>
        )}
        <Text style={{ fontSize: 13.5, color: t.ink, fontFamily: t.fontUI }}><Text style={{ color: t.muted, fontFamily: t.fontUISemi }}>Entries </Text>{es.length}{last ? ` · last ${ago(last.occurred_at)}` : ""}</Text>
        {c.notes ? <Text style={{ fontSize: 13.5, color: t.ink, fontFamily: t.fontUI }}><Text style={{ color: t.muted, fontFamily: t.fontUISemi }}>Notes </Text>{c.notes}</Text> : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ill ? <Btn kind="accent" small label="+ Episode" onPress={() => openEpisode(h, c.id, null)} /> : <Btn kind="accent" small label="+ Check in" onPress={() => ((tr.metrics || []).length ? openCheckin(h, [c.id]) : openForm(h, "observation", { concern_id: c.id, regions: c.regions, title: "" }))} />}
        {ill && open ? <Btn small label="Better today" onPress={() => endEpisodeToday(h, c.id)} /> : null}
        {ill ? <Btn small label="+ Note" onPress={() => openForm(h, "observation", { concern_id: c.id, regions: c.regions, title: "" })} /> : null}
        <Btn small label="+ Photo" onPress={() => { if (!h.needVault()) openForm(h, "photo", { concern_id: c.id, regions: c.regions }); }} />
        {!ill ? <Btn small label={c.status === "resolved" ? "Reopen" : "Mark resolved"} onPress={() => h.mutate((D) => { const cc = D.concerns.find((x) => x.id === c.id)!; cc.status = cc.status === "resolved" ? "active" : "resolved"; cc.resolved_on = cc.status === "resolved" ? today() : null; })} /> : null}
        {es.filter((x) => x.type === "observation").length > 1 ? <Btn small label="What came before" onPress={() => openBeforeConcern(h, c.id)} /> : null}
        <Btn small label="In History" onPress={() => h.go("history", { concern: c.id, type: "all" })} />
        <Btn small label="Edit" onPress={() => setEdit((v) => !v)} />
      </View>
      {edit ? (
        <View style={{ gap: 10, backgroundColor: t.soft, borderRadius: 14, padding: 12 }}>
          <Field label="Name"><Input value={eT} onChange={setET} /></Field>{!ill ? <Field label="Since"><DateField value={eS} onChange={setES} /></Field> : null}<Field label="Notes"><Input value={eN} onChange={setEN} multiline /></Field>
          {ill ? <Field label="Colour on charts and History"><PaletteRows current={c.color || undefined} onPick={(colr) => h.mutate((D) => { const cc = D.concerns.find((x) => x.id === c.id); if (cc) cc.color = colr; })} /></Field> : null}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Btn kind="accent" small label="Save" onPress={() => { if (!eT.trim()) return; h.mutate((D) => { const cc = D.concerns.find((x) => x.id === c.id)!; cc.title = eT.trim(); if (!ill) cc.started_on = eS || cc.started_on; cc.notes = eN; }); setEdit(false); }} />
            {ill ? <Btn small label={armed ? "Tap again to delete" : "Delete illness"} onPress={() => { if (!arm()) return; h.mutate((D) => { D.concerns = D.concerns.filter((x) => x.id !== c.id); }); h.setV({ concernPage: null }); }} /> : null}
          </View>
        </View>
      ) : null}
      {ill ? (
        <View>
          <Sec>Episodes</Sec>
          {eps.length ? <View style={{ gap: 8 }}>{eps.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => (
            <Row key={i} onPress={() => openEpisode(h, c.id, i)}>
              <View style={{ width: 5, alignSelf: "stretch", borderRadius: 3, backgroundColor: col, marginRight: 10, opacity: e.to ? 0.55 : 1 }} />
              <RowText title={episodeTitle(c, e)} sub={`${fmtShort(e.from)} – ${e.to ? fmtShort(e.to) : "still on"} · ${episodeDays(e)} ${episodeDays(e) === 1 ? "day" : "days"}${e.notes ? " · " + e.notes : ""}`} />
              {!e.to ? <Pill kind="up">Now</Pill> : null}
            </Row>
          ))}</View> : <P>No episodes yet. Use + Episode to add the first.</P>}
        </View>
      ) : null}
      <Sec>Check-in plan</Sec>
      <Row style={{ alignItems: "flex-start" }}>
        {(tr.metrics || []).length ? <RowText title={tr.metrics!.filter((k) => D.metrics[k]).map((k) => metric(D, k).l).join(", ")} sub={`${PER_LABEL[tr.per || "week"]}${due.length ? " · due now" : " · done for now"}`} /> : <Text style={{ flex: 1, fontSize: 12.5, color: t.muted, fontFamily: t.fontUI }}>Pick the measures you want to track for this and how often. Check-ins then show up when they're due.</Text>}
        <Btn small label={(tr.metrics || []).length ? "Change" : "Set up"} onPress={() => setPlanEdit((v) => !v)} />
      </Row>
      {planEdit ? (
        <View style={{ gap: 10, backgroundColor: t.soft, borderRadius: 14, padding: 12 }}>
          <Field label="Measures to check in"><MetricChips value={sel} onChange={setSel} /></Field>
          <Two><Half><Field label="Or a new measure"><Input value={peNew} onChange={setPeNew} placeholder="e.g. Energy, lump size" /></Field></Half><Half><Field label="It's…"><Select value={peK} options={KIND_OPTS} onChange={(v) => setPeK(v as MetricKind)} /></Field></Half>
            <Half><Field label="Unit (numbers only)"><Input value={peU} onChange={setPeU} placeholder="mm, kg" /></Field></Half><Half><Field label="How often"><Select value={pePer} options={Object.entries(PER_LABEL) as [string, string][]} onChange={(v) => setPePer(v as any)} /></Field></Half></Two>
          <Btn kind="accent" small label="Save plan" onPress={() => { h.mutate((D) => { const s = new Set(sel); const nm = peNew.trim(); if (nm) { const mk = "x_" + uid(); D.metrics[mk] = peK === "rating" ? { l: nm, u: "/5", kind: "rating", rating: true } : { l: nm, u: peK === "number" ? peU.trim() : "", kind: peK }; s.add(mk); } const cc = D.concerns.find((x) => x.id === c.id)!; cc.tracking = s.size ? { metrics: [...s], per: pePer as any } : {}; }); setPlanEdit(false); setPeNew(""); }} />
        </View>
      ) : null}
      <RemindBtn kind="concern" id={c.id} />
      {photos.length ? <View><Sec>Photos</Sec><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{photos.slice(0, 12).map((e) => <PhotoView key={e.id} photo={e.photos[0]} date={e.occurred_at} style={{ width: 84, height: 100 }} onPress={() => openEntry(h, e.id)} />)}</View></View> : null}
      {regs.length ? <View><Sec>Regimens for this</Sec><View style={{ gap: 8 }}>{regs.map((r) => <Row key={r.id} onPress={() => openRegimen(h, r)}><RowText title={r.name} sub={`${[r.dose, r.frequency].filter(Boolean).join(" · ")} · ${fmtShort(r.started_on)} – ${r.ended_on ? fmtShort(r.ended_on) : "ongoing"}`} /></Row>)}</View></View> : null}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Sec style={{ marginBottom: 0 }}>Courses of care</Sec><Btn small label="+ Course" onPress={() => openCourseForm(h, { concern_id: c.id })} /></View>
        {ks.length ? ks.map((k) => <CourseCard key={k.id} k={k} />) : <Text style={{ fontSize: 12.5, color: t.muted, fontFamily: t.fontUI }}>Recurring treatment for this: physio, laser sessions, a specialist. Each session is an appointment with what was done and what it cost.</Text>}
      </View>
      <Sec>Everything recorded</Sec>
      {es.length ? es.map((e) => <EntryRow key={e.id} e={e} />) : <P>Nothing linked yet. Use Check in to add the first entry.</P>}
    </View>
  );
}

function ConcernNew() {
  const h = useHealth();
  const [title, setTitle] = useState("");
  const [since, setSince] = useState(today());
  const [regs, setRegs] = useState<Set<string>>(new Set(h.V.region ? [h.V.region] : []));
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="New concern" icon={<TypeIco k="observation" small />} onClose={h.closeSheet} />
      <Field label="What are you keeping an eye on?"><Input value={title} onChange={setTitle} placeholder="Posture, tiredness, left breast" /></Field>
      <Field label="Since"><DateField value={since} onChange={setSince} /></Field>
      <Field label="Body areas"><RegionChips value={regs} onChange={setRegs} /></Field>
      <Field label="Notes"><Input value={notes} onChange={setNotes} multiline /></Field>
      <Acts right={<Btn kind="accent" label="Create" onPress={() => { if (!title.trim()) return setErr("Give it a name."); const id = "c-" + uid(); h.mutate((D) => { D.concerns.push({ id, title: title.trim(), regions: [...regs], started_on: since || today(), resolved_on: null, status: "active", notes, tracking: {} }); }); openConcern(h, id); }} />} />
      <Err>{err}</Err>
    </View>
  );
}

function Checkin(props: { ids: string[] }) {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const cs = props.ids.map((i) => D.concerns.find((c) => c.id === i)!).filter(Boolean);
  const [date, setDate] = useState(today());
  const [vals, setVals] = useState<Record<string, ReturnType<typeof emptyVal>>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  function save() {
    let added = 0;
    h.mutate((D) => {
      cs.forEach((c) => {
        (c.tracking!.metrics || []).filter((k) => D.metrics[k]).forEach((k) => {
          const v = readVal(mkind(D, k), vals[c.id + ":" + k] || emptyVal());
          if (v == null) return;
          D.entries.push({ id: uid(), type: "measurement", occurred_at: date, title: `${metric(D, k).l} ${fmtM(D, k, v)}`, notes: "", regions: c.regions.length ? c.regions : ["whole_body"], concern_id: c.id, parent_entry_id: null, details: { metric: k, value: v }, source: "manual", photos: [], files: [] }); added++;
        });
        const note = (notes[c.id] || "").trim();
        if (note) { D.entries.push({ id: uid(), type: "observation", occurred_at: date, title: `Check-in: ${c.title}`, notes: note, regions: c.regions, concern_id: c.id, parent_entry_id: null, details: {}, source: "manual", photos: [], files: [] }); added++; }
      });
    });
    if (!added) return setErr("Fill in at least one measure, or add a note.");
    h.closeSheet(); h.setV({ frame: null });
  }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="Check in" icon={<TypeIco k="measurement" small />} onClose={h.closeSheet} />
      <Field label="Date"><DateField value={date} onChange={setDate} /></Field>
      {cs.map((c) => { const due = dueMetrics(D, c); return (
        <View key={c.id} style={{ gap: 10 }}>
          <Sec>{c.title} <Text style={{ textTransform: "none", letterSpacing: 0, fontFamily: t.fontUISemi }}>{PER_LABEL[c.tracking!.per || "week"]}</Text></Sec>
          {c.tracking!.metrics!.filter((k) => D.metrics[k]).map((k) => <ValInput key={k} unit={metric(D, k).u} kind={mkind(D, k)} label={metric(D, k).l + (due.includes(k) ? "" : " (already logged this period)")} value={vals[c.id + ":" + k] || emptyVal()} onChange={(v) => setVals((p) => ({ ...p, [c.id + ":" + k]: v }))} />)}
          <Field label="Anything else? (optional)"><Input value={notes[c.id] || ""} onChange={(v) => setNotes((p) => ({ ...p, [c.id]: v }))} multiline placeholder="How it felt, what you noticed" /></Field>
        </View>
      ); })}
      <Acts right={<Btn kind="accent" label="Save check-in" onPress={save} />} />
      <Err>{err}</Err>
    </View>
  );
}
