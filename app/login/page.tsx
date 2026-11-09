import { Suspense } from "react";
import Link from "next/link";
import CutoutTitle from "../components/CutoutTitle";
import StarField, { BG_STARS, GUEST_STAR, STAR } from "../components/StarField";

// ?error= values the auth callback can send back.
const ERRORS: Record<string, string> = {
  access_denied: "Login was cancelled on Spotify.",
  state_mismatch: "That login link expired. Please try again.",
  token_exchange_failed: "Spotify didn't finish the login. Please try again.",
};

/**
 * The small star on the left of the background, made into a link to the
 * visualizer (no login needed). Looks like the other background stars except
 * for a chrome / holographic outline, and the login star's inner shadow on hover.
 */
function GuestStar() {
  const s = BG_STARS[GUEST_STAR];
  return (
    // The link ignores the pointer so only the star shape is clickable (as on the login star).
    <Link
      href="/visualizer"
      aria-label="Try the visualizer without logging in"
      className="group pointer-events-none fixed outline-none"
      style={{ left: s.left, top: s.top, width: s.size, height: s.size, rotate: `${s.rotate}deg` }}
    >
      <svg viewBox="0 0 100 100" aria-hidden className="size-full overflow-visible">
        <defs>
          {/* Holographic chrome: muted silver with soft rainbow bands, slowly turning. */}
          <linearGradient id="guest-holo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b9c0c9" />
            <stop offset="0.18" stopColor="#c98aae" />
            <stop offset="0.34" stopColor="#a497c9" />
            <stop offset="0.5" stopColor="#86b8c9" />
            <stop offset="0.62" stopColor="#cfd4da" />
            <stop offset="0.76" stopColor="#93c4aa" />
            <stop offset="0.88" stopColor="#c9c08a" />
            <stop offset="1" stopColor="#7d8794" />
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              values="0 0.5 0.5; 360 0.5 0.5"
              dur="8s"
              repeatCount="indefinite"
            />
          </linearGradient>
          {/* Same inner shadow as the login star. */}
          <filter id="guest-star-inset" x="-10%" y="-10%" width="120%" height="120%">
            <feFlood floodColor="#000" floodOpacity="1" />
            <feComposite in2="SourceAlpha" operator="out" />
            <feOffset dx="3" dy="3" />
            <feGaussianBlur stdDeviation="3" />
            <feComposite in2="SourceAlpha" operator="in" />
          </filter>
        </defs>
        <polygon
          points={STAR}
          className="pointer-events-auto cursor-pointer"
          fill="#3b4b5c"
          stroke="url(#guest-holo)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          points={STAR}
          filter="url(#guest-star-inset)"
          className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </svg>
    </Link>
  );
}

async function LoginError({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  if (typeof error !== "string") return null;
  return <p className="mt-6 text-center text-xl text-white">{ERRORS[error] ?? `Login failed (${error}).`}</p>;
}


export default function LoginPage(props: PageProps<"/login">) {
  return (
    <div
      className="relative isolate flex min-h-screen flex-1 flex-col items-center overflow-hidden px-4"
      style={{
        // Plastic texture over the navy, soft-light blended at full strength.
        background: "url('/assets/plastic-big.png') center / cover no-repeat fixed, #172029",
        backgroundBlendMode: "soft-light",
      }}
    >
      <StarField skip={GUEST_STAR} />
      <GuestStar />

      <header className="w-full px-4 pt-14 sm:pt-22">
        <CutoutTitle text={"Welcome to ur\nmixtape collection"} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center pb-24">
        {/* Plain <a>, not <Link>: this hits a route handler that redirects to Spotify.
            The <a> ignores the pointer so only the star shape (its polygon) is
            clickable, not the empty corners of its box. */}
        <a
          href="/api/auth/login"
          className="group pointer-events-none relative grid size-[min(66vw,19rem)] -rotate-12 place-items-center text-white outline-none"
        >
          <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 size-full overflow-visible">
            <defs>
              {/* Inner shadow: dark everywhere outside the star, shifted down-right,
                  blurred, then kept only where it falls inside the star. */}
              <filter id="star-inset" x="-10%" y="-10%" width="120%" height="120%">
                <feFlood floodColor="#000" floodOpacity="1" />
                <feComposite in2="SourceAlpha" operator="out" />
                <feOffset dx="3" dy="3" />
                <feGaussianBlur stdDeviation="3" />
                <feComposite in2="SourceAlpha" operator="in" />
              </filter>
            </defs>
            <polygon
              points={STAR}
              className="pointer-events-auto cursor-pointer"
              fill="rgb(255 255 255 / 0.1)"
              stroke="#fff"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <polygon
              points={STAR}
              filter="url(#star-inset)"
              className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            />
          </svg>
          <span className="relative mt-[5%] w-[56%] text-center text-[32px] leading-[1.1] text-[#1ed760] [text-shadow:0_2px_4px_rgb(0_0_0_/0.5)] transition-transform duration-150 group-hover:translate-x-px group-hover:translate-y-px group-focus-visible:outline-1 group-focus-visible:outline-dotted group-focus-visible:outline-white">
            login with spotify
          </span>
        </a>
        <Suspense>
          <LoginError searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
