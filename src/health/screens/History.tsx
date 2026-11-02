// History: everything by date, three ways. A list (newest first, with what
// is coming up above it), a month calendar (entries as dots under the date,
// what spans time as bars across the weeks below them, thinner the more there
// are, with a +N on a day that has more than fit), and a bar timeline. On
// both, the stretch of a bar still to come is faded: planned, not done. Then that scrolls sideways with a
// row per concern, course of care, regimen and challenge, and a row of dots
// per kind of entry. The filters by type, body area and concern apply to all
// three and sit behind the filter button. Tapping a day lists it; tapping a
// bar or a dot opens the thing. A regimen stopped and started again is one
// row with a bar per stint. Press and hold a row's title on the bar timeline
// to read all of it; a tap anywhere puts it away. The bar timeline can fill
// the screen sideways, with a wider title column.
import { useState, type ReactNode } from "react";
import { Modal, StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { MONTHS, addDays, dayDiff, fmt, iso, today } from "../model/dates";
import { expRange } from "../model/experiments";
import { episodesOf, illnessColor, isIllness } from "../model/illness";
import { regColor, stintsOf } from "../model/regimens";
import { colorOf } from "../theme";
import { Portal } from "../ui/Portal";
import { useHealth, type Health } from "../state/HealthContext";
import { Btn, Card, CardH, Chip, Chips, Empty, Icon, PageH, Row, RowText, Seg, SheetH, useT } from "../ui";
import { SuggestionCards } from "../components/Widgets";
import { NoSwipe } from "../../shell/NoSwipe";
import { ScopeChips } from "./Dashboard";
import { HIST_FILTERS, ItemRow, TimelineList, historyItems, type Item } from "./Timeline";
import { openCourseSessions, openEntry, openForm, openLab, openRegimen } from "../sheets";

type Span = { id: string; kind: "concern" | "ill" | "course" | "reg" | "ch"; title: string; sub: string; from: string; to: string | null; color: string; open: () => void; /** the thing this is one stint of; stints (or an illness's episodes) share a row and a legend entry */ group: string };
const KIND: Record<Span["kind"], string> = { concern: "Concern", ill: "Illness", course: "Course of care", reg: "Regimen", ch: "Challenge" };
const TYPE_LABEL: Record<string, string> = Object.fromEntries(HIST_FILTERS);

/** what spans time, under the current filters, earliest first */
function spansOf(h: Health): Span[] {
  const { D, V } = h;
  if (V.type !== "all" && V.type !== "reg") return [];
  const okR = (regs: string[]) => !V.region || regs.includes(V.region);
  const okC = (cid: string | null) => !V.concern || cid === V.concern;
  const out: Span[] = [];
  D.concerns.forEach((c) => {
    if (!okR(c.regions) || !okC(c.id)) return;
    const open = () => h.go("concerns", { concernPage: c.id });
    // an illness: a bar per episode on one row, labelled with what it was
    if (isIllness(c)) { const col = colorOf(illnessColor(D, c), h.t, h.t.tint("illness")); episodesOf(c).forEach((e, i) => out.push({ id: "c" + c.id + ":" + i, group: "c" + c.id, kind: "ill", title: c.title, sub: e.label || "", from: e.from, to: e.to, color: col, open })); return; }
    if (c.started_on) out.push({ id: "c" + c.id, group: "c" + c.id, kind: "concern", title: c.title, sub: c.status === "resolved" ? "Resolved" : "Active", from: c.started_on, to: c.resolved_on, color: h.t.tint("observation"), open });
  });
  D.courses.forEach((k) => { const c = D.concerns.find((x) => x.id === k.concern_id); if (okR(c ? c.regions : []) && okC(k.concern_id)) out.push({ id: "k" + k.id, group: "k" + k.id, kind: "course", title: k.title, sub: [k.provider, k.cadence].filter(Boolean).join(" · "), from: k.started_on, to: k.ended_on, color: k.color || "#4F5BF5", open: () => openCourseSessions(h, k.id) }); });
  D.regimens.forEach((r) => { if (okR(r.regions) && okC(r.concern_id)) stintsOf(r).forEach((p, i) => out.push({ id: "r" + r.id + ":" + i, group: "r" + r.id, kind: "reg", title: r.name, sub: [r.dose, r.frequency].filter(Boolean).join(" · "), from: p.from, to: p.to, color: regColor(r), open: () => openRegimen(h, r) })); });
  if (!V.region && !V.concern) D.challenges.forEach((c) => { const { from, to } = expRange(c); out.push({ id: "x" + c.id, group: "x" + c.id, kind: "ch", title: c.title, sub: "Challenge", from, to, color: h.t.accent, open: () => h.go("plan", { exp: c.id }) }); });
  return out.sort((a, b) => (a.from < b.from ? -1 : 1));
}
const dotColor = (t: ReturnType<typeof useT>, it: Item) => t.tint(it.kind === "lab" ? "lab" : it.kind === "entry" ? it.e.type : "regimen");
const isPoint = (it: Item) => it.kind === "entry" || it.kind === "lab";

/** the type chips and the area / concern chips, with a note on what All leaves out */
function Filters(props: { hint?: boolean }) {
  const h = useHealth();
  const t = useT();
  return (
    <View style={{ gap: 8 }}>
      <Chips>{HIST_FILTERS.map(([k, l]) => <Chip key={k} label={l} on={h.V.type === k} onPress={() => h.setV({ type: k })} />)}</Chips>
      <ScopeChips />
      {props.hint && h.V.type === "all" ? <Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>All leaves out measurements and body progress photos, as there are so many. Pick their chip to see them.</Text> : null}
    </View>
  );
}
function RoundBtn(props: { k: string; label: string; on?: boolean; onPress: () => void }) {
  const t = useT();
  return (
    <Pressable onPress={props.onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={props.label} accessibilityState={{ selected: !!props.on }} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: props.on ? t.accent : t.card, borderWidth: props.on ? 0 : 1, borderColor: t.line }}>
      <Icon k={props.k} size={18} stroke={2} color={props.on ? t.onAccent : t.ink} />
    </Pressable>
  );
}

