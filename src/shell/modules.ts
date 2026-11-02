// The module registry: which screens the app can host, which are switched on,
// and which one was open last. Modules ship inside the binary; the user turns
// them on from ⋮ → Add features. Each module pairs on its own and keeps its own
// credentials — the registry never sees them, it only asks "are you connected?".
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearPairing, loadPairing } from "../jarvis/storage";
import { healthClearCredentials, healthIsConnected } from "../health/store/config";

export type ModuleId = "jarvis" | "health";

export type ModuleDef = {
  id: ModuleId;
  name: string;
  blurb: string;
  connectHint: string;
  isConnected: () => Promise<boolean>;
  clearCredentials: () => Promise<void>;
};

export const MODULES: ModuleDef[] = [
  {
    id: "jarvis",
    name: "Jarvis",
    blurb: "Your assistant: voice, tasks, the ledger",
    connectHint: "Connect asks for your gateway URL and access code.",
    isConnected: async () => !!(await loadPairing()),
    clearCredentials: clearPairing,
  },
  {
    id: "health",
    name: "Health",
    blurb: "Your private health record, in your own Supabase",
    connectHint:
      "Connect asks for your project URL and publishable key, then your email, password and two-step code. Jarvis never sees any of it.",
    isConnected: healthIsConnected,
    clearCredentials: healthClearCredentials,
  },
];

const ENABLED_KEY = "shell.enabled";
const LAST_KEY = "shell.last";

export type ShellPrefs = { enabled: ModuleId[]; last: ModuleId };

const ALL_IDS = MODULES.map((m) => m.id);
const isId = (v: unknown): v is ModuleId => typeof v === "string" && (ALL_IDS as string[]).includes(v);

export async function loadShellPrefs(): Promise<ShellPrefs> {
  let enabled: ModuleId[] = ["jarvis"];
  let last: ModuleId = "jarvis";
  try {
    const [e, l] = await Promise.all([AsyncStorage.getItem(ENABLED_KEY), AsyncStorage.getItem(LAST_KEY)]);
    if (e) {
      const parsed = JSON.parse(e);
      if (Array.isArray(parsed)) {
        const ids = parsed.filter(isId);
        // keep registry order, never an empty list
        enabled = ALL_IDS.filter((id) => ids.includes(id));
        if (!enabled.length) enabled = ["jarvis"];
      }
    }
    if (isId(l) && enabled.includes(l)) last = l;
    else last = enabled[0];
  } catch {
    // first launch, or storage unavailable: defaults
  }
  return { enabled, last };
}

export async function saveEnabled(enabled: ModuleId[]): Promise<void> {
  const ids = ALL_IDS.filter((id) => enabled.includes(id));
  await AsyncStorage.setItem(ENABLED_KEY, JSON.stringify(ids.length ? ids : ["jarvis"]));
}

export async function saveLast(id: ModuleId): Promise<void> {
  await AsyncStorage.setItem(LAST_KEY, id);
}
