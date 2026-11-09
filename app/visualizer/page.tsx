import type { Metadata } from "next";
import GuestVisualizer from "./GuestVisualizer";

export const metadata: Metadata = { title: "Visualizer · My Mixtape Collection" };

/** The player's moving background on its own, no login needed (the holo star on /login). */
export default function VisualizerPage() {
  return <GuestVisualizer />;
}
