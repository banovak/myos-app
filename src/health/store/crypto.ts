// The photo vault, byte-for-byte compatible with the web app (store/supabase.js):
//   key        = PBKDF2-SHA256, 600,000 iterations, 16-byte salt → AES-256-GCM
//   ciphertext = iv (12 random bytes) || AES-GCM ciphertext || 16-byte tag
//   check      = encrypt("myos-health-vault-v1"); unlock = decrypt and compare
// PBKDF2 runs natively (react-native-quick-crypto); AES-GCM natively (expo-crypto),
// whose "combined" layout is exactly iv||ct||tag. The derived key is kept in the
// keychain (raw bytes, never the passphrase) so the passphrase is typed once per device.
import * as SecureStore from "expo-secure-store";
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytes } from "expo-crypto";
import { pbkdf2 } from "react-native-quick-crypto";
import { b64, fromUtf8, unb64, utf8 } from "./bytes";

export const VAULT_CHECK = "myos-health-vault-v1";
export const VAULT_ITER = 600000;
const KEY_PREFIX = "health.vault.";

export type VaultMeta = { v: 1; kdf: "PBKDF2-SHA256"; iterations: number; salt: string; check: string };

export function deriveKeyBytes(pass: string, salt: Uint8Array, iterations = VAULT_ITER): Promise<Uint8Array> {
  return new Promise((res, rej) => {
    pbkdf2(utf8(pass) as any, salt as any, iterations, 32, "sha256", (err: any, key: any) => {
      if (err) rej(err);
      else res(new Uint8Array(key));
    });
  });
}

export async function encryptBytes(keyBytes: Uint8Array, plain: Uint8Array): Promise<Uint8Array> {
  const key = (await AESEncryptionKey.import(keyBytes)) as AESEncryptionKey;
  const sealed = await aesEncryptAsync(plain, key, { nonce: { bytes: getRandomBytes(12) } });
  return await sealed.combined();
}

export async function decryptBytes(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = (await AESEncryptionKey.import(keyBytes)) as AESEncryptionKey;
  const out = await aesDecryptAsync(AESSealedData.fromCombined(data, { ivLength: 12, tagLength: 16 }), key);
  return typeof out === "string" ? utf8(out) : (out as Uint8Array);
}

export async function vaultSetup(pass: string): Promise<{ meta: VaultMeta; key: Uint8Array }> {
  const salt = getRandomBytes(16);
  const key = await deriveKeyBytes(pass, salt);
  const check = await encryptBytes(key, utf8(VAULT_CHECK));
  return { meta: { v: 1, kdf: "PBKDF2-SHA256", iterations: VAULT_ITER, salt: b64(salt), check: b64(check) }, key };
}

export async function vaultUnlock(pass: string, meta: VaultMeta): Promise<Uint8Array> {
  const key = await deriveKeyBytes(pass, unb64(meta.salt), meta.iterations || VAULT_ITER);
  let ok = false;
  try {
    ok = fromUtf8(await decryptBytes(key, unb64(meta.check))) === VAULT_CHECK;
  } catch {
    ok = false;
  }
  if (!ok) throw new Error("That passphrase does not match.");
  return key;
}

export async function rememberVaultKey(uid: string, key: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(KEY_PREFIX + uid, b64(key), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function recallVaultKey(uid: string): Promise<Uint8Array | null> {
  const s = await SecureStore.getItemAsync(KEY_PREFIX + uid);
  return s ? unb64(s) : null;
}

export async function forgetVaultKey(uid?: string): Promise<void> {
  if (uid) {
    await SecureStore.deleteItemAsync(KEY_PREFIX + uid);
    return;
  }
  // no uid known (clearing credentials): forget whatever this device remembered
  const ids = await SecureStore.getItemAsync("health.vault.uids");
  for (const id of (ids || "").split(",").filter(Boolean)) await SecureStore.deleteItemAsync(KEY_PREFIX + id);
  await SecureStore.deleteItemAsync("health.vault.uids");
}

export async function noteVaultUid(uid: string): Promise<void> {
  const ids = (await SecureStore.getItemAsync("health.vault.uids")) || "";
  const set = new Set(ids.split(",").filter(Boolean));
  set.add(uid);
  await SecureStore.setItemAsync("health.vault.uids", [...set].join(","));
}
