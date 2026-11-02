// Hosts the modules. One enabled = no chrome at all. Two or more = the
// module's own name becomes the switcher, and a horizontal swipe anywhere the
// module allows (see setSwipeBand and NoSwipe) moves between them. Never a
// bottom bar: the bottom belongs to the module.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { useShareIntent } from "expo-share-intent";
import { JarvisModule } from "../jarvis/JarvisModule";
import { HealthModule } from "../health/HealthModule";
import { AddFeaturesScreen } from "./AddFeaturesScreen";
import { swipeGuard } from "./NoSwipe";
import { ShellContext, type ShellApi } from "./ShellContext";
import { SwitcherSheet } from "./SwitcherSheet";
import { loadShellPrefs, saveEnabled, saveLast, type ModuleId } from "./modules";

export function ModuleShell() {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState<ModuleId[]>(["jarvis"]);
  const [current, setCurrent] = useState<ModuleId>("jarvis");
  const [sheet, setSheet] = useState(false);
  const [adding, setAdding] = useState(false);
  const bandRef = useRef<number | "all">(0);
  const startY = useRef(0);
  const currentRef = useRef(current);
  const enabledRef = useRef(enabled);
  currentRef.current = current;
  enabledRef.current = enabled;

  useEffect(() => {
    loadShellPrefs().then((p) => {
      setEnabled(p.enabled);
      setCurrent(p.last);
      setLoaded(true);
    });
  }, []);

  const switchTo = useCallback((id: ModuleId) => {
    setCurrent(id);
    setSheet(false);
    saveLast(id).catch(() => {});
  }, []);

  // A share-sheet arrival is for Jarvis, whichever module was open last.
  const { hasShareIntent } = useShareIntent({ disabled: !loaded });
  useEffect(() => {
    if (loaded && hasShareIntent && currentRef.current !== "jarvis") { setAdding(false); switchTo("jarvis"); }
  }, [hasShareIntent, loaded, switchTo]);

  const step = useCallback((dir: 1 | -1) => {
    const list = enabledRef.current;
    if (list.length < 2) return;
    const i = list.indexOf(currentRef.current);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    switchTo(list[j]);
  }, [switchTo]);

  // Swipe in the safe zone only. Captured on move, so taps underneath still land.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (e) => {
          startY.current = e.nativeEvent.pageY;
          // first finger down: nothing below can still be holding the guard
          if (e.nativeEvent.touches.length <= 1) swipeGuard.n = 0;
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_e, g) => {
          if (enabledRef.current.length < 2) return false;
          if (swipeGuard.n > 0 || g.numberActiveTouches !== 1) return false;
          const band = bandRef.current;
          const inZone = band === "all" || startY.current <= (band as number);
          return inZone && Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6;
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dx <= -50 || g.vx < -0.6) step(1);
          else if (g.dx >= 50 || g.vx > 0.6) step(-1);
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [step],
  );

  async function toggle(id: ModuleId, on: boolean) {
    let next = on ? [...enabled, id] : enabled.filter((x) => x !== id);
    next = (["jarvis", "health"] as ModuleId[]).filter((x) => next.includes(x));
    if (!next.length) return;
    setEnabled(next);
    await saveEnabled(next);
    if (!next.includes(current)) switchTo(next[0]);
  }

  const api: ShellApi = useMemo(
    () => ({
      switcher: enabled.length >= 2,
      current,
      enabled,
      openSwitcher: () => setSheet(true),
      openAddFeatures: () => { setSheet(false); setAdding(true); },
      switchTo,
      setSwipeBand: (h) => { bandRef.current = h; },
    }),
    [enabled, current, switchTo],
  );

  if (!loaded) return <View style={styles.blank} />;

  if (adding) {
    return (
      <AddFeaturesScreen
        enabled={enabled}
        onToggle={toggle}
        onBack={() => setAdding(false)}
        onConnect={(id) => { setAdding(false); switchTo(id); }}
      />
    );
  }

  return (
    <ShellContext.Provider value={api}>
      <View style={styles.host} {...pan.panHandlers}>
        {current === "jarvis" ? <JarvisModule key="jarvis" /> : <HealthModule key="health" />}
      </View>
      <SwitcherSheet
        open={sheet}
        enabled={enabled}
        current={current}
        onPick={switchTo}
        onAddFeatures={api.openAddFeatures}
        onClose={() => setSheet(false)}
      />
    </ShellContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  blank: { flex: 1, backgroundColor: "#F5F0E8" },
});
