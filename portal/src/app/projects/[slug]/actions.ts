"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { HeeApiError, heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Server actions used by the project detail page. Each reads the session
 * cookie server-side and talks to the control plane on the user's behalf —
 * session tokens never leave the portal's server runtime.
 */

async function requireSession(): Promise<string> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  return token;
}

export async function addDomainAction(slug: string, formData: FormData) {
  const hostname = String(formData.get("hostname") ?? "").trim().toLowerCase();
  const metadataRaw = String(formData.get("metadata") ?? "").trim();
  let metadata: Record<string, unknown> | undefined;
  if (metadataRaw) {
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      redirect(`/projects/${slug}?err=metadata-json`);
    }
  }

  const session = await requireSession();
  try {
    await heeApi.portal.registerDomain(session, slug, { hostname, metadata });
  } catch (err) {
    const code =
      err instanceof HeeApiError && err.status === 409
        ? "domain-taken"
        : "invalid";
    redirect(`/projects/${slug}?err=${code}`);
  }

  revalidatePath(`/projects/${slug}`);
}

export async function removeDomainAction(slug: string, hostname: string) {
  const session = await requireSession();
  try {
    await heeApi.portal.removeDomain(session, slug, hostname);
  } catch {
    redirect(`/projects/${slug}?err=remove-failed`);
  }
  revalidatePath(`/projects/${slug}`);
}

export async function issueTokenAction(slug: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`/projects/${slug}/tokens?err=name-required`);
  const session = await requireSession();
  let token: string;
  try {
    const created = await heeApi.portal.issueToken(session, slug, { name });
    token = created.token;
  } catch {
    redirect(`/projects/${slug}/tokens?err=issue-failed`);
  }
  // Redirect with raw token — surfaced ONCE on the redirect target then discarded.
  // The URL-as-transport keeps it out of the form POST round-trip history.
  redirect(`/projects/${slug}/tokens?new=${encodeURIComponent(token)}`);
}

export async function revokeTokenAction(slug: string, tokenId: string) {
  const session = await requireSession();
  try {
    await heeApi.portal.revokeToken(session, slug, tokenId);
  } catch {
    redirect(`/projects/${slug}/tokens?err=revoke-failed`);
  }
  revalidatePath(`/projects/${slug}/tokens`);
}
