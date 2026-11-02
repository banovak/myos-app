// Health module tokens, the same values as the web app's CSS variables, in
// light and dark. The accent is per user (settings.accent); its companions are
// derived exactly as the web does: on-accent by WCAG contrast, accent-soft as
// 13% accent mixed into the card colour in sRGB.
import { DEFAULT_ACCENT, isHex, TINT } from "./model/vocab";

export type Tokens = {
  dark: boolean;
  bg: string; card: string; soft: string; ink: string; muted: string; line: string;
  accent: string; accentSoft: string; onAccent: string; darkC: string; onDark: string;
  tint: (k: string) => string;
  fontUI: string; fontUIBold: string; fontUISemi: string; fontUIHeavy: string; fontData: string;
};

const LIGHT = { bg: "#FAFAFC", card: "#FFFFFF", soft: "#F6F6F9", ink: "#16180F", muted: "#5E5E64", line: "#E6E6EC", darkC: "#16180F", onDark: "#F2F4EC" };
const DARK = { bg: "#101210", card: "#1B1E18", soft: "#23271F", ink: "#ECEFE5", muted: "#9BA090", line: "#2F3429", darkC: "#ECEFE5", onDark: "#16180F" };

const chan = (v: number): number => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (hex: string): number => { const n = parseInt(hex.slice(1), 16); return 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255); };
/** white if its contrast ratio against the accent is at least near-black's, else near-black */
export function contrastOn(hex: string): string {
  const L = lum(hex);
  return 1.05 / (L + 0.05) >= (L + 0.05) / (0.0122 + 0.05) ? "#FFFFFF" : "#16180F";
}
export function mix(a: string, b: string, pct: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (sh: number) => Math.round(((pa >> sh) & 255) * pct + ((pb >> sh) & 255) * (1 - pct));
  return "#" + [16, 8, 0].map((sh) => c(sh).toString(16).padStart(2, "0")).join("").toUpperCase();
}
export const resolveAccent = (v: unknown): string => (isHex(v) ? v.toUpperCase() : DEFAULT_ACCENT);

export function makeTokens(accentIn: unknown, dark: boolean): Tokens {
  const base = dark ? DARK : LIGHT, accent = resolveAccent(accentIn);
  return {
    dark, ...base, accent, onAccent: contrastOn(accent), accentSoft: mix(accent, base.card, 0.13),
    tint: (k) => (TINT[k] ? TINT[k][dark ? 1 : 0] : base.muted),
    fontUI: "Manrope_500Medium", fontUISemi: "Manrope_600SemiBold", fontUIBold: "Manrope_700Bold", fontUIHeavy: "Manrope_800ExtraBold", fontData: "DMMono_400Regular",
  };
}
/** a stored colour string → something safe to draw: the accent token resolves to the accent, anything non-hex falls back */
export function colorOf(v: unknown, t: Tokens, fallback: string): string {
  if (v === "var(--accent)") return t.accent;
  return isHex(v) ? v : fallback;
}
export const SHADOW = { shadowColor: "#16180F", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 } as const;

/** text colour for a check-in status: behind in red, due in amber, up to date in green */
export const statusColor = (t: Tokens, st: string): string =>
  st === "behind" ? (t.dark ? "#FF7B72" : "#C62828") : st === "due" ? (t.dark ? "#F7C948" : "#8A5A00") : st === "ok" || st === "done" ? (t.dark ? "#7BD88F" : "#2E7D32") : t.muted;
