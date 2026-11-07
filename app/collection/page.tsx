import { Suspense } from "react";
import Link from "next/link";
import CutoutTitle from "../components/CutoutTitle";
import CdCase from "../components/CdCase";
import Loading from "../components/Loading";
import StarField from "../components/StarField";
import { loadCollection } from "@/lib/session";
import type { SimplifiedPlaylist } from "@/lib/spotify";

/** Only names made of letters/digits we have cutouts for; anything else falls back. */
const cutoutable = (name: string) =>
  /[A-Z0-9]/i.test(name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

// 80px letters on wide screens; narrower screens shrink, then wrap (see CutoutTitle).
const TITLE_SIZE = { maxHeight: "80px", wordGap: 1.1 };

async function Title() {
  // Same cached request as Playlists() below; on errors the title stays generic.
  const result = await loadCollection();
  const name = result.ok ? result.me.display_name?.trim() || null : null;
  if (!name || !cutoutable(name)) return <CutoutTitle text="My Mixes" {...TITLE_SIZE} />;
  // Long full names would wrap over several lines, so use just the first name.
  const short = name.length > 14 ? name.split(/\s+/)[0] : name;
  return <CutoutTitle text={`${short}'s Mixes`} {...TITLE_SIZE} />;
}

async function Playlists() {
  const result = await loadCollection();
  if (!result.ok) {
    const text =
      result.status === 0
        ? "Couldn't reach Spotify. Check your connection and reload."
        : result.status === 429
          ? // Development Mode apps get a limited number of Spotify requests.
            "Spotify is limiting requests right now. Give it a few minutes, then reload."
          : result.status === 403
            ? // Development Mode apps only serve accounts the owner added in the Developer Dashboard.
              "This Spotify account isn't on Mixtape's guest list yet. Ask the owner to add the email you use for Spotify, then log out and log in again."
            : `Spotify didn't answer properly (error ${result.status}). Try again in a minute.`;
    return <p className="max-w-xl text-center text-2xl text-black">{text}</p>;
  }
  const { me, playlists } = result;
  // Spotify's Development Mode only lets apps read the track list of playlists the
  // user owns or collaborates on. Others (followed playlists) can still be *played*,
  // so they skip the tracklist and go straight to the player.
  const canListTracks = (p: SimplifiedPlaylist) => p.owner.id === me.id || p.collaborative;
  console.info(
    `[collection] ${playlists.length} playlists, ${playlists.filter((p) => !canListTracks(p)).length} made by others`,
  );

  if (playlists.length === 0) {
    return <p className="text-2xl text-black">No playlists found on your Spotify account.</p>;
  }

  return (
    // Up to 3 cases a row, spread across the full width. A column is never
    // narrower than 15rem (or a third of the row), so on smaller screens columns
    // drop to the next row instead of the cases shrinking or touching.
    <ul
      className="grid w-full justify-items-center gap-x-12 gap-y-16 sm:gap-y-20"
      style={{
        gridTemplateColumns:
          "repeat(auto-fill, minmax(max(min(100%, 15rem), calc((100% - 2 * 3rem) / 3)), 1fr))",
      }}
    >
      {playlists.map((p) => (
        <li key={p.id} className="w-full max-w-[22rem]">
          <Link
            href={canListTracks(p) ? `/tracklist/${p.id}` : `/player/${p.id}`}
            className="group flex flex-col items-center gap-2"
          >
            <div className="w-full transition-transform duration-200 group-hover:-translate-y-1 group-hover:rotate-1">
              <CdCase cover={p.images?.[0]?.url} />
            </div>
            <span className="text-center text-lg leading-tight text-black sm:text-2xl">
              {p.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// One loading screen for the whole page: it appears once the name and the
// playlists are both in, rather than piece by piece.
export default function CollectionPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CollectionContent />
    </Suspense>
  );
}

function CollectionContent() {
  return (
    <div className="relative isolate flex min-h-screen flex-1 flex-col items-center gap-10 bg-[#f4f2ec] px-6 pb-16 sm:px-10">
      {/* Same stars as the login and track list pages, under the plastic texture. */}
      <StarField color="#fff" outline />
      {/* Plastic texture over the pale off-white: soft light at 80% opacity. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[url('/assets/plastic-big.png')] bg-cover bg-center opacity-80 mix-blend-soft-light"
      />
      <header className="w-full px-4 pt-10 pb-10 sm:pt-14 sm:pb-16">
        <Title />
      </header>
      <Playlists />
      {/* mt-auto: sits at the very bottom when there's little above it (no
          playlists, an error); pt-10 keeps the usual gap after a full grid. */}
      <form action="/api/auth/logout" method="post" className="mt-auto pt-10">
        <button aria-label="Logout" className="transition-transform duration-200 hover:scale-110 active:scale-95">
          <CutoutTitle text="Logout" as="span" oneLine level letterHover={false} maxHeight="1.75rem" minHeight="1.5rem" />
        </button>
      </form>
    </div>
  );
}
