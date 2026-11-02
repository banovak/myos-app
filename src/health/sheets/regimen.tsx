// The regimen / diet form, with colour, target, "counts as done when", dose
// history and the adherence log. Its stints (started, stopped, started again)
// are edited here; Start again opens it with a new open stint from today.
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { addDays, fmt, today, uid } from "../model/dates";
import { logsOf, regimenStopped, setStints, stintsOf } from "../model/regimens";
import type { Photo, Regimen, Stint } from "../model/types";
import { shrinkToJpeg } from "../store/media";
import { Lightbox, PhotoView } from "../components/PhotoView";
import { CameraSheet } from "./camera";
import { ALL_COLORS, REG_CATS, SOURCES, isHex } from "../model/vocab";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, DateField, Err, Field, Half, Icon, Input, NumInput, Pill, Row, RowText, Sec, Select, SheetH, Two, TypeIco, useT } from "../ui";
import { PaletteRows } from "../screens/Charts";
import { RemindBtn } from "../components/Widgets";
import { ConcernSelect, Hint, RegionChips, resolveConcern } from "./common";

/** the form; `again` opens a stopped one with a new stint, from today, already added */
export function openRegimen(h: Health, pre: Partial<Regimen>, opts?: { again?: boolean }): void { h.openSheet(<RegimenForm pre={pre} again={!!(opts && opts.again)} />); }

