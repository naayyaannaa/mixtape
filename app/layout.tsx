import type { Metadata } from "next";
import { Jersey_10 } from "next/font/google";
import "./globals.css";
import PlaybackProvider from "./player/PlaybackProvider";
import MiniPlayer from "./player/MiniPlayer";

const jersey = Jersey_10({
  weight: "400",
  variable: "--font-jersey",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Mixtape Collection",
  description: "My mixtape collection",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jersey.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Owns the Spotify player, so music keeps playing across pages. */}
        <PlaybackProvider>
          {children}
          <MiniPlayer />
        </PlaybackProvider>
      </body>
    </html>
  );
}
