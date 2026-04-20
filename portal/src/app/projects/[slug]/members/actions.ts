"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { HeeApiError, heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE } from "@/lib/session";

async function requireSession(): Promise<string> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  return token;
}

export async function inviteMemberAction(slug: string, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member") as "owner" | "member";
  if (!email) redirect(`/projects/${slug}/members?err=email-required`);
  if (role !== "owner" && role !== "member") {
    redirect(`/projects/${slug}/members?err=invalid-role`);
  }

  const session = await requireSession();
  try {
    await heeApi.portal.createInvitation(session, slug, { email, role });
  } catch (err) {
    if (err instanceof HeeApiError) {
      if (err.status === 403)
        redirect(`/projects/${slug}/members?err=forbidden`);
      if (err.status === 409)
        redirect(`/projects/${slug}/members?err=already-member`);
    }
    redirect(`/projects/${slug}/members?err=invite-failed`);
  }
  revalidatePath(`/projects/${slug}/members`);
}

export async function revokeInvitationAction(
  slug: string,
  invitationId: string,
) {
  const session = await requireSession();
  try {
    await heeApi.portal.revokeInvitation(session, slug, invitationId);
  } catch {
    redirect(`/projects/${slug}/members?err=revoke-failed`);
  }
  revalidatePath(`/projects/${slug}/members`);
}
