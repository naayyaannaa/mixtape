"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { usePlayback } from "./PlaybackProvider";
import RetroWindow from "./RetroWindow";

type Pos = { x: number; y: number };
const POS_KEY = "mixtape:miniplayer-pos";
const MARGIN = 8;

/** Keep the window fully on screen. */
function clamp(p: Pos, el: HTMLElement): Pos {
  const maxX = window.innerWidth - el.offsetWidth - MARGIN;
  const maxY = window.innerHeight - el.offsetHeight - MARGIN;
  return {
    x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, maxX)),
    y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, maxY)),
  };
}

function savedPos(): Pos | null {
  if (typeof window === "undefined") return null; // server render (Node has its own localStorage)
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
  } catch {
    return null; // server render, or storage blocked
  }
}

/**
 * Mini player on every page except the player itself, while a playlist is on.
 * Starts bottom-right; drag it anywhere by its title bar (remembered).
 * Clicking the disc or song goes back to the full player.
 */
export default function MiniPlayer() {
  const pathname = usePathname();
  const { session, now, paused, playPause, next, previous, close } = usePlayback();
  const [pos, setPos] = useState<Pos | null>(savedPos);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // Pull it back on screen if the window shrinks.
  useEffect(() => {
    const onResize = () => setPos((p) => (p && ref.current ? clamp(p, ref.current) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!session || pathname.startsWith("/player/") || pathname === "/login") return null;

  const titleBarProps: React.HTMLAttributes<HTMLDivElement> = {
    className: "cursor-move touch-none select-none",
    onPointerDown: (e) => {
      if ((e.target as HTMLElement).closest("button") || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      if (!drag.current || !ref.current) return;
      setPos(clamp({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }, ref.current));
    },
    onPointerUp: () => {
      drag.current = null;
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {}
    },
  };

  return (
    <div
      ref={ref}
      className={`fixed z-50 ${pos ? "" : "bottom-4 right-4"}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
    >
      <RetroWindow
        now={now}
        paused={paused}
        onPrevious={previous}
        onPlayPause={playPause}
        onNext={next}
        onClose={close}
        closeLabel="Stop and close mini player"
        href={`/player/${session.playlistId}`}
        className="aspect-square w-[min(80vw,18rem)]"
        discClassName="w-36"
        titleBarProps={titleBarProps}
      />
    </div>
  );
}
