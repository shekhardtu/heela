import { NextResponse } from "next/server";
import { HeeApiError, heeApi } from "@/lib/hee-api";

/**
 * Proxy to the control plane's /v1/auth/request-magic-link. The control plane
 * does find-or-create on the user row and sends the email via Postmark;
 * we just forward the email and return the same 204-on-all-cases response
 * for account-enumeration safety.
 */
export async function POST(req: Request) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  try {
    await heeApi.auth.requestMagicLink(email);
  } catch (err) {
    // Control plane down or rejected — still return 204 to the browser so
    // attackers can't distinguish valid from invalid emails. Log internally.
    if (err instanceof HeeApiError) {
      console.error(`[portal] requestMagicLink failed (${err.status}):`, err.message);
    } else {
      console.error("[portal] requestMagicLink error:", err);
    }
  }

  return new NextResponse(null, { status: 204 });
}
