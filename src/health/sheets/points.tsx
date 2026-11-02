// Body points: add one, rename it (or move it to another area), remove it;
// pick the base photo.
import { useState } from "react";
import { View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { REG } from "../model/vocab";
import { shrinkToJpeg } from "../store/media";
import { cutoutSubject } from "../../../modules/subject-mask";
import { useHealth, type Health } from "../state/HealthContext";
import { Acts, Btn, Err, Field, Input, Select, SheetH } from "../ui";

export function openPointForm(h: Health, title: string, val: string | null, onSave: (region: string) => void, onRemove?: () => void): void {
  h.openSheet(<PointForm title={title} val={val} onSave={onSave} onRemove={onRemove} />);
}
export function openPoint(h: Health, id: string): void {
  const p = h.D.points.find((p) => p.id === id);
  if (!p) return;
  const { rl } = require("../model/vocab") as typeof import("../model/vocab");
  openPointForm(h, "Point: " + rl(h.D, p.region), p.region, (r) => h.mutate((D) => { const q = D.points.find((x) => x.id === id); if (q) q.region = r; }), () => h.mutate((D) => { D.points = D.points.filter((x) => x.id !== id); }));
}
export async function pickBasePhoto(h: Health): Promise<void> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (res.canceled) return;
  const a = res.assets[0];
  const s = await shrinkToJpeg(a.uri, a.width, a.height);
  const cut = await cutoutSubject(s.uri); // the body alone on the figure, when the phone can lift it
  h.mutate((D) => { D.basePhoto = cut || s.uri; D.basePhotoPath = null; D.basePhotoEnc = false; });
  h.setV({ frame: null, editing: true });
}

function PointForm(props: { title: string; val: string | null; onSave: (r: string) => void; onRemove?: () => void }) {
  const h = useHealth();
  const regs = REG(h.D);
  const [region, setRegion] = useState(props.val || "__new");
  const [name, setName] = useState(props.val ? regs[props.val] || "" : "");
  const [err, setErr] = useState("");
  const opts: [string, string][] = [...Object.entries(regs), ["__new", "New area…"]];
  const custom = region.startsWith("cr-");
  return (
    <View style={{ gap: 12 }}>
      <SheetH title={props.title} onClose={h.closeSheet} />
      <Field label="Name" hint={region === "__new" ? undefined : custom ? "Change it to rename this area." : "Change it and the point gets its own area with that name."}><Input value={name} onChange={setName} placeholder="Left shoulder mole" autoFocus={!props.val} /></Field>
      <Field label="Or pick an area"><Select value={region} options={opts} onChange={(r) => { setRegion(r); setName(r === "__new" ? "" : regs[r] || ""); }} /></Field>
      <Acts left={props.onRemove ? <Btn label="Remove point" onPress={() => { props.onRemove!(); h.closeSheet(); }} /> : undefined} right={<Btn kind="accent" label="Save" onPress={() => {
        let r = region;
        const n = name.trim();
        const slug = () => "cr-" + (n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "area");
        if (r === "__new") { if (!n) return setErr("Name the area."); r = slug(); h.mutate((D) => { D.customRegions[r] = n; }); }
        else if (n && n !== regs[r]) {
          if (custom) h.mutate((D) => { D.customRegions[r] = n; }); // rename the area itself
          else { r = slug(); h.mutate((D) => { D.customRegions[r] = n; }); } // a built-in area keeps its name; the point moves to a new one
        }
        props.onSave(r); h.closeSheet();
      }} />} />
      <Err>{err}</Err>
    </View>
  );
}
