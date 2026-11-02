// What the Health UI needs from a store. Two implementations: the user's own
// Supabase project (the real one) and an on-device sample store for exploring
// and developing without an account.
import type { D, FileRef, Photo } from "../model/types";

export type SyncState = "idle" | "saving" | "saved" | "error";
export type StoreHooks = { onStatus: (s: SyncState, msg?: string) => void };
export type VaultState = "none" | "locked" | "unlocked";

export interface HealthStore {
  readonly mode: "supabase" | "sample";
  load(): Promise<D | null>;
  /** debounced: send only changed rows */
  save(D: D): void;
  /** flush any pending save now (e.g. before sign-out) */
  flush(): Promise<void>;
  vaultState(meta: D["settings"]["vault"] | undefined): VaultState;
  vaultSetup(pass: string): Promise<NonNullable<D["settings"]["vault"]>>;
  vaultUnlock(pass: string, meta: NonNullable<D["settings"]["vault"]>): Promise<void>;
  vaultForget(): Promise<void>;
  /** a local file uri for a photo (decrypted into the cache), or null while locked */
  photoUri(p: Photo): Promise<string | null>;
  fileUri(f: FileRef | string | null): Promise<string | null>;
  /** wipe decrypted files from the cache (lock / sign-out) */
  wipeCache(): Promise<void>;
  signOut(): Promise<void>;
  email(): Promise<string>;
}
