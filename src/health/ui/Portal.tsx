// A full-screen layer drawn by the provider, over the page and under the
// sheets. A native Modal would sit above the sheets, and on iOS a sheet opened
// from inside one never shows; this layer is ordinary content, so the point
// form, the camera and the rest open over it as usual. One at a time.
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

let host: ((node: ReactNode) => void) | null = null;

/** where the layer is drawn: once, at the root of the module */
export function PortalHost() {
  const [node, setNode] = useState<ReactNode>(null);
  useEffect(() => { host = setNode; return () => { if (host === setNode) host = null; }; }, []);
  return node ? <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]}>{node}</View> : null;
}

/** what the layer shows while this is mounted; it follows every render of its owner */
export function Portal(props: { children: ReactNode }) {
  useEffect(() => { if (host) host(props.children); });
  useEffect(() => () => { if (host) host(null); }, []);
  return null;
}
