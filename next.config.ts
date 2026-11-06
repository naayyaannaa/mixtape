import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spotify only accepts loopback IPs as redirect URIs, so dev runs on 127.0.0.1, not localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // Forward all browser console output (incl. the player's logs) to the dev server log.
  logging: { browserToTerminal: true },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
