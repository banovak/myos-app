// The scrollable bottom menu with every section, and the floating + above it
// on the right. The bottom of the screen belongs to the module.
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useHealth, type Tab } from "../state/HealthContext";
import { TABS } from "../model/vocab";
import { Icon, useT } from "../ui";
import { NoSwipe } from "../../shell/NoSwipe";

export const NAV_HEIGHT = 86;

export function BottomNav(props: { onAdd: () => void }) {
  const h = useHealth();
  const t = useT();
  return (
    <>
      <Pressable onPress={props.onAdd} style={[styles.fab, { backgroundColor: t.accent, shadowColor: t.accent }]} accessibilityLabel="Add an entry" accessibilityRole="button">
        <Icon k="plus" size={24} color={t.onAccent} stroke={2.5} />
      </Pressable>
      <NoSwipe style={[styles.nav, { backgroundColor: t.dark ? "rgba(27,30,24,.94)" : "rgba(255,255,255,.94)", borderTopColor: t.line }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }} keyboardShouldPersistTaps="handled">
          {TABS.map(([k, l]) => {
            const on = h.V.tab === k;
            return (
              <Pressable key={k} onPress={() => h.go(k as Tab)} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <View style={[styles.ico, on && { backgroundColor: t.accent }]}>
                  <Icon k={k} size={20} color={on ? t.onAccent : t.muted} />
                </View>
                <Text style={{ fontSize: 10.5, fontFamily: t.fontUISemi, color: on ? t.ink : t.muted }}>{l}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </NoSwipe>
    </>
  );
}

const styles = StyleSheet.create({
  nav: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingTop: 6, paddingBottom: 24 },
  item: { alignItems: "center", gap: 2, paddingVertical: 4, paddingHorizontal: 9 },
  ico: { width: 44, height: 28, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  fab: { position: "absolute", right: 16, bottom: NAV_HEIGHT + 14, width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", zIndex: 13, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
});
