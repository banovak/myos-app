// Health module connection config: the user's own Supabase project URL and
// publishable key. Kept in the device keychain under keys no other module
// uses. The user's login session lives separately (see session.ts) and the
// photo vault key separately again (see crypto.ts).
import * as SecureStore from "expo-secure-store";

const URL_KEY = "health.supabase_url";
const KEY_KEY = "health.supabase_key";

export type HealthConfig = { supabaseUrl: string; supabaseKey: string };

export async function loadHealthConfig(): Promise<HealthConfig | null> {
  const [supabaseUrl, supabaseKey] = await Promise.all([
    SecureStore.getItemAsync(URL_KEY),
    SecureStore.getItemAsync(KEY_KEY),
  ]);
  return supabaseUrl && supabaseKey ? { supabaseUrl, supabaseKey } : null;
}

export async function saveHealthConfig(c: HealthConfig): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(URL_KEY, c.supabaseUrl),
    SecureStore.setItemAsync(KEY_KEY, c.supabaseKey),
  ]);
}

export async function healthIsConnected(): Promise<boolean> {
  return !!(await loadHealthConfig());
}

// Clear credentials for this module: config, the login session, and the vault
// key on this device. Nothing on the server is touched.
export async function healthClearCredentials(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(URL_KEY), SecureStore.deleteItemAsync(KEY_KEY)]);
  const { clearSession } = await import("./session");
  const { forgetVaultKey } = await import("./crypto");
  const { wipePlain } = await import("./media");
  const { cancelAllHealthNotifications } = await import("../notifications/reminders");
  await clearSession().catch(() => {});
  await forgetVaultKey().catch(() => {});
  // nothing of this account stays on the device for the next one: decrypted
  // media in the cache, and scheduled reminders that carry its titles
  await wipePlain().catch(() => {});
  await cancelAllHealthNotifications().catch(() => {});
  // and the on-device remainders: sample-mode data and flags, Apple Health flags
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("health."));
  if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => {});
}

// Accepts the project URL with or without a trailing slash or path.
export function normalizeSupabaseUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  u = u.replace(/\/+$/, "");
  return u;
}

export function looksLikePublishableKey(k: string): boolean {
  const s = k.trim();
  // publishable keys (sb_publishable_…) or the legacy anon JWT; never a secret / service-role key
  if (/^sb_secret_/i.test(s)) return false;
  return /^sb_publishable_/i.test(s) || /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(s);
}
