"use client";

import { useEffect } from "react";

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (e) {
    console.info("[mixtape] full screen not allowed:", e);
  }
}

/** F toggles full screen on every page (Escape leaves it, as browsers do). */
export default function FullscreenKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      // Typing in a field keeps its letters.
      const el = e.target as HTMLElement | null;
      if (el?.closest("input:not([type=range]), textarea, select, [contenteditable]")) return;
      e.preventDefault();
      void toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
