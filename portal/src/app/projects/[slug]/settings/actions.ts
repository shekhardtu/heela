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

export async function updateProjectAction(slug: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const upstreamUrl = String(formData.get("upstreamUrl") ?? "").trim();
  const upstreamHost = String(formData.get("upstreamHost") ?? "").trim();
  const errorPageUrl = String(formData.get("errorPageUrl") ?? "").trim();

  const session = await requireSession();
  try {
    await heeApi.portal.updateProject(session, slug, {
      ...(name ? { name } : {}),
      ...(upstreamUrl ? { upstreamUrl } : {}),
      upstreamHost: upstreamHost || undefined,
      errorPageUrl: errorPageUrl || null,
    });
  } catch (err) {
    if (err instanceof HeeApiError && err.status === 403) {
      redirect(`/projects/${slug}/settings?err=forbidden`);
    }
    redirect(`/projects/${slug}/settings?err=invalid`);
  }
  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}/settings?saved=1`);
}
