// Dashboard: stories with the layout button beside them, the body card,
// widgets (one column on the phone: the web's left column then its right).
// No page title: the bottom menu names the page.
import { Text, View } from "react-native";
import { rl } from "../model/vocab";
import { useHealth } from "../state/HealthContext";
import { Chip, Chips, useT } from "../ui";
import { BodyStage, LayoutBtn } from "../components/BodyStage";
import { Stories } from "../components/Stories";
import { WidgetColumn } from "../components/Widgets";

export function ScopeChips() {
  const h = useHealth();
  const { D, V } = h;
  if (!V.region && !V.concern) return null;
  const c = V.concern ? D.concerns.find((c) => c.id === V.concern) : null;
  return (
    <Chips>
      {V.region ? <Chip on label={`${rl(D, V.region)}  ✕`} onPress={() => h.setV({ region: null, frame: null })} /> : null}
      {V.concern ? <Chip on label={`${c ? c.title : "Concern"}  ✕`} onPress={() => h.setV({ concern: null })} /> : null}
    </Chips>
  );
}

export function Dashboard() {
  const h = useHealth();
  const t = useT();
  const { D, V } = h;
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}><Stories /></View>
        <View style={{ paddingTop: 11 }}><LayoutBtn /></View>
      </View>
      <ScopeChips />
      {V.region ? <Text style={{ fontSize: 12.5, color: t.muted, fontFamily: t.fontUI, marginTop: -8 }}>White widgets show {rl(D, V.region)} only. Tinted widgets always show everything.</Text> : null}
      <BodyStage />
      <WidgetColumn col="left" />
      <WidgetColumn col="right" />
    </View>
  );
}
