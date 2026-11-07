import { Suspense } from "react";
import Link from "next/link";
import CutoutTitle from "../../components/CutoutTitle";
import PixelIcon from "../../components/PixelIcon";
import StarField from "../../components/StarField";
import Loading from "../../components/Loading";
import TrackLink from "./TrackLink";
import { loadPlaylistTracks, requireAccessToken } from "@/lib/session";
import { getPlaylistName } from "@/lib/playlist";

// Small alternating tilts so each strip looks hand-glued.
const TILTS = [-0.6, 0.4, -0.3, 0.7, -0.5, 0.2, 0.5, -0.7];

async function Tracks({ params }: { params: PageProps<"/tracklist/[playlistId]">["params"] }) {
  const { playlistId } = await params;

  const result = await loadPlaylistTracks(playlistId);
  if (!result.ok) {
    return (
      <p className="max-w-xl text-center text-2xl text-white">
        {result.status === 429
          ? "Spotify is limiting requests right now. Give it a few minutes, then reload."
          : "Couldn't open this playlist."}
      </p>
    );
  }
  const { tracks } = result;

  if (tracks.length === 0) {
    return <p className="text-2xl text-white">This mixtape is empty.</p>;
  }

  return (
    // Numbered across each row: 1 | 2, 3 | 4, …
    <ol className="grid w-full max-w-4xl grid-cols-1 gap-x-8 sm:grid-cols-2">
      {tracks.map((t, i) => (
        <li key={t.position} className="mb-3 min-w-0">
          <TrackLink
            playlistId={playlistId}
            position={t.position}
            className="block bg-[url('/assets/paper.png')] bg-size-[100%_100%] bg-no-repeat px-7 py-3 text-xl text-black transition-transform hover:scale-[1.02] sm:text-2xl"
            style={{ rotate: `${TILTS[i % TILTS.length]}deg` }}
          >
            <span className="block truncate">
              {t.position + 1}. {t.name}
            </span>
          </TrackLink>
        </li>
      ))}
    </ol>
  );
}

/** The playlist's name (metadata Spotify shares for any playlist). */
async function PlaylistName({ params }: { params: PageProps<"/tracklist/[playlistId]">["params"] }) {
  const { playlistId } = await params;
  const name = await getPlaylistName(playlistId, await requireAccessToken());
  if (!name) return null; // the track list below still shows
  return <p className="mt-10 text-center text-3xl text-white sm:mt-14 sm:text-4xl">{name}</p>;
}

// One loading screen for the whole page: it appears once the name and tracks
// are both in, rather than piece by piece.
export default function TracklistPage(props: PageProps<"/tracklist/[playlistId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <TracklistContent {...props} />
    </Suspense>
  );
}

function TracklistContent(props: PageProps<"/tracklist/[playlistId]">) {
  return (
    <div
      className="relative isolate flex min-h-screen flex-1 flex-col items-center gap-8 px-4 pb-16"
      style={{
        // Same as the login page: plastic texture over the navy, soft light.
        background: "url('/assets/plastic-big.png') center / cover no-repeat fixed, #172029",
        backgroundBlendMode: "soft-light",
      }}
    >
      <StarField />
      <header className="relative w-full px-4 pt-10 sm:pt-14">
        <Link
          href="/collection"
          aria-label="Back to collection"
          className="absolute left-4 top-6 text-white sm:left-8"
        >
          <PixelIcon name="back" size={26} />
        </Link>
        <CutoutTitle text="Track List" />
        <PlaylistName params={props.params} />
      </header>
      <Tracks params={props.params} />
    </div>
  );
}
