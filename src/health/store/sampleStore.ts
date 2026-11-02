// On-device store for the preview: fictional sample data, persisted in
// AsyncStorage so edits stick between launches. No account, no network, no
// encryption. Photos picked here stay as local file uris.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { D } from "../model/types";
import { sample } from "../model/sample";
import type { HealthStore, StoreHooks } from "./types";

const KEY = "health.sample.state";

export function createSampleStore(hooks: StoreHooks): HealthStore {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Promise<void> | null = null;
  return {
    mode: "sample",
    async load() {
      try {
        const s = await AsyncStorage.getItem(KEY);
        if (s) return JSON.parse(s) as D;
      } catch { /* fall through to fresh sample */ }
      return sample();
    },
    save(D) {
      if (timer) clearTimeout(timer);
      hooks.onStatus("saving");
      timer = setTimeout(() => {
        pending = AsyncStorage.setItem(KEY, JSON.stringify(D)).then(() => hooks.onStatus("saved"), (e) => hooks.onStatus("error", String(e?.message || e)));
      }, 300);
    },
    async flush() { if (timer) { clearTimeout(timer); timer = null; } if (pending) await pending; },
    vaultState() { return "none"; },
    async vaultSetup() { throw new Error("Sample mode keeps nothing encrypted. Connect your own project to turn this on."); },
    async vaultUnlock() { throw new Error("Nothing to unlock in sample mode."); },
    async vaultForget() {},
    async photoUri(p) { return p.src || null; },
    async fileUri(f) { return f && typeof f === "object" ? f.localUri || null : null; },
    async wipeCache() {},
    async signOut() {
      // leaving sample mode: the same cleanup the synced store does
      await this.flush();
      await AsyncStorage.removeItem(KEY);
      const { wipePlain } = await import("./media");
      const { cancelAllHealthNotifications } = await import("../notifications/reminders");
      await wipePlain().catch(() => {});
      await cancelAllHealthNotifications().catch(() => {});
    },
    async email() { return ""; },
  };
}
export async function resetSample(): Promise<void> { await AsyncStorage.removeItem(KEY); }
