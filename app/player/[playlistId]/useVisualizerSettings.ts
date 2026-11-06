import { useCallback, useMemo, useSyncExternalStore } from "react";

/** How the background looks; kept in localStorage so it sticks across songs and visits. */
export type VisualizerSettings = {
  /** Degrees to turn the accent colours (all but the main one) around the colour wheel (-180…180; 0 = as on the cover). */
  hueShift: number;
  /** 0 = very soft blend … 0.6 = soft round blobs (default) … 1 = marbled streaks. */
  noise: number;
  /** -1 = saturated / vivid … 0 = as is … 1 = whiter / pastel. */
  brightness: number;
};

const KEY = "mixtape:visualizer-v5"; // v5: noise rescaled (0.6 = soft blobs)
const DEFAULTS: VisualizerSettings = { hueShift: 0, noise: 0.6, brightness: 0 };
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key === KEY && fn(); // other tabs
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
};
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return ""; // storage blocked
  }
};

export function useVisualizerSettings() {
  // The raw string is the snapshot (stable between renders); "" on the server.
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const settings = useMemo<VisualizerSettings>(() => {
    try {
      return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
    } catch {
      return DEFAULTS;
    }
  }, [raw]);

  const update = useCallback(
    (patch: Partial<VisualizerSettings>) => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...settings, ...patch }));
      } catch {}
      listeners.forEach((fn) => fn());
    },
    [settings],
  );

  return [settings, update, () => update(DEFAULTS)] as const;
}
