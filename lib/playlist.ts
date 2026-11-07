import { cacheLife } from "next/cache";
import type { SpotifyImage } from "./spotify";

type ApiTrack = {
  type?: string;
  uri: string;
  name: string;
  artists?: { name: string }[];
  album?: { images?: SpotifyImage[] };
  images?: SpotifyImage[]; // podcast episodes
};
type ApiPlaylistItem = { track?: ApiTrack | null; item?: ApiTrack | null };

export type PlaylistTrack = {
  /** 0-based position in the playlist — what Spotify's play `offset` expects. */
  position: number;
  uri: string;
  name: string;
  artists: string;
  cover?: string;
};

// Only ask Spotify for the fields we display (items are `item` in the current API,
// `track` in older responses). Keeps each page of a big playlist small.
const TRACK_FIELDS = "type,uri,name,artists(name),album(images),images";
const ITEMS_FIELDS = `next,items(item(${TRACK_FIELDS}),track(${TRACK_FIELDS}))`;

export type TracksResult =
  | { ok: true; tracks: PlaylistTrack[] }
  | { ok: false; status: number; message: string };

/**
 * Every track in a playlist (following Spotify's pagination), or the Spotify
 * error status. Cached per token + playlist so opening the player right after
 * the tracklist doesn't download the whole playlist again.
 *
 * Errors are *returned*, never thrown: production builds strip error messages
 * crossing a "use cache" boundary, so a thrown 403 would turn into a crash.
 */
export async function getPlaylistTracks(
  playlistId: string,
  accessToken: string,
): Promise<TracksResult> {
  "use cache";

  let url: string | null =
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items` +
    `?limit=50&fields=${encodeURIComponent(ITEMS_FIELDS)}`;

  const items: ApiPlaylistItem[] = [];
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      // 403/404 won't change soon (ownership); anything else may be a blip.
      if (res.status === 403 || res.status === 404) cacheLife("minutes");
      else cacheLife("seconds");
      return { ok: false, status: res.status, message: await res.text() };
    }
    const page: { items: ApiPlaylistItem[]; next: string | null } = await res.json();
    items.push(...page.items);
    url = page.next;
  }

  cacheLife("minutes");
  return { ok: true, tracks: toTracks(items) };
}

/**
 * The user's Liked Songs (newest first, as in Spotify), in the same shape as a
 * playlist's tracks. Needs the user-library-read scope (403 without it).
 */
export async function getLikedTracks(accessToken: string): Promise<TracksResult> {
  "use cache";

  let url: string | null = "https://api.spotify.com/v1/me/tracks?limit=50";
  const items: ApiPlaylistItem[] = [];
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      cacheLife("seconds");
      return { ok: false, status: res.status, message: await res.text() };
    }
    const page: { items: ApiPlaylistItem[]; next: string | null } = await res.json();
    items.push(...page.items);
    url = page.next;
  }
  cacheLife("minutes");
  return { ok: true, tracks: toTracks(items) };
}

/** A playlist's name (null if Spotify won't say), cached like its tracks. */
export async function getPlaylistName(playlistId: string, accessToken: string): Promise<string | null> {
  "use cache";
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}?fields=name`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    cacheLife("seconds");
    console.error(`[tracklist] name of ${playlistId}: Spotify ${res.status}`);
    return null;
  }
  cacheLife("minutes");
  return ((await res.json()) as { name?: string }).name ?? null;
}

function toTracks(items: ApiPlaylistItem[]): PlaylistTrack[] {
  const tracks: PlaylistTrack[] = [];
  items.forEach((it, position) => {
    const t = it?.item ?? it?.track;
    if (!t?.name) return; // removed/unavailable items: keep positions aligned, skip display
    tracks.push({
      position,
      uri: t.uri,
      name: t.name,
      artists: (t.artists ?? []).map((a) => a.name).join(", "),
      cover: (t.album?.images ?? t.images)?.[0]?.url,
    });
  });
  return tracks;
}
