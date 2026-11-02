// One line on the timeline or in a list: icon, title, what it was, when.
import { Pressable, Text, View } from "react-native";
import { fmtShort, money, tfmt } from "../model/dates";
import type { Entry } from "../model/types";
import { TYPES, kindLabel, rl } from "../model/vocab";
import { useHealth } from "../state/HealthContext";
import { Pill, TypeIco, useT } from "../ui";
import { openEntry } from "../sheets";

export function EntryRow(props: { e: Entry; onPress?: () => void }) {
  const h = useHealth();
  const t = useT();
  const e = props.e;
  const c = h.D.concerns.find((c) => c.id === e.concern_id);
  const sub = e.type === "appointment" ? [kindLabel(h.D, e.details.kind), e.details.provider].filter(Boolean).join(" · ") : TYPES[e.type]?.label || e.type;
  const bits: string[] = [sub, ...e.regions.filter((r) => r !== "whole_body").map((r) => rl(h.D, r))];
  if (e.photos.length) bits.push(`${e.photos.length} photo${e.photos.length > 1 ? "s" : ""}`);
  if ((e.files || []).length) bits.push(`${e.files.length} file${e.files.length > 1 ? "s" : ""}`);
  if (e.details.cost) bits.push(money(e.details.cost));
  return (
    <Pressable onPress={props.onPress || (() => openEntry(h, e.id))} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 8, paddingHorizontal: 8, borderRadius: 14 }} accessibilityRole="button">
      <TypeIco k={e.type} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: t.fontUIBold, color: t.ink, fontSize: 14 }}>{e.title}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 2 }}>
          <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{bits.filter(Boolean).join(" · ")}</Text>
          {c ? <Pill>{c.title}</Pill> : null}
          {e.type === "appointment" && e.details.status === "upcoming" ? <Pill kind="up">Upcoming</Pill> : null}
          {e.type === "appointment" && e.details.status === "cancelled" ? <Pill kind="mut">Cancelled</Pill> : null}
          {e.source !== "manual" ? <Pill kind="src">from {e.source}</Pill> : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontData }}>{fmtShort(e.occurred_at)}</Text>
        {e.details.time ? <Text style={{ fontSize: 11, color: t.muted, fontFamily: t.fontData }}>{tfmt(e.details.time)}</Text> : null}
      </View>
    </Pressable>
  );
}
