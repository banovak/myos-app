// First-launch pairing — clean and modern: the orb mark, a title, two fields, a
// pill button. Tapping anywhere outside the fields dismisses the keyboard. The
// Assistant is the default module, so this is also the first screen for someone
// who only wants Health: the link under the form takes them to Add features.
import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useShell } from "../shell/ShellContext";
import { theme } from "../theme";
import { normalizeGatewayUrl, savePairing, type Pairing } from "./storage";

export function PairScreen(props: { onPaired: (p: Pairing) => void }) {
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shell = useShell();

  async function pair() {
    setError(null);
    Keyboard.dismiss();
    const gatewayUrl = normalizeGatewayUrl(url);
    if (!gatewayUrl || !code.trim()) {
      setError("both fields, please");
      return;
    }
    setBusy(true);
    try {
      // Prove the pairing before saving it: health must answer, and the code
      // must unlock the signer. A bad pairing saved is a silent broken morning.
      const health = await fetch(gatewayUrl + "/health");
      if (!health.ok) throw new Error("that URL doesn't answer like a gateway");
      const info = await health.json().catch(() => ({}));
      const token = await fetch(gatewayUrl + "/widget-token", {
        method: "POST",
        headers: { "X-Widget-Code": code.trim() },
      });
      if (token.status === 401) throw new Error("gateway found, but the access code is wrong");
      if (!token.ok) throw new Error("gateway found, but its signer isn't configured");
      const p = { gatewayUrl, code: code.trim(), name: info.name };
      await savePairing(p);
      props.onPaired(p);
    } catch (e: any) {
      setError(e?.message ?? "couldn't reach that gateway");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable style={styles.dismiss} onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.top}>
          <View style={styles.mark}>
            <View style={styles.markHighlight} />
          </View>
          <Text style={styles.h1}>Connect Your Assistant</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="gateway URL"
            placeholderTextColor={theme.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={url}
            onChangeText={setUrl}
          />
          <TextInput
            style={styles.input}
            placeholder="access code"
            placeholderTextColor={theme.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            value={code}
            onChangeText={setCode}
          />
          <Pressable style={[styles.btn, busy && styles.btnBusy]} onPress={pair} disabled={busy}>
            <Text style={styles.btnText}>{busy ? "connecting…" : "Connect"}</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Pressable onPress={shell.openAddFeatures} hitSlop={12} accessibilityRole="button">
          <Text style={styles.alt}>Here for Health? Add it instead</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dismiss: { flex: 1, backgroundColor: theme.bg },
  wrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 110,
    paddingBottom: 40,
    gap: 48,
  },
  top: { alignItems: "center", gap: 22 },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.red,
    shadowColor: theme.red,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: "hidden",
  },
  markHighlight: {
    position: "absolute",
    left: 10,
    top: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.redBright,
    opacity: 0.7,
  },
  h1: { color: theme.red, fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
  form: { gap: 12, alignItems: "stretch" },
  input: {
    backgroundColor: "#fff",
    borderColor: theme.border,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.ink,
  },
  btn: {
    alignSelf: "center",
    backgroundColor: theme.red,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  btnBusy: { opacity: 0.6 },
  btnText: { color: theme.bg, fontSize: 16, fontWeight: "700" },
  error: { color: theme.red, fontSize: 14, textAlign: "center", marginTop: 6 },
  alt: { color: theme.inkSoft, fontSize: 15, textAlign: "center", textDecorationLine: "underline" },
});
