// Holds D, the view state, the sheet, sync status and the vault, and provides
// them to every Health screen. Reloads when the app returns to the foreground
// (signed links expire after 30 minutes; the web does the same).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, useColorScheme, View } from "react-native";
import * as Notifications from "expo-notifications";
import { payloadOf } from "./notifications/reminders";
import { openConcern, openRegimen } from "./sheets";
import { HealthContext, initialView, type Health, type Tab, type View as HView } from "./state/HealthContext";
import type { D } from "./model/types";
import { normalize } from "./model/normalize";
import type { HealthStore, SyncState, VaultState } from "./store/types";
import { makeTokens } from "./theme";
import { Sheet } from "./ui/Sheet";
import { AppScreen } from "./screens/AppScreen";
import { openSecuritySheet, openAppearanceSheet, openVaultSetup, openVaultUnlock } from "./sheets/security";
import { PortalHost } from "./ui/Portal";
import { reconcileReminders } from "./notifications/reminders";
import { maybeSyncAppleHealth } from "./healthkit/sync";
import { Btn } from "./ui/primitives";

export function HealthProvider(props: { store: HealthStore; sync: { state: SyncState; msg?: string; at?: number }; onSignedOut: () => void; onNeedMfa: () => void }) {
  const scheme = useColorScheme();
  const dRef = useRef<D | null>(null);
  const [version, setVersion] = useState(0);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [V, setView] = useState<HView>(initialView);
  const [sheet, setSheet] = useState<{ node: ReactNode; key: number; onClose?: () => void } | null>(null);
  const [vault, setVault] = useState<VaultState>("none");
  const [email, setEmail] = useState("");
  const loadedAt = useRef(0);
  const sheetKey = useRef(0);
  const { store } = props;

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const applyVault = useCallback((d: D) => setVault(store.vaultState(d.settings.vault)), [store]);

  const load = useCallback(async () => {
    try {
      const data = await store.load();
      const fresh = !data;
      const d = normalize(data || undefined);
      dRef.current = d;
      applyVault(d);
      loadedAt.current = Date.now();
      setLoadErr(null);
      bump();
      if (fresh) store.save(d);
      store.email().then(setEmail).catch(() => {});
      reconcileReminders(d).catch(() => {});
      // Apple Health, when connected: read, then show the fresh rows
      maybeSyncAppleHealth(store, d).then(async (did) => { if (!did) return; if (store.mode === "supabase") { const again = await store.load(); if (again) { dRef.current = normalize(again); bump(); } } else { store.save(d); bump(); } }).catch(() => {});
    } catch (e: any) {
      const msg = e?.message || String(e);
      setLoadErr(msg);
      if (/aal2|assurance|mfa/i.test(msg)) props.onNeedMfa();
    }
  }, [store, applyVault, bump]);

  useEffect(() => { load(); }, [load]);
  // hide health content in the app switcher snapshot
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      setCovered(s !== "active");
      if (s !== "active" || store.mode !== "supabase" || Date.now() - loadedAt.current < 120000 || sheet) return;
      load();
    });
    return () => sub.remove();
  }, [load, store, sheet]);
  // a tapped reminder opens its target
  const handledResp = useRef<string | null>(null);
  useEffect(() => {
    const open = (resp: Notifications.NotificationResponse | null) => {
      const p = payloadOf(resp);
      const h = healthRef.current;
      if (!p || !h || !resp || handledResp.current === resp.notification.request.identifier) return;
      handledResp.current = resp.notification.request.identifier;
      if (p.target_kind === "challenge" && p.target_id) h.go("plan", { exp: p.target_id });
      else if (p.target_kind === "concern" && p.target_id) { h.go("dashboard"); openConcern(h, p.target_id); }
      else if (p.target_kind === "regimen" && p.target_id) { const r = h.D.regimens.find((x) => x.id === p.target_id); h.go("routines"); if (r) openRegimen(h, r); }
      else if (p.target_kind === "quick") h.go("dashboard");
      else h.go("plan");
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [version === 0]);

  const mutate = useCallback((fn: (D: D) => void) => {
    const d = dRef.current;
    if (!d) return;
    fn(d);
    store.save(d);
    bump();
    reconcileReminders(d).catch(() => {});
  }, [store, bump]);

  const setV = useCallback((patch: Partial<HView>) => setView((v) => ({ ...v, ...patch })), []);
  const go = useCallback((tab: Tab, extra?: Partial<HView>) => setView((v) => ({ ...v, tab, exp: null, concernPage: null, editing: false, customizing: false, ...(tab === "plan" ? { planYear: new Date().getFullYear() } : {}), ...(extra && extra.exp ? { expFrom: v.tab } : {}), ...extra })), []);
  const openSheet = useCallback((node: ReactNode, onClose?: () => void) => { sheetKey.current += 1; setSheet({ node, key: sheetKey.current, onClose }); }, []);
  const closeSheet = useCallback(() => setSheet((s) => { s?.onClose?.(); return null; }), []);

  const accent = dRef.current?.settings.accent;
  const t = useMemo(() => makeTokens(accent, scheme === "dark"), [accent, scheme]);

  const health: Health | null = dRef.current
    ? {
        D: dRef.current, V, version, t, store, sync: props.sync, vault, mutate, setV, refresh: bump, openSheet, closeSheet, go,
        photoUri: (p) => store.photoUri(p), fileUri: (f) => store.fileUri(f),
        needVault: () => {
          if (store.mode !== "supabase") return false;
          const st = store.vaultState(dRef.current!.settings.vault);
          if (st === "unlocked") return false;
          if (st === "none") openVaultSetup(healthRef.current!); else openVaultUnlock(healthRef.current!);
          return true;
        },
        reload: load,
        openSecurity: () => openSecuritySheet(healthRef.current!),
        openAppearance: () => openAppearanceSheet(healthRef.current!),
        signOut: async () => { await store.signOut(); props.onSignedOut(); },
        email, isSample: store.mode === "sample",
      }
    : null;
  const healthRef = useRef<Health | null>(null);
  healthRef.current = health;
  // vault state can change from inside sheets (setup / unlock / forget)
  useEffect(() => { if (dRef.current) applyVault(dRef.current); }, [version, applyVault]);

  if (!health) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
        {loadErr ? (
          <>
            <Text style={{ color: t.ink, fontSize: 17, fontFamily: t.fontUIBold }}>Could not load your data</Text>
            <Text style={{ color: t.muted, textAlign: "center", fontFamily: t.fontUI }}>{loadErr}</Text>
            <HealthContext.Provider value={{ t } as any}><Btn label="Try again" kind="dark" onPress={load} /></HealthContext.Provider>
          </>
        ) : <ActivityIndicator color={t.muted} />}
      </View>
    );
  }
  return (
    <HealthContext.Provider value={health}>
      <AppScreen />
      <PortalHost />
      <Sheet open={!!sheet} onClose={closeSheet}>{sheet ? <View key={sheet.key}>{sheet.node}</View> : null}</Sheet>
      {covered ? <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg, zIndex: 50 }]} /> : null}
    </HealthContext.Provider>
  );
}
