// Plan: challenges first (each with its own page), then the yearly plan
// grouped by category.
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { fmt, fmtShort, today } from "../model/dates";
import { EXP_LABEL, challengeStats, expKind, expMetrics, expPhotos, expRange, expRegions, expRegs, lastPhotoIn, perUnit, ruleStatus, ruleTitle, statIn } from "../model/experiments";
import { statusColor } from "../theme";
import { cycleStatsIn } from "../model/cycle";
import { logsOf } from "../model/regimens";
import { planCats, planStats, planStatus, plansFor, YEAR } from "../model/plans";
import { fmtM, metric } from "../model/series";
import type { Challenge, Plan } from "../model/types";
import { kindLabel, rl } from "../model/vocab";
import { useHealth } from "../state/HealthContext";
import { Btn, Card, CardH, Donut, Empty, P, PageH, Pill, PlusBtn, Row, RowText, Sec, Sub, useT } from "../ui";
import { ChallengeBlock, RemindBtn } from "../components/Widgets";
import { PhotoView } from "../components/PhotoView";
import { EntryRow } from "../components/EntryRow";
import { openBeforeAfter, openChallenge, openEntry, openForm, openNewExperiment, openPhases, openPlan, openPlanCats, openRegimen, openRuleGrid } from "../sheets";

const statTxt = (h: ReturnType<typeof useHealth>, k: string, s: { n: number; avg: number | null }) => (s.n ? `${fmtM(h.D, k, s.avg!)} avg · ${s.n}` : "nothing logged");

export function BABody(props: { c: Challenge; full?: boolean }) {
  const h = useHealth();
  const t = useT();
  const D = h.D, cf = props.c.config || {}, ev = cf.event_date!, w = +(cf.window || 90), T = today();
  const { addDays } = require("../model/dates") as typeof import("../model/dates");
  const bFrom = addDays(ev, -w), bTo = addDays(ev, -1), aFrom = ev, aTo = addDays(ev, w - 1), future = ev > T;
  const rows: [string, string, string][] = (cf.measures || []).filter((k) => D.metrics[k]).map((k) => [metric(D, k).l, statTxt(h, k, statIn(D, k, bFrom, bTo)), future ? `after ${fmtShort(ev)}` : statTxt(h, k, statIn(D, k, aFrom, aTo > T ? T : aTo))]);
  if (cf.cycle) {
    const b = cycleStatsIn(D, bFrom, bTo), a = cycleStatsIn(D, aFrom, aTo), f = (v: number | null, u: string) => (v == null ? "–" : `${Math.round(v)} ${u}`);
    rows.push(["Cycle length", f(b.cycleLen, "days"), future ? "" : f(a.cycleLen, "days")], ["Period length", f(b.periodLen, "days"), future ? "" : f(a.periodLen, "days")]);
  }
  const pb = props.full && cf.photo_region ? lastPhotoIn(D, cf.photo_region, bFrom, bTo) : undefined, pa = props.full && cf.photo_region && !future ? lastPhotoIn(D, cf.photo_region, aFrom, aTo) : undefined;
  return (
    <View style={{ gap: 8 }}>
      {future ? <P>Baseline running: logging before {fmt(ev)} gives you something to compare against.</P> : null}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: t.line, paddingVertical: 6 }}><Text style={{ flex: 1.2 }} /><Text style={{ flex: 1, fontSize: 11, color: t.muted, fontFamily: t.fontUIBold }}>{w} days before</Text><Text style={{ flex: 1, fontSize: 11, color: t.muted, fontFamily: t.fontUIBold }}>{w} days after</Text></View>
      {rows.length ? rows.map(([a, b, c], i) => <View key={i} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: t.line, paddingVertical: 7 }}><Text style={{ flex: 1.2, fontFamily: t.fontUISemi, color: t.ink, fontSize: 13 }}>{a}</Text><Text style={{ flex: 1, fontFamily: t.fontUI, color: t.ink, fontSize: 12.5 }}>{b}</Text><Text style={{ flex: 1, fontFamily: t.fontUI, color: t.ink, fontSize: 12.5 }}>{c}</Text></View>) : <Sub>Pick some measures to compare.</Sub>}
      {props.full && cf.photo_region ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>{pb ? <><PhotoView photo={pb.photos[0]} date={pb.occurred_at} style={{ aspectRatio: 4 / 5 }} onPress={() => openEntry(h, pb.id)} /><Sub>{fmt(pb.occurred_at)}</Sub></> : <Sub>No photo before</Sub>}</View>
          <View style={{ flex: 1, gap: 4 }}>{pa ? <><PhotoView photo={pa.photos[0]} date={pa.occurred_at} style={{ aspectRatio: 4 / 5 }} onPress={() => openEntry(h, pa.id)} /><Sub>{fmt(pa.occurred_at)}</Sub></> : <Sub>{future ? "After " + fmtShort(ev) : "No photo after"}</Sub>}</View>
        </View>
      ) : null}
    </View>
  );
}
export function PhasesBody(props: { c: Challenge }) {
  const h = useHealth();
  const t = useT();
  const cf = props.c.config || {}, T = today();
  return (
    <View style={{ gap: 8 }}>
      {(cf.phases || []).map((p, i) => { const to = p.to > T ? T : p.to; return (
        <Row key={i} style={{ alignItems: "flex-start" }}>
          <RowText title={p.name} sub={`${fmtShort(p.from)} – ${p.to >= T ? "now" : fmtShort(p.to)}`} />
          <View style={{ alignItems: "flex-end", gap: 2 }}>{(cf.measures || []).filter((k) => h.D.metrics[k]).map((k) => <Text key={k} style={{ fontSize: 12.5, color: t.ink, fontFamily: t.fontUI }}><Text style={{ fontFamily: t.fontUIBold }}>{metric(h.D, k).l}</Text> {statTxt(h, k, statIn(h.D, k, p.from, to))}</Text>)}</View>
        </Row>
      ); })}
    </View>
  );
}

