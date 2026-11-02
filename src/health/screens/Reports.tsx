// Summary: a visit summary for one area or concern over a date range, and a
// CSV export via the share sheet.
import { useState } from "react";
import { Text, View } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { addDays, fmt, today } from "../model/dates";
import { labsOnly } from "../model/reports";
import { REG, catLabel, rl } from "../model/vocab";
import type { Entry } from "../model/types";
import { useHealth } from "../state/HealthContext";
import { Btn, Card, CardH, Chip, Chips, DateField, Empty, Field, PageH, Select, Sub, useT } from "../ui";
import { PhotoView } from "../components/PhotoView";
import { openEntry } from "../sheets";

const csvq = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function buildCSV(D: ReturnType<typeof useHealth>["D"], k: string): string {
  let rows: unknown[][];
  if (k === "entries") rows = [["date", "type", "title", "body_areas", "concern", "metric", "value", "notes"], ...D.entries.slice().sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1)).map((e) => [e.occurred_at, e.type, e.title, e.regions.map((r) => rl(D, r)).join("; "), (D.concerns.find((c) => c.id === e.concern_id) || {} as any).title || "", e.details.metric || "", e.details.value ?? "", e.notes])];
  else if (k === "labs") rows = [["date", "lab", "marker", "value", "unit", "lab_range", "lab_flag"], ...labsOnly(D).flatMap((l) => l.results.map((r) => [l.date, l.lab, r.marker, r.value, r.unit, r.range, r.flag]))];
  else rows = [["name", "category", "dose", "frequency", "started_on", "ended_on", "notes"], ...D.regimens.map((r) => [r.name, catLabel(r.category), r.dose || "", r.frequency || "", r.started_on, r.ended_on || "", r.notes || ""])];
  return rows.map((r) => r.map(csvq).join(",")).join("\n");
}

