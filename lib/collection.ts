import { cacheLife } from "next/cache";
import { LIKED_ID, LIKED_NAME } from "./liked";
import { SpotifyError, spotifyGet, type Paging, type SimplifiedPlaylist, type SpotifyImage } from "./spotify";

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
 * Liked Songs as a playlist-shaped entry (cover: the newest liked song's album
 * art), or null if there are none, or the login predates the library permission.
 */
async function getLiked(token: string): Promise<Omit<SimplifiedPlaylist, "owner"> | null> {
  try {
    const page = await spotifyGet<Paging<{ track: { album?: { images?: SpotifyImage[] } } | null }>>(
      "/me/tracks?limit=1",
      token,
    );
    if (page.total === 0) return null;
    return {
      id: LIKED_ID,
      name: LIKED_NAME,
      collaborative: false,
      images: page.items[0]?.track?.album?.images ?? null,
    };
  } catch (e) {
    // 403 = logged in before Liked Songs needed the library permission:
    // the rest of the collection still shows; logging in again adds it.
    console.error("[collection] liked songs:", e instanceof SpotifyError ? e.message : e);
    return null;
  }
}

/**
 * The signed-in user and their playlists (Liked Songs first), cached per token
 * for a few minutes: going back to the collection doesn't ask Spotify again,
 * which keeps the app inside Spotify's request quota.
 *
 * Errors are *returned*, never thrown: production builds strip error messages
 * crossing a "use cache" boundary.
 */
export async function getCollection(token: string): Promise<CollectionResult> {
  "use cache";
  try {
    const [me, all, liked] = await Promise.all([
      spotifyGet<Me>("/me", token),
      getAllPlaylists(token),
      getLiked(token),
    ]);
    cacheLife("minutes");
    // Liked Songs is the user's own library, so its track list can be shown.
    const likedEntry = liked && { ...liked, owner: { id: me.id, display_name: me.display_name } };
    return { ok: true, me, playlists: likedEntry ? [likedEntry, ...all] : all };
  } catch (e) {
    cacheLife("seconds"); // a blip or a quota limit: try again soon
    if (e instanceof SpotifyError) return { ok: false, status: e.status, message: e.message };
    return { ok: false, status: 0, message: String(e) };
  }
}
