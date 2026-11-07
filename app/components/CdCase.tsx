import Image from "next/image";

// case-v3.png is 885×786: a 96px hinge on the left, then the (near-square)
// 789×786 window, with the case's tray outlines drawn over it.
// The cover art and glass overlay are right-aligned to fill that window exactly.
const CASE_W = 885;
const CASE_H = 786;
const HINGE_W = 96;
const SQUARE_LEFT = `${(HINGE_W / CASE_W) * 100}%`;
const SQUARE_W = `${((CASE_W - HINGE_W) / CASE_W) * 100}%`;

export default function CdCase({ cover, alt = "" }: { cover?: string; alt?: string }) {
  return (
    <div
      className="relative w-full drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)]"
      style={{ aspectRatio: `${CASE_W} / ${CASE_H}` }}
    >
      {/* 1. Playlist cover from Spotify */}
      <div className="absolute inset-y-0 right-0" style={{ left: SQUARE_LEFT, width: SQUARE_W }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN hosts vary
          <img src={cover} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-neutral-800" />
        )}
      </div>

      {/* 2. CD case (hinge + frame) on top of the cover */}
      <Image src="/case/case-v3.png" alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-contain" />

      {/* 3. Glass front: a sharp diagonal glare, a soft gloss from the top,
          a faint darkening toward the bottom-right and bright bevelled edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0"
        style={{
          width: SQUARE_W,
          background: [
            "linear-gradient(118deg, rgb(255 255 255 / 0.5) 0%, rgb(255 255 255 / 0.18) 34%, transparent 34.5%)",
            "linear-gradient(118deg, transparent 58%, rgb(255 255 255 / 0.12) 58.5%, rgb(255 255 255 / 0.04) 70%, transparent 70.5%)",
            "linear-gradient(180deg, rgb(255 255 255 / 0.22), transparent 35%)",
            "linear-gradient(135deg, transparent 55%, rgb(0 0 0 / 0.18))",
          ].join(", "),
          boxShadow:
            "inset 0 1px 0 rgb(255 255 255 / 0.7), inset 1px 0 0 rgb(255 255 255 / 0.4), inset 0 -1px 0 rgb(0 0 0 / 0.25), inset -1px 0 0 rgb(0 0 0 / 0.15)",
        }}
      />
    </div>
  );
}
