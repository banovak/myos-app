// Sign in with email + password, then the two-step code when a factor is
// enrolled. The database refuses any session below aal2 once a factor exists,
// so the code prompt is the only way in, never an empty dashboard.
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, useColorScheme, View } from "react-native";
import { HealthContext } from "../state/HealthContext";
import type { SupabaseStore } from "../store/supabase";
import { makeTokens } from "../theme";
import { Brand } from "../components/TopBar";

export function SignInScreen(props: { store: SupabaseStore; mfa: boolean; onSignedIn: () => void; onNeedMfa: () => void; onDisconnect: () => void }) {
  const t = makeTokens(undefined, useColorScheme() === "dark");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = { borderWidth: 1, borderColor: t.line, backgroundColor: t.card, color: t.ink, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, fontSize: 15, fontFamily: t.fontUI } as const;

  async function go(up: boolean) {
    Keyboard.dismiss(); setErr("");
    if (!email.trim() || pass.length < 8) return setErr("Enter your email and a password of at least 8 characters.");
    setBusy(true);
    try {
      if (up) {
        const confirm = await props.store.signUp(email.trim(), pass);
        if (confirm) return setErr("Check your email to confirm your account, then sign in here.");
      } else await props.store.signIn(email.trim(), pass);
      if (await props.store.mfaNeeded()) return props.onNeedMfa();
      props.onSignedIn();
    } catch (e: any) { setErr(e?.message || String(e)); } finally { setBusy(false); }
  }
  async function verify() {
    Keyboard.dismiss(); setErr(""); setBusy(true);
    try { await props.store.mfaSignIn(code.trim()); props.onSignedIn(); }
    catch (e: any) { setErr(e?.message || String(e)); } finally { setBusy(false); }
  }

  return (
    <HealthContext.Provider value={{ t } as any}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView contentContainerStyle={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Brand />
          <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 22, gap: 12, marginTop: 24 }}>
            {props.mfa ? (
              <>
                <Text style={{ fontSize: 22, fontFamily: t.fontUIHeavy, color: t.ink }}>Enter your code</Text>
                <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 20, fontFamily: t.fontUI }}>Open your authenticator app and enter the 6-digit code for My OS Health.</Text>
                <TextInput value={code} onChangeText={setCode} placeholder="123456" placeholderTextColor={t.muted} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" style={[input, { fontFamily: t.fontData, fontSize: 22, letterSpacing: 6, textAlign: "center" }]} autoFocus />
                {err ? <Text style={{ color: t.tint("observation"), fontSize: 13, fontFamily: t.fontUISemi }}>{err}</Text> : null}
                <Pressable onPress={verify} disabled={busy || code.trim().length < 6} style={{ backgroundColor: t.accent, borderRadius: 999, paddingVertical: 12, alignItems: "center", opacity: busy || code.trim().length < 6 ? 0.6 : 1 }} accessibilityRole="button">
                  <Text style={{ color: t.onAccent, fontFamily: t.fontUIBold, fontSize: 15 }}>{busy ? "Checking…" : "Continue"}</Text>
                </Pressable>
                <Pressable onPress={async () => { await props.store.signOut(); setCode(""); setErr(""); props.onDisconnect(); }} style={{ alignSelf: "center", paddingVertical: 8 }}><Text style={{ color: t.muted, fontFamily: t.fontUISemi, fontSize: 13 }}>Sign out</Text></Pressable>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 22, fontFamily: t.fontUIHeavy, color: t.ink }}>Sign in</Text>
                <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 20, fontFamily: t.fontUI }}>Your records live in your own Supabase project. Only you can read them.</Text>
                <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" style={input} />
                <TextInput value={pass} onChangeText={setPass} placeholder="Password" placeholderTextColor={t.muted} secureTextEntry autoComplete="current-password" textContentType="password" style={input} />
                {err ? <Text style={{ color: t.tint("observation"), fontSize: 13, fontFamily: t.fontUISemi }}>{err}</Text> : null}
                <Pressable onPress={() => go(false)} disabled={busy} style={{ backgroundColor: t.accent, borderRadius: 999, paddingVertical: 12, alignItems: "center", opacity: busy ? 0.6 : 1 }} accessibilityRole="button">
                  <Text style={{ color: t.onAccent, fontFamily: t.fontUIBold, fontSize: 15 }}>{busy ? "Signing in…" : "Sign in"}</Text>
                </Pressable>
                <Pressable onPress={() => go(true)} disabled={busy} style={{ alignSelf: "center", paddingVertical: 8 }} accessibilityRole="button"><Text style={{ color: t.muted, fontFamily: t.fontUISemi, fontSize: 13 }}>Create my account</Text></Pressable>
                <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI, lineHeight: 17 }}>Create an account once. Then turn off new sign-ups in Supabase so nobody else can.</Text>
              </>
            )}
          </View>
          <Pressable onPress={props.onDisconnect} style={{ alignSelf: "center", paddingVertical: 12 }} accessibilityRole="button">
            <Text style={{ color: t.muted, fontFamily: t.fontUISemi, fontSize: 13, textDecorationLine: "underline" }}>Use a different project</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </HealthContext.Provider>
  );
}
