// Charts the user builds and keeps. The builder opens above the chart.
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { addDays, today } from "../model/dates";
import { chartOrder, distributeZones, extraColor, moveChart, newChart, normalizeZones, onDashboard, STYLES } from "../model/charts";
import { cycleOn } from "../model/cycle";
import { illnessColor, illnesses } from "../model/illness";
import { regColor } from "../model/regimens";
import { getSeries, seriesList } from "../model/series";
import type { Chart } from "../model/types";
import { ACCENT_TOKEN, DEFAULT_Y1, DEFAULT_Y2, MARKERS, PALETTES, isHex, rl } from "../model/vocab";
import { useHealth } from "../state/HealthContext";
import { colorOf } from "../theme";
import { Btn, Card, Chip, Chips, DateField, Disclaim, Empty, Field, Input, NumInput, PageH, Sec, Seg, Select, Sub, useT } from "../ui";
import { ChartLegend, ChartSvg, fixedRange } from "../components/ChartSvg";
import { CycleChartBody } from "../components/CycleCalendar";
import { RegimenMonthBody } from "../components/RegimenCalendar";
import { openChartChooser } from "../sheets";

export function PaletteRows(props: { current: string | undefined; onPick: (c: string) => void }) {
  const h = useHealth();
  const t = useT();
  const [hex, setHex] = useState(isHex(props.current) ? props.current!.toUpperCase() : "");
  useEffect(() => { if (isHex(props.current)) setHex(props.current!.toUpperCase()); }, [props.current]);
  return (
    <View style={{ gap: 8 }}>
      {PALETTES.map(([n, cs]) => (
        <View key={n} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ width: 80, fontSize: 12, color: t.muted, fontFamily: t.fontUISemi }}>{n}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {cs.map((col) => { const on = col === props.current || (col === ACCENT_TOKEN && props.current === ACCENT_TOKEN); const shown = colorOf(col, t, "#999"); return (
              <Pressable key={col} onPress={() => props.onPick(col)} accessibilityLabel={`${n} ${col === ACCENT_TOKEN ? "your accent" : col}`} accessibilityRole="button"
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: shown, borderWidth: 2, borderColor: t.card, shadowColor: t.ink, shadowOpacity: on ? 1 : 0.15, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, outlineWidth: on ? 2 : 0 } as any} />
            ); })}
          </View>
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 8 }}>
        <Text style={{ width: 80, fontSize: 12, color: t.muted, fontFamily: t.fontUISemi }}>Custom</Text>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isHex(hex) ? hex : t.soft, borderWidth: 1, borderColor: t.line }} />
        <Input value={hex} onChange={(v) => { setHex(v.toUpperCase()); if (isHex(v)) props.onPick(v.toUpperCase()); }} placeholder="#RRGGBB" maxLength={7} autoCapitalize="none" style={{ width: 110, fontFamily: t.fontData }} />
      </View>
    </View>
  );
}

function ColorBtn(props: { value: string | undefined; fallback: string; onPick: (c: string) => void; label: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colorOf(props.value, t, props.fallback), borderWidth: 3, borderColor: t.card, shadowColor: t.line, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } }} accessibilityLabel={props.label} accessibilityRole="button" />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 60, backgroundColor: t.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: t.line }}><PaletteRows current={props.value} onPick={(c) => { props.onPick(c); setOpen(false); }} /></View>
      </Modal>
    </>
  );
}

/** a section of the builder: a heading, then its controls */
function BSec(props: { title: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 12 }}>
      <Text style={{ fontSize: 14.5, fontFamily: t.fontUIBold, color: t.ink }}>{props.title}</Text>
      {props.children}
    </View>
  );
}

