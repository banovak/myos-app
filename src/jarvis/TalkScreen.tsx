// The face: a name and an orb. Nothing else — clean is the design.
// Background audio (iOS UIBackgroundModes + LiveKit's audio session) keeps the
// conversation alive when the screen locks — the whole reason this shell exists.
//
// Orb states: still when idle · breathing halo + drifting grain rings while
// LISTENING · while SPEAKING, scale, halo, and ring brightness track the REAL
// output volume (getOutputVolume) so it all moves with the voice, not a timer.
// Hidden affordance: long-press the assistant's name to re-pair.
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useConversation } from "@elevenlabs/react-native";
import { useKeepAwake } from "expo-keep-awake";
import Svg, { Path } from "react-native-svg";
import { useShell } from "../shell/ShellContext";
import { theme } from "../theme";
import { GrainRings } from "./GrainRings";
import { type Pairing } from "./storage";

export function TalkScreen(props: {
  pairing: Pairing;
  onUnpair: () => void;
  onCompose: () => void;
}) {
  useKeepAwake();
  const shell = useShell();
  // status is transient-only: connecting + errors. Silence is the normal state.
  const [status, setStatus] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const orbScale = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const haloScale = useRef(new Animated.Value(1)).current;
  const ringGlow = useRef(new Animated.Value(0)).current;
  const breatheLoop = useRef<Animated.CompositeAnimation | null>(null);
  const volumeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const conversation = useConversation({
    onConnect: () => setStatus(""),
    onDisconnect: () => setStatus(""),
    onError: () => setStatus("something broke — tap to retry"),
  });

  const connected = conversation.status === "connected";
  const speaking = connected && conversation.isSpeaking;
  const ringState = !connected ? "idle" : speaking ? "speaking" : "listening";

  useEffect(() => {
    breatheLoop.current?.stop();
    if (volumeTimer.current) {
      clearInterval(volumeTimer.current);
      volumeTimer.current = null;
    }

    if (connected && !speaking) {
      haloScale.setValue(1);
      Animated.timing(ringGlow, { toValue: 0.15, duration: 400, useNativeDriver: true }).start();
      breatheLoop.current = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(haloOpacity, { toValue: 0.4, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(haloOpacity, { toValue: 0.12, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(haloScale, { toValue: 1.18, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(haloScale, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(orbScale, { toValue: 1.03, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(orbScale, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
        ]),
      );
      breatheLoop.current.start();
    } else if (connected && speaking) {
      haloScale.setValue(1.1);
      volumeTimer.current = setInterval(() => {
        let v = 0;
        try {
          v = conversation.getOutputVolume() ?? 0;
        } catch {
          v = 0.4; // volume unavailable → steady presence beats stillness
        }
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1 + v * 0.16, duration: 90, useNativeDriver: true }),
          Animated.timing(haloOpacity, { toValue: 0.15 + v * 0.5, duration: 90, useNativeDriver: true }),
          Animated.timing(ringGlow, { toValue: Math.min(1, v * 1.4), duration: 90, useNativeDriver: true }),
        ]).start();
      }, 90);
    } else {
      Animated.parallel([
        Animated.timing(orbScale, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(haloOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(ringGlow, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }

    return () => {
      breatheLoop.current?.stop();
      if (volumeTimer.current) {
        clearInterval(volumeTimer.current);
        volumeTimer.current = null;
      }
    };
  }, [connected, speaking]);

  async function micPermission(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  async function start() {
    setStatus("connecting…");
    try {
      if (!(await micPermission())) {
        setStatus("microphone permission needed");
        return;
      }
      const res = await fetch(props.pairing.gatewayUrl + "/widget-token?transport=webrtc", {
        method: "POST",
        headers: { "X-Widget-Code": props.pairing.code },
      });
      if (res.status === 401) {
        setStatus("access code no longer valid — hold the name to re-pair");
        return;
      }
      if (!res.ok) {
        setStatus("can't reach the gateway (" + res.status + ")");
        return;
      }
      const data = await res.json();
      conversation.startSession({ conversationToken: data.conversation_token });
    } catch (e: any) {
      setStatus(e?.message ?? "couldn't connect");
    }
  }

  async function stop() {
    try {
      await conversation.endSession();
    } catch {
      // already gone is fine
    }
    setStatus("");
  }

  async function connectionCheck() {
    setMenuOpen(false);
    setStatus("checking…");
    try {
      const res = await fetch(props.pairing.gatewayUrl + "/health");
      const info = await res.json().catch(() => ({}));
      setStatus(res.ok ? `${info.name ?? "gateway"} · connected` : "gateway answered strangely (" + res.status + ")");
    } catch {
      setStatus("can't reach the gateway");
    }
    setTimeout(() => setStatus(""), 4000);
  }

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.menuDots} onPress={() => setMenuOpen(true)} hitSlop={14}>
        <Text style={styles.menuDotsText}>⋮</Text>
      </Pressable>

      {menuOpen && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View style={styles.menu}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                props.onCompose();
              }}
            >
              <Text style={styles.menuItemText}>Send a task</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={connectionCheck}>
              <Text style={styles.menuItemText}>Connection check</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                shell.openAddFeatures();
              }}
            >
              <Text style={styles.menuItemText}>Add features</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                props.onUnpair();
              }}
            >
              <Text style={styles.menuItemText}>Clear credentials</Text>
            </Pressable>
            <Text style={styles.menuVersion}>v2.0.0</Text>
          </View>
        </>
      )}

      {/* The name is the switcher once two or more modules are on. */}
      <Pressable
        onPress={shell.switcher ? shell.openSwitcher : undefined}
        disabled={!shell.switcher}
        style={styles.titleRow}
        accessibilityRole={shell.switcher ? "button" : "header"}
        accessibilityLabel={shell.switcher ? `${props.pairing.name || "My OS"}. Switch module` : undefined}
      >
        <Text style={styles.h1}>{props.pairing.name || "My OS"}</Text>
        {shell.switcher ? (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.red} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={styles.chev}>
            <Path d="M6 9l6 6 6-6" />
          </Svg>
        ) : null}
      </Pressable>

      <View style={styles.orbZone}>
        <GrainRings state={ringState} glow={ringGlow} />
        <Animated.View
          style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
        />
        <Pressable onPress={connected ? stop : start} disabled={conversation.status === "connecting"}>
          <Animated.View
            style={[styles.orb, { transform: [{ scale: orbScale }] }, connected && styles.orbLive]}
          />
        </Pressable>
      </View>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 30,
    paddingHorizontal: 24,
  },
  h1: { color: theme.red, fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  chev: { opacity: 0.55, marginTop: 6 },
  orbZone: { width: 340, height: 340, alignItems: "center", justifyContent: "center" },
  halo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: theme.redBright,
  },
  orb: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: theme.red,
    shadowColor: theme.red,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  orbLive: { backgroundColor: theme.redBright },
  status: { color: theme.inkSoft, fontSize: 15, fontWeight: "500", minHeight: 22, textAlign: "center" },
  // barely-there: a shade darker than the cream background, never in your face
  menuDots: { position: "absolute", top: 58, right: 26, zIndex: 10 },
  menuDotsText: { color: "#D8D0C3", fontSize: 24, fontWeight: "700", lineHeight: 26 },
  menu: {
    position: "absolute",
    top: 92,
    right: 22,
    zIndex: 11,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 6,
    minWidth: 190,
    shadowColor: theme.ink,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 18 },
  menuItemText: { color: theme.ink, fontSize: 15, fontWeight: "500" },
  menuVersion: {
    color: theme.inkSoft,
    opacity: 0.6,
    fontSize: 11,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 8,
  },
});
