// Reports: lab results (markers across report dates, as printed, with a small
// trend line per marker) and the other documents: prescriptions, scans,
// letters, each with its file and, where useful, its own values. Nothing is
// interpreted.
import { Pressable, ScrollView, Text, View } from "react-native";
import { NoSwipe } from "../../shell/NoSwipe";
import Svg, { Circle, Path } from "react-native-svg";
import { byDateDesc, fmt, fmtShort, pd } from "../model/dates";
import { newChart } from "../model/charts";
import { isLab, kindName, labsOnly, reportKind, reportTitle } from "../model/reports";
import { getSeries } from "../model/series";
import { useHealth } from "../state/HealthContext";
import { Btn, Card, CardH, Empty, InfoBtn, PageH, Pill, Row, RowText, TypeIco, useT } from "../ui";
import { openLab, openLabForm } from "../sheets";

export function LabsScreen() {
  const h = useHealth();
  const t = useT();
  const D = h.D;
  const labs = labsOnly(D).sort(byDateDesc("date")), dates = labs.map((l) => l.date).slice().reverse();
  const others = D.labs.filter((l) => !isLab(l)).sort(byDateDesc("date"));
  const markers = [...new Set(labs.flatMap((l) => l.results.map((r) => r.marker)))];
  const cell = (m: string, d: string) => { const l = labs.find((l) => l.date === d); const r = l && l.results.find((r) => r.marker === m); return r ? <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}><Text style={{ fontFamily: t.fontData, fontSize: 13, color: t.ink }}>{r.value}</Text>{r.flag ? <Pill kind="flag">{r.flag}</Pill> : null}</View> : <Text style={{ color: t.muted }}>–</Text>; };
  const spark = (m: string) => {
    const s = getSeries(D, "lab:" + m);
    if (!s || s.kind !== "line" || s.points.length < 2) return null;
    const ps = s.points, lo = Math.min(...ps.map((p) => p.v)), hi = Math.max(...ps.map((p) => p.v)), W = 80, H = 24, X = (i: number) => 4 + (i / (ps.length - 1)) * (W - 8), Y = (v: number) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (H - 6);
    return <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}><Path d={ps.map((p, i) => (i ? "L" : "M") + X(i) + " " + Y(p.v)).join(" ")} fill="none" stroke={t.ink} strokeWidth={1.5} /><Circle cx={X(ps.length - 1)} cy={Y(ps[ps.length - 1].v)} r={3} fill={t.accent} stroke={t.ink} /></Svg>;
  };
  const units = (m: string) => { const l = labs.find((l) => l.results.some((r) => r.marker === m))!; const r = l.results.find((r) => r.marker === m)!; return <Text style={{ fontSize: 12, color: t.ink, fontFamily: t.fontUI }}>{r.unit}{r.range ? <Text style={{ fontSize: 11, color: t.muted, fontFamily: t.fontData }}> · {r.range}</Text> : null}</Text>; };
  const th = (s: string, w: number) => <Text key={s} style={{ width: w, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: t.muted, fontFamily: t.fontUIBold, paddingVertical: 9, paddingHorizontal: 8 }}>{s}</Text>;
  const fname = (l: (typeof D.labs)[number]) => (l.file ? (typeof l.file === "string" ? l.file : l.file.name) : "");
  return (
    <View style={{ gap: 16 }}>
      <PageH title="Reports" sub="Lab results, prescriptions, scans and letters, kept as they came" right={<Btn kind="accent" label="+ Add report" onPress={() => openLabForm(h)} />} />
      <Card>
        <CardH title="Lab results over time" right={<InfoBtn title="Lab results over time" text="Each marker across your lab reports, newest last. Flags and reference ranges are copied from each report exactly as the lab printed them; this app does not judge them." />} />
        {markers.length ? (
          <NoSwipe><ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: t.line }}>{th("Marker", 130)}{th("Unit · lab range", 140)}{dates.map((d) => th(`${fmtShort(d)} ${String(pd(d).getFullYear()).slice(2)}`, 92))}{th("Trend", 96)}</View>
              {markers.map((m) => (
                <View key={m} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: t.line }}>
                  <Pressable onPress={() => { h.mutate((D) => { const c = newChart(D, { title: m, y1: "lab:" + m, range: "all" }); h.setV({ editChart: c.id }); }); h.go("charts"); }} style={{ width: 130, paddingVertical: 9, paddingHorizontal: 8 }}><Text style={{ fontFamily: t.fontUIBold, color: t.ink, fontSize: 13, textDecorationLine: "underline" }}>{m}</Text></Pressable>
                  <View style={{ width: 140, paddingHorizontal: 8 }}>{units(m)}</View>
                  {dates.map((d) => <View key={d} style={{ width: 92, paddingHorizontal: 8 }}>{cell(m, d)}</View>)}
                  <View style={{ width: 96, paddingHorizontal: 8 }}>{spark(m)}</View>
                </View>
              ))}
            </View>
          </ScrollView></NoSwipe>
        ) : <Empty>No lab reports yet.</Empty>}
      </Card>
      <Card>
        <CardH title="Lab reports" sub={labs.length ? String(labs.length) : ""} />
        {labs.length ? <View style={{ gap: 8 }}>{labs.map((l) => <Row key={l.id} onPress={() => openLab(h, l.id)}><View style={{ flexDirection: "row", gap: 10, alignItems: "center", flex: 1 }}><TypeIco k="lab" small /><RowText title={reportTitle(l)} sub={`${fmt(l.date)} · ${l.results.length} results${fname(l) ? ` · ${fname(l)}` : ""}`} /></View><Pill kind="mut">{l.results.filter((r) => r.flag).length} flagged</Pill></Row>)}</View> : <Empty>Bloodwork and other lab panels go here, with the PDF and the values as printed.</Empty>}
      </Card>
      <Card>
        <CardH title="Other documents" sub={others.length ? String(others.length) : ""} right={<InfoBtn title="Other documents" text="Prescriptions, scans, referral letters, discharge summaries: the file, who it came from, and any values worth keeping as numbers (a glasses prescription, say). Values here stay with the document; only lab results go into the markers table." />} />
        {others.length ? <View style={{ gap: 8 }}>{others.map((l) => <Row key={l.id} onPress={() => openLab(h, l.id)}><View style={{ flexDirection: "row", gap: 10, alignItems: "center", flex: 1 }}><TypeIco k="report" small /><RowText title={reportTitle(l)} sub={[kindName(reportKind(l)), fmt(l.date), l.lab, l.results.length ? `${l.results.length} ${l.results.length === 1 ? "value" : "values"}` : "", fname(l)].filter(Boolean).join(" · ")} /></View></Row>)}</View> : <Empty>Prescriptions, scans and letters go here. Use + Add report and pick the kind.</Empty>}
      </Card>
    </View>
  );
}