function Builder(props: { c: Chart }) {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const c = props.c;
  const set = (fn: (c: Chart) => void) => h.mutate((D) => { const cc = D.charts.find((x) => x.id === c.id); if (cc) fn(cc); });
  const toggle = (arr: string[] | undefined, v: string) => ((arr || []).includes(v) ? (arr || []).filter((x) => x !== v) : [...(arr || []), v]);
  const [right, setRight] = useState(!!(c.y2 || (c.y2More || []).length));
  const kind = c.kind || "chart";
  const months = (opts: number[], def: number) => <Chips>{opts.map((n) => <Chip key={n} label={`${n} month${n > 1 ? "s" : ""}`} on={(c.months || def) === n} onPress={() => set((cc) => { cc.months = n; })} />)}</Chips>;
  const wrap = (kids: React.ReactNode) => (
    <View style={{ backgroundColor: t.soft, borderRadius: 16, padding: 14, gap: 12, marginBottom: 16 }}>
      <Field label="Title"><Input value={c.title} onChange={(v) => set((cc) => { cc.title = v; })} /></Field>
      {kids}
      <Btn kind="accent" label="Done" onPress={() => h.setV({ editChart: null })} />
    </View>
  );
  if (kind === "cycle") return wrap(<BSec title="Show">{months([1, 3, 6, 12], 3)}</BSec>);
  if (kind === "month") {
    const regs = D.regimens.filter((r) => r.category !== "diet").sort((a, b) => (a.started_on < b.started_on ? 1 : -1));
    return wrap(
      <BSec title="Regimen">
        {regs.length ? <Select value={c.reg || ""} placeholder="Pick a regimen" options={regs.map((r) => [r.id, r.name] as [string, string])} onChange={(v) => set((cc) => { cc.reg = v || undefined; })} /> : <Sub>Nothing in Lifestyle yet. Add a regimen there first.</Sub>}
        <Field label="Show">{months([1, 3, 6], 1)}</Field>
      </BSec>,
    );
  }
  const groups: Record<string, [string, string][]> = {};
  seriesList(D).filter((s) => { const g = getSeries(D, s.id); return g && g.kind === "line"; }).forEach((s) => (groups[s.group] = groups[s.group] || []).push([s.id, s.label]));
  const axis = (k: "y1" | "y2", label: string) => {
    const sel = c[k], type = c[`${k}Type`] || "line", other = k === "y1" ? c.y2 : c.y1;
    const selS = sel ? getSeries(D, sel) : null, monthly = !!(selS && selS.kind === "line" && selS.monthly);
    const more = c[`${k}More`] || [], used = [c.y1, c.y2, ...(c.y1More || []), ...(c.y2More || [])].filter(Boolean) as string[];
    const avoid = [colorOf(c.y1Color, t, DEFAULT_Y1), colorOf(c.y2Color, t, DEFAULT_Y2)];
    const range = c[`${k}Range`];
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Sec style={{ marginBottom: 0 }}>{label}</Sec>
          {k === "y2" ? <Btn small label="Remove" onPress={() => { set((cc) => { cc.y2 = null; delete cc.y2More; delete cc.y2Range; }); setRight(false); }} /> : null}
        </View>
        <Select value={sel || ""} placeholder="Nothing" groups={{ "": [["", "Nothing"]], ...groups }} disabledValues={other ? [other] : []} onChange={(v) => set((cc) => { cc[k] = v || null; if (v) { const s = getSeries(D, v); if (s && s.kind === "line" && (s.rating || s.monthly)) cc[`${k}Type`] = "column"; } })} />
        {sel ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Sub>Style</Sub>
            {monthly ? <Chip label="Columns by month" on /> : <Seg small value={type} options={STYLES} onChange={(v) => set((cc) => { cc[`${k}Type`] = v as any; })} />}
            {type !== "column" && type !== "dots" && !monthly ? <Chip label="7-day average" on={!!c[`${k}Avg`]} onPress={() => set((cc) => { cc[`${k}Avg`] = !cc[`${k}Avg`]; })} /> : null}
            <ColorBtn value={c[`${k}Color`]} fallback={k === "y1" ? DEFAULT_Y1 : DEFAULT_Y2} onPick={(col) => set((cc) => { cc[`${k}Color`] = col; })} label={`${label} colour`} />
          </View>
        ) : null}
        {sel ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Sub>Range</Sub>
            <Seg small value={range ? "set" : "auto"} options={[["auto", "Auto"], ["set", "Set"]]} onChange={(v) => set((cc) => { if (v === "auto") delete cc[`${k}Range`]; else cc[`${k}Range`] = cc[`${k}Range`] || [null, null]; })} />
            {range ? <>
              <View style={{ width: 72 }}><NumInput value={range[0] ?? ""} placeholder="Min" onChange={(v) => set((cc) => { const r = cc[`${k}Range`] || [null, null]; cc[`${k}Range`] = [v.trim() === "" || isNaN(+v) ? null : +v, r[1]]; })} /></View>
              <Sub>to</Sub>
              <View style={{ width: 72 }}><NumInput value={range[1] ?? ""} placeholder="Max" onChange={(v) => set((cc) => { const r = cc[`${k}Range`] || [null, null]; cc[`${k}Range`] = [r[0], v.trim() === "" || isNaN(+v) ? null : +v]; })} /></View>
              {!fixedRange(range) ? <Sub>Both ends, low to high</Sub> : null}
            </> : null}
          </View>
        ) : null}
        {sel ? (
          <View style={{ gap: 6 }}>
            {more.length ? <Chips>{more.map((id, i) => { const s = getSeries(D, id); return <Chip key={id} label={`${s ? s.label : id}  ×`} dot={extraColor(k === "y1" ? i : (c.y1More || []).length + i, avoid)} on onPress={() => set((cc) => { cc[`${k}More`] = (cc[`${k}More`] || []).filter((x) => x !== id); })} />; })}</Chips> : null}
            <Select value="" placeholder="Add another line on this axis…" groups={{ "": [["", "Add another line on this axis…"]], ...groups }} disabledValues={used} onChange={(v) => { if (v) set((cc) => { cc[`${k}More`] = [...(cc[`${k}More`] || []), v]; }); }} />
          </View>
        ) : null}
      </View>
    );
  };
  const regs = D.regimens.slice().sort((p, q) => (p.started_on < q.started_on ? -1 : 1));
  const phRegs = [...new Set(D.entries.filter((e) => e.photos.length && e.details.series !== "body").flatMap((e) => e.regions))];
  const ills = illnesses(D);
  return wrap(
    <>
      <BSec title="Y axis">
        {axis("y1", "Left axis")}
        {right ? axis("y2", "Right axis") : <View style={{ alignSelf: "flex-start" }}><Btn small label="+ Add right axis" onPress={() => setRight(true)} /></View>}
      </BSec>
      <BSec title="X axis">
        <Chips>{([["3m", "3 months"], ["6m", "6 months"], ["12m", "12 months"], ["all", "All"], ["custom", "Custom"]] as [Chart["range"], string][]).map(([k, l]) => <Chip key={k} label={l} on={c.range === k} onPress={() => set((cc) => { cc.range = k; if (k === "custom") { cc.from = cc.from || addDays(today(), -180); cc.to = cc.to || today(); } })} />)}</Chips>
        {c.range === "custom" ? <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><View style={{ flex: 1 }}><DateField value={c.from || ""} onChange={(v) => set((cc) => { cc.from = v; })} /></View><Sub>to</Sub><View style={{ flex: 1 }}><DateField value={c.to || ""} onChange={(v) => set((cc) => { cc.to = v; })} /></View></View> : null}
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Seg small value={c.scroll ? "1" : "0"} options={[["0", "Fit"], ["1", "Scroll"]]} onChange={(v) => set((cc) => { cc.scroll = v === "1"; if (cc.scroll && !cc.window) cc.window = 3; })} />
          {c.scroll ? <><Sub>Viewport size</Sub><Chips>{[1, 3, 6].map((n) => <Chip key={n} small label={`${n} month${n > 1 ? "s" : ""}`} on={(c.window || 3) === n} onPress={() => set((cc) => { cc.window = n; })} />)}</Chips></> : null}
        </View>
      </BSec>
      <BSec title="Additions">
        <Field label="Periods"><Chips>{regs.map((r) => <Chip key={r.id} label={r.name} dot={colorOf(r.color, t, regColor({}))} on={c.bands.includes(r.id)} onPress={() => set((cc) => { cc.bands = toggle(cc.bands, r.id); })} />)}{cycleOn(D) ? <Chip label="Periods (cycle)" dot="#E05A7E" on={c.bands.includes("cycle")} onPress={() => set((cc) => { cc.bands = toggle(cc.bands, "cycle"); })} /> : null}{D.courses.map((k) => <Chip key={k.id} label={`${k.title} (course)`} dot={colorOf(k.color, t, "#86C1CC")} on={c.bands.includes("k:" + k.id)} onPress={() => set((cc) => { cc.bands = toggle(cc.bands, "k:" + k.id); })} />)}{ills.map((ic) => <Chip key={ic.id} label={`${ic.title} (illness)`} dot={colorOf(illnessColor(D, ic), t, t.tint("illness"))} on={c.bands.includes("i:" + ic.id)} onPress={() => set((cc) => { cc.bands = toggle(cc.bands, "i:" + ic.id); })} />)}{!regs.length && !D.courses.length && !ills.length ? <Sub>Nothing in Lifestyle yet</Sub> : null}</Chips></Field>
        {D.courses.length ? <Field label="Instances"><Chips>{D.courses.map((k) => <Chip key={k.id} label={k.title} on={(c.sessions || []).includes(k.id)} onPress={() => set((cc) => { cc.sessions = toggle(cc.sessions, k.id); })} />)}</Chips></Field> : null}
        <Field label="Markers"><Chips>{MARKERS.map(([k, l]) => <Chip key={k} label={l} on={(c.markers || []).includes(k)} onPress={() => set((cc) => { cc.markers = toggle(cc.markers, k); })} />)}</Chips></Field>
        <Field label="Photos"><Chips>{phRegs.length ? phRegs.map((r) => <Chip key={r} label={rl(D, r)} on={c.photos.includes(r)} onPress={() => set((cc) => { cc.photos = toggle(cc.photos, r); })} />) : <Sub>No photos yet</Sub>}</Chips></Field>
      </BSec>
      <BSec title="Design">
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Axis lines"><Seg value={c.axes === false ? "0" : "1"} options={[["0", "Off"], ["1", "On"]]} onChange={(v) => set((cc) => { cc.axes = v === "1"; })} /></Field></View>
          <View style={{ flex: 1 }}><Field label="Gridlines"><Seg value={c.grid ? "1" : "0"} options={[["0", "Off"], ["1", "On"]]} onChange={(v) => set((cc) => { cc.grid = v === "1"; })} /></Field></View>
        </View>
      </BSec>
    </>,
  );
}
function ChartCard(props: { c: Chart; flash?: boolean }) {
  const h = useHealth();
  const t = useT();
  const c = props.c, ed = h.V.editChart === c.id;
  const [menu, setMenu] = useState(false);
  const [armed, setArmed] = useState(false);
  const item = (label: string, fn: () => void) => <Pressable key={label} onPress={() => { setMenu(false); fn(); }} style={{ paddingVertical: 10, paddingHorizontal: 12 }} accessibilityRole="menuitem"><Text style={{ color: t.ink, fontFamily: t.fontUISemi, fontSize: 14 }}>{label}</Text></Pressable>;
  return (
    <Card style={props.flash ? { borderWidth: 3, borderColor: t.accent } : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <Text style={{ fontSize: 15, fontFamily: t.fontUIBold, color: t.ink, flex: 1 }}>{c.title || "Untitled chart"}</Text>
        <Pressable onPress={() => setMenu(true)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Chart options" accessibilityRole="button"><Text style={{ color: t.ink, fontSize: 18, fontWeight: "700", lineHeight: 20 }}>⋯</Text></Pressable>
      </View>
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} />
        <View style={{ position: "absolute", right: 24, top: 160, backgroundColor: t.card, borderRadius: 14, padding: 6, minWidth: 220, borderWidth: 1, borderColor: t.line, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}>
          {item("Edit chart", () => h.setV({ editChart: c.id }))}
          {item(onDashboard(h.D, c.id) ? "Remove from dashboard" : "Add to dashboard", () => h.mutate((D) => { if (onDashboard(D, c.id)) (["left", "right"] as const).forEach((k) => (D.widgets[k] = D.widgets[k].filter((w) => !(w.type === "savedchart" && w.chartId === c.id)))); else D.widgets.left.push({ id: newId(), type: "savedchart", chartId: c.id }); }))}
          {item("Move up", () => h.mutate((D) => moveChart(D, c.id, -1)))}
          {item("Move down", () => h.mutate((D) => moveChart(D, c.id, 1)))}
          {item("Duplicate", () => h.mutate((D) => { const i = D.charts.findIndex((x) => x.id === c.id); const nc: Chart = { ...JSON.parse(JSON.stringify(c)), id: "ch-" + newId(), title: c.title + " (copy)" }; D.charts.splice(i + 1, 0, nc); normalizeZones(D); const z = D.chartZones!.find((z) => z.includes(c.id))!; D.chartZones!.forEach((zz) => { const k = zz.indexOf(nc.id); if (k >= 0) zz.splice(k, 1); }); z.splice(z.indexOf(c.id) + 1, 0, nc.id); }))}
          <Pressable onPress={() => { if (!armed) return setArmed(true); setMenu(false); setArmed(false); h.mutate((D) => { D.charts = D.charts.filter((x) => x.id !== c.id); (["left", "right"] as const).forEach((k) => (D.widgets[k] = D.widgets[k].filter((w) => w.chartId !== c.id))); }); if (h.V.editChart === c.id) h.setV({ editChart: null }); }} style={{ paddingVertical: 10, paddingHorizontal: 12 }}><Text style={{ color: t.tint("observation"), fontFamily: t.fontUISemi, fontSize: 14 }}>{armed ? "Tap again to delete" : "Delete chart"}</Text></Pressable>
        </View>
      </Modal>
      {ed ? <Builder c={c} /> : null}
      {c.kind === "cycle" ? <CycleChartBody months={c.months || 3} /> : c.kind === "month" ? <RegimenMonthBody regId={c.reg} months={c.months || 1} /> : <><ChartSvg c={c} /><ChartLegend c={c} /></>}
    </Card>
  );
}

export function ChartsScreen() {
  const h = useHealth();
  const { D, V } = h;
  const order = chartOrder(D);
  const edit = V.editChart ? D.charts.find((c) => c.id === V.editChart) : null;
  const flashRef = useRef<string | null>(V.focusChart);
  useEffect(() => { if (V.focusChart) { flashRef.current = V.focusChart; const id = setTimeout(() => h.setV({ focusChart: null }), 1600); return () => clearTimeout(id); } }, [V.focusChart]);
  return (
    <View style={{ gap: 16 }}>
      <PageH title="Charts" sub="Your values over time, with counts by month alongside; a regimen or your cycle on a calendar." right={<Btn kind="accent" label="+ Add chart" onPress={() => openChartChooser(h)} />} />
      {edit ? <ChartCard c={edit} /> : null}
      {order.length ? order.filter((c) => c.id !== V.editChart).map((c) => <ChartCard key={c.id} c={c} flash={V.focusChart === c.id} />) : <Card><Empty>No charts yet. Use + Add chart to build one.</Empty></Card>}
      <Disclaim>Charts line your records up by date. They don't calculate relationships between them or explain them. Bring anything you notice to your doctor.</Disclaim>
    </View>
  );
}
import { uid as newId } from "../model/dates";
