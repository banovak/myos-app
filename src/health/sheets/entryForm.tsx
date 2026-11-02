// The form for anything that happens on a date: photo, appointment,
// measurement, procedure, observation, food trial. Photos come from the camera
// (with the last-in-series overlay) or the library; files from the document
// picker. Everything is encrypted before upload in synced mode.
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { byDateDesc, nowHHMM, today, uid } from "../model/dates";
import { fmtM, fmtV, metric, mkind, readingFor, unitLabel } from "../model/series";
import { cmFromFtIn, ftInFromCm, kgFromLb, lbFromKg, setUnit, unitPref, unitWord } from "../model/units";
import type { Entry, EntryType, FileRef, MetricKind, Photo } from "../model/types";
import { KIND_OPTS, TYPES, allKinds, type FieldDef, RATING_SCALES } from "../model/vocab";
import { shrinkToJpeg } from "../store/media";
import { cutoutAvailable, cutoutSubject } from "../../../modules/subject-mask";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, Chip, Chips, DateField, Err, Field, Half, Icon, Input, NumInput, Seg, Select, SheetH, TimeField, Two, TypeIco, ValInput, emptyVal, readVal, valFrom, useT } from "../ui";
import { PhotoView } from "../components/PhotoView";
import { AdjustPhoto } from "../components/AdjustPhoto";
import { providersOf } from "../model/providers";
import { CameraSheet } from "./camera";
import { ConcernSelect, Hint, RegionChips, resolveConcern } from "./common";
import { openAdd } from "./add";

/** opens the form; `start` opens the camera or the photo library straight away, for a photo button that already knows what it is of */
type Start = { camera?: boolean; library?: boolean; /** the label new photos get, e.g. Front or Back */ label?: string };
export function openForm(h: Health, type: EntryType, pre: Partial<Entry> = {}, start: Start = {}): void { h.openSheet(<EntryForm type={type} pre={pre} start={start} />); }

const withLabel = (p: Photo, l: string): Photo => { const q = { ...p }; const v = l.trim(); if (v) q.label = v; else delete q.label; return q; };

function KindSelect(props: { value: string; onChange: (v: string) => void }) {
  const h = useHealth();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const opts: [string, string][] = [...allKinds(h.D), ["__kindnew", "+ Add your own…"]];
  return (
    <>
      <Select value={props.value} options={opts} onChange={(v) => { if (v === "__kindnew") setAdding(true); else props.onChange(v); }} />
      {adding ? (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <View style={{ flex: 1 }}><Input value={name} onChange={setName} placeholder="Name it, like Naturopath or Optometrist" autoFocus /></View>
          <Btn small kind="dark" label="Add" onPress={() => {
            const n = name.trim(); if (!n) return setAdding(false);
            const ex = allKinds(h.D).find(([, l]) => l.toLowerCase() === n.toLowerCase());
            const id = ex ? ex[0] : "k-" + (n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || uid());
            if (!ex) h.mutate((D) => { D.settings.customKinds = { ...(D.settings.customKinds || {}), [id]: n }; });
            props.onChange(id); setAdding(false); setName("");
          }} />
        </View>
      ) : null}
    </>
  );
}

