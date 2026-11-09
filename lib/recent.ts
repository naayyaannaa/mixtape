// Recently opened playlists, newest first, kept in a cookie so the collection
// page (rendered on the server) can sort by it without a flash of the old order.
// Safe to import from client and server code alike.

export const RECENT_COOKIE = "mixtape_recent";
const MAX = 50; // 50 ids × 23 chars stays well under the 4 KB cookie limit
const SEP = "."; // Spotify ids are base62, so a dot never appears in one

export function parseRecent(value: string | undefined): string[] {
  return value ? value.split(SEP).filter((id) => /^[A-Za-z0-9]+$/.test(id)) : [];
}

/** Browser only: move this playlist to the front of the list. */
export function rememberOpened(playlistId: string) {
  const current = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${RECENT_COOKIE}=`))
    ?.slice(RECENT_COOKIE.length + 1);
  const ids = [playlistId, ...parseRecent(current).filter((id) => id !== playlistId)].slice(0, MAX);
  document.cookie = `${RECENT_COOKIE}=${ids.join(SEP)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** Opened playlists first (most recent first), the rest in Spotify's order. */
export function sortByRecent<T extends { id: string }>(items: T[], recent: string[]): T[] {
  const rank = new Map(recent.map((id, i) => [id, i]));
  const never = recent.length; // sort is stable, so these keep Spotify's order
  return [...items].sort((a, b) => (rank.get(a.id) ?? never) - (rank.get(b.id) ?? never));
}
