// The cycle chart: logged days on a calendar, with the user's own averages.
// Never a prediction.
import { Pressable, Text, View } from "react-native";
import { MONTHS, fmt, fmtShort, iso, pd, today } from "../model/dates";
import { cycleRec, cycleStats } from "../model/cycle";
import { FLOW, FLOW_COL } from "../model/vocab";
import { useHealth } from "../state/HealthContext";
import { Btn, Disclaim, Stat, Stats, useT } from "../ui";
import { openCycleDay } from "../sheets";

export function MonthGrid(props: { y: number; m: number }) {
  const h = useHealth();
  const t = useT();
  const T = today();
  const first = new Date(props.y, props.m, 1), lead = (first.getDay() + 6) % 7, days = new Date(props.y, props.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <View style={{ minWidth: 200, flex: 1 }}>
      <Text style={{ fontFamily: t.fontUIBold, fontSize: 13, color: t.ink, marginBottom: 6 }}>{MONTHS[props.m]} {props.y}</Text>
      <View style={{ flexDirection: "row", gap: 3 }}>{["M", "T", "W", "T", "F", "S", "S"].map((x, i) => <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: t.muted, fontFamily: t.fontUIBold }}>{x}</Text>)}</View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((n, i) => {
          if (!n) return <View key={"e" + i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const ds = iso(new Date(props.y, props.m, n)), r = cycleRec(h.D, ds), col = r && FLOW_COL[r.flow];
          return (
            <View key={ds} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 1.5 }}>
              <Pressable onPress={() => openCycleDay(h, ds)} accessibilityRole="button" accessibilityLabel={fmt(ds) + (r ? ", " + r.flow : "")}
                style={{ flex: 1, borderRadius: 999, backgroundColor: col || t.soft, alignItems: "center", justifyContent: "center", opacity: ds > T ? 0.45 : 1, borderWidth: ds === T ? 2 : 0, borderColor: t.ink }}>
                <Text style={{ fontSize: 11.5, fontFamily: t.fontData, color: col ? "#fff" : t.ink }}>{n}</Text>
                {r && (r.symptoms || []).length ? <View style={{ position: "absolute", bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: col ? "#fff" : t.ink, opacity: 0.7 }} /> : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function CycleChartBody(props: { months: number; small?: boolean }) {
  const h = useHealth();
  const t = useT();
  const n = props.small ? 1 : props.months || 3, T = pd(today());
  const months = [...Array(n)].map((_, i) => { const d = new Date(T.getFullYear(), T.getMonth() - (n - 1 - i), 1); return [d.getFullYear(), d.getMonth()] as [number, number]; });
  const s = cycleStats(h.D);
  return (
    <View style={{ gap: 12 }}>
      <Stats>
        <View style={{ flexDirection: "row", width: "100%", gap: 10 }}>
          <Stat value={s.cd ? "Day " + s.cd : "–"} label="of your cycle today" />
          <Stat value={s.last ? fmtShort(s.last.start) : "–"} label={`last period started${s.last ? " · " + s.last.len + " days" : ""}`} />
        </View>
        <View style={{ flexDirection: "row", width: "100%", gap: 10 }}>
          <Stat value={s.avgCycle ? s.avgCycle + " days" : "–"} label={`average cycle${s.nCycles ? ", last " + s.nCycles : ""}`} />
          <Stat value={s.avgPeriod ? s.avgPeriod + " days" : "–"} label="average period" />
        </View>
      </Stats>
      <View style={{ gap: 16 }}>{months.map(([y, m]) => <MonthGrid key={`${y}-${m}`} y={y} m={m} />)}</View>
      {!props.small ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {FLOW.slice(1).map(([v, l]) => <View key={v} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: FLOW_COL[v] }} /><Text style={{ fontSize: 12, color: t.ink, fontFamily: t.fontUI }}>{l}</Text></View>)}
            <Text style={{ fontSize: 12, color: t.ink, fontFamily: t.fontUI }}>A dot under a day means symptoms were logged</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Btn kind="accent" small label="Log today" onPress={() => openCycleDay(h, today())} />
            <View style={{ flex: 1, minWidth: 180 }}><Disclaim>Tap any day to log it. Averages of your own records; nothing here predicts anything.{s.imported ? " Includes days from Apple Health; what you log yourself comes first." : ""}</Disclaim></View>
          </View>
        </>
      ) : null}
    </View>
  );
}
