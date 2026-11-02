// One check-in of a challenge, every period as a square: done, missed, open
// now, still to come. Opened from the check-in lines on the challenge page.
import { Text, View } from "react-native";
import { perUnit, ruleCells, ruleStatus, ruleTitle } from "../model/experiments";
import type { Challenge } from "../model/types";
import { statusColor } from "../theme";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, SheetH, Sub, useT } from "../ui";

export function openRuleGrid(h: Health, c: Challenge, ri: number): void { h.openSheet(<RuleGrid id={c.id} ri={ri} />); }

function RuleGrid(props: { id: string; ri: number }) {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const c = D.challenges.find((x) => x.id === props.id), r = c ? c.rules[props.ri] : undefined;
  if (!c || !r) return <View><SheetH title="Check-in" onClose={h.closeSheet} /></View>;
  const cells = ruleCells(D, c, r), st = ruleStatus(D, c, r), daily = r.per === "day", perRow = daily ? 7 : 6, size = daily ? 32 : 36;
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += perRow) rows.push(cells.slice(i, i + perRow));
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={ruleTitle(r)} onClose={h.closeSheet} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <Sub>{c.title} · {st.hit} of {st.n} {perUnit(r.per, st.n)}</Sub>
        <Text style={{ fontFamily: t.fontUIBold, color: statusColor(t, st.st), fontSize: 13 }}>{st.detail}</Text>
      </View>
      <View style={{ gap: 6 }}>
        {rows.map((row, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 6 }}>
            {row.map((x, j) => (
              <View key={j} style={{ width: size, height: size, borderRadius: 8, backgroundColor: x.st === "hit" ? t.accent : x.st === "fut" ? t.soft : "transparent", borderWidth: x.st === "miss" ? 1.5 : x.st === "open" ? 2 : 0, borderColor: x.st === "open" ? t.accent : t.line, opacity: x.st === "fut" ? 0.5 : 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 10, fontFamily: t.fontUISemi, color: x.st === "hit" ? t.onAccent : t.muted }}>{daily ? +x.a.slice(8) : i * perRow + j + 1}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      <Sub>Filled is done, outlined is missed, the ring is open now.</Sub>
      <Acts />
    </View>
  );
}
