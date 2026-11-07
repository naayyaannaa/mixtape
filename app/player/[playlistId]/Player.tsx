"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import PixelIcon from "../../components/PixelIcon";
import { toggleFullscreen } from "../../components/FullscreenKey";
import Controls from "../Controls";
import RetroWindow from "../RetroWindow";
import { PREMIUM_MESSAGE, usePlayback, type Start } from "../PlaybackProvider";
import Disc from "./Disc";
import MeshBackground, { accentHue, shiftPalette, useCoverPalette } from "./MeshBackground";
import VisualizerPanel from "./VisualizerPanel";
import { useVisualizerSettings } from "./useVisualizerSettings";
import ProgressBar from "./ProgressBar";
import { usePictureInPicture } from "./usePictureInPicture";
import { useIdle } from "./useIdle";
import type { PlaylistTrack } from "@/lib/playlist";

/** Hide everything but the disc and background after this long without mouse movement. */
const IDLE_MS = 30_000;

/**
 * The full-screen player. Playback itself lives in <PlaybackProvider> (root
 * layout), so leaving this page keeps the music going in the mini player.
 */
export default function Player({
  playlistId,
  tracks,
  requestedStart,
}: {
  playlistId: string;
  /** null = a followed playlist whose track list Spotify won't share with this app. */
  tracks: PlaylistTrack[] | null;
  /** Track to start, or null to keep what's already playing from this playlist. */
  requestedStart: Start | null;
}) {
  const playback = usePlayback();
  const { now, paused, time, message, open, session } = playback;
  const noPremium = message === PREMIUM_MESSAGE;

  // Props from the server are new objects on every render; compare by value.
  const startKey = requestedStart && JSON.stringify(requestedStart);
  useEffect(() => {
    open(playlistId, tracks, startKey ? (JSON.parse(startKey) as Start) : null);
  }, [open, playlistId, tracks, startKey]);

  // Keep the address on the song that's playing (next/previous, end of a song…),
  // so a refresh carries on from it. replaceState: no navigation, no reload.
  const onThisPlaylist = session?.playlistId === playlistId;
  useEffect(() => {
    if (!onThisPlaylist) return;
    let query: string | null = null;
    if (tracks) {
      if (now.position !== undefined) query = `?track=${now.position + 1}`;
    } else if (now.uri?.startsWith("spotify:track:")) {
      query = `?song=${now.uri.slice("spotify:track:".length)}`;
    }
    if (query && query !== window.location.search) {
      window.history.replaceState(null, "", `${window.location.pathname}${query}`);
    }
  }, [onThisPlaylist, tracks, now.position, now.uri]);

  const pip = usePictureInPicture();

  // Followed playlists have no track list, so there's no number to show.
  const trackNumber = tracks && now.position !== undefined ? now.position + 1 : null;
  const coverPalette = useCoverPalette(now.cover);
  const [look, setLook, resetLook] = useVisualizerSettings();
  const palette = shiftPalette(coverPalette, look.hueShift);

  const controls = {
    paused,
    onPrevious: playback.previous,
    onPlayPause: playback.playPause,
    onNext: playback.next,
  };

  // Keyboard: Space / K = play/pause, ← = previous, → = next (these work in the
  // pop-out mini player too). F = full screen is app-wide (<FullscreenKey>).
  const controlsRef = useRef(controls);
  useEffect(() => {
    controlsRef.current = controls;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      // Text fields and the background panel's sliders keep their own keys (arrows etc.).
      if (el?.closest("input:not([type=range]), textarea, select, [contenteditable], [data-own-keys]")) return;
      const c = controlsRef.current;
      const action =
        e.key === " " || e.key === "k" || e.key === "K" || e.key === "MediaPlayPause"
          ? c.onPlayPause
          : e.key === "ArrowRight" || e.key === "MediaTrackNext"
            ? c.onNext
            : e.key === "ArrowLeft" || e.key === "MediaTrackPrevious"
              ? c.onPrevious
              : null;
      if (!action) return;
      e.preventDefault(); // stop Space from also "clicking" a focused button or scrolling
      action();
    };
    const targets: Window[] = [window];
    if (pip.pipWindow) targets.push(pip.pipWindow);
    targets.forEach((w) => w.addEventListener("keydown", onKey));
    return () => targets.forEach((w) => w.removeEventListener("keydown", onKey));
  }, [pip.pipWindow]);

  // Screen-saver mode: after a while without mouse movement the top bar (track
  // list / home links, background controls, pop-out, full screen, track number)
  // fades out. The disc, song, artist and playback controls stay.
  const idle = useIdle(IDLE_MS);
  const fade = `transition-opacity duration-700 ${idle ? "pointer-events-none opacity-0" : "opacity-100"}`;

  return (
    <div
      className={`relative isolate flex flex-1 flex-col items-center px-6 pb-12 pt-6 transition-colors duration-1000 sm:px-10 ${idle ? "cursor-none" : ""}`}
      style={{ color: palette.text }}
    >
      <MeshBackground colors={palette.colors} noise={look.noise} brightness={look.brightness} />
      {/* relative: the background-settings popup lines up with its right edge. */}
      <header className={`relative z-10 flex w-full items-center justify-between ${fade}`}>
        <nav className="flex items-center gap-6">
          {tracks ? (
            <>
              <Link href={`/tracklist/${playlistId}`} aria-label="Back to track list">
                <PixelIcon name="back" size={26} />
              </Link>
              <Link href="/collection" aria-label="Collection">
                <PixelIcon name="home" size={32} />
              </Link>
            </>
          ) : (
            // Someone else's playlist: no track list to go back to, so back = collection.
            <Link href="/collection" aria-label="Back to collection">
              <PixelIcon name="back" size={26} />
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-6">
          <VisualizerPanel
            settings={look}
            onChange={setLook}
            onReset={resetLook}
            centerHue={accentHue(coverPalette)}
          />
          {pip.supported && (
            <button onClick={() => void pip.open()} aria-label="Pop out mini player">
              <PixelIcon name="pip" size={24} />
            </button>
          )}
          <button onClick={() => void toggleFullscreen()} aria-label="Toggle full screen">
            <PixelIcon name="fullscreen" size={24} />
          </button>
          {trackNumber && <p className="text-3xl">Track {trackNumber}</p>}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6">
        {/* No Premium: nothing can play, but the disc keeps spinning with its note. */}
        <Disc cover={now.cover} spinning={!paused || noPremium} scribble={noPremium ? "sorry :(" : undefined} />

        <div className="flex flex-col items-center text-center">
          <h1 className="text-4xl leading-tight sm:text-5xl">{now.name}</h1>
          <p className="text-2xl sm:text-3xl">{now.artists}</p>
        </div>

        <div className="flex w-full flex-col items-center gap-6">
          <ProgressBar position={time.position} duration={time.duration} onSeek={playback.seek} />

          <Controls
            {...controls}
            shuffle={playback.shuffle}
            onShuffle={playback.toggleShuffle}
            repeat={playback.repeat}
            onRepeat={playback.cycleRepeat}
            className="gap-10 sm:gap-20"
            size={40}
          />

          {message && <p className="text-xl">{message}</p>}
        </div>
      </main>

      {/* Pop-out (picture-in-picture) window: the same old-Windows player as the mini player. */}
      {pip.pipWindow &&
        createPortal(
          <RetroWindow
            now={now}
            {...controls}
            onClose={() => pip.pipWindow?.close()}
            closeLabel="Close pop-out player"
            className="h-screen w-screen"
            discClassName="w-[min(58vw,40vh)]"
          />,
          pip.pipWindow.document.body,
        )}
    </div>
  );
}