function ExpCard(props: { c: Challenge }) {
  const h = useHealth();
  const t = useT();
  const k = expKind(props.c);
  return (
    <Pressable onPress={() => h.setV({ exp: props.c.id, expFrom: "plan" })} style={{ backgroundColor: t.soft, borderRadius: 16, padding: 14, gap: 10 }} accessibilityRole="button">
      <Text style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", fontFamily: t.fontUIBold, color: t.muted }}>{EXP_LABEL[k]}</Text>
      {k === "challenge" ? <ChallengeBlock c={props.c} /> : <><Text style={{ fontFamily: t.fontUIBold, fontSize: 15, color: t.ink }}>{props.c.title}</Text>{k === "phases" ? <PhasesBody c={props.c} /> : <BABody c={props.c} />}</>}
    </Pressable>
  );
}

function PlanCard(props: { p: Plan }) {
  const h = useHealth();
  const t = useT();
  const p = props.p, s = planStats(h.D, p), [st, cl] = planStatus(p, s);
  return (
    <View style={{ backgroundColor: t.soft, borderRadius: 16, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <Donut pct={s.done / s.target} size={66} stroke={8} color={s.done >= s.target ? t.accent : "#4F5BF5"} onTint center={<Text style={{ fontSize: 16, fontFamily: t.fontUIHeavy, color: t.ink }}>{s.done}/{s.target}</Text>} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: t.fontUIBold, color: t.ink }}>{p.title}</Text>
          <Sub>{kindLabel(h.D, p.kind) || ""} · {+p.per_year > 1 ? `${p.per_year}× a year` : "once a year"}</Sub>
          <Sub>{s.last ? `Last: ${fmt(s.last.occurred_at)}` : "Nothing logged yet"}</Sub>
          <Pill kind={cl}>{st}</Pill>
        </View>
      </View>
      {p.notes ? <Sub>{p.notes}</Sub> : null}
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        <Btn small label="Log or book" onPress={() => openForm(h, "appointment", { title: p.title, details: { kind: p.kind, plan_id: p.id, status: "done" } })} />
        <Btn small label="Edit" onPress={() => openPlan(h, p)} />
      </View>
    </View>
  );
}

