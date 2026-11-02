// Security (two-step sign-in, the photo vault), the accent colour, vault
// setup and unlock, two-step enrolment.
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useHealth, type Health } from "../state/HealthContext";
import type { SupabaseStore } from "../store/supabase";
import { ACCENTS, isHex } from "../model/vocab";
import { Acts, Btn, Err, Field, Input, P, Pill, Row, RowText, SheetH, useT } from "../ui";

export function openSecuritySheet(h: Health): void { h.openSheet(<Security />); }
export function openAppearanceSheet(h: Health): void { h.openSheet(<Appearance />); }
export function openVaultSetup(h: Health, after?: () => void): void { h.openSheet(<VaultSetup after={after} />); }
export function openVaultUnlock(h: Health, after?: () => void): void { h.openSheet(<VaultUnlock after={after} />); }
export function openMfaSetup(h: Health): void { h.openSheet(<MfaSetup />); }

function Security() {
  const h = useHealth();
  const [mfa, setMfa] = useState<boolean | null>(null);
  const store = h.store as SupabaseStore;
  useEffect(() => { store.mfaEnabled?.().then(setMfa).catch(() => setMfa(false)); }, [h.version]);
  const vs = h.vault;
  return (
    <View style={{ gap: 10 }}>
      <SheetH title="Security" onClose={h.closeSheet} />
      <Row style={{ alignItems: "flex-start" }}>
        <RowText title="Two-step sign-in" sub={mfa == null ? "Checking…" : mfa ? "On. Signing in needs a code from your authenticator app, and the database refuses any session without it." : "Off. Anyone with your password could sign in."} />
        {mfa ? <Pill>On</Pill> : mfa === false ? <Btn kind="accent" small label="Turn on" onPress={() => openMfaSetup(h)} /> : null}
      </Row>
      <Row style={{ alignItems: "flex-start" }}>
        <RowText title="Encrypted photos and files" sub={vs === "none" ? "Off. Turn this on before adding photos." : vs === "unlocked" ? "On, and unlocked on this device." : "On, but locked on this device."} />
        {vs === "none" ? <Btn kind="accent" small label="Turn on" onPress={() => openVaultSetup(h)} /> : vs === "locked" ? <Btn kind="dark" small label="Unlock" onPress={() => openVaultUnlock(h)} /> : <Btn small label="Forget on this device" onPress={async () => { await h.store.vaultForget(); h.closeSheet(); await h.reload(); }} />}
      </Row>
    </View>
  );
}

function Appearance() {
  const h = useHealth();
  const t = useT();
  const cur = (h.D.settings.accent || t.accent).toUpperCase();
  const [hex, setHex] = useState(cur);
  const set = (v: string) => { const u = v.toUpperCase(); setHex(u); if (isHex(u)) h.mutate((D) => { D.settings.accent = u; }); };
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="Accent colour" onClose={h.closeSheet} />
      <P>Used for buttons, highlights and the tinted widgets, here and on the web. Change it any time.</P>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ACCENTS.map(([n, c]) => <Pressable key={c} onPress={() => set(c)} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: c === cur ? 2 : 1, borderColor: c === cur ? t.ink : t.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, width: "47%", flexGrow: 1 }} accessibilityRole="button" accessibilityState={{ selected: c === cur }}><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c }} /><Text style={{ fontFamily: t.fontUISemi, color: t.ink, fontSize: 13 }}>{n}</Text></Pressable>)}
      </View>
      <Field label="Custom"><View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isHex(hex) ? hex : t.soft, borderWidth: 1, borderColor: t.line }} /><Input value={hex} onChange={set} maxLength={7} autoCapitalize="none" placeholder="#RRGGBB" style={{ width: 120, fontFamily: t.fontData }} /></View></Field>
      <P style={{ fontSize: 12, marginBottom: 0 }}>The home-screen icon stays the My OS mark: Apple only allows icons bundled in the app.</P>
    </View>
  );
}

