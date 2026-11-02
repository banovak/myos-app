// Decrypted media lives in the app cache only, under one folder that is wiped
// on lock and sign-out. Photos are JPEG (the web shrinks to max 1600 px,
// quality 0.84, before encrypting); the phone does the same before upload.
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const DIR = new Directory(Paths.cache, "health-plain");

export function plainDir(): Directory {
  if (!DIR.exists) DIR.create({ intermediates: true, idempotent: true });
  return DIR;
}
export const safeName = (path: string): string => path.replace(/[^\w.\-]+/g, "_").slice(-120);

export async function writePlain(path: string, bytes: Uint8Array, ext: string): Promise<string> {
  const f = new File(plainDir(), safeName(path) + ext);
  if (f.exists) f.delete();
  f.create();
  f.write(bytes);
  return f.uri;
}
export function plainUriIfCached(path: string, ext: string): string | null {
  const f = new File(plainDir(), safeName(path) + ext);
  return f.exists ? f.uri : null;
}
export async function wipePlain(): Promise<void> {
  try { if (DIR.exists) DIR.delete(); } catch { /* nothing cached */ }
}
export async function readBytes(uri: string): Promise<Uint8Array> {
  return await new File(uri).bytes();
}
export const extFor = (type?: string | null): string => {
  const t = (type || "").toLowerCase();
  if (t.includes("jpeg") || t.includes("jpg")) return ".jpg";
  if (t.includes("png")) return ".png";
  if (t.includes("pdf")) return ".pdf";
  if (t.includes("heic")) return ".heic";
  if (t.includes("csv")) return ".csv";
  if (t.includes("text")) return ".txt";
  if (t.includes("word")) return ".docx";
  return ".bin";
};

/** the part of an image inside `r` (pixels), as a JPEG file */
export async function cropJpeg(uri: string, r: { x: number; y: number; w: number; h: number }): Promise<{ uri: string }> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.crop({ originX: r.x, originY: r.y, width: r.w, height: r.h });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  img.release?.();
  return { uri: out.uri };
}

/** shrink to max 1600 px on the long side, JPEG 0.84, matching the web */
export async function shrinkToJpeg(uri: string, width?: number, height?: number): Promise<{ uri: string; bytes: Uint8Array }> {
  const ctx = ImageManipulator.manipulate(uri);
  let w = width, h = height;
  if (!w || !h) {
    const probe = await ctx.renderAsync();
    w = probe.width; h = probe.height;
    probe.release?.();
  }
  const s = Math.min(1, 1600 / Math.max(w!, h!));
  const ctx2 = ImageManipulator.manipulate(uri);
  if (s < 1) ctx2.resize({ width: Math.round(w! * s), height: Math.round(h! * s) });
  const img = await ctx2.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.84 });
  img.release?.();
  return { uri: out.uri, bytes: await readBytes(out.uri) };
}
