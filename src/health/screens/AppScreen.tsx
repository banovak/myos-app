// The signed-in app: top bar, the current section, bottom nav, floating +.
import { useEffect, useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import { useHealth } from "../state/HealthContext";
import { TopBar } from "../components/TopBar";
import { BottomNav, NAV_HEIGHT } from "../components/BottomNav";
import { Dashboard } from "./Dashboard";
import { HistoryScreen } from "./History";
import { ConcernsScreen } from "./Concerns";
import { PlanScreen } from "./Plan";
import { ChartsScreen } from "./Charts";
import { LabsScreen } from "./Labs";
import { PhotosScreen } from "./Photos";
import { LifestyleScreen } from "./Lifestyle";
import { ReportsScreen } from "./Reports";
import { openAdd, openVaultUnlock } from "../sheets";
import { Btn, useT } from "../ui";
import { pageScroll, usePageLock } from "../state/pageScroll";

export function AppScreen() {
  const h = useHealth();
  const t = useT();
  const scroll = useRef<ScrollView>(null);
  const locked = usePageLock();
  // back to the top on a new page; an area picked on the dashboard stays where you are
  const was = useRef({ tab: h.V.tab, exp: h.V.exp, concernPage: h.V.concernPage });
  useEffect(() => {
    const p = was.current; was.current = { tab: h.V.tab, exp: h.V.exp, concernPage: h.V.concernPage };
    if (p.tab === h.V.tab && p.exp === h.V.exp && p.concernPage === h.V.concernPage && h.V.tab === "dashboard") return;
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [h.V.tab, h.V.exp, h.V.concernPage, h.V.region]);
  const body = {
    dashboard: <Dashboard />, history: <HistoryScreen />, concerns: <ConcernsScreen />, plan: <PlanScreen />, charts: <ChartsScreen />,
    labs: <LabsScreen />, photos: <PhotosScreen />, routines: <LifestyleScreen />, reports: <ReportsScreen />,
  }[h.V.tab];
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <TopBar />
      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: NAV_HEIGHT + 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={(e) => { pageScroll.y = e.nativeEvent.contentOffset.y; }} scrollEnabled={!locked}>
        {h.vault === "locked" ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: t.darkC, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14 }}>
            <Text style={{ color: t.onDark, fontSize: 13, fontFamily: t.fontUISemi, flex: 1 }}>Photos and files are locked on this device.</Text>
            <Btn small label="Unlock" onPress={() => openVaultUnlock(h)} style={{ backgroundColor: t.onDark }} />
          </View>
        ) : null}
        {h.isSample ? <Text style={{ fontSize: 11.5, color: t.muted, fontFamily: t.fontUI, borderWidth: 1, borderStyle: "dashed", borderColor: t.line, borderRadius: 12, padding: 8, paddingHorizontal: 12, marginBottom: 14 }}><Text style={{ fontFamily: t.fontUIBold, color: t.ink }}>Sample data.</Text> Fictional records, kept only on this phone. Connect your own project from ⋮ to keep real ones.</Text> : null}
        {body}
      </ScrollView>
      <BottomNav onAdd={() => openAdd(h)} />
    </View>
  );
}
