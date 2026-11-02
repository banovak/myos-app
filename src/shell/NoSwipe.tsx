// Wrap anything that has its own horizontal gesture (a horizontal list, the
// photo scrubber, a chart you drag across, a pinch-zoomed drawing) so a drag
// that starts inside it never switches modules. Plain touch events, counted
// while a finger is down; the shell checks the count before it claims a swipe.
import { useRef, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export const swipeGuard = { n: 0 };

export function NoSwipe(props: { children: ReactNode; style?: StyleProp<ViewStyle>; off?: boolean; pointerEvents?: "auto" | "box-none" | "none" | "box-only" }) {
  const counted = useRef(0);
  const offRef = useRef(props.off);
  offRef.current = props.off;
  return (
    <View
      style={props.style}
      pointerEvents={props.pointerEvents}
      onTouchStart={() => { if (!offRef.current) { counted.current++; swipeGuard.n++; } }}
      onTouchEnd={() => { if (counted.current > 0) { counted.current--; swipeGuard.n = Math.max(0, swipeGuard.n - 1); } }}
      onTouchCancel={() => { if (counted.current > 0) { counted.current--; swipeGuard.n = Math.max(0, swipeGuard.n - 1); } }}
    >
      {props.children}
    </View>
  );
}
