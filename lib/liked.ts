/**
 * Route id standing in for the user's Liked Songs: /tracklist/liked, /player/liked.
 * (Spotify ids are 22 base-62 characters, so it can't clash with a real playlist.)
 * Its own module so browser code can import it without the server-side loaders.
 */
export const LIKED_ID = "liked";
export const LIKED_NAME = "Liked Songs";
