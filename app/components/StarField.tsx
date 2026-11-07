// Five-point star in a 100×100 box.
export const STAR = "50,2 61.8,36.2 97.6,36.2 68.9,57.6 79.4,92 50,71 20.6,92 31.1,57.6 2.4,36.2 38.2,36.2";

// Solid stars scattered behind everything (positioned relative to the screen);
// some run off the edges.
const BG_STARS: { left: string; top: string; size: string; rotate: number }[] = [
  { left: "-6%", top: "-8%", size: "22vmax", rotate: -14 },
  { left: "78%", top: "-6%", size: "18vmax", rotate: 12 },
  { left: "22%", top: "30%", size: "9vmax", rotate: 8 },
  { left: "86%", top: "40%", size: "14vmax", rotate: -20 },
  { left: "-4%", top: "68%", size: "17vmax", rotate: 18 },
  { left: "28%", top: "80%", size: "20vmax", rotate: -6 },
  { left: "70%", top: "74%", size: "8vmax", rotate: 24 },
  { left: "8%", top: "42%", size: "6vmax", rotate: -30 },
  { left: "60%", top: "18%", size: "7vmax", rotate: 16 },
];

/**
 * Background stars shared by the login and track list pages. Fixed to the
 * screen (they stay put while a long page scrolls) and behind the content: the
 * parent needs `isolate` so -z-10 still sits above the parent's own background.
 */
export default function StarField({
  color = "#3b4b5c",
  outline = false,
}: {
  color?: string;
  /** Only the stars' outlines (a thin line), no fill. */
  outline?: boolean;
} = {}) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {BG_STARS.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 100 100"
          className="absolute"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, rotate: `${s.rotate}deg` }}
        >
          <polygon
            points={STAR}
            fill={outline ? "none" : color}
            stroke={outline ? color : undefined}
            strokeWidth={outline ? 2.5 : undefined}
            vectorEffect={outline ? "non-scaling-stroke" : undefined}
          />
        </svg>
      ))}
    </div>
  );
}
