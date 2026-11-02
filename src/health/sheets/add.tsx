// The + Add menu, the chart chooser, the new-experiment chooser, the widget library.
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { newChart } from "../model/charts";
import { uid } from "../model/dates";
import { tracked } from "../model/reminders";
import type { Entry, EntryType } from "../model/types";
import { TYPES, WIDGETS } from "../model/vocab";
import { useHealth, type Health } from "../state/HealthContext";
import { Btn, Chip, Chips, Sec, SheetH, TypeIco, useT } from "../ui";
import { openForm } from "./entryForm";
import { openCheckin, openConcernNew } from "./concern";
import { openIllnessNew } from "./illness";
import { openCycleDay } from "./cycle";
import { openRegimen } from "./regimen";
import { openLabForm } from "./lab";
import { openBeforeAfter, openChallenge, openPhases } from "./experiments";

function TypeBtn(props: { k: string; label: string; hint: string; onPress: () => void; icon?: string; full?: boolean }) {
  const t = useT();
  return (
    <Pressable onPress={props.onPress} style={{ width: props.full ? "100%" : "47%", flexGrow: 1, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, borderRadius: 16, padding: 12, gap: 6 }} accessibilityRole="button">
      <TypeIco k={props.icon || props.k} />
      <Text style={{ fontSize: 13.5, fontFamily: t.fontUIBold, color: t.ink }}>{props.label}</Text>
      <Text style={{ fontSize: 11.5, color: t.muted, fontFamily: t.fontUI }}>{props.hint}</Text>
    </Pressable>
  );
}
const Grid = (p: { children: React.ReactNode }) => <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{p.children}</View>;

export function openAdd(h: Health, pre: Partial<Entry> = {}): void { h.openSheet(<AddBody pre={pre} />); }
function AddBody(props: { pre: Partial<Entry> }) {
  const h = useHealth();
  const t = useT();
  const tr = tracked(h.D);
  const once: EntryType[] = ["photo", "appointment", "measurement", "procedure", "observation", "food_trial"];
  return (
    <View>
      <SheetH title="Add" onClose={h.closeSheet} />
      {tr.length ? (
        <Pressable onPress={() => openCheckin(h)} style={{ flexDirection: "row", gap: 12, alignItems: "center", borderRadius: 16, padding: 12, paddingHorizontal: 14, backgroundColor: t.accentSoft, marginBottom: 6 }} accessibilityRole="button">
          <TypeIco k="measurement" /><View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontFamily: t.fontUIBold, color: t.ink }}>Check in</Text><Text style={{ fontSize: 12, color: t.muted, fontFamily: t.fontUI }}>{tr.map((c) => c.title).join(", ")}</Text></View>
        </Pressable>
      ) : null}
      <Sec>Something that happened</Sec>
      <Grid>
        {once.map((k) => <TypeBtn key={k} k={k} label={TYPES[k].label} hint={TYPES[k].hint} onPress={() => { if (k === "photo" && h.needVault()) return; openForm(h, k, props.pre); }} />)}
        <TypeBtn k="illness" label="Illness" hint="A cold, a bug, a flare-up: when it started, when it ended" onPress={() => openIllnessNew(h)} />
        <TypeBtn k="cycle" label="Cycle day" hint="Period flow, spotting, symptoms" onPress={() => { h.mutate((D) => { if (!D.settings.cycle_on) D.settings.cycle_on = true; }); openCycleDay(h); }} />
      </Grid>
      <Sec>Something over time</Sec>
      <Grid>
        <TypeBtn k="regimen" label="Regimen" hint="Something you take or do regularly: supplements, meds, skin care, yoga" onPress={() => openRegimen(h, {})} />
        <TypeBtn k="diet" label="Diet" hint="How you're eating, in your own words" onPress={() => openRegimen(h, { category: "diet" })} />
        <TypeBtn k="challenge" label="Challenge" hint="Something for a set time with check-ins, phases to compare, or before and after a change" onPress={() => openNewExperiment(h)} />
        <TypeBtn k="observation" label="Concern" hint="Something you're keeping an eye on, with its own check-ins" onPress={() => openConcernNew(h)} />
      </Grid>
      <Sec>A document</Sec>
      <Grid><TypeBtn k="lab" label="Lab report" hint="Bloodwork PDF and its results, as printed" onPress={() => openLabForm(h)} /><TypeBtn k="report" label="Other report" hint="A prescription, a scan, a letter: the file and its values" onPress={() => openLabForm(h, "prescription")} /></Grid>
    </View>
  );
}

