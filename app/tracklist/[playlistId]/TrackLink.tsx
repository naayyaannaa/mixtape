"use client";

import Link from "next/link";
import { usePlayback } from "../../player/PlaybackProvider";

/**
 * A track on the tracklist. Clicking it starts the song straight away and opens
 * the player at the same time, instead of waiting for the player page to load
 * before asking Spotify to play.
 */
export default function TrackLink({
  playlistId,
  position,
  className,
  style,
  children,
}: {
  playlistId: string;
  /** 0-based position in the playlist. */
  position: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { prime } = usePlayback();
  return (
    <Link
      href={`/player/${playlistId}?track=${position + 1}`}
      className={className}
      style={style}
      onClick={(e) => {
        // Opening in a new tab/window: let that tab start it.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        prime(playlistId, position);
      }}
    >
      {children}
    </Link>
  );
}
