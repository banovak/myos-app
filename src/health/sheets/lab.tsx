// A report: lab results (date, lab, the PDF, the values typed in as printed),
// or another document (a prescription, a scan, a letter) with its file and, if
// useful, its own values. Files are encrypted. Nothing is interpreted.
import { useState } from "react";
import { Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { today, uid } from "../model/dates";
import { REPORT_KINDS, labsOnly, titleHint } from "../model/reports";
import type { FileRef, Lab, ReportKind } from "../model/types";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, DateField, Err, Field, Half, Icon, Input, NumInput, Select, SheetH, Two, TypeIco, useT } from "../ui";

export function openLabForm(h: Health, kind: ReportKind = "lab"): void { h.openSheet(<LabForm kind={kind} />); }

type RowT = { marker: string; value: string; unit: string; range: string; flag: string };
const blank = (): RowT => ({ marker: "", value: "", unit: "", range: "", flag: "" });
function LabForm(props: { kind: ReportKind }) {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const labs = labsOnly(D);
  const known = [...new Set(labs.flatMap((l) => l.results.map((r) => JSON.stringify([r.marker, r.unit, r.range]))))].map((s) => JSON.parse(s) as [string, string, string]);
  const labRows = (): RowT[] => (known.length ? known : [["", "", ""]]).map(([m, u, r]) => ({ marker: m, value: "", unit: u, range: r, flag: "" }));
  const [kind, setKind] = useState<ReportKind>(props.kind);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [lab, setLab] = useState(props.kind === "lab" ? (labs[0] || { lab: "" }).lab || "" : "");
  const [file, setFile] = useState<FileRef | null>(null);
  const [rows, setRows] = useState<RowT[]>(props.kind === "lab" ? labRows() : [blank()]);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const isLab = kind === "lab";
  const upd = (i: number, p: Partial<RowT>) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const pickKind = (k: string) => { const nk = k as ReportKind; setKind(nk); setErr(""); if (nk === "lab") { setRows(labRows()); if (!lab) setLab((labs[0] || { lab: "" }).lab || ""); } else if (kind === "lab") { setRows([blank()]); setLab(""); } };
  async function pick() {
    if (h.needVault()) return;
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    setFile({ name: a.name, size: a.size ?? null, type: a.mimeType || "application/pdf", localUri: a.uri });
  }
  function save() {
    const results = rows.map((r) => ({ marker: r.marker.trim(), value: r.value.trim(), unit: r.unit.trim(), range: r.range.trim(), flag: r.flag })).filter((r) => r.marker || r.value !== "");
    if (results.some((r) => !r.marker || r.value === "")) return setErr(isLab ? "Each result needs a marker and a value." : "Each value needs a name and a number. Remove the rows you don't need.");
    if (results.some((r) => isNaN(+r.value.replace(",", ".")))) return setErr("Values must be numbers.");
    if (isLab && !results.length) return setErr("Enter at least one result with a value.");
    if (!isLab && !title.trim() && !file && !results.length) return setErr("Give it a title, attach the file, or enter a value.");
    const l: Lab = { id: "l-" + uid(), date: date || today(), lab: lab.trim() || (isLab ? "Lab" : ""), file, notes: notes.trim(), results: results.map((r) => ({ ...r, value: +r.value.replace(",", ".") })), kind, ...(title.trim() ? { title: title.trim() } : {}) };
    h.mutate((D) => { D.labs.push(l); });
    h.closeSheet();
  }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={isLab ? "Lab report" : "Report"} icon={<TypeIco k={isLab ? "lab" : "report"} small />} onClose={h.closeSheet} />
      <Field label="What is it"><Select value={kind} options={REPORT_KINDS} onChange={pickKind} /></Field>
      {!isLab ? <Field label="Title"><Input value={title} onChange={setTitle} placeholder={titleHint[kind]} /></Field> : null}
      <Two><Half><Field label={isLab ? "Date collected" : "Dated"}><DateField value={date} onChange={setDate} /></Field></Half><Half><Field label={isLab ? "Lab" : "From"}><Input value={lab} onChange={setLab} placeholder={isLab ? "Lab name" : "Optometrist, clinic, hospital"} /></Field></Half></Two>
      <Field label="File"><View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}><Btn small label={file ? "Change file" : "Attach PDF or photo"} left={<Icon k="file" size={14} />} onPress={pick} />{file ? <Text style={{ fontSize: 12.5, fontFamily: t.fontUISemi, color: t.ink }}>{file.name}</Text> : null}</View></Field>
      <View style={{ backgroundColor: t.accentSoft, borderRadius: 16, padding: 14, gap: 4 }}><Text style={{ fontFamily: t.fontUIBold, color: t.ink }}>How this works</Text><Text style={{ fontSize: 12.5, color: t.muted, fontFamily: t.fontUI, lineHeight: 18 }}>{isLab ? "The PDF is encrypted and stored with the report. Type the values in as the lab printed them. Nothing is interpreted; flags and ranges are the lab's own." : "The file is encrypted and stored with the report. Values are optional: a glasses prescription's sphere and cylinder, a dose. They stay with this document and are not mixed into the lab markers."}</Text></View>
      <Field label={isLab ? "Results" : "Values (optional)"}>
        <View style={{ gap: 10 }}>{rows.map((r, i) => (
          <View key={i} style={{ gap: 6, backgroundColor: t.soft, borderRadius: 12, padding: 10 }}>
            <View style={{ flexDirection: "row", gap: 6 }}><View style={{ flex: 1.4 }}><Input value={r.marker} onChange={(v) => upd(i, { marker: v })} placeholder={isLab ? "Marker" : "Name, e.g. OD sphere"} /></View><View style={{ flex: 1 }}><NumInput value={r.value} onChange={(v) => upd(i, { value: v })} placeholder="Value" /></View><Btn small label="✕" onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))} /></View>
            <View style={{ flexDirection: "row", gap: 6 }}><View style={{ flex: 1 }}><Input value={r.unit} onChange={(v) => upd(i, { unit: v })} placeholder="Unit" /></View><View style={{ flex: 1.4 }}><Input value={r.range} onChange={(v) => upd(i, { range: v })} placeholder={isLab ? "Lab range" : "Note, e.g. axis 90"} /></View>{isLab ? <View style={{ width: 90 }}><Select value={r.flag} options={[["", "–"], ["H", "H"], ["L", "L"]]} onChange={(v) => upd(i, { flag: v })} /></View> : null}</View>
          </View>
        ))}</View>
        <Btn small label="+ Add row" onPress={() => setRows((rs) => [...rs, blank()])} />
      </Field>
      <Field label="Notes"><Input value={notes} onChange={setNotes} multiline placeholder={isLab ? "" : "What it says, in your words"} /></Field>
      <Acts right={<Btn kind="accent" label="Save report" onPress={save} />} />
      <Err>{err}</Err>
    </View>
  );
}
