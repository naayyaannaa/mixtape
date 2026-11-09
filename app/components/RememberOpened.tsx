"use client";

import { useEffect } from "react";
import { rememberOpened } from "@/lib/recent";

/** Marks a playlist as just opened, for the collection's "recently opened" order. */
export default function RememberOpened({ playlistId }: { playlistId: string }) {
  useEffect(() => rememberOpened(playlistId), [playlistId]);
  return null;
}
