// The grain rings — three tilted, counter-rotating bands of dot-grain around the
// orb. Idle: near-still, faint. Listening: soft presence. Speaking: the parent
// drives `glow` from real output volume, and speed steps up.
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { theme } from "../theme";

const SIZE = 340;
const C = SIZE / 2;

type Props = {
  state: "idle" | "listening" | "speaking";
  glow: Animated.Value; // 0..1 — parent maps output volume onto this
};

function Ring(props: {
  r: number;
  duration: number;
  reverse?: boolean;
  dash: string;
  width: number;
  color: string;
  baseOpacity: number;
  glow: Animated.Value;
  speedK: number;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const loop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loop.current?.stop();
    spin.setValue(0);
    loop.current = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: props.duration / props.speedK,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.current.start();
    return () => loop.current?.stop();
  }, [props.duration, props.speedK, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: props.reverse ? ["360deg", "0deg"] : ["0deg", "360deg"],
  });
  const opacity = props.glow.interpolate({
    inputRange: [0, 1],
    outputRange: [props.baseOpacity, Math.min(1, props.baseOpacity + 0.55)],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, transform: [{ rotate }] }]}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={C}
          cy={C}
          r={props.r}
          stroke={props.color}
          strokeWidth={props.width}
          strokeDasharray={props.dash}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

export function GrainRings(props: Props) {
  const speedK = props.state === "speaking" ? 2.6 : props.state === "listening" ? 1 : 0.45;
  return (
    // The tilt: squashed on Y and leaned like a planet's ring plane.
    <Animated.View
      pointerEvents="none"
      style={[styles.plane, { transform: [{ rotate: "-16deg" }, { scaleY: 0.42 }] }]}
    >
      <Ring r={112} duration={26000} dash="1.6 7" width={2.2} color={theme.red} baseOpacity={0.34} glow={props.glow} speedK={speedK} />
      <Ring r={126} duration={38000} reverse dash="1.2 9" width={1.8} color={theme.redBright} baseOpacity={0.26} glow={props.glow} speedK={speedK} />
      <Ring r={142} duration={52000} dash="1 12" width={1.4} color={theme.ink} baseOpacity={0.12} glow={props.glow} speedK={speedK} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  plane: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
