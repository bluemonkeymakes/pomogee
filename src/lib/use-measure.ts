import { useEffect, useState, type RefObject } from "react";

export interface Size {
  width: number;
  height: number;
}

/** Track an element's content-box size via ResizeObserver. Returns {0,0} until
 * the first observation. Transforms (e.g. scale()) don't affect the reported
 * size, so this is safe to read on an element you also scale. */
export function useMeasure<T extends HTMLElement>(ref: RefObject<T | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Track the viewport size. Used to decide the app's compact (short-bar) mode,
 * which the header/tabs and timer all key off of. */
export function useWindowSize(): Size {
  const [size, setSize] = useState<Size>(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  }));
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}
