// The one bottom sheet every form and detail view opens in. Scrolls inside,
// avoids the keyboard, closes on the scrim or ✕.
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useT } from "./primitives";

export function Sheet(props: { open: boolean; onClose: () => void; children: ReactNode }) {
  const t = useT();
  return (
    <Modal visible={props.open} transparent animationType="slide" onRequestClose={props.onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={props.onClose} accessibilityLabel="Close" />
        <View style={[sh.sheet, { backgroundColor: t.card }]} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={sh.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {props.children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function SheetH(props: { title: ReactNode; icon?: ReactNode; onClose: () => void }) {
  const t = useT();
  return (
    <View style={sh.head}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        {props.icon}
        {typeof props.title === "string" ? <Text style={{ fontSize: 18, fontFamily: t.fontUIHeavy, color: t.ink, flexShrink: 1 }}>{props.title}</Text> : props.title}
      </View>
      <Pressable onPress={props.onClose} style={[sh.x, { backgroundColor: t.soft }]} accessibilityLabel="Close" accessibilityRole="button">
        <Text style={{ color: t.ink, fontSize: 15 }}>✕</Text>
      </Pressable>
    </View>
  );
}
export function Acts(props: { left?: ReactNode; right?: ReactNode; start?: boolean }) {
  return <View style={[sh.acts, props.start && { justifyContent: "flex-start" }]}>{props.left ?? <View />}{props.right}</View>;
}
export const sh = StyleSheet.create({
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "92%", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: -10 } },
  body: { padding: 20, paddingBottom: 40, gap: 12 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 },
  x: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  acts: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" },
});