function RegimenForm(props: { pre: Partial<Regimen>; again?: boolean }) {
  const h = useHealth();
  const t = useT();
  const { D, V } = h;
  const pre = props.pre, diet = pre.category === "diet", T = today();
  const used = new Set(D.regimens.map((r) => r.color));
  const [pick, setPick] = useState<string>(pre.color || ALL_COLORS.filter((_, i) => i % 4 >= 1).find((c) => !used.has(c)) || ALL_COLORS[1]);
  const [name, setName] = useState(pre.name || "");
  const [cat, setCat] = useState(pre.category && pre.category !== "diet" ? pre.category : "supplement");
  const [dose, setDose] = useState(pre.dose || "");
  const [freq, setFreq] = useState(pre.frequency || "");
  // the stints: what it has, plus a new open one when starting again
  const [stints, setSt] = useState<Stint[]>(() => [...(pre.started_on ? stintsOf(pre as Regimen).map((p) => ({ ...p })) : [{ from: T, to: null }]), ...(props.again ? [{ from: T, to: null }] : [])]);
  const upd = (i: number, p: Partial<Stint>) => setSt((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const [regs, setRegs] = useState<Set<string>>(new Set(pre.regions || (diet ? ["whole_body"] : V.region ? [V.region] : [])));
  const [concern, setConcern] = useState(pre.concern_id || "");
  const [newConcern, setNewConcern] = useState("");
  const [tc, setTc] = useState(String((pre.target || {}).count || ""));
  const [tp, setTp] = useState((pre.target || {}).per || "week");
  const [ms, setMs] = useState((pre.match || {}).source || "manual");
  const [ma, setMa] = useState((pre.match || {}).activity || "");
  const [chg, setChg] = useState(T);
  const [logD, setLogD] = useState(T);
  const [notes, setNotes] = useState(pre.notes || "");
  const [err, setErr] = useState("");
  const [armed, setArmed] = useState(false);
  const logs = pre.id ? logsOf(D, pre.id).slice(0, 12) : [];
  // photos of the product: the ones already on it and the ones being added; hold one to remove it
  const [photos, setPhotos] = useState<Photo[]>(() => (pre.photos || []).map((p) => ({ ...p })));
  const [cam, setCam] = useState(false);
  const [look, setLook] = useState<Photo | null>(null);
  async function fromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 4, quality: 1 });
    if (res.canceled) return;
    const out: Photo[] = [];
    for (const a of res.assets) { const s = await shrinkToJpeg(a.uri, a.width, a.height); out.push({ src: s.uri }); }
    setPhotos((p) => [...p, ...out]);
  }

  function save() {
    setErr("");
    if (!name.trim()) return setErr(diet ? "Describe the diet." : "Give it a name.");
    if (stints.some((p) => p.to && p.to < p.from)) return setErr("A stop date is before its start date.");
    const ss = stints.map((p) => ({ from: p.from, to: p.to || null })).sort((a, b) => (a.from < b.from ? -1 : 1));
    for (let i = 0; i + 1 < ss.length; i++) if (!ss[i].to || ss[i].to! >= ss[i + 1].from) return setErr("The stints overlap: stop one before the next starts.");
    const from = ss[0].from;
    let failed = "";
    h.mutate((D) => {
      let cid = pre.concern_id || null;
      if (!diet) { const c = resolveConcern(D, concern, newConcern, regs, from); if (c.err) { failed = c.err; return; } cid = c.id; }
      const nd = diet ? "" : dose.trim(), nf = diet ? "" : freq.trim(), changes = [...(pre.changes || [])];
      if (pre.id && !diet && (nd !== (pre.dose || "") || nf !== (pre.frequency || ""))) { changes.push({ on: chg || T, dose: nd, frequency: nf, prev_dose: pre.dose || "", prev_frequency: pre.frequency || "" }); changes.sort((a, b) => (a.on < b.on ? -1 : 1)); }
      const tcn = diet ? 0 : +tc, target = tcn > 0 ? { count: tcn, per: tp as any } : null;
      const match = diet || ms === "manual" ? { source: "manual" } : { source: ms, activity: ma.trim() };
      const r: Regimen = { id: pre.id || "r-" + uid(), name: name.trim(), category: diet ? "diet" : (cat as any), dose: nd, frequency: nf, started_on: from, ended_on: null, regions: [...regs], concern_id: cid, notes, color: pick, target, match, changes, ...(photos.length ? { photos } : {}) };
      setStints(r, ss);
      // one diet at a time: another diet still open when this one's open stint starts is stopped the day before
      const open = diet ? ss.find((p) => !p.to) : undefined;
      if (open) D.regimens.forEach((x) => {
        if (x.id === r.id || x.category !== "diet" || regimenStopped(x, open.from)) return;
        const xs = stintsOf(x), last = xs[xs.length - 1];
        if (!last.to && last.from < open.from) setStints(x, [...xs.slice(0, -1), { from: last.from, to: addDays(open.from, -1) }]);
      });
      const i = D.regimens.findIndex((x) => x.id === r.id);
      if (i >= 0) D.regimens[i] = r; else D.regimens.push(r);
    });
    if (failed) return setErr(failed);
    h.closeSheet();
  }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={props.again ? "Start again" : `${pre.id ? "Edit " : ""}${diet ? "Diet" : "Regimen"}`} icon={<TypeIco k={diet ? "diet" : "regimen"} small />} onClose={h.closeSheet} />
      {pre.id && !diet ? <RemindBtn kind="regimen" id={pre.id} /> : null}
      {props.again ? <Hint>A new stint, from the start date you pick. Its earlier stints, its log and its colour stay with it, and it comes back to Active.</Hint> : null}
      <Field label={diet ? "Describe the diet" : "Name"}><Input value={name} onChange={setName} placeholder={diet ? "Mediterranean, or no alcohol" : "Magnesium glycinate, morning stretches"} /></Field>
      <Two>
        {!diet ? <><Half><Field label="Kind"><Select value={cat} options={REG_CATS} onChange={(v) => setCat(v as any)} /></Field></Half><Half><Field label="Dose or amount"><Input value={dose} onChange={setDose} placeholder="50 mg" /></Field></Half><Half><Field label="How often"><Input value={freq} onChange={setFreq} placeholder="Daily, 3× a week" /></Field></Half></> : null}
        {stints.length === 1 ? <>
          <Half><Field label="Started"><DateField value={stints[0].from} onChange={(v) => upd(0, { from: v })} /></Field></Half>
          <Half><Field label="Stopped (blank if ongoing)"><DateField value={stints[0].to || ""} onChange={(v) => upd(0, { to: v || null })} clearable placeholder="Ongoing" /></Field></Half>
        </> : null}
      </Two>
      {stints.length > 1 ? (
        <Field label="Stints" hint="Each time it was started and stopped. Stop the last one, or start it again below.">
          <View style={{ gap: 10 }}>
            {stints.map((p, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <View style={{ flex: 1 }}><Field label={i === 0 ? "Started" : undefined}><DateField value={p.from} onChange={(v) => upd(i, { from: v })} /></Field></View>
                <View style={{ flex: 1 }}><Field label={i === 0 ? "Stopped" : undefined}><DateField value={p.to || ""} onChange={(v) => upd(i, { to: v || null })} clearable placeholder="Ongoing" /></Field></View>
                <Pressable onPress={() => setSt((s) => s.filter((_, j) => j !== i))} hitSlop={8} style={{ paddingBottom: 10 }} accessibilityRole="button" accessibilityLabel="Remove this stint"><Icon k="close" size={16} color={t.muted} /></Pressable>
              </View>
            ))}
          </View>
        </Field>
      ) : null}
      {stints.every((p) => p.to) ? <View style={{ flexDirection: "row" }}><Btn small label="+ Start again" onPress={() => setSt((s) => [...s, { from: T, to: null }])} /></View> : null}
      {!diet ? <><Field label="Body areas"><RegionChips value={regs} onChange={setRegs} /></Field><ConcernSelect value={concern} onChange={setConcern} newName={newConcern} onNewName={setNewConcern} /></> : null}
      {!diet ? (
        <Two>
          <Half><Field label="Aim for (optional)"><View style={{ flexDirection: "row", gap: 8 }}><NumInput value={tc} onChange={setTc} integer placeholder="2" style={{ width: 80 }} /><View style={{ flex: 1 }}><Select value={tp} options={[["day", "per day"], ["week", "per week"], ["month", "per month"]]} onChange={(v) => setTp(v as "day" | "week" | "month")} /></View></View></Field></Half>
          <Half><Field label="Counts as done when"><Select value={ms} options={SOURCES} onChange={setMs} /></Field></Half>
          {ms !== "manual" ? <Half><Field label="Of type"><Input value={ma} onChange={setMa} placeholder="Yoga, Run, Swim" /></Field><Hint>This ticks itself off once that app is connected. Until then, tick it off yourself.</Hint></Half> : null}
          {pre.id ? <Half><Field label="If you changed the dose or how often, the change started"><DateField value={chg} onChange={setChg} /></Field></Half> : null}
        </Two>
      ) : null}
      {pre.id && !diet && (pre.changes || []).length ? <View><Sec>Dose history</Sec><View style={{ gap: 8 }}>{pre.changes!.slice().sort((a, b) => (a.on < b.on ? 1 : -1)).map((c, i) => <Row key={i}><RowText title={fmt(c.on)} sub={`${c.prev_dose || "–"} → ${c.dose || "–"}${c.frequency !== c.prev_frequency ? ` · ${c.prev_frequency || "–"} → ${c.frequency || "–"}` : ""}`} /></Row>)}</View></View> : null}
      {pre.id && !diet ? (
        <View>
          <Sec>Logged</Sec>
          <View style={{ gap: 8 }}>{logs.length ? logs.map((l) => <Row key={l.id}><View style={{ flexDirection: "row", gap: 6, alignItems: "center", flex: 1 }}><Text style={{ fontFamily: t.fontUIBold, color: t.ink, fontSize: 13.5 }}>{fmt(l.on_date)}</Text>{l.source !== "manual" ? <Pill kind="src">{l.source}</Pill> : null}</View><Btn small label="Remove" onPress={() => h.mutate((D) => { D.regLogs = D.regLogs.filter((x) => x.id !== l.id); })} /></Row>) : <Text style={{ color: t.muted, fontSize: 13, fontFamily: t.fontUI }}>Nothing logged yet.</Text>}</View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 }}><View style={{ flex: 1 }}><DateField value={logD} onChange={setLogD} /></View><Btn small label="+ Log this day" onPress={() => h.mutate((D) => { D.regLogs.push({ id: "rl-" + uid(), regimen_id: pre.id!, on_date: logD || T, time: null, source: "manual", note: "" }); })} /></View>
        </View>
      ) : null}
      <Field label={diet ? "Photos" : "Photos of the product"} hint={diet ? undefined : "The pack, the label, the dose: for the record."}>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Btn small label="Take photo" left={<Icon k="photo" size={14} />} onPress={() => { if (!h.needVault()) setCam(true); }} />
          <Btn small label="From library" onPress={() => { if (!h.needVault()) fromLibrary(); }} />
        </View>
        {photos.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {photos.map((p, i) => <Pressable key={p.path || p.src || i} onPress={() => setLook(p)} onLongPress={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} accessibilityRole="imagebutton" accessibilityLabel="Photo, tap to see it, hold to remove"><PhotoView photo={p} style={{ width: 72, height: 72 }} /></Pressable>)}
          </View>
        ) : null}
        {photos.length ? <Hint>Press and hold one to remove it.</Hint> : null}
      </Field>
      <Field label="Colour on charts"><PaletteRows current={isHex(pick) || pick === "var(--accent)" ? pick : undefined} onPick={setPick} /></Field>
      <Field label="Notes"><Input value={notes} onChange={setNotes} multiline /></Field>
      {diet && (!pre.id || props.again) ? <Hint>If another diet is current, it will be marked as stopped the day before this one starts.</Hint> : null}
      <Acts left={pre.id ? <Btn label={armed ? "Tap again to delete" : "Delete"} onPress={() => { if (!armed) return setArmed(true); h.mutate((D) => { D.regimens = D.regimens.filter((r) => r.id !== pre.id); D.regLogs = (D.regLogs || []).filter((l) => l.regimen_id !== pre.id); }); h.closeSheet(); }} /> : undefined} right={<Btn kind="accent" label="Save" onPress={save} />} />
      <Err>{err}</Err>
      <CameraSheet open={cam} overlay={null} onClose={() => setCam(false)} onShot={(uri) => { setPhotos((p) => [...p, { src: uri }]); setCam(false); }} />
      <Lightbox photo={look} onClose={() => setLook(null)} />
    </View>
  );
}
