"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PlaylistTrack } from "@/lib/playlist";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const READY_TIMEOUT_MS = 15_000;
/** How long a tracklist click's head start counts as "this song is already starting". */
const PRIMED_MS = 10_000;

// Shows up in the browser console (and in `next dev`'s log file).
export const log = (...args: unknown[]) => console.info("[mixtape player]", ...args);

export type NowPlaying = {
  /** 0-based position in the playlist, when we know the playlist's tracks. */
  position?: number;
  /** spotify:track:… */
  uri?: string;
  name: string;
  artists: string;
  cover?: string;
};

/** Where to start a playlist: a 0-based track position, or a specific song. */
export type Start = { position: number } | { uri: string };
const startKey = (playlistId: string, start: Start) =>
  `${playlistId}:${"uri" in start ? start.uri : start.position}`;

type Session = {
  playlistId: string;
  /** null = a followed playlist whose track list Spotify won't share with this app. */
  tracks: PlaylistTrack[] | null;
};

type Playback = {
  session: Session | null;
  now: NowPlaying;
  paused: boolean;
  time: { position: number; duration: number };
  message: string | null;
  shuffle: boolean;
  /** off → whole playlist → this song. */
  repeat: Repeat;
  /**
   * Show this playlist in the player. `start` starts that track; null keeps
   * whatever is already playing from this playlist (or starts at the top).
   */
  open: (playlistId: string, tracks: PlaylistTrack[] | null, start: Start | null) => void;
  /**
   * Start a track right away, before the player page has loaded (e.g. on a
   * tracklist click). The page's own open() for the same track then just attaches.
   */
  prime: (playlistId: string, position: number) => void;
  playPause: () => void;
  next: () => void;
  previous: () => void;
  seek: (ms: number) => void;
  toggleShuffle: () => void;
  /** off → repeat playlist → repeat song → off. */
  cycleRepeat: () => void;
  /** Stop and forget the current playlist (hides the mini player). */
  close: () => void;
};

export type Repeat = "off" | "context" | "track";
const REPEAT_MODES: Repeat[] = ["off", "context", "track"]; // = the SDK's repeat_mode 0/1/2

const PlaybackContext = createContext<Playback | null>(null);

export function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used inside <PlaybackProvider>");
  return ctx;
}

// The access token, kept in memory so each Spotify command doesn't first need a
// round trip to our server. Re-fetched after a while, or when Spotify says 401.
const TOKEN_TTL_MS = 5 * 60_000;
let tokenCache: { token: string; at: number } | null = null;

async function getToken(fresh = false): Promise<string> {
  if (!fresh && tokenCache && Date.now() - tokenCache.at < TOKEN_TTL_MS) return tokenCache.token;
  const res = await fetch("/api/auth/token", { cache: "no-store" });
  if (res.status === 401) {
    // Full reload on purpose: session is gone, start fresh at the login page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new Error("Not logged in");
  }
  const { accessToken } = await res.json();
  tokenCache = { token: accessToken, at: Date.now() };
  return accessToken;
}

