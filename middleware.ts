import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/invite"];
const API_PUBLIC = ["/api/auth/login", "/api/auth/register", "/api/auth/password-reset", "/api/rpc/", "/api/invites/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public assets, _next internals, and socket.io
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/socket.io") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("dollarcord_session");
  const isLoggedIn = Boolean(sessionCookie?.value);

  // Allow public API routes regardless of auth state
  if (API_PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Protect all non-public routes
  if (!isLoggedIn && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login/register
  if (isLoggedIn && PUBLIC_PATHS.some((p) => pathname === p)) {
    const url = request.nextUrl.clone();
    url.pathname = "/channels";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
