"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HeeApiError, heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Accept a pending invite. Called from a signed-in user clicking the form on
 * /invite/accept. If the session email doesn't match the invited email, the
 * control plane returns 403 — we surface a specific error so the user can
 * sign out and retry with the right account.
 */
export async function acceptInviteAction(token: string): Promise<void> {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) {
    redirect(`/login?redirectTo=${encodeURIComponent(`/invite/accept?token=${token}`)}`);
  }

  try {
    const result = await heeApi.portal.acceptInvitation(session!, token);
    redirect(`/projects/${result.projectSlug}?welcome=1`);
  } catch (err) {
    if (err instanceof HeeApiError) {
      // Next.js redirect errors internally throw — don't swallow.
      if (err.name === "Error" || err.message === "NEXT_REDIRECT") throw err;
      if (err.status === 403)
        redirect(`/invite/accept?token=${token}&err=wrong-email`);
      if (err.status === 400 && err.message.includes("expired"))
        redirect(`/invite/accept?token=${token}&err=expired`);
      if (err.status === 400 && err.message.includes("revoked"))
        redirect(`/invite/accept?token=${token}&err=revoked`);
      if (err.status === 404)
        redirect(`/invite/accept?token=${token}&err=not-found`);
    }
    throw err;
  }
}