/** fetch() to the Spotify Web API with our token; retries once with a fresh token on 401. */
async function spotify(path: string, init: { method?: string; body?: unknown } = {}) {
  const send = (token: string) =>
    fetch(`https://api.spotify.com/v1/${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined && { "Content-Type": "application/json" }),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  const res = await send(await getToken());
  return res.status === 401 ? send(await getToken(true)) : res;
}

const EMPTY: NowPlaying = { name: "", artists: "" };

/**
 * Owns the Spotify Web Playback SDK player for the whole app. It lives in the
 * root layout, so the music keeps playing while the user moves between pages.
 */
export default function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState<NowPlaying>(EMPTY);
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState({ position: 0, duration: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  // Mixtapes play in order unless shuffle is switched on here (Spotify would
  // otherwise carry over the account's own shuffle setting).
  const shuffleRef = useRef(false);
  const repeatRef = useRef<Repeat>("off");

  const playerRef = useRef<Spotify.Player | null>(null);
  const deviceRef = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const nowRef = useRef<NowPlaying>(EMPTY);
  /** Playback has started for the current session (so play/pause toggles, not restarts). */
  const startedRef = useRef(false);
  /** What to play once the device is ready / the request in flight (dedupes repeat opens). */
  const wantedRef = useRef<{ playlistId: string; start: Start } | null>(null);
  const inFlightRef = useRef<string | null>(null);
  /**
   * A track just started by prime(). Its player page's open() for the same track
   * only attaches to it (also when React's dev mode opens the page twice).
   */
  const primedRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    nowRef.current = now;
  }, [now]);

  /** PUT/POST a /me/player/… command for our device. */
  const command = useCallback(async (method: "PUT" | "POST", path: string) => {
    const deviceId = deviceRef.current;
    if (!deviceId) return null;
    const sep = path.includes("?") ? "&" : "?";
    return spotify(`me/player/${path}${sep}device_id=${deviceId}`, { method });
  }, []);

  // Ask Spotify to play a playlist on our in-browser device, from a given track.
  const play = useCallback(async (playlistId: string, start: Start) => {
    wantedRef.current = { playlistId, start };
    const deviceId = deviceRef.current;
    if (!deviceId) return; // the "ready" listener plays it once the device exists
    const key = `${startKey(playlistId, start)}:${deviceId}`;
    if (inFlightRef.current === key) return;
    inFlightRef.current = key;

    try {
      const request = () =>
        spotify(`me/player/play?device_id=${deviceId}`, {
          method: "PUT",
          body: { context_uri: `spotify:playlist:${playlistId}`, offset: start },
        });

      let res = await request();
      log(`play request (${startKey(playlistId, start)}) →`, res.status);
      // A brand-new device can take a few seconds to register with Spotify ("Device not found").
      for (let attempt = 1; res.status === 404 && attempt <= 5; attempt++) {
        if (attempt === 2) {
          // Handing playback to the device explicitly often makes Spotify recognise it.
          const t = await spotify("me/player", {
            method: "PUT",
            body: { device_ids: [deviceId], play: false },
          });
          log("transfer playback →", t.status);
        }
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        res = await request();
        log(`play retry ${attempt} →`, res.status);
      }
      if (sessionRef.current?.playlistId !== playlistId) return; // user moved on meanwhile
      if (res.ok) {
        startedRef.current = true;
        setMessage(null);
        // Apply our shuffle choice (off by default), so track order matches the list.
        void command("PUT", `shuffle?state=${shuffleRef.current}`).then((r) =>
          log("shuffle", shuffleRef.current, "→", r?.status),
        );
      } else if (res.status === 403) {
        setMessage("Spotify Premium is needed to play music here.");
      } else {
        log("play failed:", await res.text());
        if (res.status === 404) {
          // Which devices Spotify actually knows about, to tell a stale device from a lost one.
          const d = await spotify("me/player/devices");
          const { devices = [] } = d.ok ? await d.json() : {};
          log(
            "our device", deviceId, "| Spotify sees:",
            devices.map((x: { id: string; name: string }) => `${x.name} ${x.id}`),
          );
        }
        setMessage("Couldn't start playback. Press play to try again.");
      }
    } finally {
      if (inFlightRef.current === key) inFlightRef.current = null;
    }
  }, [command]);

  // Create the SDK player once, the first time something is opened.
  const ensurePlayer = useCallback(() => {
    if (playerRef.current) return;

    const readyTimer = setTimeout(() => {
      log("no 'ready' event after", READY_TIMEOUT_MS, "ms");
      setMessage("Spotify's player didn't connect. Refresh to try again.");
    }, READY_TIMEOUT_MS);

    const fail = (event: string, e: Spotify.Error, text: string) => {
      log(event, e.message);
      clearTimeout(readyTimer);
      setMessage(text);
    };

    const init = () => {
      if (!window.Spotify || playerRef.current) return;
      log("SDK loaded, creating player");
      const player = new window.Spotify.Player({
        name: "Mixtape",
        // The SDK only asks when its token has run out, so always hand it a fresh one.
        getOAuthToken: (cb) => void getToken(true).then(cb),
        volume: 0.8,
      });
      playerRef.current = player;

      player.addListener("ready", ({ device_id }) => {
        log("ready, device", device_id);
        clearTimeout(readyTimer);
        deviceRef.current = device_id;
        const wanted = wantedRef.current;
        if (wanted) {
          setMessage("Starting…");
          void play(wanted.playlistId, wanted.start);
        }
      });
      player.addListener("not_ready", () => {
        log("not_ready");
        deviceRef.current = null;
      });
      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        const t = state.track_window.current_track;
        const uri = t.linked_from?.uri ?? t.uri;
        const match = sessionRef.current?.tracks?.find((x) => x.uri === uri || x.uri === t.uri);
        setNow({
          position: match?.position,
          uri,
          name: t.name,
          artists: t.artists.map((a) => a.name).join(", "),
          cover: t.album.images[0]?.url,
        });
        setPaused(state.paused);
        shuffleRef.current = state.shuffle;
        setShuffle(state.shuffle);
        repeatRef.current = REPEAT_MODES[state.repeat_mode] ?? "off";
        setRepeat(repeatRef.current);
        // The SDK sometimes reports a transient playback_error ("The operation is not
        // allowed.") right as playback starts; once music is playing, drop the message.
        if (!state.paused) setMessage(null);
        setTime({ position: state.position, duration: state.duration });
      });
      player.addListener("account_error", (e) =>
        fail("account_error", e, "Spotify Premium is needed to play music here."),
      );
      player.addListener("authentication_error", (e) =>
        fail("authentication_error", e, "Spotify login expired. Log in again."),
      );
      player.addListener("initialization_error", (e) =>
        fail("initialization_error", e, "This browser can't play Spotify. Try Chrome, Firefox or Edge."),
      );
      player.addListener("playback_error", (e) => fail("playback_error", e, e.message));
      player.addListener("autoplay_failed", () => {
        setPaused(true);
        setMessage("Press play to start.");
      });

      void player.connect().then((ok) => log("connect() →", ok));
      // Closing or reloading the tab: disconnect, or Spotify keeps a dead
      // "Mixtape" device around for a while.
      window.addEventListener("pagehide", () => player.disconnect());
    };

    if (window.Spotify) {
      init();
    } else {
      window.onSpotifyWebPlaybackSDKReady = init;
      if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SDK_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [play]);

  /** Switch to a playlist: forget the old one's song and state. */
  const switchTo = useCallback((playlistId: string, tracks: PlaylistTrack[] | null) => {
    const next = { playlistId, tracks };
    sessionRef.current = next;
    setSession(next);
  }, []);

  const open = useCallback(
    (playlistId: string, tracks: PlaylistTrack[] | null, start: Start | null) => {
      const same = sessionRef.current?.playlistId === playlistId;
      switchTo(playlistId, tracks);

      // Tracks may arrive after the song started (prime()): fill in its position.
      const uri = nowRef.current.uri;
      if (tracks && uri && nowRef.current.position === undefined) {
        const position = tracks.find((t) => t.uri === uri)?.position;
        if (position !== undefined) setNow((n) => (n.uri === uri ? { ...n, position } : n));
      }

      // Just started from the tracklist click: nothing more to do.
      const primed = primedRef.current;
      if (start && primed?.key === startKey(playlistId, start) && Date.now() - primed.at < PRIMED_MS) {
        return;
      }

      if (same) {
        // Back to the playlist that's already on: keep playing unless a different
        // track was picked.
        if (start === null) return;
        const now = nowRef.current;
        if ("uri" in start ? start.uri === now.uri : start.position === now.position) return;
        const wanted = wantedRef.current;
        if (
          !startedRef.current &&
          wanted?.playlistId === playlistId &&
          startKey(playlistId, wanted.start) === startKey(playlistId, start)
        ) {
          return; // already on its way (e.g. React dev mode calling this twice)
        }
      } else {
        startedRef.current = false;
        const first =
          start && "position" in start ? tracks?.find((t) => t.position === start.position) : tracks?.[0];
        setNow(first ?? EMPTY);
        setTime({ position: 0, duration: 0 });
        setPaused(true);
      }
      setMessage(deviceRef.current ? "Starting…" : "Loading player…");
      ensurePlayer();
      void play(playlistId, start ?? { position: 0 });
    },
    [ensurePlayer, play, switchTo],
  );

  const prime = useCallback(
    (playlistId: string, position: number) => {
      const start = { position };
      if (sessionRef.current?.playlistId !== playlistId) {
        // Track list arrives with the player page; until then show nothing stale.
        switchTo(playlistId, null);
        startedRef.current = false;
        setNow(EMPTY);
        setTime({ position: 0, duration: 0 });
      }
      primedRef.current = { key: startKey(playlistId, start), at: Date.now() };
      setMessage(deviceRef.current ? "Starting…" : "Loading player…");
      ensurePlayer();
      void play(playlistId, start);
    },
    [ensurePlayer, play, switchTo],
  );

  // Connect the in-browser Spotify device as soon as the app opens (not on the
  // first play), so the first song starts without waiting for it.
  useEffect(() => {
    if (window.location.pathname !== "/login") ensurePlayer();
  }, [ensurePlayer]);

  // Spotify only reports the position on changes, so advance it locally while playing.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(
      () => setTime((t) => ({ ...t, position: Math.min(t.position + 250, t.duration) })),
      250,
    );
    return () => clearInterval(id);
  }, [paused]);

  const playPause = useCallback(async () => {
    const player = playerRef.current;
    const s = sessionRef.current;
    if (!player || !s) return;
    await player.activateElement(); // unlocks audio on Safari/mobile
    if (!startedRef.current) await play(s.playlistId, { position: nowRef.current.position ?? 0 });
    else await player.togglePlay();
  }, [play]);

  // Skip via the Web API, which is more reliable than the SDK's nextTrack/previousTrack;
  // fall back to the SDK if the request fails. When the order is known (shuffle
  // off), show the new song straight away instead of waiting for Spotify.
  const skip = useCallback(
    async (direction: "next" | "previous") => {
      const player = playerRef.current;
      const deviceId = deviceRef.current;
      const s = sessionRef.current;
      if (!player || !deviceId || !s) return;
      if (!startedRef.current) {
        return void (await play(s.playlistId, { position: nowRef.current.position ?? 0 }));
      }
      const { tracks } = s;
      const i = tracks?.findIndex((t) => t.position === nowRef.current.position) ?? -1;
      const upcoming = tracks && i >= 0 && !shuffleRef.current ? tracks[i + (direction === "next" ? 1 : -1)] : undefined;
      if (upcoming) {
        setNow(upcoming);
        setTime({ position: 0, duration: 0 });
      }
      const res = await command("POST", direction);
      if (res && !res.ok) {
        log(`${direction} →`, res.status, await res.text());
        await (direction === "next" ? player.nextTrack() : player.previousTrack());
      }
    },
    [command, play],
  );

  const seek = useCallback((ms: number) => {
    setTime((t) => ({ ...t, position: ms })); // move the bar now, don't wait for Spotify
    void playerRef.current?.seek(ms);
  }, []);

  const toggleShuffle = useCallback(() => {
    const on = !shuffleRef.current;
    shuffleRef.current = on;
    setShuffle(on); // show it now; Spotify's state update confirms it
    void command("PUT", `shuffle?state=${on}`).then((r) => log("shuffle", on, "→", r?.status));
  }, [command]);

  const cycleRepeat = useCallback(() => {
    const next = REPEAT_MODES[(REPEAT_MODES.indexOf(repeatRef.current) + 1) % REPEAT_MODES.length];
    repeatRef.current = next;
    setRepeat(next);
    void command("PUT", `repeat?state=${next}`).then((r) => log("repeat", next, "→", r?.status));
  }, [command]);

  const close = useCallback(() => {
    void playerRef.current?.pause();
    sessionRef.current = null;
    wantedRef.current = null;
    startedRef.current = false;
    setSession(null);
  }, []);

  // Hardware media keys and the OS "Now Playing" controls, on every page.
  const actions = useRef({ playPause, skip, paused });
  useEffect(() => {
    actions.current = { playPause, skip, paused };
  });
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const handlers: [MediaSessionAction, () => void][] = [
      ["play", () => actions.current.paused && void actions.current.playPause()],
      ["pause", () => !actions.current.paused && void actions.current.playPause()],
      ["previoustrack", () => void actions.current.skip("previous")],
      ["nexttrack", () => void actions.current.skip("next")],
    ];
    for (const [action, fn] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, fn);
      } catch {}
    }
    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {}
      }
    };
  }, []);

  // What the OS shows in its Now Playing widget.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !now.name) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: now.name,
      artist: now.artists,
      artwork: now.cover ? [{ src: now.cover }] : [],
    });
    navigator.mediaSession.playbackState = paused ? "paused" : "playing";
  }, [now, paused]);

  const value = useMemo<Playback>(
    () => ({
      session,
      now,
      paused,
      time,
      message,
      shuffle,
      repeat,
      open,
      prime,
      playPause: () => void playPause(),
      next: () => void skip("next"),
      previous: () => void skip("previous"),
      seek,
      toggleShuffle,
      cycleRepeat,
      close,
    }),
    [session, now, paused, time, message, shuffle, repeat, open, prime, playPause, skip, seek, toggleShuffle, cycleRepeat, close],
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}
