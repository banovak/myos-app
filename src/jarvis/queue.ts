// The quiet second door: put a line on the ledger without saying a word.
// POSTs to the gateway's desk endpoints — same code, same gateway, no new
// secrets. Text goes to /desk/queue; media (with optional text) goes multipart
// to /desk/upload, which stores it and inks ONE ledger line with links.
import { File } from "expo-file-system";
import { type Pairing } from "./storage";

export type QueueResult =
  | { ok: true }
  | { ok: false; badCode: boolean; message: string };

export type OutboundMedia = {
  uri: string;
  name: string;
  type: string; // mime
  size?: number;
};

// Client-side mirrors of the gateway's /desk/upload limits. The 20MB cap is
// the gateway's per-file ceiling — roomy for photos, tight for video: long
// clips have to be trimmed before sharing.
export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

function failure(res: Response): QueueResult {
  if (res.status === 401) {
    return {
      ok: false,
      badCode: true,
      message: "access code no longer valid — clear credentials from the menu to re-pair",
    };
  }
  return { ok: false, badCode: false, message: "the gateway said no (" + res.status + ")" };
}

export async function sendToQueue(pairing: Pairing, text: string): Promise<QueueResult> {
  try {
    const res = await fetch(pairing.gatewayUrl + "/desk/queue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Widget-Code": pairing.code,
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return failure(res);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, badCode: false, message: e?.message ?? "can't reach the gateway" };
  }
}

export async function sendToUpload(
  pairing: Pairing,
  media: OutboundMedia[],
  text: string,
): Promise<QueueResult> {
  try {
    const form = new FormData();
    for (const img of media) {
      // SDK 57's global fetch is Expo's WinterCG one: form parts must be a Blob
      // or expose bytes() — the classic RN {uri,...} part throws "Unsupported
      // FormDataPart implementation". expo-file-system's File wraps the local
      // uri as exactly that (and carries name+type for the part headers).
      form.append("files", new File(img.uri) as any);
    }
    if (text) form.append("text", text);
    const res = await fetch(pairing.gatewayUrl + "/desk/upload", {
      method: "POST",
      // no Content-Type header — fetch sets the multipart boundary itself
      headers: { "X-Widget-Code": pairing.code },
      body: form,
    });
    if (!res.ok) return failure(res);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, badCode: false, message: e?.message ?? "can't reach the gateway" };
  }
}
