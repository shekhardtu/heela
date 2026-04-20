import { NextRequest, NextResponse } from "next/server";

/**
 * Cheap edge-runtime check: if there's no session cookie at all, bounce to
 * /login without hitting the control plane. Cookie validity is re-checked
 * server-side during SSR of each protected page via `getSessionUser()`.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("hee_session");
  if (!hasSession) {
    const login = new URL("/login", req.url);
    login.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Protect everything under /projects and /account. Everything else (the
  // landing page, /login, /api/*) is public or handled by its own logic.
  matcher: ["/projects/:path*", "/account/:path*"],
};
