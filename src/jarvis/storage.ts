// Pairing config — the ONLY state the app holds: which gateway to talk to and the
// access code that unlocks its signer. Stored in the device keychain/keystore.
import * as SecureStore from "expo-secure-store";

const URL_KEY = "gateway_url";
const CODE_KEY = "widget_code";
const NAME_KEY = "assistant_name";

// name = this assistant's identity, reported by the gateway at pairing time —
// the app is a generic shell ("My OS" — always with the space, never "MyOS");
// the paired assistant supplies the title.
export type Pairing = { gatewayUrl: string; code: string; name?: string };

export async function loadPairing(): Promise<Pairing | null> {
  const [gatewayUrl, code, name] = await Promise.all([
    SecureStore.getItemAsync(URL_KEY),
    SecureStore.getItemAsync(CODE_KEY),
    SecureStore.getItemAsync(NAME_KEY),
  ]);
  return gatewayUrl && code ? { gatewayUrl, code, name: name ?? undefined } : null;
}

export async function savePairing(p: Pairing): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(URL_KEY, p.gatewayUrl),
    SecureStore.setItemAsync(CODE_KEY, p.code),
    p.name ? SecureStore.setItemAsync(NAME_KEY, p.name) : Promise.resolve(),
  ]);
}

export async function clearPairing(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(URL_KEY),
    SecureStore.deleteItemAsync(CODE_KEY),
    SecureStore.deleteItemAsync(NAME_KEY),
  ]);
}

// Accepts whatever the user pastes — the widget URL, the bare gateway, with or
// without a trailing slash — and normalizes to the gateway base.
export function normalizeGatewayUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  u = u.replace(/\/+$/, "");
  u = u.replace(/\/(widget|widget-token|run-log|health)$/i, "");
  return u;
}
