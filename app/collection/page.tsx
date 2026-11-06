import { Suspense, cache } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import CutoutTitle from "../components/CutoutTitle";
import CdCase from "../components/CdCase";
import { withSpotify } from "@/lib/session";
import { SpotifyError, spotifyGet, type Paging, type SimplifiedPlaylist } from "@/lib/spotify";

/** Every playlist in the user's library (owned and followed), 50 per page. */
async function getAllPlaylists(token: string) {
  const all: SimplifiedPlaylist[] = [];
  for (let offset = 0; ; offset += 50) {
    const page = await spotifyGet<Paging<SimplifiedPlaylist>>(
      `/me/playlists?limit=50&offset=${offset}`,
      token,
    );
    all.push(...page.items.filter(Boolean));
    if (!page.next) return all;
  }
}

type Me = { id: string; display_name: string | null };
/** The signed-in user, fetched once per request (title and playlists both need it). */
const getMe = cache((token: string) => spotifyGet<Me>("/me", token));

/** Only names made of letters/digits we have cutouts for; anything else falls back. */
const cutoutable = (name: string) =>
  /[A-Z0-9]/i.test(name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

async function Title() {
  let name: string | null = null;
  try {
    name = (await withSpotify(getMe)).display_name?.trim() || null;
  } catch (e) {
    unstable_rethrow(e); // let Next's redirect to /login (expired session) through
    // Playlists() below explains Spotify errors; the title just stays generic.
  }
  if (!name || !cutoutable(name)) return <CutoutTitle text="My Mixtapes" />;
  // Long full names shrink every letter to fit one line, so use just the first name.
  const short = name.length > 14 ? name.split(/\s+/)[0] : name;
  return <CutoutTitle text={`${short}'s Mixtapes`} />;
}

async function Playlists() {
  let me: { id: string };
  let playlists: SimplifiedPlaylist[];
  try {
    [me, playlists] = await withSpotify((token) =>
      Promise.all([getMe(token), getAllPlaylists(token)]),
    );
  } catch (e) {
    unstable_rethrow(e); // Next's redirect to /login
    if (!(e instanceof SpotifyError)) {
      // Network trouble (e.g. "fetch failed"): no answer from Spotify at all.
      console.error("[collection]", e);
      return (
        <p className="max-w-xl text-center text-2xl text-white">
          Couldn&apos;t reach Spotify. Check your connection and reload.
        </p>
      );
    }
    console.error("[collection]", e.message);
    // Development Mode apps only serve Spotify accounts the app owner has added
    // in the Developer Dashboard; everyone else gets 403 on every call.
    if (e.status === 403) {
      return (
        <p className="max-w-xl text-center text-2xl text-white">
          This Spotify account isn&apos;t on Mixtape&apos;s guest list yet. Ask the owner to add
          the email you use for Spotify, then log out and log in again.
        </p>
      );
    }
    return (
      <p className="max-w-xl text-center text-2xl text-white">
        Spotify didn&apos;t answer properly (error {e.status}). Try again in a minute.
      </p>
    );
  }
  // Spotify's Development Mode only lets apps read the track list of playlists the
  // user owns or collaborates on. Others (followed playlists) can still be *played*,
  // so they skip the tracklist and go straight to the player.
  const canListTracks = (p: SimplifiedPlaylist) => p.owner.id === me.id || p.collaborative;
  console.info(
    `[collection] ${playlists.length} playlists, ${playlists.filter((p) => !canListTracks(p)).length} made by others`,
  );

  if (playlists.length === 0) {
    return <p className="text-2xl text-white">No playlists found on your Spotify account.</p>;
  }

  return (
    <ul className="grid w-full max-w-6xl grid-cols-4 gap-x-8 gap-y-14 sm:gap-x-14 sm:gap-y-20 sm:px-6">
      {playlists.map((p) => (
        <li key={p.id}>
          <Link
            href={canListTracks(p) ? `/tracklist/${p.id}` : `/player/${p.id}`}
            className="group flex flex-col items-center gap-2"
          >
            <div className="w-full transition-transform duration-200 group-hover:-translate-y-1 group-hover:rotate-1">
              <CdCase cover={p.images?.[0]?.url} />
            </div>
            <span className="text-center text-lg leading-tight text-white sm:text-2xl">
              {p.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function CollectionPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center gap-10 bg-grey-noise px-4 pb-16">
      <header className="w-full px-4 pt-10 pb-10 sm:pt-14 sm:pb-16">
        {/* Same height as the title while the name loads, so nothing jumps. */}
        <Suspense fallback={<div className="h-[min(10vw,5.5rem)]" />}>
          <Title />
        </Suspense>
      </header>
      <Suspense fallback={<p className="text-2xl text-white">Loading your mixtapes…</p>}>
        <Playlists />
      </Suspense>
      <form action="/api/auth/logout" method="post">
        <button className="text-xl text-white/80 underline">Log out</button>
      </form>
    </div>
  );
}
