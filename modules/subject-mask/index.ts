// Subject cutout (iOS 17+, on the phone). Absent module or no subject → null,
// and the caller keeps the original photo.
import { requireOptionalNativeModule } from "expo";

type SubjectMask = { available: boolean; cutout(uri: string): Promise<string | null> };
const M = requireOptionalNativeModule<SubjectMask>("SubjectMask");

export const cutoutAvailable = !!(M && M.available);

/** file:// photo → file:// PNG of the subject alone on a clear ground, same frame as the photo, or null */
export async function cutoutSubject(uri: string): Promise<string | null> {
  if (!M || !M.available) return null;
  try { return await M.cutout(uri); } catch { return null; }
}
