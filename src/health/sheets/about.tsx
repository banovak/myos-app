// About, privacy and terms, from the ⋮ menu. Short, because the app keeps
// nothing of yours itself: your record lives in your own Supabase project,
// or only on this phone with sample data.
import { View } from "react-native";
import { useHealth, type Health } from "../state/HealthContext";
import { P, Sec, SheetH } from "../ui";

export function openAbout(h: Health): void { h.openSheet(<About />); }

function About() {
  const h = useHealth();
  return (
    <View style={{ gap: 6 }}>
      <SheetH title="About My OS Health" onClose={h.closeSheet} />
      <P>My OS Health records what you choose to put in it: appointments, photos, measurements, lab results, what you take and what you do. It shows it back to you so you can see patterns and take them to your doctor.</P>
      <P>It never interprets your data. Nothing in it is medical advice, a diagnosis, or a reason to start or stop a treatment. For that, see a professional.</P>
      <Sec>Your data</Sec>
      <P>Your record is stored in a Supabase project that you own and that you connected yourself, or only on this phone when you use sample data. This app reads and writes to that project, and to Apple Health if you connect it. It does not send your record anywhere else.</P>
      <P>Photos and files are encrypted on this phone with your passphrase before they are uploaded. The passphrase never leaves the phone. Without it, the stored photos cannot be opened, by anyone.</P>
      <P>This app has no advertising and no third-party tracking. It does not collect analytics about you. Reminders are scheduled on this phone and their text stays on it.</P>
      <P>Your credentials for Supabase are kept in this phone's keychain. Clear credentials in the menu removes them.</P>
      <Sec>Terms</Sec>
      <P>You are responsible for the record you keep and for the Supabase project it lives in, including its security and backups. This app is provided as is. It can have faults, and it should not be your only copy of anything that matters.</P>
      <P>Use it for yourself. It is not built for keeping records about other people.</P>
    </View>
  );
}
