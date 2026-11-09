"use client";

import Link from "next/link";
import PixelIcon from "../components/PixelIcon";
import { toggleFullscreen } from "../components/FullscreenKey";
import MeshBackground, { accentHue, rgbToHsl, shiftPalette, type Palette } from "../player/[playlistId]/MeshBackground";
import VisualizerPanel from "../player/[playlistId]/VisualizerPanel";
import { useVisualizerSettings } from "../player/[playlistId]/useVisualizerSettings";

// No song, so no cover to take colours from: a fixed pastel set instead
// (pink, lilac, sky, peach). The colour slider turns them like a cover's.
const COLORS: Palette["colors"] = [
  [255, 122, 176],
  [167, 139, 250],
  [125, 211, 252],
  [253, 186, 116],
];
const GUEST_PALETTE: Palette = {
  colors: COLORS,
  text: "#161616",
  baseHue: rgbToHsl(COLORS[0])[0],
  baseIndex: 0,
};

export default function GuestVisualizer() {
  const [look, setLook, resetLook] = useVisualizerSettings();
  const palette = shiftPalette(GUEST_PALETTE, look.hueShift);

  return (
    <div
      className="relative isolate flex min-h-screen flex-1 flex-col px-6 pt-6 sm:px-10"
      style={{ color: palette.text }}
    >
      <MeshBackground colors={palette.colors} noise={look.noise} brightness={look.brightness} />
      {/* relative: the background-settings popup lines up with its right edge. */}
      <header className="relative z-10 flex w-full items-center justify-between">
        <Link href="/login" aria-label="Back to login">
          <PixelIcon name="back" size={26} />
        </Link>
        <div className="flex items-center gap-6">
          <VisualizerPanel
            settings={look}
            onChange={setLook}
            onReset={resetLook}
            centerHue={accentHue(GUEST_PALETTE)}
          />
          <button onClick={() => void toggleFullscreen()} aria-label="Toggle full screen">
            <PixelIcon name="fullscreen" size={24} />
          </button>
        </div>
      </header>
    </div>
  );
}
