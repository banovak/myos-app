// A story's preview card: what it is, the actions, and Dismiss (hides only).
import { View } from "react-native";
import { ago, fmt, today, uid } from "../model/dates";
import { metric } from "../model/series";
import type { Story } from "../model/stories";
import { kindLabel } from "../model/vocab";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, P, Row, RowText, Sec, SheetH, useT } from "../ui";
import { ChallengeBlock } from "../components/Widgets";
import { EntryRow } from "../components/EntryRow";
import { openForm } from "./entryForm";
import { openCheckin, openConcern } from "./concern";
import { endEpisodeToday, openEpisode } from "./illness";
import { openVaultUnlock } from "./security";

export function openStory(h: Health, it: Story, dismiss: () => void): void { h.openSheet(<StorySheet it={it} dismiss={dismiss} />); }

function StorySheet(props: { it: Story; dismiss: () => void }) {
  const h = useHealth();
  const t = useT();
  const { D } = h;
  const it = props.it;
  let body: React.ReactNode = null;
  let actions: [string, () => void][] = [];
  if (it.kind === "calendar") {
    const pend = D.suggestions.filter((x) => x.status === "pending");
    body = (
      <View style={{ gap: 8 }}>
        <P>{pend.length === 1 ? "This event" : "These events"} on your calendar {pend.length === 1 ? "looks" : "look"} like health appointments. Add the ones you want on your record. Nothing is added until you choose Add.</P>
        {pend.map((x) => <Row key={x.id}><RowText title={x.title} sub={`${fmt(x.occurred_at)} · ${ago(x.occurred_at)}`} /><View style={{ flexDirection: "row", gap: 6 }}><Btn kind="dark" small label="Add" onPress={() => openForm(h, "appointment", { title: x.title, occurred_at: x.occurred_at, details: { ...x.details, status: "upcoming" }, source: "calendar", fromSuggestion: x.id })} /><Btn small label="Not health" onPress={() => h.mutate((D) => { const s = D.suggestions.find((y) => y.id === x.id); if (s) s.status = "dismissed"; })} /></View></Row>)}
      </View>
    );
    actions = [["See History", () => { h.closeSheet(); h.go("history"); }]];
  } else if (it.kind === "appt") {
    const e = it.entry, d = e.details;
    body = (
      <View style={{ gap: 6 }}>
        <P>Upcoming {(kindLabel(D, d.kind) || "appointment").toLowerCase()} appointment, {ago(e.occurred_at)}.</P>
        <RowText title="When" sub={fmt(e.occurred_at)} />
        {d.provider ? <RowText title="With" sub={`${d.provider}${d.practice ? ` · ${d.practice}` : ""}`} /> : null}
        {d.reason ? <RowText title="For" sub={d.reason} /> : null}
      </View>
    );
    actions = [["Record how it went", () => openForm(h, "appointment", { ...e, details: { ...d, status: "done" } })], ["Follow-up", () => openForm(h, "observation", { parent_entry_id: e.id, regions: e.regions, concern_id: e.concern_id })], ["Edit", () => openForm(h, "appointment", e)]];
  } else if (it.kind === "challenge") {
    const r = it.challenge.rules[it.ruleIndex];
    body = <View style={{ gap: 10 }}><P>No {r.label.toLowerCase()} logged {it.when} yet.</P><ChallengeBlock c={it.challenge} /></View>;
    actions = [["Add it now", () => (r.kind === "regimen" ? h.mutate((D) => { D.regLogs.push({ id: "rl-" + uid(), regimen_id: r.regimen!, on_date: today(), time: null, source: "manual", note: "" }); }) : r.kind === "photo" ? (h.needVault() ? undefined : openForm(h, "photo", { regions: [r.region!], title: r.label })) : openForm(h, "measurement", { details: { metric: r.metric } }))], ["Open Plan", () => { h.closeSheet(); h.go("plan", { exp: it.challenge.id }); }]];
  } else if (it.kind === "checkin") {
    const per = it.concern.tracking!.per || "week";
    body = <P>Your {per === "day" ? "daily" : per === "week" ? "weekly" : "monthly"} check-in: {it.due.map((k) => metric(D, k).l.toLowerCase()).join(", ")}.</P>;
    actions = [["Check in now", () => openCheckin(h, [it.concern.id])], ["Open concern", () => openConcern(h, it.concern.id)]];
  } else if (it.kind === "sick") {
    const eps = it.concern.episodes || [], idx = eps.findIndex((e) => e.from === it.episode.from);
    body = <P>{it.concern.title}{it.episode.label ? `, ${it.episode.label.toLowerCase()}` : ""}, since {fmt(it.episode.from)}: {it.days === 1 ? "one day" : `${it.days} days`} so far. Say when it ended and the days are counted right.</P>;
    actions = [["Better today", () => { endEpisodeToday(h, it.concern.id); h.closeSheet(); }], ["Ended another day", () => openEpisode(h, it.concern.id, idx < 0 ? null : idx)], ["Open illness", () => openConcern(h, it.concern.id)]];
  } else if (it.kind === "quiet") {
    body = <View><P>Still marked active, but nothing has been logged for {it.quiet} days.</P>{it.last ? <><Sec>Last entry</Sec><EntryRow e={it.last} /></> : null}</View>;
    actions = [["Check in", () => openForm(h, "observation", { concern_id: it.concern.id, regions: it.concern.regions })], ["Mark resolved", () => { h.mutate((D) => { const c = D.concerns.find((x) => x.id === it.concern.id); if (c) { c.status = "resolved"; c.resolved_on = today(); } }); h.closeSheet(); }], ["Open concern", () => openConcern(h, it.concern.id)]];
  } else {
    body = <P>Your photos and files are encrypted. Enter your photo passphrase once on this device to see them.</P>;
    actions = [["Unlock", () => openVaultUnlock(h)]];
  }
  return (
    <View style={{ gap: 10 }}>
      <SheetH title={it.title} onClose={h.closeSheet} />
      {body}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {actions.map(([l, fn], i) => <Btn key={l} kind={i === 0 ? "accent" : "ghost"} label={l} onPress={fn} />)}
        <Btn label="Dismiss" onPress={() => { props.dismiss(); h.closeSheet(); }} />
      </View>
      <P style={{ fontSize: 11.5, marginBottom: 0 }}>Dismiss only hides this from the row at the top. Nothing is deleted.</P>
      <Acts />
    </View>
  );
}