export function openChartChooser(h: Health): void { h.openSheet(<ChartChooser />); }
function ChartChooser() {
  const h = useHealth();
  return (
    <View>
      <SheetH title="New chart" onClose={h.closeSheet} />
      <View style={{ gap: 10 }}>
        <TypeBtn full k="measurement" label="Chart" hint="Your values over time on up to two axes: measures, labs, Apple Health, and counts by month like sick days. Lines, areas, columns or dots, with regimens, periods and photos alongside." onPress={() => { h.mutate((D) => { const c = newChart(D); h.setV({ editChart: c.id }); }); h.closeSheet(); h.go("charts", { editChart: undefined as any }); }} />
        <TypeBtn full k="appointment" label="Calendar" hint="One regimen a day at a time: the days you took the magnesium, the days you missed. Tap a day to tick it." onPress={() => { h.mutate((D) => { const r = D.regimens.find((x) => x.category !== "diet" && !x.ended_on); const c = newChart(D, { kind: "month", title: r ? r.name : "Calendar", months: 1, y1: null, reg: r ? r.id : undefined }); h.setV({ editChart: c.id }); }); h.closeSheet(); h.go("charts", { editChart: undefined as any }); }} />
        <TypeBtn full k="cycle" label="Cycle" hint="Your period, spotting and symptoms on a calendar, with your average cycle and period length." onPress={() => { h.mutate((D) => { newChart(D, { kind: "cycle", title: "My cycle", months: 3, y1: null }); D.settings.cycle_on = true; }); h.closeSheet(); h.go("charts"); }} />
      </View>
    </View>
  );
}

export function openNewExperiment(h: Health): void { h.openSheet(<NewExperiment />); }
function NewExperiment() {
  const h = useHealth();
  return (
    <View>
      <SheetH title="New challenge" onClose={h.closeSheet} />
      <View style={{ gap: 10 }}>
        <TypeBtn full k="challenge" label="Check-in challenge" hint='Do something for a set time, with check-ins. "90 days of red light, photo every week."' onPress={() => openChallenge(h)} />
        <TypeBtn full k="challenge" label="Phases" hint='Try things one after another and compare each stretch. "Yoga only, then physio only, then both."' onPress={() => openPhases(h)} />
        <TypeBtn full k="challenge" label="Before and after" hint='Compare the weeks either side of a change. "Before and after a new medication."' onPress={() => openBeforeAfter(h)} />
      </View>
    </View>
  );
}

export function openWidgetLib(h: Health, col: "left" | "right"): void { h.openSheet(<WidgetLib col={col} />); }
function WidgetLib(props: { col: "left" | "right" }) {
  const h = useHealth();
  const t = useT();
  const [pick, setPick] = useState<"chart" | "quick" | null>(null);
  const add = (w: any) => { h.mutate((D) => { D.widgets[props.col].push({ id: uid(), ...w }); }); h.closeSheet(); };
  return (
    <View>
      <SheetH title="Add a widget" onClose={h.closeSheet} />
      <Grid>{Object.entries(WIDGETS).map(([k, w]) => (
        <Pressable key={k} onPress={() => (k === "savedchart" ? setPick("chart") : k === "quick" ? setPick("quick") : add({ type: k }))} style={{ width: "47%", flexGrow: 1, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, borderRadius: 16, padding: 12, gap: 4 }} accessibilityRole="button">
          <Text style={{ fontSize: 13.5, fontFamily: t.fontUIBold, color: t.ink }}>{w.label}</Text><Text style={{ fontSize: 11.5, color: t.muted, fontFamily: t.fontUI }}>{w.hint}</Text>
        </Pressable>
      ))}</Grid>
      {pick === "chart" ? <View><Sec>Which chart?</Sec><Chips>{h.D.charts.map((c) => <Chip key={c.id} label={c.title} onPress={() => add({ type: "savedchart", chartId: c.id })} />)}</Chips><View style={{ marginTop: 10 }}><Btn small label="+ Build a new chart" onPress={() => { h.mutate((D) => { const c = newChart(D); D.widgets[props.col].push({ id: uid(), type: "savedchart", chartId: c.id }); h.setV({ editChart: c.id }); }); h.closeSheet(); h.go("charts"); }} /></View></View> : null}
      {pick === "quick" ? <View><Sec>What do you want to log each day?</Sec><Chips><Chip label="Cycle day" onPress={() => add({ type: "quick", src: "cycle" })} />{Object.entries(h.D.metrics).map(([k, m]) => <Chip key={k} label={m.l} onPress={() => add({ type: "quick", src: "m:" + k })} />)}</Chips></View> : null}
    </View>
  );
}
