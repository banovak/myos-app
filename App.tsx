// My OS — the companion app for the whole My OS family. A module shell: the
// user switches screens on from ⋮ → Add features. Jarvis (pair with YOUR
// gateway, then tap and talk) is module 1; Health (your own record, in your
// own Supabase) is module 2. Each module pairs on its own; nothing is shared.
import "react-native-url-polyfill/auto";
import { registerGlobals } from "@livekit/react-native";
registerGlobals();

import { StatusBar } from "expo-status-bar";
import { ModuleShell } from "./src/shell/ModuleShell";

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <ModuleShell />
    </>
  );
}
