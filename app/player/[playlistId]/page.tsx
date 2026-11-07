import { Suspense } from "react";
import { loadPlaylistTracks } from "@/lib/session";
import Player from "./Player";
import Loading from "../../components/Loading";
import type { Start } from "../PlaybackProvider";

async function PlayerLoader({ params, searchParams }: PageProps<"/player/[playlistId]">) {
  const { playlistId } = await params;
  const { track, song } = await searchParams;
  const result = await loadPlaylistTracks(playlistId);

  // 403 = a playlist the user follows but doesn't own: Spotify won't list its
  // tracks to this app, but it can still be played. The player then shows
  // whatever Spotify reports as the current song.
  if (!result.ok && result.status !== 403) {
    return (
      <p className="m-auto max-w-xl text-center text-3xl text-white">
        {result.status === 429
          ? "Spotify is limiting requests right now. Give it a few minutes, then reload."
          : "Couldn't open this playlist."}
      </p>
    );
  }
  const tracks = result.ok ? result.tracks : null;

  if (tracks && tracks.length === 0) {
    return <p className="m-auto text-3xl text-white">This mixtape is empty.</p>;
  }

  // Where to start: ?track= is the 1-based number shown on the tracklist; ?song=
  // is a Spotify track id (followed playlists, whose numbers we can't see). The
  // player keeps both up to date, so a refresh carries on with the same song.
  // Neither: keep whatever is already playing from this playlist.
  let start: Start | null = null;
  const wanted = typeof track === "string" ? Number(track) - 1 : NaN;
  if (tracks && Number.isInteger(wanted)) {
    start = { position: (tracks.find((t) => t.position === wanted) ?? tracks[0]).position };
  } else if (typeof song === "string" && /^[A-Za-z0-9]{22}$/.test(song)) {
    start = { uri: `spotify:track:${song}` };
  }

  return (
    // Keyed by playlist only: picking another song re-uses the same player.
    <Player key={playlistId} playlistId={playlistId} tracks={tracks} requestedStart={start} />
  );
}

export default function PlayerPage(props: PageProps<"/player/[playlistId]">) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col bg-white">
      <Suspense fallback={<Loading />}>
        <PlayerLoader {...props} />
      </Suspense>
    </div>
  );
}
