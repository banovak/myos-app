// Apple Health settings: connect (read-only), what is read, sync now, disconnect.
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { useHealth, type Health } from "../state/HealthContext";
import { appleHealthAvailable, appleHealthLast, appleHealthOn, connectAppleHealth, disconnectAppleHealth, syncAppleHealth } from "../healthkit/sync";
import { HK_ITEMS, hkUse } from "../model/hkuse";
import { Acts, Btn, Err, P, Pill, Row, RowText, Sec, Seg, SheetH, useT } from "../ui";

export function openAppleHealth(h: Health): void { h.openSheet(<AppleHealthSheet />); }

function AppleHealthSheet() {
  const h = useHealth();
  const t = useT();
  const [avail, setAvail] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const refresh = async () => { setAvail(await appleHealthAvailable()); setOn(await appleHealthOn()); setLast(await appleHealthLast()); };
  useEffect(() => { refresh(); }, []);
  async function sync() {
    setBusy(true); setErr(""); setMsg("");
    try {
      const n = await syncAppleHealth(h.store, h.D);
      setMsg(`Read ${n.daily} daily values, ${n.cycle} cycle days and ${n.logs} workouts.`);
      if (h.store.mode === "supabase") await h.reload(); else h.mutate(() => {});
      setLast(await appleHealthLast());
    } catch (e: any) { setErr(e?.message || String(e)); } finally { setBusy(false); }
  }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="Apple Health" onClose={h.closeSheet} />
      <P>Read-only. Daily values, your cycle and workouts come into your own record; nothing is ever written back to Health. Garmin, Oura, Whoop, MyFitnessPal and cycle apps arrive this way when you let them write to Health.</P>
      {Platform.OS !== "ios" || avail === false ? <P>Apple Health isn't available on this device.</P> : null}
      <Row style={{ alignItems: "flex-start" }}>
        <RowText title="Connection" sub={on ? (last ? `Connected · last read ${new Date(last).toLocaleString()}` : "Connected · not read yet") : "Not connected"} />
        {on ? <Pill kind="up">On</Pill> : <Btn kind="accent" small label="Connect" disabled={!avail} onPress={async () => { setErr(""); try { const ok = await connectAppleHealth(); if (!ok) return setErr("Health didn't grant access. You can change it in the Health app under Sharing → Apps."); await refresh(); await sync(); } catch (e: any) { setErr(e?.message || String(e)); } }} />}
      </Row>
      <Sec>What it reads, and what to use</Sec>
      <View style={{ gap: 8 }}>
        {HK_ITEMS.map((it) => (
          <View key={it.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <Text style={{ flex: 1, fontSize: 13, color: t.ink, fontFamily: t.fontUISemi }}>{it.label}</Text>
            <Seg small value={hkUse(h.D, it.key)} options={it.merge ? [["both", "Both"], ["health", "Health"], ["manual", "Manual"]] : [["both", "On"], ["off", "Off"]]} onChange={(v) => h.mutate((D) => { D.settings.hkUse = { ...(D.settings.hkUse || {}), [it.key]: v as any }; })} />
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>The last 90 days, on every app open (at most once an hour). Weight and body fat are one measure whether typed in or read from Health: Both shows every value and, on a day with both, the figure from Health. Cycle days you enter yourself always win. Off hides an item without deleting anything.</Text>
      {on ? <Acts left={<Btn label="Disconnect" onPress={async () => { await disconnectAppleHealth(); await refresh(); setMsg("Disconnected. Rows already imported stay until you delete them on the web."); }} />} right={<Btn kind="accent" label={busy ? "Reading…" : "Read now"} disabled={busy} onPress={sync} />} /> : null}
      {msg ? <Text style={{ fontSize: 13, color: t.ink, fontFamily: t.fontUI }}>{msg}</Text> : null}
      <Err>{err}</Err>
    </View>
  );
}
