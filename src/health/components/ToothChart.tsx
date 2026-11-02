// The 32-tooth chart, drawn like a dental chart: two arches, each tooth an
// outline with groove lines, status as a tint. Dentist view: the person's
// right on the viewer's left.
import { Pressable, Text, View } from "react-native";
import { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { FitSvg } from "./Figure";
import { teethGeometry, teethData, toothLabel, toothNum, statusLabel, TOOTH_STATUS, ALL_TEETH } from "../model/teeth";
import { useHealth } from "../state/HealthContext";
import { Chips, Chip, Disclaim, Seg, useT } from "../ui";
import { openTooth } from "../sheets";

export function TeethSvg(props: { small?: boolean; onTooth?: (n: number) => void }) {
  const h = useHealth();
  const t = useT();
  const geo = teethGeometry(h.D);
  const stroke = "#9AA0A6";
  return (
    <FitSvg viewBox="0 0 400 560" label="Teeth chart" interactive>
      {!props.small ? (
        <>
          <Line x1={125} y1={292} x2={275} y2={292} stroke={t.line} strokeWidth={1.5} />
          <SvgText x={200} y={272} textAnchor="middle" fill={t.muted} opacity={0.7} fontSize={11.5} fontFamily={t.fontUIBold} letterSpacing={1}>UPPER TEETH</SvgText>
          <SvgText x={200} y={320} textAnchor="middle" fill={t.muted} opacity={0.7} fontSize={11.5} fontFamily={t.fontUIBold} letterSpacing={1}>LOWER TEETH</SvgText>
          <SvgText x={14} y={552} fill={t.muted} opacity={0.7} fontSize={11.5} fontFamily={t.fontUIBold} letterSpacing={1}>← YOUR RIGHT</SvgText>
          <SvgText x={386} y={552} textAnchor="end" fill={t.muted} opacity={0.7} fontSize={11.5} fontFamily={t.fontUIBold} letterSpacing={1}>YOUR LEFT →</SvgText>
        </>
      ) : null}
      {geo.map((g) => {
        const tr = `translate(${g.x.toFixed(1)} ${g.y.toFixed(1)}) rotate(${g.ang.toFixed(1)})${g.up ? "" : " scale(1 -1)"}`;
        const label = toothLabel(h.D, g.n) + (g.ss.length ? ", " + g.ss.map(statusLabel).join(", ") : "");
        return (
          <G key={g.n} onPress={props.onTooth ? () => props.onTooth!(g.n) : undefined} accessibilityLabel={label}>
            <G transform={tr}>
              <Path d={g.path} fill={g.gone ? "none" : g.col || t.card} fillOpacity={g.col ? 0.32 : 1} stroke={g.col || stroke} strokeWidth={g.col ? 2 : 1.5} strokeLinejoin="round" strokeDasharray={g.gone ? "3 3" : undefined} opacity={g.gone ? 0.6 : 1} />
              {!g.gone ? <Path d={g.grooves} fill="none" stroke={g.col || stroke} strokeWidth={1.1} strokeLinecap="round" opacity={g.col ? 0.9 : 0.75} /> : null}
              {g.ss.length > 1 && !g.gone ? <Circle r={3} cy={(g.h * 0.02).toFixed(1)} fill="#fff" stroke="rgba(0,0,0,.4)" strokeWidth={1} /> : null}
            </G>
            {!props.small ? <SvgText x={g.lx.toFixed(1)} y={(g.ly + 4).toFixed(1)} textAnchor="middle" fill={t.muted} fontSize={11} fontFamily={t.fontData}>{toothNum(h.D, g.n)}</SvgText> : null}
          </G>
        );
      })}
    </FitSvg>
  );
}

export function TeethLegend() {
  const h = useHealth();
  const t = useT();
  const used = new Set(Object.values(teethData(h.D)).flatMap((r) => r.s));
  const items = TOOTH_STATUS.filter(([k]) => used.has(k));
  return (
    <View style={{ gap: 8, alignItems: "center" }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        {items.length ? items.map(([k, l, c]) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c || "transparent", borderWidth: c ? 0 : 1.5, borderStyle: "dashed", borderColor: t.muted }} />
            <Text style={{ fontSize: 12, color: t.ink, fontFamily: t.fontUI }}>{l}</Text>
          </View>
        )) : <Text style={{ fontSize: 12, color: t.ink, fontFamily: t.fontUI }}>Tap a tooth to note what's been done to it.</Text>}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>Numbering</Text>
        <Seg small value={h.D.settings.toothNumbering || "fdi"} options={[["fdi", "International"], ["universal", "US"]]} onChange={(v) => h.mutate((D) => { D.settings.toothNumbering = v as "fdi" | "universal"; })} />
      </View>
      <Disclaim center>Shown as your dentist sees it, facing you. A record of what was done, not a diagnosis.</Disclaim>
    </View>
  );
}

export function TeethWidget() {
  const h = useHealth();
  const t = useT();
  const td = teethData(h.D), ns = ALL_TEETH.filter((n) => td[n] && (td[n].s.length || td[n].note));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ width: 240, aspectRatio: 400 / 560, alignSelf: "center", maxHeight: 220 }}><TeethSvg small onTooth={(n) => openTooth(h, n)} /></View>
      {ns.length ? ns.slice(0, 5).map((n) => (
        <Pressable key={n} onPress={() => openTooth(h, n)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, backgroundColor: t.soft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }} accessibilityRole="button">
          <Text style={{ fontSize: 13.5, fontFamily: t.fontUIBold, color: t.ink, flex: 1 }}>{toothLabel(h.D, n).replace(/^Tooth /, "")}</Text>
          <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{td[n].s.map(statusLabel).join(", ") || "Note"}</Text>
        </Pressable>
      )) : <Text style={{ color: t.muted, fontSize: 13, fontFamily: t.fontUI, paddingVertical: 6 }}>Tap a tooth to note fillings, crowns, removed or never-grown teeth.</Text>}
      <Pressable onPress={() => h.go("dashboard", { zoom: "head", region: "teeth", mouthView: "teeth", frame: null })} style={{ paddingVertical: 6 }} accessibilityRole="link">
        <Text style={{ fontSize: 13, fontFamily: t.fontUIBold, color: t.ink, textDecorationLine: "underline" }}>Open the full chart</Text>
      </Pressable>
    </View>
  );
}
export { Chips, Chip };
