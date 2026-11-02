// The switcher: a bottom sheet listing every enabled module, a tick on the
// current one, Add features at the bottom. Opens from the module name. It
// fades in rather than sliding: a switch should feel quiet.
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { MODULES, type ModuleId } from "./modules";

export function SwitcherSheet(props: {
  open: boolean;
  enabled: ModuleId[];
  current: ModuleId;
  onPick: (id: ModuleId) => void;
  onAddFeatures: () => void;
  onClose: () => void;
}) {
  const mods = MODULES.filter((m) => props.enabled.includes(m.id));
  return (
    <Modal visible={props.open} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable style={styles.scrim} onPress={props.onClose} accessibilityLabel="Close" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.handle} />
        <Text style={styles.kicker}>Switch to</Text>
        {mods.map((m) => {
          const on = m.id === props.current;
          return (
            <Pressable
              key={m.id}
              style={[styles.row, on && styles.rowOn]}
              onPress={() => props.onPick(m.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <ModuleMark id={m.id} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.sub}>{m.blurb}</Text>
              </View>
              {on ? (
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#16180F" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M5 12.5l4.5 4.5L19 7.5" />
                </Svg>
              ) : null}
            </Pressable>
          );
        })}
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={props.onAddFeatures} accessibilityRole="button">
          <View style={styles.plus}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#16180F" strokeWidth={2.4} strokeLinecap="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>Add features</Text>
            <Text style={styles.sub}>Turn modules on or off. Each connects on its own.</Text>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

export function ModuleMark(props: { id: ModuleId; size?: number }) {
  const s = props.size ?? 36;
  if (props.id === "jarvis") {
    return <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: "#8B0000", shadowColor: "#8B0000", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }} />;
  }
  return (
    <View style={{ width: s, height: s, borderRadius: s / 3, backgroundColor: "#8B0000", alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: s / 3, height: s / 3, borderRadius: s / 6, backgroundColor: "#FFFFFF" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(10,12,8,.45)" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 6,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E6E6EC", alignSelf: "center", marginBottom: 10 },
  kicker: { fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: "#5E5E64", fontWeight: "700", paddingHorizontal: 4, paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#F6F6F9", minHeight: 56 },
  rowOn: { borderWidth: 2, borderColor: "#16180F" },
  name: { fontWeight: "700", fontSize: 15, color: "#16180F" },
  sub: { fontSize: 12, color: "#5E5E64" },
  divider: { height: 1, backgroundColor: "#E6E6EC", marginVertical: 8, marginHorizontal: 4 },
  plus: { width: 36, height: 36, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#6C6C72", alignItems: "center", justifyContent: "center" },
});