export function HistoryScreen() {
  const h = useHealth();
  const { D, V } = h;
  const [filters, setFilters] = useState(false);
  const [full, setFull] = useState(false);
  const items = historyItems(D, V), spans = spansOf(h);
  const view = V.histView;
  // the list in two: what is still to come (dated after today, or an appointment booked for today), then the past
  const T = today();
  const isUp = (it: Item) => it.d > T || (it.kind === "entry" && it.e.type === "appointment" && it.e.details.status === "upcoming" && it.d >= T);
  const up = items.filter(isUp).sort((a, b) => (a.d < b.d ? -1 : 1)), past = items.filter((it) => !isUp(it));
  const filtered = V.type !== "all" || !!V.region || !!V.concern;
  return (
    <View style={{ gap: 14 }}>
      <PageH title="History" sub={view === "list" ? `${items.length} items` : view === "month" ? "Entries as dots, what spans time as bars" : "What spans time, and when things happened"} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}><Seg value={view} options={[["list", "List"], ["month", "Month"], ["bars", "Timeline"]]} onChange={(v) => h.setV({ histView: v as "list" | "month" | "bars" })} /></View>
        <RoundBtn k="filter" label={filters ? "Hide filters" : filtered ? "Filters, some set" : "Filters"} on={filters || filtered} onPress={() => setFilters((v) => !v)} />
        {view === "bars" ? <RoundBtn k="expand" label="Timeline full screen" onPress={() => setFull(true)} /> : null}
      </View>
      {filters ? <Card style={{ paddingVertical: 14 }}><Filters hint /></Card> : null}
      {view === "list" ? <><ComingUp items={up} /><TimelineList items={past} title="Past" /></> : view === "month" ? <MonthView items={items} spans={spans} /> : <BarsView items={items} spans={spans} />}
      {full ? <FullBars items={items} spans={spans} onClose={() => setFull(false)} /> : null}
    </View>
  );
}

