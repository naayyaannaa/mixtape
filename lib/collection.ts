import { cacheLife } from "next/cache";
import { SpotifyError, spotifyGet, type Paging, type SimplifiedPlaylist } from "./spotify";

export type Me = { id: string; display_name: string | null };

export type CollectionResult =
  | { ok: true; me: Me; playlists: SimplifiedPlaylist[] }
  /** status 0 = Spotify couldn't be reached at all (network). */
  | { ok: false; status: number; message: string };

/** Every playlist in the user's library (owned and followed), 50 per page. */
async function getAllPlaylists(token: string) {
  const all: SimplifiedPlaylist[] = [];
  for (let offset = 0; ; offset += 50) {
    const page = await spotifyGet<Paging<SimplifiedPlaylist>>(`/me/playlists?limit=50&offset=${offset}`, token);
    all.push(...page.items.filter(Boolean));
    if (!page.next) return all;
  }
}

/**
 * The signed-in user and their playlists, cached per token
 * for a few minutes: going back to the collection doesn't ask Spotify again,
 * which keeps the app inside Spotify's request quota.
 *
 * Errors are *returned*, never thrown: production builds strip error messages
 * crossing a "use cache" boundary.
 */
export async function getCollection(token: string): Promise<CollectionResult> {
  "use cache";
  try {
    const [me, playlists] = await Promise.all([spotifyGet<Me>("/me", token), getAllPlaylists(token)]);
    cacheLife("minutes");
    return { ok: true, me, playlists };
  } catch (e) {
    cacheLife("seconds"); // a blip or a quota limit: try again soon
    if (e instanceof SpotifyError) return { ok: false, status: e.status, message: e.message };
    return { ok: false, status: 0, message: String(e) };
  }
}
