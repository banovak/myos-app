// New or edit reminder. Asks for notification permission the first time one
// is saved, never at install. Concern reminders are private by default.
import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { today, uid } from "../model/dates";
import { WD, remDefaultTitle, remFor, remTarget } from "../model/reminders";
import type { Reminder, ReminderKind, Repeat } from "../model/types";
import { useHealth, type Health } from "../state/HealthContext";
import { notificationsAllowed, requestNotifications, PRIVATE_TEXT } from "../notifications/reminders";
import { Acts, Btn, Check, Chip, Chips, DateField, Err, Field, Half, Icon, Input, NumInput, P, Seg, SheetH, TimeField, Two, useT } from "../ui";

export function openRemind(h: Health, o: { kind?: ReminderKind; id?: string | null; rid?: string }): void { h.openSheet(<ReminderForm o={o} />); }

function ReminderForm(props: { o: { kind?: ReminderKind; id?: string | null; rid?: string } }) {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const o = props.o;
  const ex = o.rid ? (D.reminders || []).find((r) => r.id === o.rid) : o.kind && o.kind !== "custom" ? remFor(D, o.kind, o.id ?? null) : undefined;
  const r: Reminder = ex || { id: "rm-" + uid(), title: remDefaultTitle(D, o.kind || "custom", o.id ?? null), target_kind: o.kind || "custom", target_id: o.id ?? null, schedule: { repeat: "daily", time: "09:00", days: [1, 2, 3, 4, 5, 6, 7], monthday: 1, date: today() }, private: o.kind === "concern", skip_if_done: true, enabled: true };
  const sc = { days: [1, 2, 3, 4, 5, 6, 7], monthday: 1, date: today(), time: "09:00", repeat: "daily" as Repeat, ...r.schedule };
  const [title, setTitle] = useState(r.title);
  const [rep, setRep] = useState<Repeat>(sc.repeat || "daily");
  const [days, setDays] = useState<Set<number>>(new Set(sc.days));
  const [md, setMd] = useState(String(sc.monthday || 1));
  const [date, setDate] = useState(sc.date || today());
  const [time, setTime] = useState(sc.time || "09:00");
  const [priv, setPriv] = useState(!!r.private);
  const [skip, setSkip] = useState(r.skip_if_done !== false);
  const [paused, setPaused] = useState(!r.enabled);
  const [err, setErr] = useState("");
  const [armed, setArmed] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => { notificationsAllowed().then(setAllowed); }, []);
  const tgt = r.target_kind !== "custom" ? remTarget(D, r) : null;
  async function save() {
    const tt = title.trim();
    if (!tt) return setErr("Say what it should remind you of.");
    if (rep === "weekly" && !days.size) return setErr("Pick at least one day.");
    if (allowed === false) { const ok = await requestNotifications(); setAllowed(ok); }
    const o2: Reminder = { ...r, title: tt, schedule: { repeat: rep, time: time || "09:00", ...(rep === "weekly" ? { days: [...days].sort() } : {}), ...(rep === "monthly" ? { monthday: Math.min(28, Math.max(1, +md || 1)) } : {}), ...(rep === "once" ? { date: date || today() } : {}) }, private: priv, skip_if_done: r.target_kind !== "custom" ? skip : false, enabled: !paused };
    h.mutate((D) => { D.reminders = (D.reminders || []).filter((x) => x.id !== r.id); D.reminders.push(o2); });
    h.closeSheet();
  }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={ex ? "Edit reminder" : "New reminder"} icon={<Icon k="bell" size={18} stroke={2} />} onClose={h.closeSheet} />
      {tgt ? <P style={{ marginBottom: 0 }}>For: <Text style={{ fontFamily: t.fontUIBold, color: t.ink }}>{tgt.label}</Text></P> : null}
      <Field label="What it says"><Input value={title} onChange={setTitle} placeholder="Take iron, scalp photo, drink water" /></Field>
      <Field label="Repeat"><Seg value={rep} options={[["daily", "Every day"], ["weekly", "Some days"], ["monthly", "Monthly"], ["once", "Once"]]} onChange={(v) => setRep(v as Repeat)} wrap /></Field>
      {rep === "weekly" ? <Field label="On"><Chips>{WD.map((d, i) => <Chip key={d} label={d} on={days.has(i + 1)} onPress={() => setDays((p) => { const n = new Set(p); n.has(i + 1) ? n.delete(i + 1) : n.add(i + 1); return n; })} />)}</Chips></Field> : null}
      <Two>
        {rep === "monthly" ? <Half><Field label="Day of the month"><NumInput value={md} onChange={setMd} integer /></Field></Half> : null}
        {rep === "once" ? <Half><Field label="Date"><DateField value={date} onChange={setDate} /></Field></Half> : null}
        <Half><Field label="Time"><TimeField value={time} onChange={setTime} /></Field></Half>
      </Two>
      <Check value={priv} onChange={setPriv} label="Keep it private on the lock screen" hint={`Shows "${PRIVATE_TEXT}" instead.`} />
      {r.target_kind !== "custom" ? <Check value={skip} onChange={setSkip} label="Skip it if I've already done it that day" /> : null}
      {ex ? <Check value={paused} onChange={setPaused} label="Pause this reminder" /> : null}
      {allowed === false ? <View style={{ backgroundColor: t.accentSoft, borderRadius: 14, padding: 12, gap: 6 }}><Text style={{ fontSize: 13, color: t.ink, fontFamily: t.fontUISemi }}>Notifications are off, so this won't arrive yet.</Text><Text style={{ fontSize: 12.5, color: t.muted, fontFamily: t.fontUI }}>Saving asks for permission. If it stays off, turn it on in Settings.</Text><Btn small label="Open Settings" onPress={() => Linking.openSettings()} /></View> : null}
      <Acts left={ex ? <Btn label={armed ? "Tap again to delete" : "Delete"} onPress={() => { if (!armed) return setArmed(true); h.mutate((D) => { D.reminders = D.reminders.filter((x) => x.id !== r.id); }); h.closeSheet(); }} /> : undefined} right={<Btn kind="accent" label="Save" onPress={save} />} />
      <Err>{err}</Err>
    </View>
  );
}
