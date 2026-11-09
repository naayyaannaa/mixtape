"use client";

import Link from "next/link";
import PixelIcon from "../components/PixelIcon";
import Disc from "./[playlistId]/Disc";
import MeshBackground, { lightestColor, shiftPalette, useCoverPalette } from "./[playlistId]/MeshBackground";
import { useVisualizerSettings } from "./[playlistId]/useVisualizerSettings";
import type { NowPlaying } from "./PlaybackProvider";

/**
 * The small player as an old-Windows style window: bevelled grey frame, navy
 * title bar with a close box, the song's moving colour background, big centred disc, song in a sunken field and
 * bevelled previous / play / next buttons. Used by the in-page mini player and
 * the pop-out (picture-in-picture) window.
 */
export default function RetroWindow({
  now,
  paused,
  onPrevious,
  onPlayPause,
  onNext,
  onClose,
  closeLabel,
  href,
  className = "",
  discClassName = "w-40",
  style,
  titleBarProps,
}: {
  now: NowPlaying;
  paused: boolean;
  onPrevious: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  /** Without onClose there's no title bar (the pop-out window has the browser's own). */
  onClose?: () => void;
  closeLabel?: string;
  /** Where clicking the disc / song goes (the full player); omit for no link. */
  href?: string;
  className?: string;
  discClassName?: string;
  style?: React.CSSProperties;
  /** e.g. pointer handlers to drag the window by its title bar. */
  titleBarProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  // Same colours and noise as the full player's background.
  const [look] = useVisualizerSettings();
  const palette = shiftPalette(useCoverPalette(now.cover), look.hueShift);
  // Title bar and buttons take the background's lightest colour (follows the
  // song and the colour slider), with text that stays readable on it.
  const accent = lightestColor(palette);

  const btn = "retro-raised flex h-8 w-11 items-center justify-center";
  const disc = <Disc cover={now.cover} spinning={!paused} className={discClassName} />;
  const song = (
    <>
      <p className="truncate text-lg leading-tight">{now.name || "Mixtape"}</p>
      <p className="truncate text-sm leading-tight text-[#404040]">{now.artists}</p>
    </>
  );
  const field = "retro-sunken block w-full bg-white px-2 py-1 text-center text-black";

  return (
    <div
      className={`retro-frame flex flex-col p-[3px] text-white ${className}`}
      style={{ "--retro-face": accent.color, "--retro-ink": accent.text, ...style } as React.CSSProperties}
    >
      {onClose && (
        <div
          {...titleBarProps}
          className={`flex h-7 shrink-0 items-center justify-between gap-2 bg-(--retro-face) pl-2 pr-[3px] text-(--retro-ink) transition-colors duration-1000 ${titleBarProps?.className ?? ""}`}
        >
          <span className="truncate text-lg leading-none">Mixtape</span>
          <button
            onClick={onClose}
            aria-label={closeLabel}
            className="retro-raised flex h-[20px] w-[22px] shrink-0 items-center justify-center"
          >
            <PixelIcon name="close" size={8} />
          </button>
        </div>
      )}

      {/* Sunken body showing the song's colours, like a window's content area. */}
      <div
        className={`retro-sunken relative isolate flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden p-3 ${onClose ? "mt-[3px]" : ""}`}
      >
        <MeshBackground
          colors={palette.colors}
          noise={look.noise}
          brightness={look.brightness}
          className="absolute inset-0"
        />
        {href ? (
          <Link href={href} aria-label="Open player" className="shrink-0">
            {disc}
          </Link>
        ) : (
          disc
        )}
        {href ? (
          <Link href={href} className={field}>
            {song}
          </Link>
        ) : (
          <div className={field}>{song}</div>
        )}
        <div className="flex shrink-0 gap-3">
          <button aria-label="Previous track" onClick={onPrevious} className={btn}>
            <PixelIcon name="previous" size={14} />
          </button>
          <button aria-label={paused ? "Play" : "Pause"} onClick={onPlayPause} className={btn}>
            <PixelIcon name={paused ? "play" : "pause"} size={14} />
          </button>
          <button aria-label="Next track" onClick={onNext} className={btn}>
            <PixelIcon name="next" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
