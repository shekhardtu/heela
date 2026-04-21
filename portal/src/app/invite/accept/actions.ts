"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HeeApiError, heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE } from "@/lib/session";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/**
 * One-click invite acceptance. The invite email link is itself proof of
 * email receipt — we trust it the same way we trust a magic-link callback.
 * Server calls the unauth'd accept-via-token endpoint, which:
 *   - validates token (expires/revoked/accepted checks)
 *   - find-or-creates the User at the INVITED email (never user input)
 *   - adds them as ProjectMember
 *   - mints a session
 * We set the session cookie and redirect into the project.
 */
export async function acceptInviteAction(token: string): Promise<void> {
  try {
    const result = await heeApi.portal.acceptInviteViaToken(token);

    const store = await cookies();
    // Drop any existing session — the invite supersedes prior auth. If the
    // user was logged in as a different email, this switches them to the
    // invited identity (which is what the DB permits anyway).
    store.set({
      name: SESSION_COOKIE,
      value: result.sessionToken,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS_SECONDS,
    });

    redirect(`/projects/${result.projectSlug}?welcome=1`);
  } catch (err) {
    if (err instanceof HeeApiError) {
      if (err.status === 404)
        redirect(`/invite/accept?token=${token}&err=not-found`);
      if (err.status === 400 && err.message.includes("expired"))
        redirect(`/invite/accept?token=${token}&err=expired`);
      if (err.status === 400 && err.message.includes("revoked"))
        redirect(`/invite/accept?token=${token}&err=revoked`);
      if (err.status === 400 && err.message.includes("accepted"))
        redirect(`/invite/accept?token=${token}&err=used`);
    }
    throw err;
  }
}
