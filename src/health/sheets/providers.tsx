// Your providers: the list, a page per provider (what you have had with them
// and what it cost), and the form with a photo. Archive keeps the history and
// takes them off the active list; delete removes the card, appointments stay.
import { useState } from "react";
import { Linking, Pressable, Text, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { fmt, money, today } from "../model/dates";
import { initials, newProviderId, providerCourses, providerEntries, providerOf, providerSpend, providersOf, removeProvider, setArchived, upsertProvider } from "../model/providers";
import type { Provider } from "../model/types";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, Chip, Chips, Empty, Err, Field, Input, P, Row, RowText, Sec, SheetH, Stat, Stats, Sub, useT } from "../ui";
import { PhotoView } from "../components/PhotoView";
import { EntryRow } from "../components/EntryRow";
import { shrinkToJpeg } from "../store/media";
import { CameraSheet } from "./camera";
import { openCard } from "./card";
import { openForm } from "./entryForm";

export function openProviders(h: Health, from?: "card"): void { h.openSheet(<ProvidersSheet from={from} />); }
export function openProvider(h: Health, id: string): void { h.openSheet(<ProviderSheet id={id} />); }
export function openProviderForm(h: Health, id?: string, from?: "card"): void { h.openSheet(<ProviderForm id={id} from={from} />); }
/** + on the health card: re-activate an archived provider, or add a new one */
export function openProviderAdd(h: Health, from?: "card"): void {
  if (!providersOf(h.D).some((p) => p.archived)) return openProviderForm(h, undefined, from);
  h.openSheet(<ProviderAdd from={from} />);
}
function ProviderAdd(props: { from?: "card" }) {
  const h = useHealth();
  const archived = providersOf(h.D).filter((p) => p.archived);
  const back = () => (props.from === "card" ? openCard(h) : openProviders(h));
  return (
    <View style={{ gap: 10 }}>
      <SheetH title="Add a provider" onClose={h.closeSheet} />
      <Btn kind="accent" label="New provider" onPress={() => openProviderForm(h, undefined, props.from)} style={{ alignSelf: "flex-start" }} />
      <Sec>Or re-activate one</Sec>
      <View style={{ gap: 8 }}>{archived.map((p) => <Row key={p.id} onPress={() => openProvider(h, p.id)}><ProviderAvatar p={p} /><RowText title={p.name} sub={roleLine(p)} /><Btn small label="Re-activate" onPress={() => { h.mutate((D) => setArchived(D, p.id, false)); back(); }} /></Row>)}</View>
      <Acts left={<Btn label="← Back" onPress={back} />} />
    </View>
  );
}

export function ProviderAvatar(props: { p: Provider; size?: number }) {
  const t = useT();
  const s = props.size || 44;
  if (props.p.photo) return <PhotoView photo={props.p.photo} style={{ width: s, height: s }} radius={s / 2} />;
  return (
    <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: t.fontUIBold, color: t.ink, fontSize: s * 0.36 }}>{initials(props.p.name) || "?"}</Text>
    </View>
  );
}
const roleLine = (p: Provider): string => [p.role, p.practice].filter(Boolean).join(" · ");

