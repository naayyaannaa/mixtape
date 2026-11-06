import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, sameOriginUrl } from "@/lib/spotify";

// Spotify rejected our token (expired or revoked): forget the session and go to
// the login page. Going straight to /login instead would loop, because the proxy
// still sees the stale cookie and sends a "logged in" user on to /collection.
// (GET, because server components can only redirect; nothing links here.)
export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(sameOriginUrl("/login", request), 303);
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
