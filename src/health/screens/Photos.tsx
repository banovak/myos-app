// Every photo, filtered by body area or body progress. No text on the image.
import { Text, View } from "react-native";
import { byDateDesc, fmt } from "../model/dates";
import { rl } from "../model/vocab";
import { useHealth } from "../state/HealthContext";
import { Card, Chip, Chips, PageH, useT } from "../ui";
import { PhotoView } from "../components/PhotoView";
import { openEntry } from "../sheets";

export function PhotosScreen() {
  const h = useHealth();
  const t = useT();
  const { D, V } = h;
  const ps = D.entries.filter((e) => e.photos.length);
  const regs = [...new Set(ps.flatMap((e) => (e.details.series === "body" ? ["__body"] : e.regions)))];
  const f = V.photoRegion;
  const shown = ps.filter((e) => f === "all" || (f === "__body" ? e.details.series === "body" : e.regions.includes(f) && e.details.series !== "body")).sort(byDateDesc());
  return (
    <View style={{ gap: 16 }}>
      <PageH title="Photos" sub={`${shown.length} shown`} />
      <Card>
        <Chips style={{ marginBottom: 12 }}><Chip label="All" on={f === "all"} onPress={() => h.setV({ photoRegion: "all" })} />{regs.map((r) => <Chip key={r} label={r === "__body" ? "Body progress" : rl(D, r)} on={f === r} onPress={() => h.setV({ photoRegion: r })} />)}</Chips>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {shown.map((e) => (
            <View key={e.id} style={{ width: "47%", flexGrow: 1, gap: 4 }}>
              <PhotoView photo={e.photos[0]} date={e.occurred_at} style={{ aspectRatio: 4 / 5 }} radius={14} onPress={() => openEntry(h, e.id)} />
              <Text style={{ fontSize: 12.5, fontFamily: t.fontUIBold, color: t.ink }}>{e.title}</Text>
              <Text style={{ fontSize: 11.5, color: t.muted, fontFamily: t.fontUI }}>{fmt(e.occurred_at)}</Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}
