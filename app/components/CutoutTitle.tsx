import Image from "next/image";

// Intrinsic widths of /public/letters/*.png (all are 400px tall).
const LETTER_WIDTHS: Record<string, number> = {
  "0": 350, "1": 312, "2": 292, "3": 456, "4": 366,
  "5": 211, "6": 272, "7": 280, "8": 273, "9": 266,
  A: 411, B: 211, C: 180, D: 368, E: 349, F: 259, G: 191,
  H: 464, I: 232, J: 443, K: 256, L: 377, M: 461, N: 523,
  O: 402, P: 289, Q: 388, R: 341, S: 300, T: 165, U: 303,
  V: 292, W: 501, X: 391, Y: 346, Z: 370,
};
const LETTER_HEIGHT = 400;
// No image for the apostrophe: it's drawn as a small paper scrap (see below),
// this wide in letter-heights.
const APOSTROPHE_UNITS = 0.32;
const isApostrophe = (ch: string) => ch === "'";

// Small, deterministic tilts/offsets so it reads like a ransom-note cutout.
const TILTS = [-6, 4, -3, 7, -5, 2, -8, 5, -2, 6, -4, 3];
const LIFTS = [0, -6, 4, -3, 6, -2, 3, -5];

// Spacing, as a fraction of letter height.
const LETTER_GAP = 0.14;
const WORD_GAP = 0.7;
const LINE_GAP = 0.75;

/** Width of one line of words, in letter-heights. */
function lineUnits(words: string[]) {
  const letterUnits = [...words.join("")].reduce(
    (sum, ch) =>
      sum + (isApostrophe(ch) ? APOSTROPHE_UNITS : (LETTER_WIDTHS[ch] ?? 0) / LETTER_HEIGHT),
    0,
  );
  const letterGapCount = words.reduce((n, w) => n + Math.max(w.length - 1, 0), 0);
  return letterUnits + letterGapCount * LETTER_GAP + (words.length - 1) * WORD_GAP;
}

/**
 * Ransom-note title. Put "\n" in `text` to break it over several lines.
 * Letters shrink with the screen down to `minHeight`; below that, words wrap onto
 * new lines instead, and only shrink further once the longest word can't fit.
 */
export default function CutoutTitle({
  text,
  maxHeight = "5.5rem",
  minHeight = "3rem",
}: {
  text: string;
  maxHeight?: string;
  minHeight?: string;
}) {
  const lines = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // é → e: only plain letters have cutouts
    .replace(/[\u2018\u2019]/g, "'")
    .toUpperCase()
    .split("\n")
    .map((line) => line.split(/\s+/).filter(Boolean))
    .filter((words) => words.length);
  let i = 0;

  // Size letters so the longest line fits the width: each line's width is the sum
  // of its letters' aspect ratios plus the gaps, all measured in letter-heights.
  const totalUnits = Math.max(...lines.map(lineUnits));
  const longestWordUnits = Math.max(...lines.flat().map((word) => lineUnits([word])));

  return (
    <h1
      aria-label={text.replace(/\s+/g, " ")}
      className="flex flex-col items-center"
      style={
        {
          "--h": `min(${maxHeight}, max(calc(75vw / ${totalUnits.toFixed(3)}), ${minHeight}), calc(90vw / ${longestWordUnits.toFixed(3)}))`,
          gap: `calc(var(--h) * ${LINE_GAP})`,
        } as React.CSSProperties
      }
    >
      {lines.map((words, l) => (
        <span
          key={l}
          className="flex flex-wrap items-center justify-center"
          style={{ columnGap: `calc(var(--h) * ${WORD_GAP})`, rowGap: `calc(var(--h) * ${LINE_GAP})` }}
        >
          {words.map((word, w) => (
            <span
              key={w}
              aria-hidden
              className="flex shrink-0 items-center"
              style={{ gap: `calc(var(--h) * ${LETTER_GAP})` }}
            >
              {[...word].map((ch, c) => {
                if (isApostrophe(ch)) {
                  const n = i++;
                  return (
                    <span
                      key={c}
                      className="flex h-[calc(var(--h)*0.5)] items-start justify-center self-start bg-[#f3efe4] font-black leading-none text-black shadow-[0_4px_6px_rgba(0,0,0,0.6)]"
                      style={{
                        width: `calc(var(--h) * ${APOSTROPHE_UNITS})`,
                        fontSize: "calc(var(--h) * 0.75)",
                        rotate: `${TILTS[n % TILTS.length]}deg`,
                        clipPath: "polygon(6% 0, 100% 5%, 92% 100%, 0 94%)",
                      }}
                    >
                      &rsquo;
                    </span>
                  );
                }
                const width = LETTER_WIDTHS[ch];
                if (!width) return null;
                const n = i++;
                return (
                  <Image
                    key={c}
                    src={`/letters/${ch}.png`}
                    alt=""
                    width={width}
                    height={LETTER_HEIGHT}
                    priority
                    className="h-(--h) w-auto drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] transition-transform duration-200 hover:scale-110"
                    style={{
                      rotate: `${TILTS[n % TILTS.length]}deg`,
                      translate: `0 ${LIFTS[n % LIFTS.length]}px`,
                    }}
                  />
                );
              })}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}
