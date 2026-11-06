"use client";

import { useEffect, useRef, useState } from "react";
import PixelIcon from "../../components/PixelIcon";
import { HUE_RANGE, TONE_RANGE, hslToRgb } from "./MeshBackground";
import type { VisualizerSettings } from "./useVisualizerSettings";

const css = (h: number) => `rgb(${hslToRgb([((h % 1) + 1) % 1, 0.75, 0.55]).map(Math.round).join(" ")})`;

/** Top-right button + popover with the background's colour and texture sliders. */
export default function VisualizerPanel({
  settings,
  onChange,
  onReset,
  centerHue,
}: {
  settings: VisualizerSettings;
  onChange: (patch: Partial<VisualizerSettings>) => void;
  onReset: () => void;
  /** Hue (0–1) of the cover's first accent colour, before any shift: the slider's centre. */
  centerHue: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Track: black, then the full colour wheel centred on the cover's own accent
  // colour, then white.
  const span = 2 * (HUE_RANGE + TONE_RANGE);
  const at = (deg: number) => `${(((deg + HUE_RANGE + TONE_RANGE) / span) * 100).toFixed(1)}%`;
  const stops = Array.from({ length: 13 }, (_, i) => {
    const deg = (i - 6) * 30;
    return `${css(centerHue + deg / 360)} ${at(deg)}`;
  });
  const hueTrack = `linear-gradient(to right, #000 0%, #000 ${at(-HUE_RANGE - TONE_RANGE * 0.6)}, ${stops.join(", ")}, #fff ${at(HUE_RANGE + TONE_RANGE * 0.6)}, #fff 100%)`;

  // Swatch: what the slider is on (black / white at the ends).
  const v = settings.hueShift;
  const swatch =
    v <= -HUE_RANGE - TONE_RANGE / 2 ? "#000" : v >= HUE_RANGE + TONE_RANGE / 2 ? "#fff" : css(centerHue + v / 360);

  return (
    <div ref={rootRef} className="relative" data-own-keys>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Background settings"
        aria-expanded={open}
        className="transition-transform active:scale-90"
      >
        <PixelIcon name="sliders" size={24} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-4 flex w-72 flex-col gap-4 bg-black/45 p-5 text-xl text-white shadow-[4px_4px_0_rgba(0,0,0,0.5)] backdrop-blur-md">
          <label className="flex flex-col gap-2">
            <span className="flex items-center justify-between">
              Colour
              <span className="size-5 outline outline-1 outline-white/40" style={{ background: swatch }} />
            </span>
            <input
              type="range"
              min={-HUE_RANGE - TONE_RANGE}
              max={HUE_RANGE + TONE_RANGE}
              step={1}
              value={settings.hueShift}
              onChange={(e) => onChange({ hueShift: Number(e.target.value) })}
              className="pixel-range"
              style={{ background: hueTrack }}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span>Noise</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.noise}
              onChange={(e) => onChange({ noise: Number(e.target.value) })}
              className="pixel-range"
              style={{ background: "rgb(255 255 255 / 0.35)" }}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span>Brightness</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={settings.brightness}
              onChange={(e) => onChange({ brightness: Number(e.target.value) })}
              className="pixel-range"
              style={{ background: "linear-gradient(to right, #ff1f6b, #b57aa0 50%, #fff)" }}
            />
          </label>

          <button onClick={onReset} className="self-center text-xl opacity-80 transition hover:opacity-100 active:scale-95">
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
