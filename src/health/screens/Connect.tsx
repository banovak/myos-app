// Connect: the user's own Supabase project URL and publishable key. The key is
// checked against the project before anything is saved. Never a secret key.
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, useColorScheme, View } from "react-native";
import { HealthContext } from "../state/HealthContext";
import { looksLikePublishableKey, normalizeSupabaseUrl, saveHealthConfig, type HealthConfig } from "../store/config";
import { makeTokens } from "../theme";
import { Brand } from "../components/TopBar";

export function ConnectScreen(props: { onConnected: (cfg: HealthConfig) => void; onSample: () => void }) {
  const t = makeTokens(undefined, useColorScheme() === "dark");
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function connect() {
    Keyboard.dismiss();
    setErr("");
    const supabaseUrl = normalizeSupabaseUrl(url), supabaseKey = key.trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(supabaseUrl) && !/^https:\/\//i.test(supabaseUrl)) return setErr("That doesn't look like a project URL.");
    if (/^sb_secret_/i.test(supabaseKey)) return setErr("That's a secret key. Use the publishable key: it's designed to be public, and row-level security keeps your records private.");
    if (!looksLikePublishableKey(supabaseKey)) return setErr("Paste the publishable key (sb_publishable_…) from Project Settings → API.");
    setBusy(true);
    try {
      // prove the pair before saving: the project must answer with this key
      const res = await fetch(supabaseUrl + "/auth/v1/settings", { headers: { apikey: supabaseKey } });
      if (res.status === 401 || res.status === 403) throw new Error("The project answered, but not for this key.");
      if (!res.ok) throw new Error("That URL doesn't answer like a Supabase project (" + res.status + ").");
      const cfg = { supabaseUrl, supabaseKey };
      await saveHealthConfig(cfg);
      props.onConnected(cfg);
    } catch (e: any) {
      setErr(e?.message || "Couldn't reach that project.");
    } finally {
      setBusy(false);
    }
  }

  const input = { borderWidth: 1, borderColor: t.line, backgroundColor: t.card, color: t.ink, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, fontSize: 15, fontFamily: t.fontUI } as const;
  return (
    <HealthContext.Provider value={{ t } as any}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView contentContainerStyle={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Brand />
          <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 22, gap: 12, marginTop: 24 }}>
            <Text style={{ fontSize: 22, fontFamily: t.fontUIHeavy, color: t.ink }}>Connect your project</Text>
            <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 20, fontFamily: t.fontUI }}>Your records live in your own Supabase project. Only you can read them. This module never shares anything with Jarvis.</Text>
            <View style={{ gap: 5 }}>
              <Text style={{ fontSize: 12, fontFamily: t.fontUIBold, color: t.muted }}>Project URL</Text>
              <TextInput value={url} onChangeText={setUrl} placeholder="https://xxxx.supabase.co" placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={input} />
            </View>
            <View style={{ gap: 5 }}>
              <Text style={{ fontSize: 12, fontFamily: t.fontUIBold, color: t.muted }}>Publishable key</Text>
              <TextInput value={key} onChangeText={setKey} placeholder="sb_publishable_…" placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false} secureTextEntry style={input} />
              <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>Project Settings → API. Never a secret or service-role key.</Text>
            </View>
            {err ? <Text style={{ color: t.tint("observation"), fontSize: 13, fontFamily: t.fontUISemi }}>{err}</Text> : null}
            <Pressable onPress={connect} disabled={busy} style={{ backgroundColor: t.accent, borderRadius: 999, paddingVertical: 12, alignItems: "center", opacity: busy ? 0.6 : 1 }} accessibilityRole="button">
              <Text style={{ color: t.onAccent, fontFamily: t.fontUIBold, fontSize: 15 }}>{busy ? "Checking…" : "Connect"}</Text>
            </Pressable>
          </View>
          <Pressable onPress={props.onSample} style={{ alignSelf: "center", paddingVertical: 12 }} accessibilityRole="button">
            <Text style={{ color: t.muted, fontFamily: t.fontUISemi, fontSize: 13, textDecorationLine: "underline" }}>Try it with sample data first</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </HealthContext.Provider>
  );
}
