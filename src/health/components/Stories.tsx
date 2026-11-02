// Needs-you circles at the top of the dashboard, each with a yellow badge in
// its corner (a count, days to go, a mark). The row fades out at its right
// edge, under the layout button. Tapping one opens a preview card with
// actions and Dismiss (which only hides it; nothing is deleted).
import { Pressable, ScrollView, Text, View } from "react-native";
import { dismissStory, storyItems, type Story } from "../model/stories";
import { useHealth } from "../state/HealthContext";
import { Icon, useT } from "../ui";
import { PhotoView } from "./PhotoView";
import { openStory } from "../sheets";
import { NoSwipe } from "../../shell/NoSwipe";

export function Stories() {
  const h = useHealth();
  const t = useT();
  const items = storyItems(h.D, h.vault === "locked");
  if (!items.length) return null;
  const steps = 7; // the fade: strips of the page colour, more opaque to the right
  return (
    <NoSwipe>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 4, paddingRight: 28, paddingVertical: 2 }} style={{ marginHorizontal: -4 }} accessibilityLabel="Needs your attention">
        {items.map((it) => <StoryBubble key={it.key} it={it} onPress={() => openStory(h, it, () => h.mutate((D) => dismissStory(D, it.key)))} />)}
      </ScrollView>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, right: -4, width: 4 * steps, flexDirection: "row" }}>
        {Array.from({ length: steps }, (_, i) => <View key={i} style={{ width: 4, backgroundColor: t.bg, opacity: (i + 1) / steps }} />)}
      </View>
    </NoSwipe>
  );
}
function StoryBubble(props: { it: Story; onPress: () => void }) {
  const t = useT();
  const it = props.it, k = it.ico === "lock" ? "challenge" : it.ico;
  return (
    <Pressable onPress={props.onPress} style={{ alignItems: "center", gap: 4, width: 66 }} accessibilityRole="button" accessibilityLabel={`${it.label}, ${it.sub}`}>
      <View style={{ padding: 2, borderRadius: 999, borderWidth: 2, borderColor: t.accent }}>
        {it.photo ? <PhotoView photo={it.photo} style={{ width: 50, height: 50 }} radius={25} position="center" /> : (
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: t.card, alignItems: "center", justifyContent: "center" }}>
            <Icon k={it.ico} size={22} color={t.tint(k)} />
          </View>
        )}
        {it.badge || it.badgeIco ? (
          <View style={{ position: "absolute", top: -4, right: -6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: "#F7C948", borderWidth: 1.5, borderColor: t.card, alignItems: "center", justifyContent: "center" }}>
            {it.badgeIco ? <Icon k={it.badgeIco} size={11} color="#2B2300" /> : <Text style={{ fontSize: 10.5, lineHeight: 13, fontFamily: t.fontUIBold, color: "#2B2300" }}>{it.badge}</Text>}
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ fontSize: 11.5, fontFamily: t.fontUIBold, color: t.ink, maxWidth: 66 }}>{it.label}</Text>
    </Pressable>
  );
}
