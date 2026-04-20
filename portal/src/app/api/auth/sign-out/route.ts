import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { portalUrl } from "@/lib/base-url";
import { heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await heeApi.auth.signOut(token);
    } catch {
      /* ignore — we're clearing the cookie either way */
    }
  }
  const res = NextResponse.redirect(portalUrl("/login"));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
