import { Suspense } from "react";
import { loadPlaylistTracks } from "@/lib/session";
import Player from "./Player";

async function PlayerLoader({ params, searchParams }: PageProps<"/player/[playlistId]">) {
  const { playlistId } = await params;
  const { track } = await searchParams;
  const result = await loadPlaylistTracks(playlistId);

  // 403 = a playlist the user follows but doesn't own: Spotify won't list its
  // tracks to this app, but it can still be played. The player then shows
  // whatever Spotify reports as the current song.
  if (!result.ok && result.status !== 403) {
    return <p className="m-auto text-3xl text-white">Couldn&apos;t open this playlist.</p>;
  }
  const tracks = result.ok ? result.tracks : null;

  // ?track= is the 1-based track number shown on the tracklist. Without it, the
  // player keeps whatever is already playing from this playlist.
  const wanted = typeof track === "string" ? Number(track) - 1 : null;
  const start =
    tracks && wanted !== null ? (tracks.find((t) => t.position === wanted) ?? tracks[0]) : null;

  if (tracks && tracks.length === 0) {
    return <p className="m-auto text-3xl text-white">This mixtape is empty.</p>;
  }

  return (
    <Player
      key={`${playlistId}-${start?.position ?? "current"}`}
      playlistId={playlistId}
      tracks={tracks}
      requestedTrack={start?.position ?? null}
    />
  );
}

export default function PlayerPage(props: PageProps<"/player/[playlistId]">) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col bg-grey-noise">
      <Suspense>
        <PlayerLoader {...props} />
      </Suspense>
    </div>
  );
}
