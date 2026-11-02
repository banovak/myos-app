// ⋮ → Add features: every module with a toggle and its own Connect step.
// Shell-level screen, so it wears the My OS look (cream, maroon).
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { theme } from "../theme";
import { MODULES, type ModuleId } from "./modules";
import { ModuleMark } from "./SwitcherSheet";

export function AddFeaturesScreen(props: {
  enabled: ModuleId[];
  onToggle: (id: ModuleId, on: boolean) => void;
  onConnect: (id: ModuleId) => void;
  onBack: () => void;
}) {
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  async function refresh() {
    const out: Record<string, boolean> = {};
    await Promise.all(MODULES.map(async (m) => { out[m.id] = await m.isConnected().catch(() => false); }));
    setConnected(out);
  }
  useEffect(() => { refresh(); }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable onPress={props.onBack} hitSlop={10} style={styles.back} accessibilityLabel="Back" accessibilityRole="button">
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </Pressable>
        <Text style={styles.h1}>Add features</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>Each module connects on its own and keeps its own credentials. Nothing is shared between them.</Text>
        {MODULES.map((m) => {
          const on = props.enabled.includes(m.id);
          const isConn = !!connected[m.id];
          const onlyOne = on && props.enabled.length === 1;
          return (
            <View key={m.id} style={styles.card}>
              <View style={styles.cardTop}>
                <ModuleMark id={m.id} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name}>{m.name}</Text>
                  <Text style={styles.blurb}>{m.blurb}</Text>
                </View>
                <Switch
                  value={on}
                  disabled={onlyOne}
                  onValueChange={(v) => props.onToggle(m.id, v)}
                  trackColor={{ true: theme.red, false: "#D8D0C3" }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel={`${m.name} ${on ? "on" : "off"}`}
                />
              </View>
              <View style={styles.cardBottom}>
                <View style={styles.status}>
                  <View style={[styles.statusDot, { backgroundColor: isConn ? "#3E7D4F" : "#B8AE9F" }]} />
                  <Text style={styles.statusText}>{isConn ? "Connected" : "Not connected yet"}</Text>
                </View>
                {isConn ? (
                  <Pressable
                    onPress={async () => { await m.clearCredentials(); refresh(); }}
                    style={styles.ghostBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.ghostText}>Clear credentials</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => props.onConnect(m.id)}
                    style={[styles.btn, !on && styles.btnOff]}
                    disabled={!on}
                    accessibilityRole="button"
                  >
                    <Text style={styles.btnText}>Connect</Text>
                  </Pressable>
                )}
              </View>
              {!isConn ? <Text style={styles.hint}>{m.connectHint}</Text> : null}
              {onlyOne ? <Text style={styles.hint}>The only module on. Turn another on before switching this one off.</Text> : null}
            </View>
          );
        })}
        <Text style={styles.foot}>With one module on, the screen stays clean. With two or more, the name at the top switches between them, and so do the dots.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 56, paddingHorizontal: 20, minHeight: 100 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -12 },
  h1: { color: theme.red, fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  lead: { color: "#5A5A5A", fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: "#fff", borderWidth: 2, borderColor: theme.border, borderRadius: 16, padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 17, fontWeight: "700", color: theme.ink },
  blurb: { fontSize: 13, color: "#5A5A5A" },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 },
  status: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, color: "#5A5A5A" },
  btn: { backgroundColor: theme.red, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 22 },
  btnOff: { opacity: 0.4 },
  btnText: { color: theme.bg, fontSize: 14, fontWeight: "700" },
  ghostBtn: { paddingVertical: 10 },
  ghostText: { color: theme.red, fontSize: 13, fontWeight: "700" },
  hint: { fontSize: 12.5, color: "#5A5A5A", lineHeight: 18 },
  foot: { fontSize: 12.5, color: "#8A8176", lineHeight: 18, textAlign: "center", marginTop: 8 },
});
