import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await heeApi.auth.signOut(token);
    } catch {
      /* ignore — we're clearing the cookie either way */
    }
  }
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
