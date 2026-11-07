import type { Metadata } from "next";
import { Suspense } from "react";
import { Jersey_10 } from "next/font/google";
import "./globals.css";
import PlaybackProvider from "./player/PlaybackProvider";
import MiniPlayer from "./player/MiniPlayer";
import FullscreenKey from "./components/FullscreenKey";

const jersey = Jersey_10({
  weight: "400",
  variable: "--font-jersey",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Mixtape Collection",
  description: "My mixtape collection",
  // Favicon: Album CD by Streamline, rendered as light/dark PNGs.
  // https://icon-sets.iconify.design/streamline-pixel/music-album-cd-disk-playlist/
  // https://github.com/webalys-hq/streamline-vectors
  // Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
  icons: {
    icon: [
      {
        url: "/favicon-light.png?v=2",
        type: "image/png",
        sizes: "128x128",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-dark.png?v=2",
        type: "image/png",
        sizes: "128x128",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jersey.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Owns the Spotify player, so music keeps playing across pages. */}
        <FullscreenKey />
        <PlaybackProvider>
          {children}
          {/* Reads the current URL, which dynamic routes (/player/[id]…) only know
              at request time: Suspense lets the rest of each page prerender. */}
          <Suspense fallback={null}>
            <MiniPlayer />
          </Suspense>
        </PlaybackProvider>
      </body>
    </html>
  );
}
