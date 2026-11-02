// Send to [assistant] — the share sheet's landing pad, and the menu's task box.
// Three shapes, one screen: text/URL shared in shows read-only; photos and
// videos shared in show as small thumbnails (upload path); opened bare from
// the menu it's a plain queue-a-task box with a quiet 📎 for media. Voice
// stays the main face; this is the quiet second door.
import { useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { theme } from "../theme";
import { type Pairing } from "./storage";
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  sendToQueue,
  sendToUpload,
  type OutboundMedia,
} from "./queue";

const isVideo = (m: OutboundMedia) => m.type.startsWith("video/");

export function ComposeScreen(props: {
  pairing: Pairing;
  sharedContent: string | null;
  sharedImages: OutboundMedia[];
  onDone: () => void;
}) {
  const name = props.pairing.name || "My OS";
  const [instruction, setInstruction] = useState("");
  const [picked, setPicked] = useState<OutboundMedia[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shared = props.sharedContent?.trim() || null;
  const images = [...props.sharedImages, ...picked];
  // The 📎 lives in the plain queue-a-task shape (menu mode) only —
  // shared-in content arrives as-is.
  const manual = !shared && props.sharedImages.length === 0;

  async function attach() {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FILES,
      quality: 0.9,
    });
    if (res.canceled) return;
    const add = res.assets.map((a) => ({
      uri: a.uri,
      name: a.fileName || (a.type === "video" ? "video.mp4" : "photo.jpg"),
      type: a.mimeType || (a.type === "video" ? "video/mp4" : "image/jpeg"),
      size: a.fileSize ?? undefined,
    }));
    setPicked((prev) => [...prev, ...add]);
  }

  function removePicked(uri: string) {
    setPicked((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function send() {
    setError(null);
    Keyboard.dismiss();
    const note = instruction.trim();
    // instruction + ": " + shared content when both exist; whichever alone
    // otherwise. With images, this combined text rides the upload's "text"
    // field (images win the path; a shared URL is appended to the text).
    const text = shared ? (note ? note + ": " + shared : shared) : note;

    if (images.length > 0) {
      if (images.length > MAX_FILES) {
        setError(`${MAX_FILES} attachments max per send`);
        return;
      }
      const tooBig = images.find((i) => (i.size ?? 0) > MAX_FILE_BYTES);
      if (tooBig) {
        setError(
          `${tooBig.name} is over 20MB` + (isVideo(tooBig) ? " — trim the clip and retry" : ""),
        );
        return;
      }
      setBusy(true);
      const result = await sendToUpload(props.pairing, images, text);
      setBusy(false);
      if (result.ok) {
        setSent(true);
        setTimeout(props.onDone, 1200);
      } else {
        // plain error, everything preserved — nothing is lost
        setError(result.message);
      }
      return;
    }

    if (!text) {
      setError("nothing to send yet");
      return;
    }
    setBusy(true);
    const result = await sendToQueue(props.pairing, text);
    setBusy(false);
    if (result.ok) {
      // brief confirmation, then back to the face
      setSent(true);
      setTimeout(props.onDone, 1200);
    } else {
      setError(result.message);
    }
  }

  if (sent) {
    return (
      <View style={styles.confirmWrap}>
        <Text style={styles.confirmText}>On the ledger ✓</Text>
      </View>
    );
  }

  const placeholder =
    shared || images.length > 0
      ? `What should ${name} do with this?`
      : `What should ${name} do?`;

  return (
    <Pressable style={styles.dismiss} onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={props.onDone} hitSlop={14} disabled={busy}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>

        <Text style={styles.h1}>Send to {name}</Text>

        {shared ? (
          <View style={styles.sharedBox}>
            <ScrollView style={styles.sharedScroll}>
              <Text style={styles.sharedText}>{shared}</Text>
            </ScrollView>
          </View>
        ) : null}

        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
            {props.sharedImages.map((img) => (
              <MediaThumb key={img.uri} media={img} />
            ))}
            {picked.map((img) => (
              <Pressable key={img.uri} onPress={() => removePicked(img.uri)} disabled={busy}>
                <MediaThumb media={img} />
                <View style={styles.thumbRemove}>
                  <Text style={styles.thumbRemoveText}>×</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={theme.inkSoft}
          multiline
          value={instruction}
          onChangeText={setInstruction}
        />

        {manual ? (
          <Pressable style={styles.attach} onPress={attach} hitSlop={10} disabled={busy}>
            <Text style={styles.attachText}>📎</Text>
          </Pressable>
        ) : null}

        <Pressable style={[styles.btn, busy && styles.btnBusy]} onPress={send} disabled={busy}>
          <Text style={styles.btnText}>{busy ? "sending…" : "Send"}</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </KeyboardAvoidingView>
    </Pressable>
  );
}

// <Image> renders nothing useful for a video uri — videos get a quiet dark
// tile with a play glyph instead.
function MediaThumb(props: { media: OutboundMedia }) {
  if (!isVideo(props.media)) {
    return <Image source={{ uri: props.media.uri }} style={styles.thumb} />;
  }
  return (
    <View style={[styles.thumb, styles.thumbVideo]}>
      <Text style={styles.thumbVideoGlyph}>▶</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dismiss: { flex: 1, backgroundColor: theme.bg },
  wrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 64,
    paddingBottom: 40,
    gap: 18,
  },
  header: { flexDirection: "row", justifyContent: "flex-start" },
  cancel: { color: theme.inkSoft, fontSize: 16, fontWeight: "500" },
  h1: { color: theme.red, fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
  sharedBox: {
    backgroundColor: "#fff",
    borderColor: theme.border,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxHeight: 160,
  },
  sharedScroll: { flexGrow: 0 },
  sharedText: { color: theme.inkSoft, fontSize: 15, lineHeight: 21 },
  thumbRow: { flexGrow: 0 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff",
  },
  thumbVideo: {
    backgroundColor: theme.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbVideoGlyph: { color: theme.bg, fontSize: 18, opacity: 0.9 },
  thumbRemove: {
    position: "absolute",
    top: -4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbRemoveText: { color: theme.bg, fontSize: 12, fontWeight: "700", lineHeight: 14 },
  input: {
    backgroundColor: "#fff",
    borderColor: theme.border,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.ink,
    minHeight: 96,
    textAlignVertical: "top",
  },
  attach: { alignSelf: "flex-start" },
  attachText: { fontSize: 20, color: theme.inkSoft },
  btn: {
    alignSelf: "center",
    backgroundColor: theme.red,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 40,
    marginTop: 6,
  },
  btnBusy: { opacity: 0.6 },
  btnText: { color: theme.bg, fontSize: 16, fontWeight: "700" },
  error: { color: theme.red, fontSize: 14, textAlign: "center" },
  confirmWrap: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { color: theme.red, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
});
