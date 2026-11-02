// The Health module's state: D (the record), V (view state), the store, sync
// status, vault state, theme tokens, and the one bottom sheet. D is mutated in
// place and a version counter re-renders, mirroring the web's save()/render().
import { createContext, useContext, type ReactNode } from "react";
import type { D, Photo, FileRef } from "../model/types";
import type { HealthStore, SyncState, VaultState } from "../store/types";
import type { Tokens } from "../theme";

export type Tab = "dashboard" | "history" | "routines" | "plan" | "concerns" | "charts" | "labs" | "photos" | "reports";
// the bands of the body figure that zoom in on the dashboard
export type BodyZone = "upper" | "middle" | "lower";
export type View = {
  tab: Tab; region: string | null; concern: string | null; type: string; frame: number | null; editing: boolean; customizing: boolean;
  editChart: string | null; photoRegion: string; apptKind: string; planYear: number; expanded: Set<string>; exp: string | null;
  zoom: "head" | BodyZone | null; mouthView: "teeth" | "photos"; focusChart: string | null;
  /** the body card: the front or the back */
  side: "front" | "back";
  /** History: which view, and the month the calendar shows (YYYY-MM) */
  histView: "list" | "month" | "bars"; histMonth: string;
  /** the concern whose page is open on the Concerns tab */
  concernPage: string | null;
  /** the tab the open challenge page was reached from, for its back button */
  expFrom: Tab | null;
};
export const initialView = (): View => ({
  tab: "dashboard", region: null, concern: null, type: "all", frame: null, editing: false, customizing: false, editChart: null, photoRegion: "all", apptKind: "all",
  planYear: new Date().getFullYear(), expanded: new Set(), exp: null, zoom: null, mouthView: "teeth", focusChart: null, side: "front",
  histView: "list", histMonth: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })(), concernPage: null, expFrom: null,
});

export type SheetContent = { node: ReactNode; key: number; onClose?: () => void };
export type Health = {
  D: D;
  V: View;
  version: number;
  t: Tokens;
  store: HealthStore;
  sync: { state: SyncState; msg?: string; at?: number };
  vault: VaultState;
  /** mutate D in place, then save and re-render */
  mutate: (fn: (D: D) => void) => void;
  /** change view state and re-render */
  setV: (patch: Partial<View>) => void;
  /** re-render without saving (after an in-place tweak that the store already knows about) */
  refresh: () => void;
  openSheet: (node: ReactNode, onClose?: () => void) => void;
  closeSheet: () => void;
  /** go to a tab (clears exp, the concern page, editing and customizing, like the nav does) */
  go: (tab: Tab, extra?: Partial<View>) => void;
  photoUri: (p: Photo) => Promise<string | null>;
  fileUri: (f: FileRef | string | null) => Promise<string | null>;
  /** before adding a photo or file in synced mode: true if the vault must be set up / unlocked first (and the sheet for it has been opened) */
  needVault: () => boolean;
  reload: () => Promise<void>;
  openSecurity: () => void;
  openAppearance: () => void;
  signOut: () => Promise<void>;
  email: string;
  isSample: boolean;
};

export const HealthContext = createContext<Health | null>(null);
export function useHealth(): Health {
  const h = useContext(HealthContext);
  if (!h) throw new Error("useHealth outside HealthProvider");
  return h;
}
