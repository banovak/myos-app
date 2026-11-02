// An illness: a group ("Viral", "Bacterial", "Lupus") and its episodes. The
// new-illness sheet picks or names the group, labels the bout and dates it;
// the episode sheet edits one bout. Body areas are optional and come second:
// an illness is anchored to time, a concern to a place.
import { useState } from "react";
import { View } from "react-native";
import { today, uid } from "../model/dates";
import { ILLNESS_GROUPS, episodeClash, episodesOf, groupNamed, illnesses, recentLabels, setEpisodes } from "../model/illness";
import type { Concern, Episode } from "../model/types";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, Chip, Chips, DateField, Err, Field, Half, Input, SheetH, Two, TypeIco } from "../ui";
import { Hint, RegionChips, useArmed } from "./common";

export function openIllnessNew(h: Health, pre: { group?: string } = {}): void { h.openSheet(<IllnessNew pre={pre} />); }
/** edit one episode (index into episodesOf), or add one (null) */
export function openEpisode(h: Health, cid: string, index: number | null): void { h.openSheet(<EpisodeSheet cid={cid} index={index} />); }
/** the episode still on ends today */
export function endEpisodeToday(h: Health, cid: string): void {
  h.mutate((D) => {
    const c = D.concerns.find((x) => x.id === cid);
    if (!c) return;
    const eps = episodesOf(c).map((e) => ({ ...e })), o = eps.find((e) => !e.to);
    if (o) o.to = today();
    setEpisodes(c, eps);
  });
}
const openIllness = (h: Health, id: string) => { h.closeSheet(); h.go("concerns", { concernPage: id }); };
const mkEpisode = (from: string, to: string, label: string, notes: string): Episode => ({ from, to: to || null, ...(label.trim() ? { label: label.trim() } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) });

function LabelField(props: { value: string; onChange: (v: string) => void }) {
  const h = useHealth();
  const recent = recentLabels(h.D).slice(0, 8);
  return (
    <Field label="What it was (optional)">
      <Input value={props.value} onChange={props.onChange} placeholder="Cold, flu, norovirus, flare" />
      {recent.length ? <Chips>{recent.map((l) => <Chip key={l} small label={l} on={props.value.trim().toLowerCase() === l.toLowerCase()} onPress={() => props.onChange(l)} />)}</Chips> : null}
    </Field>
  );
}

function IllnessNew(props: { pre: { group?: string } }) {
  const h = useHealth();
  const { D } = h;
  const groups = illnesses(D);
  const names = [...groups.map((c) => c.title), ...ILLNESS_GROUPS.filter((g) => !groups.some((c) => c.title.trim().toLowerCase() === g.toLowerCase()))];
  const [group, setGroup] = useState(props.pre.group || (groups[0] ? groups[0].title : ""));
  const [own, setOwn] = useState(false);
  const [ownName, setOwnName] = useState("");
  const [label, setLabel] = useState("");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState("");
  const [where, setWhere] = useState(false);
  const [regs, setRegs] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  function save() {
    const g = (own ? ownName : group).trim();
    if (!g) return setErr(own ? "Name the group." : "Pick a group.");
    if (!from) return setErr("When did it start?");
    if (to && to < from) return setErr("It can't end before it starts.");
    const ep = mkEpisode(from, to, label, notes);
    const have = groups.find((c) => c.title.trim().toLowerCase() === g.toLowerCase());
    if (have && episodeClash(episodesOf(have), ep)) return setErr(`That overlaps another ${have.title} episode. Edit that one from its page instead.`);
    let id = "";
    h.mutate((D) => {
      const c = groupNamed(D, g, (): Concern => ({ id: "c-" + uid(), title: g, regions: [], started_on: null, resolved_on: null, status: "active", kind: "illness", episodes: [], tracking: {} }));
      id = c.id;
      setEpisodes(c, [...episodesOf(c), ep]);
      if (regs.size) c.regions = [...new Set([...(c.regions || []), ...regs])];
    });
    openIllness(h, id);
  }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title="Illness" icon={<TypeIco k="illness" small />} onClose={h.closeSheet} />
      <Field label="What kind">
        <Chips>
          {names.map((n) => <Chip key={n} label={n} on={!own && group.trim().toLowerCase() === n.toLowerCase()} onPress={() => { setGroup(n); setOwn(false); }} />)}
          <Chip label="+ Your own" on={own} onPress={() => setOwn(true)} />
        </Chips>
        {own ? <Input value={ownName} onChange={setOwnName} placeholder="Lupus, Migraine, Allergies" autoFocus /> : null}
        <Hint>Viral and bacterial are causes. A condition you live with gets its own name, so its flare-ups stack beside them on a chart.</Hint>
      </Field>
      <LabelField value={label} onChange={setLabel} />
      <Two>
        <Half><Field label="Started"><DateField value={from} onChange={setFrom} /></Field></Half>
        <Half><Field label="Ended"><DateField value={to} onChange={setTo} clearable placeholder="Still on" /></Field></Half>
      </Two>
      {where ? <Field label="Where it shows (optional)"><RegionChips value={regs} onChange={setRegs} /></Field> : <View style={{ alignSelf: "flex-start" }}><Btn small label="Where it shows (optional)" onPress={() => setWhere(true)} /></View>}
      <Field label="Notes"><Input value={notes} onChange={setNotes} multiline /></Field>
      <Acts right={<Btn kind="accent" label="Save" onPress={save} />} />
      <Err>{err}</Err>
    </View>
  );
}

