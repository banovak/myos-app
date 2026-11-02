// The dashboard's scroll position and a lock on it, shared without a
// re-render: the body card needs the offset to measure where it sits, and
// it locks the page while a point is being dragged or the drawing is pinched.
import { useEffect, useReducer } from "react";

export const pageScroll = {
  y: 0,
  lock: false,
  subs: new Set<() => void>(),
  setLock(l: boolean) {
    if (this.lock === l) return;
    this.lock = l;
    this.subs.forEach((f) => f());
  },
};

export function usePageLock(): boolean {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    pageScroll.subs.add(bump);
    return () => { pageScroll.subs.delete(bump); };
  }, []);
  return pageScroll.lock;
}