/** the bar timeline turned sideways to fill the phone: turn the phone to read it */
function FullBars(props: { items: Item[]; spans: Span[]; onClose: () => void }) {
  const t = useT();
  const win = useWindowDimensions();
  const W = Math.max(win.width, win.height), H = Math.min(win.width, win.height);
  return (
    <Modal visible animationType="fade" onRequestClose={props.onClose} supportedOrientations={["portrait", "landscape"]}>
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: W, height: H, transform: [{ rotate: "90deg" }], paddingLeft: 54, paddingRight: 34, paddingVertical: 12, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 16, fontFamily: t.fontUIBold, color: t.ink }}>Timeline</Text>
            <View style={{ flex: 1 }}><ScrollView horizontal showsHorizontalScrollIndicator={false}><Filters /></ScrollView></View>
            <RoundBtn k="close" label="Close" onPress={props.onClose} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}><BarsView items={props.items} spans={props.spans} full /></ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** what is still to come under the current filters, and what the calendar found, above the past. Always there for
 * appointments (it holds the button to book one); for other filters only when something is dated ahead */
function ComingUp(props: { items: Item[] }) {
  const h = useHealth();
  const { D, V } = h;
  const up = props.items;
  const sug = D.suggestions.filter((s) => s.status === "pending");
  const appts = V.type === "all" || V.type === "appointment";
  if (!appts && !up.length) return null;
  return (
    <Card>
      <CardH title="Coming up" sub={up.length ? String(up.length) : ""} right={appts ? <Btn small kind="accent" label="+ Appointment" onPress={() => openForm(h, "appointment", { details: { status: "upcoming" } })} /> : undefined} />
      <View style={{ gap: 10 }}>
        {appts && sug.length ? <SuggestionCards items={sug} /> : null}
        {up.length ? up.map((it, i) => <ItemRow key={i} it={it} />) : <Empty>Nothing booked.</Empty>}
      </View>
    </Card>
  );
}