function EpisodeSheet(props: { cid: string; index: number | null }) {
  const h = useHealth();
  const { D } = h;
  const c = D.concerns.find((x) => x.id === props.cid);
  const eps = c ? episodesOf(c) : [];
  const e = props.index != null ? eps[props.index] : undefined;
  const [label, setLabel] = useState(e && e.label ? e.label : "");
  const [from, setFrom] = useState(e ? e.from : today());
  const [to, setTo] = useState(e && e.to ? e.to : "");
  const [notes, setNotes] = useState(e && e.notes ? e.notes : "");
  const [err, setErr] = useState("");
  const [armed, arm] = useArmed();
  if (!c) return null;
  function save() {
    if (!from) return setErr("When did it start?");
    if (to && to < from) return setErr("It can't end before it starts.");
    const ep = mkEpisode(from, to, label, notes);
    if (episodeClash(eps, ep, props.index == null ? -1 : props.index)) return setErr("That overlaps another episode.");
    h.mutate((D) => {
      const cc = D.concerns.find((x) => x.id === props.cid);
      if (!cc) return;
      const list = episodesOf(cc).map((x) => ({ ...x }));
      if (props.index != null) list[props.index] = ep; else list.push(ep);
      setEpisodes(cc, list);
    });
    h.closeSheet();
  }
  function remove() {
    if (!arm()) return;
    let gone = false;
    h.mutate((D) => {
      const cc = D.concerns.find((x) => x.id === props.cid);
      if (!cc) return;
      const list = episodesOf(cc).filter((_, i) => i !== props.index);
      if (list.length) setEpisodes(cc, list);
      else { D.concerns = D.concerns.filter((x) => x.id !== cc.id); gone = true; }
    });
    h.closeSheet();
    if (gone) h.setV({ concernPage: null });
  }
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={e ? `${c.title} episode` : `New ${c.title} episode`} icon={<TypeIco k="illness" small />} onClose={h.closeSheet} />
      <LabelField value={label} onChange={setLabel} />
      <Two>
        <Half><Field label="Started"><DateField value={from} onChange={setFrom} /></Field></Half>
        <Half><Field label="Ended"><DateField value={to} onChange={setTo} clearable placeholder="Still on" /></Field></Half>
      </Two>
      <Field label="Notes"><Input value={notes} onChange={setNotes} multiline placeholder="How it went, what you took" /></Field>
      <Acts left={e ? <Btn label={armed ? "Tap again to remove" : "Remove episode"} onPress={remove} /> : undefined} right={<Btn kind="accent" label="Save" onPress={save} />} />
      {e && eps.length === 1 ? <Hint>Removing the only episode removes the illness too.</Hint> : null}
      <Err>{err}</Err>
    </View>
  );
}
