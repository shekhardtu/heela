import { NextRequest, NextResponse } from "next/server";
import { portalUrl } from "@/lib/base-url";
import { HeeApiError, heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE } from "@/lib/session";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/**
 * Landing endpoint for magic-link emails. Verifies the JWT via the control
 * plane, captures the session token, drops it into an httpOnly cookie,
 * redirects to /projects. The raw session token never hits the browser JS
 * side — the cookie handles everything server-rendered.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(portalUrl("/login?err=missing-token"));
  }

  try {
    const session = await heeApi.auth.callback(token);

    const redirectTo = req.nextUrl.searchParams.get("redirect") ?? "/projects";
    const res = NextResponse.redirect(portalUrl(redirectTo));
    res.cookies.set({
      name: SESSION_COOKIE,
      value: session.sessionToken,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS_SECONDS,
    });
    return res;
  } catch (err) {
    const status = err instanceof HeeApiError ? err.status : 0;
    const code = status === 401 ? "expired" : "failed";
    return NextResponse.redirect(portalUrl(`/login?err=${code}`));
  }
}