export function PlanSection() {
  const h = useHealth();
  const t = useT();
  const { D, V } = h;
  const items = plansFor(D, V.planYear), cats = planCats(D), known = new Set(cats.map((c) => c.id)), other = items.filter((p) => !known.has(p.category));
  const group = (id: string, name: string, ps: Plan[]) => (
    <View key={id || "other"} style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 14.5, fontFamily: t.fontUIHeavy, color: t.ink }}>{name}</Text>
        <Sub>{ps.length ? ps.length + (ps.length > 1 ? " items" : " item") : ""}</Sub>
        <View style={{ flex: 1 }} />
        <PlusBtn label={`Add to ${name}`} onPress={() => openPlan(h, { category: id })} />
      </View>
      {ps.length ? ps.map((p) => <PlanCard key={p.id} p={p} />) : <Text style={{ fontSize: 12.5, color: t.muted, fontFamily: t.fontUI, padding: 12, paddingHorizontal: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.line, borderRadius: 14 }}>Nothing planned for {name.toLowerCase()} in {V.planYear}.</Text>}
    </View>
  );
  return (
    <Card>
      <CardH
        title={<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={() => h.setV({ planYear: V.planYear - 1 })} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Previous year"><Text style={{ color: t.ink, fontSize: 16 }}>‹</Text></Pressable>
          <Text style={{ fontSize: 15, fontFamily: t.fontUIBold, color: t.ink }}>{V.planYear} plan</Text>
          <Pressable onPress={() => h.setV({ planYear: V.planYear + 1 })} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Next year"><Text style={{ color: t.ink, fontSize: 16 }}>›</Text></Pressable>
        </View>}
        right={<Btn small kind="dark" label="Categories" onPress={() => openPlanCats(h)} />}
      />
      <Sub style={{ marginBottom: 12 }}>{V.planYear === YEAR() ? "What you want to get done this year" : V.planYear > YEAR() ? "Planning ahead" : "Looking back"}</Sub>
      {!items.length && plansFor(D, V.planYear - 1).length ? <Row style={{ marginBottom: 12 }}><Sub>Nothing planned for {V.planYear} yet.</Sub><Btn kind="dark" small label={`Copy ${V.planYear - 1} plan`} onPress={() => h.mutate((D) => { plansFor(D, V.planYear - 1).forEach((p) => D.plans.push({ ...p, id: "p-" + newId(), year: V.planYear })); })} /></Row> : null}
      <View style={{ gap: 18 }}>{cats.map((c) => group(c.id, c.name, items.filter((p) => p.category === c.id)))}{other.length ? group("", "No category", other) : null}</View>
    </Card>
  );
}

export function PlanScreen() {
  const h = useHealth();
  const { D, V } = h;
  const c = V.exp ? D.challenges.find((x) => x.id === V.exp) : null;
  if (c) return <ExpPage c={c} />;
  return (
    <View style={{ gap: 16 }}>
      <PageH title="Plan" sub="What you're aiming for: the challenges you're running and this year's plan." />
      <Card><CardH title="Challenges" right={<PlusBtn label="New challenge" onPress={() => openNewExperiment(h)} />} /><View style={{ gap: 12 }}>{D.challenges.length ? D.challenges.slice().sort((a, b) => (a.started_on < b.started_on ? 1 : -1)).map((c) => <ExpCard key={c.id} c={c} />) : <Empty>No challenges yet. A challenge is something for a set time with check-ins, phases to compare, or before and after a change.</Empty>}</View></Card>
      <PlanSection />
    </View>
  );
}

