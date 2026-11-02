// Health module entry: load fonts, read the connection config, and run the
// door sequence — Connect (project URL + key) → Sign in → two-step code →
// the app. "Try with sample data" skips the doors with an on-device store.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, useColorScheme, View } from "react-native";
import { useFonts, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { DMMono_400Regular } from "@expo-google-fonts/dm-mono";
import { useShell } from "../shell/ShellContext";
import { HealthProvider } from "./HealthProvider";
import { ConnectScreen } from "./screens/Connect";
import { SignInScreen } from "./screens/SignIn";
import { loadHealthConfig, type HealthConfig } from "./store/config";
import { createSupabaseStore, type SupabaseStore } from "./store/supabase";
import { createSampleStore } from "./store/sampleStore";
import type { HealthStore, SyncState } from "./store/types";
import { makeTokens } from "./theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SAMPLE_KEY = "health.mode.sample";
type Stage = "loading" | "connect" | "signin" | "mfa" | "app";

export function HealthModule() {
  const shell = useShell();
  const scheme = useColorScheme();
  const [fontsLoaded] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, DMMono_400Regular });
  const [stage, setStage] = useState<Stage>("loading");
  const [store, setStore] = useState<HealthStore | null>(null);
  const [sync, setSync] = useState<{ state: SyncState; msg?: string; at?: number }>({ state: "idle" });
  const hooks = { onStatus: (state: SyncState, msg?: string) => setSync((p) => ({ state, msg, at: state === "saved" ? Date.now() : p.at })) };

  useEffect(() => { shell.setSwipeBand("all"); }, [shell]);

  const boot = useCallback(async () => {
    setStage("loading");
    const sampleOn = (await AsyncStorage.getItem(SAMPLE_KEY)) === "1";
    const cfg = await loadHealthConfig();
    if (!cfg) {
      if (sampleOn) { setStore(createSampleStore(hooks)); setStage("app"); return; }
      setStage("connect");
      return;
    }
    const s = createSupabaseStore(cfg, hooks);
    setStore(s);
    try {
      const session = await s.session();
      if (!session) { setStage("signin"); return; }
      if (await s.mfaNeeded()) { setStage("mfa"); return; }
      setStage("app");
    } catch {
      setStage("signin");
    }
  }, []);
  useEffect(() => { boot(); }, [boot]);

  async function connected(cfg: HealthConfig) {
    await AsyncStorage.removeItem(SAMPLE_KEY);
    const s = createSupabaseStore(cfg, hooks);
    setStore(s);
    setStage("signin");
  }
  async function trySample() {
    await AsyncStorage.setItem(SAMPLE_KEY, "1");
    setStore(createSampleStore(hooks));
    setStage("app");
  }
  async function leaveSample() {
    await AsyncStorage.removeItem(SAMPLE_KEY);
    setStore(null);
    setStage("connect");
  }

  const t = makeTokens(undefined, scheme === "dark");
  if (!fontsLoaded || stage === "loading") {
    return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.muted} /></View>;
  }
  if (stage === "connect") return <ConnectScreen onConnected={connected} onSample={trySample} />;
  if ((stage === "signin" || stage === "mfa") && store && store.mode === "supabase") {
    return (
      <SignInScreen
        store={store as SupabaseStore}
        mfa={stage === "mfa"}
        onSignedIn={() => setStage("app")}
        onNeedMfa={() => setStage("mfa")}
        onDisconnect={async () => { const { healthClearCredentials } = await import("./store/config"); await healthClearCredentials(); setStore(null); setStage("connect"); }}
      />
    );
  }
  if (stage === "app" && store) {
    return (
      <HealthProvider
        store={store}
        sync={sync}
        onSignedOut={() => { setStage(store.mode === "sample" ? "connect" : "signin"); if (store.mode === "sample") leaveSample(); }}
        onNeedMfa={() => setStage("mfa")}
      />
    );
  }
  return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}><Text style={{ color: t.muted }}>Something went wrong. Reopen the module.</Text></View>;
}
