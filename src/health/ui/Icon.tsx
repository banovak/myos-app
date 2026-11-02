// Stroke icons, the same paths as the web app's ICONS and NAVICON.
import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useT } from "./primitives";

const P = (p: { k: string }) => {
  switch (p.k) {
    case "photo": return <><Path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><Circle cx={12} cy={13} r={3.5} /></>;
    case "appointment": return <><Rect x={4} y={5.5} width={16} height={14} rx={2} /><Path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>;
    case "measurement": return <><Path d="M5 19 19 5" /><Path d="M8 16l-1.5-1.5M11 13l-2-2M14 10l-1.5-1.5M17 7l-2-2" /></>;
    case "procedure": return <><Path d="M14.5 4.5 19.5 9.5 9 20H4v-5z" /><Path d="m12.5 6.5 5 5" /></>;
    case "concerns":
    case "observation": return <><Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><Circle cx={12} cy={12} r={3} /></>;
    case "lab": return <><Path d="M9.5 3.5h5M10.5 3.5v6L5 18.5a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5.5-9v-6" /><Path d="M7.5 14.5h9" /></>;
    case "illness": return <><Path d="M12 3.5a2.5 2.5 0 0 0-2.5 2.5v8.3a4.5 4.5 0 1 0 5 0V6A2.5 2.5 0 0 0 12 3.5z" /><Path d="M12 9.5v6" /><Circle cx={12} cy={17} r={1.2} /></>;
    case "report": return <><Path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><Path d="M14 3.5V8h4.5M9 13h6M9 16.5h6" /></>;
    case "regimen": return <><Rect x={3.5} y={9} width={17} height={6.5} rx={3.25} transform="rotate(-35 12 12)" /><Path d="m9.6 8.6 4.8 6.8" /></>;
    case "diet": return <><Path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" /><Path d="M5 19 13 11" /></>;
    case "food_trial": return <Path d="M7 3.5v17M4.5 3.5v5a2.5 2.5 0 0 0 5 0v-5M16.5 20.5v-17c-2.5 1-3.5 4-3.5 7.5h3.5" />;
    case "cycle": return <Path d="M12 3.5c3.5 4.5 6 7.7 6 10.8a6 6 0 0 1-12 0C6 11.2 8.5 8 12 3.5z" />;
    case "challenge": return <Path d="M5 21V4M5 4h11l-2 4 2 4H5" />;
    case "lock": return <><Rect x={5} y={11} width={14} height={9} rx={2} /><Path d="M8 11V8a4 4 0 0 1 8 0v3" /></>;
    case "bell": return <><Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>;
    case "file": return <><Path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><Path d="M14 3.5V8h4.5" /></>;
    case "plan": return <><Circle cx={12} cy={12} r={8.5} /><Circle cx={12} cy={12} r={4.5} /><Circle cx={12} cy={12} r={1} /></>;
    case "dashboard": return <><Path d="M4 11.5 12 5l8 6.5V20H4z" /><Path d="M10 20v-5h4v5" /></>;
    case "timeline": return <><Path d="M9 6h11M9 12h11M9 18h11" /><Circle cx={4.5} cy={6} r={1} /><Circle cx={4.5} cy={12} r={1} /><Circle cx={4.5} cy={18} r={1} /></>;
    case "charts": return <Path d="M5 20V11M11 20V5M17 20v-7M3 20h18" />;
    case "labs": return <><Path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><Path d="M14 3.5V8h4.5M9 13h6M9 16.5h6" /></>;
    case "photos": return <><Rect x={3.5} y={5} width={17} height={14} rx={2} /><Circle cx={9} cy={10} r={1.8} /><Path d="m20.5 16-4.5-4.5L6 19" /></>;
    case "routines": return <><Path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" /><Path d="M5 19 13 11" /></>;
    case "reports": return <><Path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><Path d="M14 3.5V8h4.5M9 13h6M9 16.5h6" /></>;
    case "plus": return <Path d="M12 5v14M5 12h14" />;
    case "check": return <Path d="M5 12.5l4.5 4.5L19 7.5" />;
    case "chev": return <Path d="M6 9l6 6 6-6" />;
    case "back": return <Path d="M15 5l-7 7 7 7" />;
    case "grip": return <><Circle cx={9} cy={6} r={1.6} fill="currentColor" /><Circle cx={15} cy={6} r={1.6} fill="currentColor" /><Circle cx={9} cy={12} r={1.6} fill="currentColor" /><Circle cx={15} cy={12} r={1.6} fill="currentColor" /><Circle cx={9} cy={18} r={1.6} fill="currentColor" /><Circle cx={15} cy={18} r={1.6} fill="currentColor" /></>;
    case "camera": return <><Path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><Circle cx={12} cy={13} r={3.5} /></>;
    case "card": return <><Rect x={3} y={5} width={18} height={14} rx={2.5} /><Circle cx={8.5} cy={10.5} r={2} /><Path d="M5.3 16c.6-1.8 1.8-2.7 3.2-2.7s2.6.9 3.2 2.7M14 9.5h4M14 13h4" /></>;
    case "edit": return <><Path d="M14.5 4.5 19.5 9.5 9 20H4v-5z" /><Path d="m12.5 6.5 5 5" /></>;
    case "layout": return <><Rect x={3.5} y={3.5} width={7} height={7} rx={1.5} /><Rect x={13.5} y={3.5} width={7} height={7} rx={1.5} /><Rect x={3.5} y={13.5} width={7} height={7} rx={1.5} /><Rect x={13.5} y={13.5} width={7} height={7} rx={1.5} /></>;
    case "filter": return <Path d="M3.5 5h17l-6.5 7.5V19l-4 2v-8.5z" />;
    case "info": return <><Circle cx={12} cy={12} r={9} /><Path d="M12 11v5.5M12 7.8v.4" /></>;
    case "expand": return <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />;
    case "close": return <Path d="M6 6l12 12M18 6L6 18" />;
    case "rotate": return <><Path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><Path d="M19.5 3.5v4.5H15" /></>;
    case "shrink": return <Path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />;
    case "history":
    case "appointments": return <><Rect x={4} y={5.5} width={16} height={14} rx={2} /><Path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>;
    default: return <Circle cx={12} cy={12} r={6} />;
  }
};

export function Icon(props: { k: string; size?: number; color?: string; stroke?: number }) {
  const t = useT();
  const n = props.size ?? 17;
  return (
    <Svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke={props.color ?? t.ink} strokeWidth={props.stroke ?? 1.8} strokeLinecap="round" strokeLinejoin="round">
      <P k={props.k} />
    </Svg>
  );
}
/** the coloured square an entry type wears in lists */
export function TypeIco(props: { k: string; small?: boolean }) {
  const t = useT();
  const n = props.small ? 26 : 34;
  const bg = t.tint(props.k === "challenge" ? "challenge" : props.k);
  const col = props.k === "challenge" ? t.onDark : "#fff";
  return (
    <View style={{ width: n, height: n, borderRadius: props.small ? 8 : 10, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Icon k={props.k} size={props.small ? 14 : 17} color={col} />
    </View>
  );
}