function EntryForm(props: { type: EntryType; pre: Partial<Entry>; start: Start }) {
  const h = useHealth();
  const t = useT();
  const { D, V } = h;
  const type = props.type, pre = props.pre, T = TYPES[type], d0 = pre.details || {};
  const [title, setTitle] = useState(pre.title || "");
  const [date, setDate] = useState(pre.occurred_at || today());
  // a new entry is logged as it happens, so the time is now; appointments are usually ahead
  const [time, setTime] = useState<string>(d0.time || (pre.id || type === "appointment" ? "" : nowHHMM()));
  const [endD, setEndD] = useState<string>(d0.end_date || "");
  const [endT, setEndT] = useState<string>(d0.end_time || "");
  const [det, setDet] = useState<Record<string, string>>(() => ({ ...Object.fromEntries(T.fields.map((f) => [f.k, d0[f.k] == null ? (f.t === "kind" ? "doctor" : f.t === "select" ? (f.o![0][0]) : "") : String(d0[f.k])])), ...(d0.provider_id ? { provider_id: String(d0.provider_id) } : {}) }));
  const [regs, setRegs] = useState<Set<string>>(new Set(pre.regions || (V.region ? [V.region] : [])));
  const [concern, setConcern] = useState(pre.concern_id || "");
  const [newConcern, setNewConcern] = useState("");
  const [notes, setNotes] = useState(pre.notes || "");
  const [photos, setPhotos] = useState<Photo[]>(() => (pre.id ? [] : pre.photos || []));
  const [files, setFiles] = useState<FileRef[]>([]);
  // body and face progress photos: the subject lifted off the background, on the phone (iOS 17+), unless the user keeps it
  const cutting = type === "photo" && cutoutAvailable;
  const seriesCut = det.series === "body" || det.series === "face";
  const [bgChoice, setBgChoice] = useState<"cut" | "keep" | null>(null);
  const keepBg = bgChoice ? bgChoice === "keep" : !seriesCut;
  // photos already on the entry (when editing) and the ones being added; tap one to zoom and position it
  const [kept, setKept] = useState<Photo[]>(() => (pre.id ? pre.photos || [] : []));
  const [adj, setAdj] = useState<{ list: "kept" | "new"; i: number } | null>(null);
  const [cuts, setCuts] = useState<Record<string, string | null>>({});
  const inflight = useRef(new Set<string>());
  useEffect(() => {
    if (!cutting) return;
    for (const p of photos) {
      const u = p.src;
      if (!u || !/^file:/.test(u) || cuts[u] !== undefined || inflight.current.has(u)) continue;
      inflight.current.add(u);
      cutoutSubject(u).then((c) => setCuts((m) => ({ ...m, [u]: c }))).finally(() => inflight.current.delete(u));
    }
  }, [cutting, photos]);
  const shown = (p: Photo): Photo => (cutting && !keepBg && p.src && cuts[p.src] ? { src: cuts[p.src]!, ...(p.fit ? { fit: p.fit } : {}) } : p);
  const cutN = cutting ? photos.filter((p) => p.src && cuts[p.src]).length : 0;
  const busyN = cutting ? photos.filter((p) => p.src && /^file:/.test(p.src) && cuts[p.src] === undefined).length : 0;
  const [cam, setCam] = useState(false);
  const [err, setErr] = useState("");
  // a photo's label (Front, Back, Left side…): under its thumbnail, tap to set
  const labelBtn = (l: string | undefined, set: (v: string) => void) => (
    <Pressable onPress={() => Alert.prompt("Label this photo", "Front, Back, Left side…", (v) => set(v || ""), "plain-text", l || "")} accessibilityRole="button" accessibilityLabel={l ? `Labelled ${l}. Change the label` : "Label this photo"} hitSlop={6}>
      <Text style={{ fontSize: 11, fontFamily: t.fontUISemi, color: l ? t.ink : t.muted }} numberOfLines={1}>{l || "Label…"}</Text>
    </Pressable>
  );
  // measurement
  const [mk, setMk] = useState<string>(d0.metric || Object.keys(D.metrics)[0] || "__new");
  const [nmL, setNmL] = useState(""); const [nmK, setNmK] = useState<MetricKind>("number"); const [nmU, setNmU] = useState(""); const [nmS, setNmS] = useState("/5");
  const kd: MetricKind = mk === "__new" ? nmK : mkind(D, mk);
  const units = unitPref(D);
  const [val, setVal] = useState(() => valFrom(mk === "__new" ? "number" : mkind(D, mk), mk === d0.metric ? (mk === "weight" && units.weight === "lb" && d0.value != null ? lbFromKg(+d0.value) : d0.value) : null));
  const [ftIn, setFtIn] = useState(() => { const c = mk === "height" && d0.metric === "height" && d0.value != null ? ftInFromCm(+d0.value) : null; return { ft: c ? String(c.ft) : "", inch: c ? String(c.inch) : "" }; });
  // appointment reading for a course
  const course = D.courses.find((x) => x.id === det.course_id), cm = course && course.metric ? D.metrics[course.metric] : null;
  const [reading, setReading] = useState<string>(pre.id ? String(readingFor(D, pre.id)?.details.value ?? "") : "");
  const overlay = useMemo<Photo | null>(() => {
    if (type !== "photo") return null;
    const series = det.series, region = [...regs][0];
    const last = D.entries.filter((e) => e.photos.length && (series === "body" || series === "face" ? e.details.series === series : region ? e.regions.includes(region) && e.details.series !== "body" : false)).sort(byDateDesc())[0];
    if (!last) return null;
    const want = (props.start.label || "").toLowerCase();
    return (want && last.photos.find((p) => (p.label || "").toLowerCase() === want)) || last.photos[0];
  }, [type, det.series, regs, D.entries]);

  // opened from a camera button: the sheet is still sliding in, so the camera or picker follows just after
  useEffect(() => {
    if (!props.start.camera && !props.start.library) return;
    const id = setTimeout(() => { if (props.start.camera) setCam(true); else fromLibrary(); }, 450);
    return () => clearTimeout(id);
  }, []);
  async function fromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 6, quality: 1 });
    if (res.canceled) return;
    const out: Photo[] = [];
    for (const a of res.assets) { const s = await shrinkToJpeg(a.uri, a.width, a.height); out.push(withLabel({ src: s.uri }, props.start.label || "")); }
    setPhotos((p) => [...p, ...out]);
  }
  async function pickFiles() {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return;
    setFiles((f) => [...f, ...res.assets.map((a) => ({ name: a.name, size: a.size ?? null, type: a.mimeType ?? null, localUri: a.uri }))]);
  }
  function field(f: FieldDef) {
    if (f.only && det.kind !== f.only) return null;
    if (f.t === "metric") return null; // the measure has its own row below
    const v = det[f.k] ?? "";
    const set = (x: string) => setDet((p) => ({ ...p, [f.k]: x }));
    let inp: React.ReactNode;
    if (f.t === "plan") inp = <Select value={v} options={[["", "No"], ...D.plans.slice().sort((a, b) => b.year - a.year).map((p) => [p.id, `${p.title} (${p.year})`] as [string, string])]} onChange={set} />;
    else if (f.t === "course") inp = <Select value={v} options={[["", "No"], ...D.courses.map((k) => [k.id, k.title] as [string, string])]} onChange={(x) => { set(x); const k = D.courses.find((c) => c.id === x); if (k) setDet((p) => ({ ...p, course_id: x, cost: p.cost || (k.cost != null ? String(k.cost) : ""), provider: p.provider || k.provider || "" })); }} />;
    else if (f.t === "provider") {
      const cur = det.provider_id || "", ps = providersOf(D).filter((p) => !p.archived || p.id === cur);
      inp = (
        <View style={{ gap: 6 }}>
          {ps.length ? <Select value={cur} options={[["", "Someone else"], ...ps.map((p) => [p.id, p.name] as [string, string])]} onChange={(id) => { const p = ps.find((x) => x.id === id); setDet((q) => ({ ...q, provider_id: id, provider: p ? p.name : "", practice: p ? (p.practice || "") : q.practice })); }} /> : null}
          {!cur ? <Input value={v} onChange={set} placeholder={f.p} /> : null}
        </View>
      );
    }
    else if (f.t === "kind") inp = <KindSelect value={v || "doctor"} onChange={set} />;
    else if (f.t === "select") inp = <Select value={v} options={f.o!} onChange={set} />;
    else if (f.t === "area") inp = <Input value={v} onChange={set} multiline />;
    else if (f.t === "number") inp = <NumInput value={v} onChange={set} placeholder={f.p} />;
    else if (f.t === "date") inp = <DateField value={v} onChange={set} clearable placeholder="–" />;
    else inp = <Input value={v} onChange={set} placeholder={f.p} />;
    const el = <Field key={f.k} label={f.l}>{inp}</Field>;
    return f.full ? <View key={f.k} style={{ width: "100%" }}>{el}</View> : <Half key={f.k}>{el}</Half>;
  }

  function save() {
    setErr("");
    const d: Record<string, any> = {};
    T.fields.forEach((f) => { const v = det[f.k]; if (v !== undefined && v !== "" && f.t !== "metric") d[f.k] = f.t === "number" ? +v : v; });
    if (type === "appointment") { if (det.provider_id) d.provider_id = det.provider_id; else delete d.provider_id; }
    let ttl = title.trim();
    let metricKey = mk;
    let newMetric: { k: string; m: any } | null = null;
    let value: number | null = null;
    if (type === "measurement") {
      if (mk === "height" && units.height === "ft") {
        if (ftIn.ft.trim() === "" && ftIn.inch.trim() === "") return setErr("Enter a value.");
        value = cmFromFtIn(+ftIn.ft.replace(",", ".") || 0, +ftIn.inch.replace(",", ".") || 0);
      } else {
        value = readVal(kd, val);
        if (value == null) return setErr("Enter a value.");
        if (mk === "weight" && units.weight === "lb") value = kgFromLb(value);
      }
      if (mk === "__new") { const l = nmL.trim(); if (!l) return setErr("Name the new measure."); metricKey = "x_" + uid(); newMetric = { k: metricKey, m: nmK === "rating" ? { l, u: nmS, kind: "rating", rating: true } : { l, u: nmK === "number" ? nmU.trim() : "", kind: nmK } }; }
      d.metric = metricKey; d.value = value;
    }
    if (!ttl && type === "food_trial" && d.food) ttl = "Reintroduced " + String(d.food).toLowerCase();
    if (!ttl && type !== "measurement") return setErr("Give it a short title.");
    if (time) d.time = time;
    if (type === "observation" && (endD || endT)) {
      if ((endD || date) < date || ((endD || date) === date && endT && time && endT < time)) return setErr("The end is before the start.");
      d.end_date = endD || date; if (endT) d.end_time = endT;
    }
    let failed = "";
    h.mutate((D) => {
      if (newMetric) D.metrics[newMetric.k] = newMetric.m;
      const r2 = new Set(regs); if (type === "measurement" && !r2.size) r2.add("whole_body");
      const c = resolveConcern(D, concern, newConcern, r2, date);
      if (c.err) { failed = c.err; return; }
      if (type === "measurement") ttl = `${metric(D, metricKey).l} ${fmtM(D, metricKey, value!)}`;
      const entry: Entry = { id: pre.id || uid(), type, occurred_at: date, title: ttl, notes, regions: [...r2], concern_id: c.id, parent_entry_id: pre.parent_entry_id || null, details: d, source: pre.source || "manual", photos: pre.id ? [...kept, ...photos.map(shown)] : photos.map(shown), files: [...(pre.files || []), ...files] };
      const i = D.entries.findIndex((x) => x.id === entry.id);
      if (i >= 0) D.entries[i] = entry; else D.entries.push(entry);
      if (type === "appointment") {
        const k = D.courses.find((x) => x.id === d.course_id), old = readingFor(D, entry.id), rv = reading.trim();
        if (k && k.metric && rv !== "" && !isNaN(+rv)) {
          const M = metric(D, k.metric), m: Entry = { id: old ? old.id : uid(), type: "measurement", occurred_at: entry.occurred_at, title: `${M.l} ${fmtV(+rv, M.u)}`, notes: "", regions: entry.regions.length ? entry.regions : ["whole_body"], concern_id: entry.concern_id, parent_entry_id: null, details: { metric: k.metric, value: +rv, from_appt: entry.id }, source: "manual", photos: [], files: [] };
          if (old) Object.assign(old, m); else D.entries.push(m);
        }
      }
      if (pre.fromSuggestion) { const s = D.suggestions.find((s) => s.id === pre.fromSuggestion); if (s) s.status = "accepted"; }
    });
    if (failed) return setErr(failed);
    h.closeSheet();
    h.setV({ frame: null });
  }

  return (
    <View style={{ gap: 12 }}>
      <SheetH title={T.label} icon={<TypeIco k={type} small />} onClose={h.closeSheet} />
      {type !== "measurement" ? <Field label="Title"><Input value={title} onChange={setTitle} placeholder={type === "appointment" ? "Dental cleaning" : type === "photo" ? "Left cheek, morning" : "Short description"} /></Field> : null}
      <Two>
        <Half><Field label="Date"><DateField value={date} onChange={setDate} /></Field></Half>
        <Half><Field label="Time (optional)"><TimeField value={time} onChange={setTime} /></Field></Half>
        {type === "observation" ? <><Half><Field label="Ended (optional)"><DateField value={endD} onChange={setEndD} clearable placeholder="–" /></Field></Half><Half><Field label="End time"><TimeField value={endT} onChange={setEndT} /></Field></Half></> : null}
        {T.fields.map(field)}
      </Two>
      {type === "measurement" ? (
        <>
          <Field label="Measure"><Select value={mk} options={[...Object.entries(D.metrics).map(([k, m]) => [k, `${m.l} (${k === "weight" || k === "height" ? unitWord(D, k) : m.rating ? unitLabel(m.u) : m.u})`] as [string, string]), ["__new", "New measure…"]]} onChange={(v) => { setMk(v); setVal(emptyVal()); }} /></Field>
          {mk === "__new" ? <Two><Half><Field label="Name the measure"><Input value={nmL} onChange={setNmL} placeholder="e.g. Waist, bedtime, lump size" /></Field></Half><Half><Field label="It's…"><Select value={nmK} options={KIND_OPTS} onChange={(v) => { setNmK(v as MetricKind); setVal(emptyVal()); }} /></Field></Half>{nmK === "number" ? <Half><Field label="Unit"><Input value={nmU} onChange={setNmU} placeholder="cm, kg, mm" /></Field></Half> : null}{nmK === "rating" ? <Half><Field label="Scale" hint="Fixed once chosen: start a new measure to change it."><Select value={nmS} options={RATING_SCALES} onChange={setNmS} /></Field></Half> : null}</Two> : null}
          {mk === "weight" || mk === "height" ? (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
              <View style={{ flex: 1 }}>
                {mk === "height" && units.height === "ft" ? (
                  <Field label="Value">
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <NumInput value={ftIn.ft} onChange={(ft) => setFtIn((p) => ({ ...p, ft }))} integer style={{ width: 80 }} /><Text style={{ color: t.muted }}>ft</Text>
                      <NumInput value={ftIn.inch} onChange={(inch) => setFtIn((p) => ({ ...p, inch }))} style={{ width: 80 }} /><Text style={{ color: t.muted }}>in</Text>
                    </View>
                  </Field>
                ) : <ValInput kind={kd} label={`Value (${mk === "weight" ? units.weight : "cm"})`} value={val} onChange={setVal} />}
              </View>
              <View style={{ paddingBottom: 2 }}>
                <Seg small value={mk === "weight" ? units.weight : units.height} options={mk === "weight" ? [["kg", "kg"], ["lb", "lb"]] : [["cm", "cm"], ["ft", "ft in"]]} onChange={(u) => {
                  // switching the unit converts what has been typed so nothing is lost
                  if (mk === "weight") { const n = readVal(kd, val); if (n != null) setVal(valFrom(kd, u === "lb" ? lbFromKg(n) : kgFromLb(n))); }
                  else if (u === "ft") { const n = readVal(kd, val); const c = n != null ? ftInFromCm(n) : null; setFtIn({ ft: c ? String(c.ft) : "", inch: c ? String(c.inch) : "" }); }
                  else if (ftIn.ft !== "" || ftIn.inch !== "") setVal(valFrom(kd, cmFromFtIn(+ftIn.ft || 0, +ftIn.inch || 0)));
                  h.mutate((D) => setUnit(D, mk as "weight" | "height", u as any));
                }} />
              </View>
            </View>
          ) : <ValInput kind={kd} label="Value" value={val} onChange={setVal} unit={mk === "__new" ? (nmK === "rating" ? nmS : nmU) : (D.metrics[mk] || {}).u} />}
        </>
      ) : null}
      {type === "appointment" && cm ? <Field label={`Your ${cm.l.toLowerCase()} today (${cm.rating ? unitLabel(cm.u) : cm.u})`}><NumInput value={reading} onChange={setReading} /></Field> : null}
      {type !== "measurement" ? <Field label="Body areas"><RegionChips value={regs} onChange={(r) => { setRegs(r); if (type === "photo" && (det.series || "none") === "none") { if (r.has("whole_body")) setDet((q) => ({ ...q, series: "body" })); else if (r.has("face")) setDet((q) => ({ ...q, series: "face" })); } }} /></Field> : null}
      <ConcernSelect value={concern} onChange={setConcern} newName={newConcern} onNewName={setNewConcern} />
      {type !== "measurement" ? <Field label="Photos or files">
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Btn small label="Take photo" left={<Icon k="photo" size={14} />} onPress={() => { if (!h.needVault()) setCam(true); }} />
          <Btn small label="From library" onPress={() => { if (!h.needVault()) fromLibrary(); }} />
          <Btn small label="Attach file" left={<Icon k="file" size={14} />} onPress={() => { if (!h.needVault()) pickFiles(); }} />
        </View>
        {kept.length || photos.length || files.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {kept.map((p, i) => <View key={"k" + i} style={{ alignItems: "center", gap: 3 }}><Pressable onPress={() => setAdj({ list: "kept", i })} accessibilityRole="imagebutton" accessibilityLabel="Photo, tap to zoom and position"><PhotoView photo={p} style={{ width: 72, height: 72 }} /></Pressable>{labelBtn(p.label, (l) => setKept((ps) => ps.map((q, j) => (j === i ? withLabel(q, l) : q))))}</View>)}
            {photos.map((p, i) => <View key={i} style={{ alignItems: "center", gap: 3 }}><Pressable onPress={() => setAdj({ list: "new", i })} onLongPress={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} accessibilityRole="imagebutton" accessibilityLabel="Photo, tap to zoom and position, hold to remove"><PhotoView photo={shown(p)} style={{ width: 72, height: 72 }} /></Pressable>{labelBtn(p.label, (l) => setPhotos((ps) => ps.map((q, j) => (j === i ? withLabel(q, l) : q))))}</View>)}
            {files.map((f, i) => <Pressable key={"f" + i} onLongPress={() => setFiles((fs) => fs.filter((_, j) => j !== i))} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: t.soft, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 }}><Icon k="file" size={14} /><Text style={{ fontSize: 12.5, fontFamily: t.fontUISemi, color: t.ink }}>{f.name}</Text></Pressable>)}
          </View>
        ) : null}
        {photos.length || files.length ? <Hint>Press and hold one to remove it.</Hint> : null}
        {cutN || busyN ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            {cutN ? <Chips><Chip small label="Background removed" on={!keepBg} onPress={() => setBgChoice("cut")} /><Chip small label="Keep background" on={keepBg} onPress={() => setBgChoice("keep")} /></Chips> : null}
            {busyN ? <Hint>Lifting the subject off the background…</Hint> : null}
          </View>
        ) : null}
      </Field> : null}
      <Field label="Notes"><Input value={notes} onChange={setNotes} multiline /></Field>
      <Acts left={<Btn label="← Back" onPress={() => openAdd(h, pre)} />} right={<Btn kind="accent" label="Save" onPress={save} />} />
      <Err>{err}</Err>
      <CameraSheet open={cam} overlay={overlay} guide={det.series === "body" || det.series === "face" ? det.series : null} onClose={() => setCam(false)} onShot={(uri) => { setPhotos((p) => [...p, withLabel({ src: uri }, props.start.label || "")]); setCam(false); }} />
      <AdjustPhoto photo={adj ? (adj.list === "kept" ? kept[adj.i] : shown(photos[adj.i])) : null} outline={det.series === "body" ? "body" : det.series === "face" ? "face" : null} onClose={() => setAdj(null)} onSave={(fit) => {
        const a = adj; if (!a) return;
        const upd = (p: Photo): Photo => { const q = { ...p }; if (fit) q.fit = fit; else delete q.fit; return q; };
        if (a.list === "kept") setKept((l) => l.map((p, j) => (j === a.i ? upd(p) : p))); else setPhotos((l) => l.map((p, j) => (j === a.i ? upd(p) : p)));
      }} />
    </View>
  );
}
