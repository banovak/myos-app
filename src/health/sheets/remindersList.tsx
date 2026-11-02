// Every reminder in one list, from the bell in the top bar: pause, edit, or
// add one here. A reminder is set on the thing itself too (a challenge, a
// concern, a Lifestyle item, a quick-entry widget).
import { Text, View } from "react-native";
import { nextFire, remStatus, remTarget, schedText } from "../model/reminders";
import { useHealth, type Health } from "../state/HealthContext";
import { Btn, Empty, Icon, Pill, Row, SheetH, Sub, useT } from "../ui";
import { openRemind } from "./reminder";

export function openReminders(h: Health): void { h.openSheet(<RemindersList />); }

function RemindersList() {
  const h = useHealth();
  const t = useT();
  const rs = (h.D.reminders || []).slice().sort((a, b) => ((nextFire(a)?.getTime() ?? Infinity) - (nextFire(b)?.getTime() ?? Infinity)));
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="Reminders" onClose={h.closeSheet} />
      <View style={{ gap: 8 }}>
        {rs.length ? rs.map((r) => { const tg = remTarget(h.D, r); return (
          <Row key={r.id} onPress={() => openRemind(h, { rid: r.id })}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flex: 1, minWidth: 0 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center", opacity: r.enabled ? 1 : 0.45 }}><Icon k="bell" size={14} stroke={2} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}><Text style={{ fontFamily: t.fontUIBold, color: t.ink, fontSize: 13.5 }}>{r.title}</Text>{r.private ? <Pill kind="mut">Private</Pill> : null}</View>
                <Sub>{schedText(r.schedule || {})}{!tg ? " · what it was for has been removed" : tg.label ? " · " + tg.label : ""}</Sub>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI, textAlign: "right" }}>{remStatus(h.D, r)}</Text>
          </Row>
        ); }) : <Empty>No reminders yet. Add one here, or use Remind me on a challenge, concern, Lifestyle item or quick entry.</Empty>}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}><Btn kind="accent" label="+ Add a reminder" onPress={() => openRemind(h, { kind: "custom", id: null })} /></View>
    </View>
  );
}
