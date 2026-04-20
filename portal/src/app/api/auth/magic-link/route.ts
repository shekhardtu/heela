import { NextResponse } from "next/server";

/**
 * Phase 1: stub that just records the request. Wire up to Resend + JWT cookies
 * in Phase 2 once we have a real portal flow.
 *
 * Expected body: { email: string }
 */
export async function POST(req: Request) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  // TODO(phase-2): sign a short-lived JWT and email it via Resend.
  //   const token = await new SignJWT({ email }).sign(jwtKey);
  //   await resend.emails.send({ from: "hee <auth@hee.la>", to: email, subject: "Sign in to Hee", html: renderMagicLinkEmail(token) });
  console.log(`[auth] magic-link requested for ${email}`);

  return NextResponse.json({ ok: true });
}