function VaultSetup(props: { after?: () => void }) {
  const h = useHealth();
  const t = useT();
  const [p1, setP1] = useState(""); const [p2, setP2] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="Encrypt your photos and files" onClose={h.closeSheet} />
      <P>Photos and files are encrypted on this phone before they're uploaded, with a passphrase only you know. Supabase stores scrambled data it can't open. Nobody else can either, including anyone who gets into your Supabase account.</P>
      <P>You enter it once per device. After that this phone keeps it in its keychain and unlocks your photos on its own.</P>
      <View style={{ backgroundColor: t.accentSoft, borderRadius: 16, padding: 14, gap: 4 }}><Text style={{ fontFamily: t.fontUIBold, color: t.ink }}>This passphrase can't be recovered.</Text><Text style={{ fontSize: 12.5, color: t.muted, fontFamily: t.fontUI, lineHeight: 18 }}>It's separate from your sign-in password. If you lose it, your encrypted photos and files are unreadable forever. Store it in a password manager.</Text></View>
      <Field label="Passphrase (at least 10 characters)"><Input value={p1} onChange={setP1} secure autoCapitalize="none" textContentType="newPassword" /></Field>
      <Field label="Type it again"><Input value={p2} onChange={setP2} secure autoCapitalize="none" textContentType="newPassword" /></Field>
      <Acts right={<Btn kind="accent" label={busy ? "Setting up…" : "Turn on encryption"} disabled={busy} onPress={async () => {
        if (p1.length < 10) return setErr("Use at least 10 characters."); if (p1 !== p2) return setErr("The two passphrases don't match.");
        setErr(""); setBusy(true);
        try { const meta = await h.store.vaultSetup(p1); h.mutate((D) => { D.settings.vault = meta; }); h.closeSheet(); props.after?.(); } catch (e: any) { setErr(e?.message || String(e)); } finally { setBusy(false); }
      }} />} />
      <Err>{err}</Err>
    </View>
  );
}
function VaultUnlock(props: { after?: () => void }) {
  const h = useHealth();
  const [p, setP] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="Unlock photos and files" onClose={h.closeSheet} />
      <P>Enter your photo passphrase. This phone remembers it in the keychain until you choose Forget on this device.</P>
      <Field label="Passphrase"><Input value={p} onChange={setP} secure autoCapitalize="none" textContentType="password" autoFocus /></Field>
      <Acts right={<Btn kind="accent" label={busy ? "Checking…" : "Unlock"} disabled={busy} onPress={async () => {
        if (!h.D.settings.vault) return setErr("No vault is set up for this account yet.");
        setErr(""); setBusy(true);
        try { await h.store.vaultUnlock(p, h.D.settings.vault); h.closeSheet(); await h.reload(); props.after?.(); } catch (e: any) { setErr(e?.message || String(e)); } finally { setBusy(false); }
      }} />} />
      <Err>{err}</Err>
    </View>
  );
}
function MfaSetup() {
  const h = useHealth();
  const t = useT();
  const store = h.store as SupabaseStore;
  const [d, setD] = useState<{ id: string; totp: { qr_code: string; secret: string; uri: string } } | null>(null);
  const [code, setCode] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { store.mfaEnroll().then(setD).catch((e) => setErr(e?.message || String(e))); }, []);
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="Turn on two-step sign-in" onClose={h.closeSheet} />
      {!d && !err ? <P>Preparing…</P> : null}
      {d ? (
        <>
          <P>1. Add this code to an authenticator app. On this phone, tap the button and choose your app. From another device, scan the code.</P>
          <P>Google Authenticator, Microsoft Authenticator or Authy: they add it straight away. 1Password: open your My OS Health login and add a one-time password. iPhone Passwords: save a login for My OS Health first, then add the code to that login.</P>
          <Btn kind="ghost" label="Add to an authenticator on this phone" onPress={() => Linking.openURL(d.totp.uri).catch(() => setErr("No authenticator app took the code. Install one, or enter the key below by hand."))} />
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <Image source={{ uri: d.totp.qr_code }} style={{ width: 180, height: 180, backgroundColor: "#fff", borderRadius: 12 }} contentFit="contain" />
            <View style={{ flex: 1, minWidth: 160 }}><Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>Can't scan? Enter this key instead:</Text><Text selectable style={{ fontFamily: t.fontData, color: t.ink, fontSize: 12 }}>{d.totp.secret}</Text></View>
          </View>
          <P>2. Enter the 6-digit code it now shows for My OS Health.</P>
          <Field label="6-digit code"><Input value={code} onChange={setCode} keyboard="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" /></Field>
          <Acts right={<Btn kind="accent" label="Turn on" onPress={async () => { try { await store.mfaVerify(d.id, code.trim()); openSecuritySheet(h); } catch (e: any) { setErr(e?.message || String(e)); } }} />} />
        </>
      ) : null}
      <Err>{err}</Err>
    </View>
  );
}
