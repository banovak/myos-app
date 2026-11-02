// Byte helpers shared by the vault and the session store. Base64 matches the
// web app's btoa/atob exactly (standard alphabet, padded).
import { Buffer } from "react-native-quick-crypto";

export const b64 = (u8: Uint8Array): string => Buffer.from(u8).toString("base64");
export const unb64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));
export const utf8 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "utf8"));
export const fromUtf8 = (u8: Uint8Array): string => Buffer.from(u8).toString("utf8");
export const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};