export function ReportsScreen() {
  const h = useHealth();
  const t = useT();
  const D = h.D;
  const [focus, setFocus] = useState("all");
  const [from, setFrom] = useState(addDays(today(), -365));
  const [to, setTo] = useState(today());
  const [built, setBuilt] = useState(false);
  const [csv, setCsv] = useState("entries");
  const [msg, setMsg] = useState("");
  const groups: Record<string, [string, string][]> = { "": [["all", "Everything"]], "Body area": Object.entries(REG(D)).map(([k, l]) => ["r:" + k, l]), Concern: D.concerns.map((c) => ["c:" + c.id, c.title]) };

  const inF = (regs: string[], cid: string | null) => focus === "all" || (focus.startsWith("r:") ? regs.includes(focus.slice(2)) : cid === focus.slice(2));
  const es = D.entries.filter((e) => e.occurred_at >= from && e.occurred_at <= to && inF(e.regions, e.concern_id) && !(e.details.series === "body")).sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1));
  const rs = D.regimens.filter((r) => r.started_on <= to && (!r.ended_on || r.ended_on >= from) && inF(r.regions, r.concern_id));
  const ls = focus === "all" || focus === "r:whole_body" ? labsOnly(D).filter((l) => l.date >= from && l.date <= to) : [];
  const title = focus === "all" ? "Everything" : focus.startsWith("r:") ? rl(D, focus.slice(2)) : (D.concerns.find((c) => c.id === focus.slice(2)) || { title: "" }).title;
  const grp = (ty: string) => es.filter((e) => e.type === ty);
  const li = (e: Entry) => <Text key={e.id} onPress={() => openEntry(h, e.id)} style={{ fontSize: 13, color: t.ink, fontFamily: t.fontUI, lineHeight: 19 }}>• <Text style={{ fontFamily: t.fontUIBold }}>{fmt(e.occurred_at)}</Text> · {e.title}{e.details.what_they_said ? ` — “${e.details.what_they_said}”` : ""}{e.notes ? ` (${e.notes})` : ""}</Text>;
  const H4 = (p: { children: string }) => <Text style={{ fontFamily: t.fontUIBold, fontSize: 13, color: t.ink, marginTop: 14, marginBottom: 6 }}>{p.children}</Text>;

  async function share() {
    try {
      const dir = new Directory(Paths.cache, "health-export");
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const f = new File(dir, `myos-health-${csv}-${today()}.csv`);
      if (f.exists) f.delete();
      f.create(); f.write(buildCSV(D, csv));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text", dialogTitle: "Export CSV" });
      else setMsg("Sharing isn't available on this device.");
    } catch (e: any) { setMsg(e?.message || String(e)); }
  }
  return (
    <View style={{ gap: 16 }}>
      <PageH title="Summary" sub="Pull your own records together, for yourself or to bring to an appointment" />
      <Card>
        <CardH title="Visit summary" sub="Everything recorded about one area or concern, in date order" />
        <View style={{ gap: 12 }}>
          <Field label="Focus"><Select value={focus} options={[]} groups={groups} onChange={(v) => { setFocus(v); setBuilt(false); }} /></Field>
          <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><Field label="From"><DateField value={from} onChange={(v) => { setFrom(v); setBuilt(false); }} /></Field></View><View style={{ flex: 1 }}><Field label="To"><DateField value={to} onChange={(v) => { setTo(v); setBuilt(false); }} /></Field></View></View>
          <Btn kind="accent" label="Build summary" onPress={() => setBuilt(true)} />
        </View>
        {built ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 17, fontFamily: t.fontUIBold, color: t.ink, marginTop: 10 }}>{title} · {fmt(from)} – {fmt(to)}</Text>
            {rs.length ? <><H4>Regimens and diet in this period</H4>{rs.map((r) => <Text key={r.id} style={{ fontSize: 13, color: t.ink, fontFamily: t.fontUI, lineHeight: 19 }}>• {r.name}{r.dose ? `, ${r.dose}` : ""} · {fmt(r.started_on)} – {r.ended_on ? fmt(r.ended_on) : "ongoing"}</Text>)}</> : null}
            {[["appointment", "Appointments"], ["procedure", "Procedures"], ["observation", "Observations"], ["food_trial", "Food trials"], ["measurement", "Measurements"]].map(([ty, l]) => (grp(ty).length ? <View key={ty}><H4>{l}</H4>{grp(ty).map(li)}</View> : null))}
            {ls.length ? <><H4>Lab results</H4>{ls.map((l) => <Text key={l.id} style={{ fontSize: 13, color: t.ink, fontFamily: t.fontUI, lineHeight: 19 }}>• <Text style={{ fontFamily: t.fontUIBold }}>{fmt(l.date)}</Text> · {l.results.map((r) => `${r.marker} ${r.value} ${r.unit}${r.flag ? ` (${r.flag})` : ""}`).join(", ")}</Text>)}</> : null}
            {grp("photo").length ? <><H4>Photos</H4><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{grp("photo").map((e) => <PhotoView key={e.id} photo={e.photos[0]} date={e.occurred_at} style={{ width: 90, height: 110 }} onPress={() => openEntry(h, e.id)} />)}</View></> : null}
            {!es.length && !rs.length && !ls.length ? <Empty>Nothing recorded for this focus and period.</Empty> : null}
          </View>
        ) : null}
      </Card>
      <Card>
        <CardH title="Export your data" sub="CSV, for a spreadsheet or your own analysis" />
        <Chips style={{ marginBottom: 10 }}>{[["entries", "Entries"], ["labs", "Lab results"], ["regimens", "Regimens & diet"]].map(([k, l]) => <Chip key={k} label={l} on={csv === k} onPress={() => setCsv(k)} />)}</Chips>
        <Text numberOfLines={8} style={{ fontFamily: t.fontData, fontSize: 11, color: t.ink, backgroundColor: t.soft, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: t.line }}>{buildCSV(D, csv)}</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 }}><Btn kind="dark" label="Share CSV" onPress={share} />{msg ? <Sub>{msg}</Sub> : null}</View>
      </Card>
    </View>
  );
}