function ExpPage(props: { c: Challenge }) {
  const h = useHealth();
  const t = useT();
  const { D, V } = h;
  const c = props.c, k = expKind(c), { from, to } = expRange(c), T = today(), end = to > T ? T : to, cf = c.config || {};
  const red = t.dark ? "#FF7B72" : "#C62828";
  const [armed, setArmed] = useState(false);
  const ps = expPhotos(D, c, from, end), rs = expRegions(c), ms = expMetrics(c).filter((m) => D.metrics[m]), regs = expRegs(D, c);
  const tile = (e: typeof ps[number]) => <View key={e.id} style={{ width: "31%", gap: 4 }}><PhotoView photo={e.photos[0]} date={e.occurred_at} style={{ aspectRatio: 4 / 5 }} onPress={() => openEntry(h, e.id)} /><Sub>{fmt(e.occurred_at)}</Sub></View>;
  const grid = (es: typeof ps) => (es.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{es.map(tile)}</View> : <Empty>None.</Empty>);
  // a grid behind its heading, folded away until opened
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const fold = (key: string, title: string, es: typeof ps) => (
    <View key={key} style={{ gap: 8 }}>
      <Pressable onPress={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} accessibilityRole="button" accessibilityState={{ expanded: !!open[key] }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Sec style={{ marginBottom: 0 }}>{title} · {es.length}</Sec><Text style={{ color: t.muted, fontSize: 12 }}>{open[key] ? "▾" : "▸"}</Text>
      </Pressable>
      {open[key] ? grid(es) : null}
    </View>
  );
  const pair = (a: typeof ps[number] | undefined, la: string, b: typeof ps[number] | undefined, lb: string) => (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {[[a, la], [b, lb]].map(([e, l], i) => <View key={i} style={{ flex: 1, gap: 4 }}>{e ? <><PhotoView photo={(e as any).photos[0]} date={(e as any).occurred_at} style={{ aspectRatio: 4 / 5 }} onPress={() => openEntry(h, (e as any).id)} /><Sub>{l as string} · {fmt((e as any).occurred_at)}</Sub></> : <Sub>{l as string}: none</Sub>}</View>)}
    </View>
  );
  let photos: React.ReactNode = null;
  if (rs.length) {
    let body: React.ReactNode;
    if (!ps.length) body = <Empty>No {rs.map((r) => rl(D, r)).join(", ").toLowerCase()} photos in this stretch yet.</Empty>;
    else if (k === "phases") body = (cf.phases || []).map((p) => { const pp = ps.filter((e) => e.occurred_at >= p.from && e.occurred_at <= p.to); return <View key={p.name + p.from}><Sec>{p.name} · {pp.length}</Sec>{grid(pp)}</View>; });
    else if (k === "before_after") { const b = ps.filter((e) => e.occurred_at < cf.event_date!), a = ps.filter((e) => e.occurred_at >= cf.event_date!); body = <View style={{ gap: 12 }}>{pair(b[b.length - 1], "Last before", a[a.length - 1], "Latest after")}{fold("before", "All before", b)}{fold("after", "All after", a)}</View>; }
    else body = ps.length > 1 ? <View style={{ gap: 12 }}>{pair(ps[0], "First", ps[ps.length - 1], "Latest")}{fold("all", "All of them", ps)}</View> : grid(ps);
    photos = <Card><CardH title="Photos" sub={`${rs.map((r) => rl(D, r)).join(", ")} · ${ps.length}`} right={<PlusBtn label="Add photo" onPress={() => openForm(h, "photo", { regions: [rs[0]], details: { series: rs[0] === "face" ? "face" : rs[0] === "whole_body" ? "body" : "none" } }, { camera: true })} />} />{body}</Card>;
  }
  return (
    <View style={{ gap: 16 }}>
      <Pressable onPress={() => h.go(V.expFrom || "plan")} style={{ alignSelf: "flex-start" }} accessibilityRole="button"><Text style={{ fontFamily: t.fontUIBold, color: t.ink, textDecorationLine: "underline" }}>‹ Back</Text></Pressable>
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", fontFamily: t.fontUIBold, color: t.muted }}>{EXP_LABEL[k]}</Text>
        <Text style={{ fontSize: 24, fontFamily: t.fontUIHeavy, color: t.ink, letterSpacing: -0.5 }}>{c.title}</Text>
        <Sub>{fmt(from)} – {to >= T && k !== "before_after" ? "now, ends " + fmt(to) : fmt(to)}</Sub>
      </View>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
        <RemindBtn kind="challenge" id={c.id} />
        <Btn kind="accent" small label="Edit" onPress={() => (k === "challenge" ? openChallenge(h, c) : k === "phases" ? openPhases(h, c) : openBeforeAfter(h, c))} />
      </View>
      <Card>
        {k === "challenge" ? (() => { const s = challengeStats(D, c), soon = s.elapsed === 0; return (
          <View style={{ flexDirection: "row", gap: 18, alignItems: "flex-start" }}>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Donut pct={s.elapsed / s.total} size={120} stroke={13} color={t.accent} center={<View style={{ alignItems: "center" }}><Text style={{ fontSize: 24, fontFamily: t.fontUIHeavy, color: t.ink }}>{s.elapsed}</Text><Text style={{ fontSize: 11, color: t.muted, fontFamily: t.fontUI }}>of {s.total} days</Text></View>} />
              <Text style={{ fontSize: 12.5, fontFamily: t.fontUIBold, color: t.ink }}>Challenge duration</Text>
              {soon ? <Sub>Starts {fmtShort(c.started_on)}</Sub> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
              {s.rules.length ? s.rules.map((r, i) => { const st = ruleStatus(D, c, r); return (
                <Pressable key={i} onPress={() => openRuleGrid(h, c, i)} style={{ gap: 5 }} accessibilityRole="button" accessibilityLabel={`${ruleTitle(r)}, ${st.detail}. Opens every ${r.per}`}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <Text style={{ fontSize: 13, fontFamily: t.fontUIBold, color: t.ink, flex: 1, minWidth: 0 }}>{ruleTitle(r)}</Text>
                    <Text style={{ fontSize: 12.5, fontFamily: t.fontUIBold, color: statusColor(t, st.st) }}>{st.detail}</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: t.soft, overflow: "hidden" }}><View style={{ width: `${Math.round((st.n ? st.hit / st.n : 0) * 100)}%`, height: 6, backgroundColor: t.accent }} /></View>
                  <Sub>{st.hit} of {st.n} {perUnit(r.per, st.n)} ›</Sub>
                </Pressable>
              ); }) : <Sub>No check-ins set. Add some with Edit.</Sub>}
            </View>
          </View>
        ); })() : (
          <View><P>{k === "phases" ? "Each phase side by side, with the average of what you logged during it." : `Comparing ${+(cf.window || 90)} days either side of ${cf.label || "the change"} on ${fmt(cf.event_date)}.`} Averages and counts only; what they mean is yours to judge, or to take to your doctor.</P>{k === "phases" ? <PhasesBody c={c} /> : <BABody c={c} full />}</View>
        )}
      </Card>
      {photos}
      {ms.length ? <Card><CardH title="Measurements" sub="Everything logged in this stretch" /><View style={{ gap: 10 }}>{ms.map((m) => { const es = D.entries.filter((e) => e.type === "measurement" && e.details.metric === m && e.occurred_at >= from && e.occurred_at <= end).sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1)), s = statIn(D, m, from, end); return (
        <View key={m} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line, gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontFamily: t.fontUIBold, color: t.ink }}>{metric(D, m).l}</Text><Sub>{s.n ? `${fmtM(D, m, s.avg!)} avg · ${s.n} logged` : "nothing logged"}</Sub></View>
          {es.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{es.map((e) => <Pressable key={e.id} onPress={() => openEntry(h, e.id)} style={{ backgroundColor: t.soft, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}><Text style={{ fontSize: 11, fontFamily: t.fontData, color: t.ink }}>{fmtShort(e.occurred_at)} · {fmtM(D, m, e.details.value)}</Text></Pressable>)}</View> : null}
        </View>
      ); })}</View></Card> : null}
      {regs.length ? <Card><CardH title="Lifestyle" sub="Part of this challenge" /><View style={{ gap: 8 }}>{regs.map((r) => { const n = logsOf(D, r.id, from, end).length; return <Row key={r.id} onPress={() => openRegimen(h, r)}><RowText title={r.name} sub={[r.dose, r.frequency].filter(Boolean).join(" · ")} /><Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontData }}>{n ? `logged ${n}×` : ""}</Text></Row>; })}</View></Card> : null}
      {c.notes ? <Card><CardH title="Notes" /><P style={{ marginBottom: 0 }}>{c.notes}</P></Card> : null}
      <Pressable onPress={() => { if (!armed) return setArmed(true); h.mutate((D) => { D.challenges = D.challenges.filter((x) => x.id !== c.id); }); h.go(V.expFrom || "plan"); }} style={{ alignSelf: "center", borderWidth: 1.5, borderColor: red, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18, marginTop: 4 }} accessibilityRole="button">
        <Text style={{ color: red, fontFamily: t.fontUIBold, fontSize: 13.5 }}>{armed ? "Tap again to delete it for good" : k === "challenge" ? "Delete entire challenge" : k === "phases" ? "Delete these phases" : "Delete this comparison"}</Text>
      </Pressable>
    </View>
  );
}
import { uid as newId } from "../model/dates";
