// Session persistence for supabase-js. A Supabase session is bigger than the
// keychain's comfortable per-item size on iOS, so: a random 256-bit key lives
// in SecureStore, and the session itself is AES-GCM encrypted with it and
// kept in AsyncStorage. Nothing readable sits outside the keychain.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytes } from "expo-crypto";
import { b64, fromUtf8, unb64, utf8 } from "./bytes";

const KEY_KEY = "health.session_key";
const PREFIX = "health.session.";

async function sessionKey(): Promise<AESEncryptionKey> {
  let hex = await SecureStore.getItemAsync(KEY_KEY);
  if (!hex) {
    hex = b64(getRandomBytes(32));
    await SecureStore.setItemAsync(KEY_KEY, hex);
  }
  return (await AESEncryptionKey.import(hex, "base64")) as AESEncryptionKey;
}

export const largeSecureStore = {
  async getItem(name: string): Promise<string | null> {
    try {
      const ct = await AsyncStorage.getItem(PREFIX + name);
      if (!ct) return null;
      const key = await sessionKey();
      const out = await aesDecryptAsync(AESSealedData.fromCombined(unb64(ct)), key);
      return typeof out === "string" ? out : fromUtf8(out as Uint8Array);
    } catch {
      return null;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    const key = await sessionKey();
    const sealed = await aesEncryptAsync(utf8(value), key);
    await AsyncStorage.setItem(PREFIX + name, b64(await sealed.combined()));
  },
  async removeItem(name: string): Promise<void> {
    await AsyncStorage.removeItem(PREFIX + name);
  },
};

export async function clearSession(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
  await SecureStore.deleteItemAsync(KEY_KEY);
}