function ProvidersSheet(props: { from?: "card" }) {
  const h = useHealth();
  const { D } = h;
  const win = useWindowDimensions();
  const all = providersOf(D);
  const roleMap = new Map<string, string>();
  all.forEach((p) => { const r = (p.role || "").trim(); if (r) roleMap.set(r.toLowerCase(), r); });
  const roles = [...roleMap.values()].sort();
  const [role, setRole] = useState("");
  const shown = role ? all.filter((p) => (p.role || "").trim().toLowerCase() === role.toLowerCase()) : all;
  const active = shown.filter((p) => !p.archived), archived = shown.filter((p) => p.archived);
  const row = (p: Provider) => <Row key={p.id} onPress={() => openProvider(h, p.id)}><ProviderAvatar p={p} /><RowText title={p.name} sub={roleLine(p)} />{p.archived ? <Btn small label="Re-activate" onPress={() => h.mutate((D) => setArchived(D, p.id, false))} /> : null}</Row>;
  return (
    <View style={{ gap: 10, minHeight: win.height * 0.78 }}>
      <SheetH title="Providers" onClose={h.closeSheet} />
      {roles.length > 1 ? <Chips><Chip small label="All" on={!role} onPress={() => setRole("")} />{roles.map((r) => <Chip key={r} small label={r} on={role.toLowerCase() === r.toLowerCase()} onPress={() => setRole(r)} />)}</Chips> : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Sec>Active</Sec><Btn small label="+ New" onPress={() => openProviderForm(h)} /></View>
      {active.length ? <View style={{ gap: 8 }}>{active.map(row)}</View> : <Empty>{all.length ? "None here." : "No providers yet. Add your doctor, dentist, physio, and appointments can pick them with one tap."}</Empty>}
      {archived.length ? <View style={{ gap: 8 }}><Sec>Archived</Sec>{archived.map(row)}</View> : null}
      <Acts left={props.from === "card" ? <Btn label="← Health card" onPress={() => openCard(h)} /> : undefined} />
    </View>
  );
}

function ProviderSheet(props: { id: string }) {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const p = providerOf(D, props.id);
  const [armed, setArmed] = useState(false);
  if (!p) return <View><SheetH title="Provider" onClose={h.closeSheet} /><P>This provider was removed.</P></View>;
  const es = providerEntries(D, p), ks = providerCourses(D, p);
  const done = es.filter((e) => e.details.status !== "upcoming" && e.details.status !== "cancelled"), up = es.filter((e) => e.details.status === "upcoming");
  const red = t.dark ? "#FF7B72" : "#C62828", link = (p.link || "").trim();
  const tel = (p.phone || "").replace(/[^\d+]/g, "");
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={p.name} onClose={h.closeSheet} />
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <ProviderAvatar p={p} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          {p.role ? <Text style={{ fontFamily: t.fontUIBold, color: t.ink, fontSize: 15 }}>{p.role}</Text> : null}
          {p.practice ? <Sub>{p.practice}</Sub> : null}
          {p.archived ? <Sub>Archived</Sub> : null}
        </View>
      </View>
      {p.phone || p.address || link ? (
        <View style={{ gap: 8 }}>
          {p.phone ? <Pressable onPress={() => { if (tel) Linking.openURL("tel:" + tel); }} accessibilityRole="link"><RowText title="Phone" sub={p.phone} /></Pressable> : null}
          {p.address ? <Pressable onPress={() => Linking.openURL("https://maps.apple.com/?q=" + encodeURIComponent(p.address!))} accessibilityRole="link"><RowText title="Address" sub={p.address} /></Pressable> : null}
          {link ? <Pressable onPress={() => Linking.openURL(/^https?:/i.test(link) ? link : "https://" + link)} accessibilityRole="link"><RowText title="Link" sub={link} /></Pressable> : null}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Btn kind="accent" small label="+ Appointment" onPress={() => openForm(h, "appointment", { details: { provider_id: p.id, provider: p.name, practice: p.practice || "", status: "upcoming" } })} />
        <Btn small label="Edit" onPress={() => openProviderForm(h, p.id)} />
        <Btn small label={p.archived ? "Restore" : "Archive"} onPress={() => h.mutate((D) => setArchived(D, p.id, !p.archived))} />
      </View>
      <Stats><Stat value={String(done.length)} label={done.length === 1 ? "visit" : "visits"} /><Stat value={String(up.length)} label="upcoming" /><Stat value={money(providerSpend(done))} label="spent" /></Stats>
      {ks.length ? <View style={{ gap: 6 }}><Sec>Courses of care</Sec>{ks.map((k) => <Row key={k.id}><RowText title={k.title} sub={`${fmt(k.started_on)} – ${k.ended_on ? fmt(k.ended_on) : "ongoing"}`} /></Row>)}</View> : null}
      <View style={{ gap: 6 }}>
        <Sec>Appointments</Sec>
        {es.length ? es.map((e) => <EntryRow key={e.id} e={e} />) : <Empty>None yet.</Empty>}
      </View>
      <Pressable onPress={() => { if (!armed) return setArmed(true); h.mutate((D) => removeProvider(D, p.id)); openProviders(h); }} style={{ alignSelf: "center", borderWidth: 1.5, borderColor: red, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, marginTop: 4 }} accessibilityRole="button">
        <Text style={{ color: red, fontFamily: t.fontUIBold, fontSize: 13 }}>{armed ? "Tap again to delete" : "Delete provider"}</Text>
      </Pressable>
      <Sub>Archive keeps the history. Delete removes this card; the appointments stay.</Sub>
      <Acts left={<Btn label="← Providers" onPress={() => openProviders(h)} />} />
    </View>
  );
}

function ProviderForm(props: { id?: string; from?: "card" }) {
  const h = useHealth();
  const { D } = h;
  const pre = providerOf(D, props.id);
  const [p, setP] = useState<Provider>(() => (pre ? { ...pre } : { id: newProviderId(), name: "", role: "", practice: "", phone: "", address: "", link: "", photo: null, added_on: today() }));
  const [cam, setCam] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof Provider) => (v: string) => setP((x) => ({ ...x, [k]: v }));
  async function fromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled) return;
    const a = res.assets[0], s = await shrinkToJpeg(a.uri, a.width, a.height);
    setP((x) => ({ ...x, photo: { src: s.uri } }));
  }
  function save() {
    if (!p.name.trim()) return setErr("Give them a name.");
    const tr = (v?: string) => (v || "").trim();
    const out: Provider = { ...p, name: tr(p.name), role: tr(p.role), practice: tr(p.practice), phone: tr(p.phone), address: tr(p.address), link: tr(p.link) };
    h.mutate((D) => upsertProvider(D, out));
    openProvider(h, out.id);
  }
  return (
    <View style={{ gap: 10 }}>
      <SheetH title={pre ? "Edit provider" : "New provider"} onClose={h.closeSheet} />
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <ProviderAvatar p={p} size={64} />
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1 }}>
          <Btn small label="Take photo" onPress={() => { if (!h.needVault()) setCam(true); }} />
          <Btn small label="From library" onPress={() => { if (!h.needVault()) fromLibrary(); }} />
          {p.photo ? <Btn small label="Remove" onPress={() => setP((x) => ({ ...x, photo: null }))} /> : null}
        </View>
      </View>
      <Field label="Name"><Input value={p.name} onChange={set("name")} placeholder="Dr. Mogla" /></Field>
      <Field label="Role"><Input value={p.role || ""} onChange={set("role")} placeholder="Family doctor, dentist, physio" /></Field>
      <Field label="Practice"><Input value={p.practice || ""} onChange={set("practice")} placeholder="Clinic name" /></Field>
      <Field label="Phone"><Input value={p.phone || ""} onChange={set("phone")} placeholder="" /></Field>
      <Field label="Address"><Input value={p.address || ""} onChange={set("address")} placeholder="" multiline /></Field>
      <Field label="Link"><Input value={p.link || ""} onChange={set("link")} placeholder="Website or a Google Maps link" /></Field>
      <Err>{err}</Err>
      <Acts left={<Btn label="← Back" onPress={() => (pre ? openProvider(h, pre.id) : props.from === "card" ? openCard(h) : openProviders(h))} />} right={<Btn kind="accent" label="Save" onPress={save} />} />
      <CameraSheet open={cam} overlay={null} onClose={() => setCam(false)} onShot={(uri) => { setP((x) => ({ ...x, photo: { src: uri } })); setCam(false); }} />
    </View>
  );
}
