// The top of every Health screen: the "My OS · Health" wordmark (the module
// switcher once two or more modules are on), the reminders bell, and the ⋮
// menu: My OS items first (the same in every module), then this module's,
// then the account, with the last save time. A save problem shows beside the bell.
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useShell } from "../../shell/ShellContext";
import { useHealth } from "../state/HealthContext";
import { Icon, useT } from "../ui";
import { openAbout, openAppleHealth, openProviders, openReminders } from "../sheets";

export function Brand(props: { onPress?: () => void; chevron?: boolean }) {
  const t = useT();
  const inner = (
    <View style={styles.brand}>
      <View style={[styles.mark, { backgroundColor: t.accent }]}><View style={[styles.markDot, { backgroundColor: t.onAccent }]} /></View>
      <View>
        <Text style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: t.muted, fontFamily: t.fontUIBold, lineHeight: 13 }}>My OS</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 18, fontFamily: t.fontUIHeavy, color: t.ink, letterSpacing: -0.4, lineHeight: 22 }}>Health</Text>
          {props.chevron ? <View style={{ opacity: 0.5, marginTop: 2 }}><Icon k="chev" size={14} stroke={3} /></View> : null}
        </View>
      </View>
    </View>
  );
  if (!props.onPress) return inner;
  return <Pressable onPress={props.onPress} accessibilityRole="button" accessibilityLabel="My OS Health. Switch module" style={{ minHeight: 44, justifyContent: "center" }}>{inner}</Pressable>;
}

export function TopBar() {
  const h = useHealth();
  const shell = useShell();
  const t = h.t;
  const [menu, setMenu] = useState(false);
  const err = h.sync.state === "error" ? (/locked/i.test(h.sync.msg || "") ? "Photos locked. Not saved" : "Not saved yet. Retrying") : "";
  const at = h.sync.at ? new Date(h.sync.at) : null;
  const when = at ? (at.toDateString() === new Date().toDateString() ? "" : at.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " ") + at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";
  const savedLine = h.sync.state === "saving" ? "Saving…" : err ? err : h.sync.state === "saved" ? (h.isSample ? "Saved on this phone" : "Saved") + (when ? " at " + when : "") : "";
  const nRem = (h.D.reminders || []).filter((r) => r.enabled).length;
  const item = (label: string, fn: () => void, danger?: boolean) => (
    <Pressable key={label} style={styles.menuItem} onPress={() => { setMenu(false); fn(); }} accessibilityRole="menuitem">
      <Text style={{ color: danger ? t.tint("observation") : t.ink, fontSize: 15, fontFamily: t.fontUI }}>{label}</Text>
    </Pressable>
  );
  const divider = (k: string) => <View key={k} style={{ height: 1, backgroundColor: t.line, marginVertical: 6 }} />;
  const group = (label: string) => <Text key={"g:" + label} style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: t.muted, fontFamily: t.fontUIBold, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 2 }}>{label}</Text>;
  return (
    <View style={styles.top}>
      <Brand onPress={shell.switcher ? shell.openSwitcher : undefined} chevron={shell.switcher} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {err ? <Text style={{ fontSize: 12, color: t.tint("observation"), fontFamily: t.fontUISemi }} numberOfLines={1}>{err}</Text> : null}
        <Pressable onPress={() => openReminders(h)} style={styles.dots} hitSlop={6} accessibilityLabel={nRem ? `Reminders, ${nRem} on` : "Reminders"} accessibilityRole="button">
          <Icon k="bell" size={20} stroke={2} color={t.ink} />
        </Pressable>
        <Pressable onPress={() => setMenu(true)} style={styles.dots} hitSlop={10} accessibilityLabel="Menu" accessibilityRole="button">
          <Text style={{ color: t.muted, fontSize: 22, fontWeight: "700", lineHeight: 26 }}>⋯</Text>
        </Pressable>
      </View>
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} />
        <View style={[styles.menu, { backgroundColor: t.card }]} accessibilityRole="menu">
          {group("My OS")}
          {item("Add features", shell.openAddFeatures)}
          {item("Accent colour", h.openAppearance)}
          {item("About and privacy", () => openAbout(h))}
          {divider("d1")}
          {group("Health")}
          {item("Providers", () => openProviders(h))}
          {item("Apple Health", () => openAppleHealth(h))}
          {!h.isSample ? item("Security", h.openSecurity) : null}
          {divider("d2")}
          {item("Reload", () => h.reload())}
          {h.isSample ? item("Leave sample data", () => h.signOut(), true) : item("Sign out", () => h.signOut())}
          {!h.isSample ? item("Clear credentials", async () => { const { healthClearCredentials } = await import("../store/config"); await healthClearCredentials(); await h.signOut(); }, true) : null}
          {savedLine ? <Text style={{ color: err ? t.tint("observation") : t.muted, fontSize: 12, paddingHorizontal: 18, paddingTop: 8, fontFamily: t.fontUISemi }}>{savedLine}</Text> : null}
          <Text style={{ color: t.muted, opacity: 0.6, fontSize: 11, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8, fontFamily: t.fontUI }}>{h.email || (h.isSample ? "Sample data. Lives only on this phone." : "")}</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 54, paddingHorizontal: 14, paddingBottom: 6 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  markDot: { width: 14, height: 14, borderRadius: 7 },
  dots: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  menu: { position: "absolute", top: 100, right: 14, borderRadius: 14, paddingVertical: 6, minWidth: 210, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  menuItem: { paddingVertical: 11, paddingHorizontal: 18 },
});