// ----- month -----
const CELL = 58, LANES = 4, BAR_TOP = 36, BAR_MAX = 5, BAR_MIN = 2, BAR_GAP = 2;
function MonthView(props: { items: Item[]; spans: Span[] }) {
  const h = useHealth();
  const t = useT();
  const T = today();
  const [y, m] = h.V.histMonth.split("-").map(Number);
  const first = new Date(y, m - 1, 1), dim = new Date(y, m, 0).getDate(), dow = (first.getDay() + 6) % 7; // weeks start on Monday
  const rows = Math.ceil((dow + dim) / 7);
  const start = addDays(iso(first), -dow), end = addDays(start, rows * 7 - 1);
  const byDay = new Map<string, Item[]>();
  props.items.forEach((it) => { if (isPoint(it)) { const a = byDay.get(it.d) || []; a.push(it); byDay.set(it.d, a); } });
  // lanes for the bars, the same across the weeks: a span takes the first lane free after the one before it ends.
  // Only the first LANES lanes are drawn; the bars thin out as lanes are used, down to a floor
  const laneEnd: string[] = [], laneOf = new Map<string, number>();
  props.spans.filter((s) => s.from <= end && (s.to || T) >= start).forEach((s) => {
    let l = laneEnd.findIndex((e) => e < s.from);
    if (l < 0) { l = laneEnd.length; laneEnd.push(""); }
    laneEnd[l] = s.to || T; laneOf.set(s.id, l);
  });
  const lanes = Math.min(LANES, laneEnd.length);
  const bar = Math.max(BAR_MIN, Math.min(BAR_MAX, (CELL - BAR_TOP - 3 - (lanes - 1) * BAR_GAP) / Math.max(1, lanes)));
  const crossing = (d: string) => props.spans.filter((s) => laneOf.has(s.id) && s.from <= d && (s.to || T) >= d);
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); h.setV({ histMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` }); };
  const nav = (lbl: string, fn: () => void, a11y: string) => <Pressable onPress={fn} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }} accessibilityRole="button" accessibilityLabel={a11y}><Text style={{ color: t.ink, fontSize: 18, lineHeight: 22 }}>{lbl}</Text></Pressable>;
  const thisMonth = T.slice(0, 7) === h.V.histMonth;
  return (
    <Card style={{ paddingHorizontal: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 6, marginBottom: 10 }}>
        {nav("‹", () => shift(-1), "Previous month")}
        <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontFamily: t.fontUIBold, color: t.ink }}>{MONTHS[m - 1]} {y}</Text>
        {!thisMonth ? <Chip label="Today" onPress={() => h.setV({ histMonth: T.slice(0, 7) })} /> : null}
        {nav("›", () => shift(1), "Next month")}
      </View>
      <View style={{ flexDirection: "row" }}>{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: t.muted, fontFamily: t.fontUIBold }}>{d}</Text>)}</View>
      {Array.from({ length: rows }, (_, r) => {
        const d0 = addDays(start, r * 7), d6 = addDays(d0, 6);
        const segs = props.spans.filter((s) => laneOf.has(s.id) && laneOf.get(s.id)! < LANES && s.from <= d6 && (s.to || T) >= d0).map((s) => {
          const c0 = s.from > d0 ? dayDiff(d0, s.from) : 0, c1 = (s.to || T) < d6 ? dayDiff(d0, s.to || T) : 6;
          return { s, c0, c1, l: laneOf.get(s.id)!, starts: s.from >= d0, ends: !!s.to && s.to <= d6 };
        });
        return (
          <View key={r} style={{ height: CELL, flexDirection: "row", borderTopWidth: 1, borderTopColor: t.line }}>
            {Array.from({ length: 7 }, (_, c) => {
              const d = addDays(d0, c), inM = d.slice(0, 7) === h.V.histMonth, its = byDay.get(d) || [], isT = d === T;
              const more = crossing(d).filter((s) => laneOf.get(s.id)! >= LANES).length; // bars this day that are not drawn
              return (
                <Pressable key={c} onPress={() => openDay(h, d, its, props.spans.filter((s) => s.from <= d && (s.to || T) >= d))} style={{ flex: 1, alignItems: "center", paddingTop: 4 }} accessibilityRole="button" accessibilityLabel={`${fmt(d)}, ${its.length} items${more ? `, ${more} more bars` : ""}`}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: isT ? t.accent : "transparent" }}>
                    <Text style={{ fontSize: 12, fontFamily: isT ? t.fontUIBold : t.fontUI, color: isT ? t.onAccent : inM ? t.ink : t.muted, opacity: inM || isT ? 1 : 0.45 }}>{+d.slice(8)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 2, position: "absolute", top: 28 }}>{its.slice(0, 4).map((it, i) => <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: dotColor(t, it) }} />)}</View>
                  {more ? <Text style={{ position: "absolute", right: 2, bottom: 1, fontSize: 8.5, lineHeight: 10, fontFamily: t.fontUIBold, color: t.muted }}>+{more}</Text> : null}
                </Pressable>
              );
            })}
            {segs.flatMap(({ s, c0, c1, l, starts, ends }) => {
              const tc = T < d0 ? -1 : T > d6 ? 7 : dayDiff(d0, T); // the last column that has happened
              const piece = (a: number, b: number, rl: boolean, rr: boolean, fut: boolean) => <View key={s.id + (fut ? "f" : "")} pointerEvents="none" style={{ position: "absolute", top: BAR_TOP + l * (bar + BAR_GAP), left: `${(a / 7) * 100}%`, width: `${((b - a + 1) / 7) * 100}%`, height: bar, backgroundColor: s.color, opacity: fut ? 0.3 : 0.8, borderTopLeftRadius: rl ? bar / 2 : 0, borderBottomLeftRadius: rl ? bar / 2 : 0, borderTopRightRadius: rr ? bar / 2 : 0, borderBottomRightRadius: rr ? bar / 2 : 0 }} />;
              if (c1 <= tc) return [piece(c0, c1, starts, ends, false)];
              if (c0 > tc) return [piece(c0, c1, starts, ends, true)];
              return [piece(c0, tc, starts, false, false), piece(tc + 1, c1, false, ends, true)];
            })}
          </View>
        );
      })}
      {laneOf.size ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 6, marginTop: 10 }}>{props.spans.filter((s, i, all) => laneOf.has(s.id) && all.findIndex((x) => x.group === s.group && laneOf.has(x.id)) === i).map((s) => <Pressable key={s.id} onPress={s.open} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><View style={{ width: 10, height: 5, borderRadius: 3, backgroundColor: s.color, opacity: laneOf.get(s.id)! < LANES ? 1 : 0.4 }} /><Text style={{ fontSize: 11.5, color: t.ink, fontFamily: t.fontUI }}>{s.title}</Text></Pressable>)}</View> : null}
    </Card>
  );
}

function openDay(h: Health, d: string, items: Item[], spans: Span[]): void {
  h.openSheet(<DaySheet d={d} items={items} spans={spans} />);
}
function DaySheet(props: { d: string; items: Item[]; spans: Span[] }) {
  const h = useHealth();
  const T = today();
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={fmt(props.d)} onClose={h.closeSheet} />
      {props.items.length || props.spans.length ? (
        <View style={{ gap: 8 }}>
          {props.items.map((it, i) => <ItemRow key={i} it={it} />)}
          {props.spans.map((s) => <Row key={s.id} onPress={() => { h.closeSheet(); s.open(); }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color, marginRight: 10 }} /><RowText title={s.title} sub={`${KIND[s.kind]}${s.sub ? " · " + s.sub : ""}`} /></Row>)}
        </View>
      ) : <Empty>Nothing on this day.</Empty>}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Btn small kind="accent" label="+ Appointment" onPress={() => openForm(h, "appointment", { occurred_at: props.d, details: { status: props.d > T ? "upcoming" : "done" } })} />
        <Btn small label="+ Observation" onPress={() => openForm(h, "observation", { occurred_at: props.d })} />
      </View>
    </View>
  );
}

// ----- bars -----
const PX = 5, LBL = 112, LBL_FULL = 170, RH = 32, HDR = 26;
function BarsView(props: { items: Item[]; spans: Span[]; full?: boolean }) {
  const h = useHealth();
  const t = useT();
  const T = today();
  const pts = props.items.filter(isPoint);
  const byType = new Map<string, Item[]>();
  pts.forEach((it) => { const k = it.kind === "lab" ? "lab" : it.e.type; const a = byType.get(k) || []; a.push(it); byType.set(k, a); });
  if (!props.spans.length && !pts.length) return <Card><Empty>Nothing here yet.</Empty></Card>;
  const ds = [T, ...props.spans.map((s) => s.from), ...props.spans.map((s) => s.to || T), ...pts.map((it) => it.d)].sort();
  const from = addDays(ds[0], -10), to = addDays(ds[ds.length - 1] > addDays(T, 30) ? ds[ds.length - 1] : addDays(T, 30), 10);
  const X = (d: string) => dayDiff(from, d) * PX;
  const W = X(to);
  const months: { d: string; l: string }[] = [];
  for (let d = new Date(+from.slice(0, 4), +from.slice(5, 7), 1); iso(d) <= to; d.setMonth(d.getMonth() + 1)) months.push({ d: iso(d), l: `${MONTHS[d.getMonth()]}${d.getMonth() === 0 ? " " + d.getFullYear() : ""}` });
  // a row per thing; a regimen's stints share one row
  const groups = new Map<string, Span[]>();
  props.spans.forEach((s) => groups.set(s.group, [...(groups.get(s.group) || []), s]));
  const rows: ({ k: "span"; s: Span; ss: Span[] } | { k: "pts"; type: string; its: Item[] })[] = [
    ...(["concern", "ill", "course", "reg", "ch"] as const).flatMap((kind) => [...groups.values()].filter((ss) => ss[0].kind === kind).map((ss) => ({ k: "span" as const, s: ss[0], ss }))),
    ...[...byType.entries()].map(([type, its]) => ({ k: "pts" as const, type, its })),
  ];
  const H = HDR + rows.length * RH, lbl = props.full ? LBL_FULL : LBL;
  const [held, setHeld] = useState<number | null>(null); // the row whose title is being held, shown in full across the chart
  const Box = ({ children }: { children: ReactNode }) => (props.full ? <View style={{ borderRadius: 14, borderWidth: 1, borderColor: t.line, overflow: "hidden" }}>{children}</View> : <Card style={{ padding: 0, overflow: "hidden" }}>{children}</Card>);
  return (
    <Box>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: lbl, borderRightWidth: 1, borderRightColor: t.line }}>
          <View style={{ height: HDR }} />
          {rows.map((r, i) => (
            <Pressable key={i} onPress={r.k === "span" ? r.s.open : undefined} onLongPress={() => setHeld(i)} delayLongPress={250} accessibilityLabel={r.k === "span" ? `${r.s.title}, ${KIND[r.s.kind]}. Hold to read the whole title` : TYPE_LABEL[r.type] || r.type} style={{ height: RH, justifyContent: "center", paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: t.line, backgroundColor: held === i ? t.soft : undefined }}>
              <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: t.fontUISemi, color: t.ink }}>{r.k === "span" ? r.s.title : TYPE_LABEL[r.type] || r.type}</Text>
              <Text numberOfLines={1} style={{ fontSize: 10, color: t.muted, fontFamily: t.fontUI }}>{r.k === "span" ? KIND[r.s.kind] : `${r.its.length}`}</Text>
            </Pressable>
          ))}
        </View>
        <NoSwipe style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: Math.max(0, X(T) - 180), y: 0 }}>
            <View style={{ width: W, height: H }}>
              {months.map((mo) => <View key={mo.d} pointerEvents="none" style={{ position: "absolute", left: X(mo.d), top: 0, bottom: 0, borderLeftWidth: 1, borderLeftColor: t.line }}><Text style={{ fontSize: 10.5, color: t.muted, fontFamily: t.fontUIBold, paddingLeft: 4, paddingTop: 6 }}>{mo.l}</Text></View>)}
              <View pointerEvents="none" style={{ position: "absolute", left: X(T), top: 0, bottom: 0, borderLeftWidth: 1.5, borderLeftColor: t.accent }} />
              {rows.map((r, i) => (
                <View key={i} style={{ position: "absolute", left: 0, right: 0, top: HDR + i * RH, height: RH, borderTopWidth: 1, borderTopColor: t.line }}>
                  {r.k === "span" ? r.ss.flatMap((s) => {
                    // the stretch still to come is faded; today's column counts as done
                    const end = s.to || T, x0 = X(s.from), x2 = X(end) + PX, xt = X(T) + PX;
                    const piece = (k: string, a: number, b: number, rl: boolean, rr: boolean, fut: boolean) => <Pressable key={k} onPress={s.open} accessibilityRole="button" accessibilityLabel={fut ? `${s.title}, planned` : s.title} style={{ position: "absolute", left: a, width: Math.max(fut ? 4 : 8, b - a), top: 7, height: RH - 14, backgroundColor: s.color, opacity: fut ? 0.3 : 0.85, borderTopLeftRadius: rl ? 9 : 0, borderBottomLeftRadius: rl ? 9 : 0, borderTopRightRadius: rr ? (s.to ? 9 : 2) : 0, borderBottomRightRadius: rr ? (s.to ? 9 : 2) : 0 }} />;
                    if (s.from > T) return [piece(s.id, x0, x2, true, true, true)];
                    if (!s.to || s.to <= T) return [piece(s.id, x0, x2, true, true, false)];
                    return [piece(s.id, x0, xt, true, false, false), piece(s.id + "f", xt, x2, false, true, true)];
                  }) : r.its.map((it, j) => (
                    <Pressable key={j} onPress={() => (it.kind === "lab" ? openLab(h, it.l.id) : it.kind === "entry" ? openEntry(h, it.e.id) : undefined)} hitSlop={4} style={{ position: "absolute", left: X(it.d) - 5, top: (RH - 10) / 2, width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor(t, it) }} accessibilityRole="button" accessibilityLabel={it.kind === "entry" ? it.e.title : "Lab report"} />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </NoSwipe>
        {held !== null && rows[held] ? (
          <View pointerEvents="none" style={{ position: "absolute", left: lbl - 2, right: 8, top: HDR + held * RH + 1, minHeight: RH - 2, justifyContent: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
            <Text style={{ fontSize: 12.5, fontFamily: t.fontUISemi, color: t.ink }}>{rows[held].k === "span" ? rows[held].s.title : TYPE_LABEL[(rows[held] as { type: string }).type] || (rows[held] as { type: string }).type}</Text>
            {rows[held].k === "span" && rows[held].s.sub ? <Text style={{ fontSize: 10.5, color: t.muted, fontFamily: t.fontUI }}>{KIND[rows[held].s.kind]} · {rows[held].s.sub}</Text> : null}
          </View>
        ) : null}
        {held !== null ? (props.full
          ? <Pressable onPress={() => setHeld(null)} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Put the title away" />
          : <Portal><Pressable onPress={() => setHeld(null)} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Put the title away" /></Portal>) : null}
      </View>
    </Box>
  );
}
