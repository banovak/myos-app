// Jarvis as a module: pairing, the face, the compose screen, and share-sheet
// arrivals. Exactly what the app was before modules existed, wrapped so the
// shell can host it next to Health.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ConversationProvider } from "@elevenlabs/react-native";
import { useShareIntent } from "expo-share-intent";
import { useShell } from "../shell/ShellContext";
import { theme } from "../theme";
import { PairScreen } from "./PairScreen";
import { TalkScreen } from "./TalkScreen";
import { ComposeScreen } from "./ComposeScreen";
import { clearPairing, loadPairing, type Pairing } from "./storage";
import { type OutboundMedia } from "./queue";

// Share-intent file paths arrive bare on some platforms; RN's fetch/Image
// want a proper uri scheme.
function toUri(path: string): string {
  return /^(file|content):\/\//.test(path) ? path : "file://" + path;
}

export function JarvisModule() {
  const shell = useShell();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [composing, setComposing] = useState(false);

  // The whole face is a safe swipe zone: nothing on it scrolls sideways.
  useEffect(() => { shell.setSwipeBand("all"); }, [shell]);

  // Share-sheet arrivals (text + URLs). If the app isn't paired yet the intent
  // waits — PairScreen shows first, then the compose screen picks it up.
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    loadPairing().then((p) => {
      setPairing(p);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (hasShareIntent && pairing) setComposing(true);
  }, [hasShareIntent, pairing]);

  async function unpair() {
    await clearPairing();
    setPairing(null);
    setComposing(false);
  }

  function closeCompose() {
    if (hasShareIntent) resetShareIntent();
    setComposing(false);
  }

  if (!loaded) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  const sharedContent = hasShareIntent ? shareIntent.webUrl ?? shareIntent.text ?? null : null;
  const sharedImages: OutboundMedia[] =
    hasShareIntent && shareIntent.files
      ? shareIntent.files
          .filter((f) => /^(image|video)\//.test(f.mimeType ?? ""))
          .map((f) => ({
            uri: toUri(f.path),
            name: f.fileName || ((f.mimeType ?? "").startsWith("video/") ? "shared.mp4" : "shared.jpg"),
            type: f.mimeType || "image/jpeg",
            size: f.size ?? undefined,
          }))
      : [];

  return (
    <ConversationProvider>
      {!pairing ? (
        <PairScreen onPaired={setPairing} />
      ) : composing ? (
        <ComposeScreen pairing={pairing} sharedContent={sharedContent} sharedImages={sharedImages} onDone={closeCompose} />
      ) : (
        <TalkScreen pairing={pairing} onUnpair={unpair} onCompose={() => setComposing(true)} />
      )}
    </ConversationProvider>
  );
}
