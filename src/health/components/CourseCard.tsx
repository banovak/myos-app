// A course of care (physio every three weeks, say): sessions, cost, cadence,
// the reading taken at each session charted, and the buttons to log a session
// or see them all. Shown on the concern it belongs to, or under Concerns when
// it belongs to none.
import { Text, View } from "react-native";
import { addDays, fmt, fmtShort, money, today } from "../model/dates";
import { courseStats } from "../model/plans";
import { unitLabel } from "../model/series";
import type { Course } from "../model/types";
import { useHealth, type Health } from "../state/HealthContext";
import { Btn, Card, CardH, Pill, Stat, Stats, Swatch, useT } from "../ui";
import { ChartSvg } from "./ChartSvg";
import { newChart } from "../model/charts";
import { openCourseForm, openCourseSessions, openForm } from "../sheets";

export function logForCourse(h: Health, k: Course, status = "done"): void {
  const c = h.D.concerns.find((x) => x.id === k.concern_id);
  openForm(h, "appointment", { title: k.title, regions: c ? c.regions : [], concern_id: k.concern_id, details: { kind: k.kind, status, provider: k.provider, practice: k.practice, course_id: k.id, cost: k.cost } });
}

export function CourseCard(props: { k: Course }) {
  const h = useHealth();
  const t = useT();
  const k = props.k, s = courseStats(h.D, k), m = k.metric ? h.D.metrics[k.metric] : null;
  return (
    <Card>
      <CardH title={k.title} sub={[k.provider, k.practice].filter(Boolean).join(" · ")} right={<Pill kind={k.ended_on ? "mut" : "up"}>{k.ended_on ? "Ended " + fmtShort(k.ended_on) : "Ongoing"}</Pill>} />
      <Stats>
        <View style={{ flexDirection: "row", width: "100%", gap: 10 }}><Stat value={String(s.done.length)} label="sessions" /><Stat value={money(s.spent)} label="spent" /></View>
        <View style={{ flexDirection: "row", width: "100%", gap: 10 }}><Stat value={k.cadence || "–"} label={`since ${fmt(k.started_on)}`} /><Stat value={s.next ? fmtShort(s.next.occurred_at) : "–"} label="next session" /></View>
      </Stats>
      {m && k.metric ? (
        <View style={{ marginTop: 14 }}>
          <ChartSvg c={{ id: "k" + k.id, title: k.title, y1: "m:" + k.metric, y1Type: "line", y1Color: "#4F5BF5", y2: null, bands: [], photos: [], range: "custom", from: addDays(k.started_on, -10), to: k.ended_on || today(), grid: false }} height={190} />
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}><Swatch color="#4F5BF5" /><Text style={{ fontSize: 12, color: t.ink, fontFamily: t.fontUI }}>{m.l} <Text style={{ color: t.muted }}>{unitLabel(m.u)} · your reading at each session</Text></Text></View>
        </View>
      ) : null}
      {k.notes ? <Text style={{ marginTop: 10, fontSize: 12.5, color: t.muted, fontFamily: t.fontUI }}>{k.notes}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <Btn kind="accent" small label="+ Log session" onPress={() => logForCourse(h, k)} />
        <Btn small label="All sessions" onPress={() => openCourseSessions(h, k.id)} />
        <Btn small label="Chart it" onPress={() => { h.mutate((D) => { const c = newChart(D, { title: k.title, y1: k.metric ? "m:" + k.metric : null, y1Type: "line", bands: ["k:" + k.id], sessions: [k.id], range: "custom", from: addDays(k.started_on, -14), to: k.ended_on || today() }); h.setV({ editChart: c.id }); }); h.go("charts"); }} />
        <Btn small label="Edit" onPress={() => openCourseForm(h, k)} />
      </View>
    </Card>
  );
}
