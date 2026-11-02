// What a module can ask of the shell: whether the switcher exists (two or more
// modules on), how to open it, and how to reach Add features. Modules draw
// their own title; the shell tells them whether to hang a chevron on it.
import { createContext, useContext } from "react";
import type { ModuleId } from "./modules";

export type ShellApi = {
  /** two or more modules enabled: show the chevron and allow the swipe */
  switcher: boolean;
  current: ModuleId;
  enabled: ModuleId[];
  openSwitcher: () => void;
  openAddFeatures: () => void;
  switchTo: (id: ModuleId) => void;
  /** where a swipe may switch modules: the module's top band (px from the top of the screen) or "all"; wrap horizontal gestures in NoSwipe */
  setSwipeBand: (height: number | "all") => void;
};

export const ShellContext = createContext<ShellApi>({
  switcher: false,
  current: "jarvis",
  enabled: ["jarvis"],
  openSwitcher: () => {},
  openAddFeatures: () => {},
  switchTo: () => {},
  setSwipeBand: () => {},
});

export const useShell = () => useContext(ShellContext);
