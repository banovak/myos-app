// A month view of one regimen: the days it was ticked off, filled in its
// colour; days it was running but not ticked, a ring; days outside its
// stints, plain; days still to come, faded. Tap a day to tick it, tap again to
// untick. The quick answer to "did I take it, and which days did I miss?"
import { Pressable, Text, View } from "react-native";
import { MONTHS, addDays, fmt, iso, pd, today, uid } from "../model/dates";
import { logsOf, regColor, regimenActive } from "../model/regimens";
import type { Regimen } from "../model/types";
import { useHealth } from "../state/HealthContext";
import { colorOf } from "../theme";
import { Empty, Stat, Stats, useT } from "../ui";

export function RegimenMonthBody(props: { regId?: string; months: number; small?: boolean }) {
  const h = useHealth();
  const t = useT();
  const D = h.D, T = today(), r = D.regimens.find((x) => x.id === props.regId);
  if (!r) return <Empty>Pick a regimen to show.</Empty>;
  const col = colorOf(r.color, t, regColor({}));
  const n = props.small ? 1 : props.months || 1, Td = pd(T);
  const months = [...Array(n)].map((_, i) => { const d = new Date(Td.getFullYear(), Td.getMonth() - (n - 1 - i), 1); return [d.getFullYear(), d.getMonth()] as [number, number]; });
  const logged = new Set(logsOf(D, r.id).map((l) => l.on_date));
  // this month so far: the days ticked out of the days it was running
  let run = 0, hit = 0;
  for (let d = T.slice(0, 8) + "01"; d <= T; d = addDays(d, 1)) if (regimenActive(r, d)) { run++; if (logged.has(d)) hit++; }
  return (
    <View style={{ gap: 12 }}>
      {!props.small ? (
        <Stats>
          <View style={{ flexDirection: "row", width: "100%", gap: 10 }}>
            <Stat value={`${hit} of ${run}`} label="days this month so far" />
            <Stat value={run ? `${Math.round((hit / run) * 100)}%` : "–"} label={r.name} />
          </View>
        </Stats>
      ) : null}
      <View style={{ gap: 16 }}>{months.map(([y, m]) => <RegGrid key={`${y}-${m}`} y={y} m={m} r={r} col={col} logged={logged} />)}</View>
      {!props.small ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: col }} /><Text style={{ fontSize: 12, color: t.ink, fontFamily: t.fontUI }}>Ticked</Text></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: col }} /><Text style={{ fontSize: 12, color: t.ink, fontFamily: t.fontUI }}>Running, not ticked</Text></View>
          <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>Tap a day to tick it, again to untick.</Text>
        </View>
      ) : null}
    </View>
  );
}

function RegGrid(props: { y: number; m: number; r: Regimen; col: string; logged: Set<string> }) {
  const h = useHealth();
  const t = useT();
  const T = today(), { r, col } = props;
  const first = new Date(props.y, props.m, 1), lead = (first.getDay() + 6) % 7, days = new Date(props.y, props.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const tick = (d: string) => h.mutate((D) => {
    const i = D.regLogs.findIndex((l) => l.regimen_id === r.id && l.on_date === d && l.source === "manual");
    if (i >= 0) D.regLogs.splice(i, 1); else D.regLogs.push({ id: "rl-" + uid(), regimen_id: r.id, on_date: d, time: null, source: "manual", note: "" });
  });
  return (
    <View style={{ minWidth: 200, flex: 1 }}>
      <Text style={{ fontFamily: t.fontUIBold, fontSize: 13, color: t.ink, marginBottom: 6 }}>{MONTHS[props.m]} {props.y}</Text>
      <View style={{ flexDirection: "row", gap: 3 }}>{["M", "T", "W", "T", "F", "S", "S"].map((x, i) => <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: t.muted, fontFamily: t.fontUIBold }}>{x}</Text>)}</View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((n, i) => {
          if (!n) return <View key={"e" + i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const ds = iso(new Date(props.y, props.m, n)), on = props.logged.has(ds), running = regimenActive(r, ds), fut = ds > T, isT = ds === T;
          return (
            <View key={ds} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 1.5 }}>
              <Pressable onPress={fut ? undefined : () => tick(ds)} disabled={fut} accessibilityRole="button" accessibilityLabel={`${fmt(ds)}, ${on ? "ticked" : running ? "not ticked" : "not running"}${fut ? ", to come" : ""}`}
                style={{ flex: 1, borderRadius: 999, backgroundColor: on ? col : t.soft, alignItems: "center", justifyContent: "center", opacity: fut ? 0.4 : running || on ? 1 : 0.5, borderWidth: isT ? 2 : running && !on && !fut ? 1.5 : 0, borderColor: isT ? t.ink : col }}>
                <Text style={{ fontSize: 11.5, fontFamily: t.fontData, color: on ? "#fff" : t.ink }}>{n}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
