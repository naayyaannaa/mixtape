import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, SpotifyError } from "./spotify";
import { getLikedTracks, getPlaylistTracks } from "./playlist";
import { LIKED_ID } from "./liked";
import { getCollection } from "./collection";

/** Clears the dead login cookies, then shows the login page (see the route). */
const SESSION_EXPIRED = "/api/auth/expired";

/** The current Spotify access token, or a redirect to /login. */
export async function requireAccessToken() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect("/login");
  return token;
}

/** Run a Spotify call; an expired/invalid token sends the user to /login. */
export async function withSpotify<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await requireAccessToken();
  try {
    return await fn(token);
  } catch (e) {
    if (e instanceof SpotifyError && e.status === 401) redirect(SESSION_EXPIRED);
    throw e;
  }
}

/** A playlist's tracks; an expired token sends the user to /login. */
export async function loadPlaylistTracks(playlistId: string) {
  const token = await requireAccessToken();
  const result =
    playlistId === LIKED_ID ? await getLikedTracks(token) : await getPlaylistTracks(playlistId, token);
  if (!result.ok) {
    if (result.status === 401) redirect(SESSION_EXPIRED);
    console.error(`Playlist ${playlistId}: Spotify ${result.status} ${result.message}`);
  }
  return result;
}

/**
 * The user and their playlists (cached); an expired token sends the user to
 * /login. Wrapped in React's cache() so the title and the list share one call.
 */
export const loadCollection = cache(async () => {
  const token = await requireAccessToken();
  const result = await getCollection(token);
  if (!result.ok) {
    if (result.status === 401) redirect(SESSION_EXPIRED);
    console.error("[collection]", result.status, result.message);
  }
  return result;
});
