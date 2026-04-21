import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE, getSessionUser } from "@/lib/session";
import { updateProjectAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ err?: string; saved?: string }>;
}

export default async function ProjectSettingsPage(props: PageProps) {
  const { slug } = await props.params;
  const { err, saved } = await props.searchParams;

  const user = await getSessionUser();
  if (!user) redirect("/login");
  const membership = user.projects.find((p) => p.slug === slug);
  if (!membership) notFound();

  const store = await cookies();
  const session = store.get(SESSION_COOKIE)!.value;
  const project = await heeApi.portal.getProject(session, slug);
  const isOwner = membership.role === "owner";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <nav className="mb-6 text-sm text-ink-500">
        <Link href={`/projects/${slug}`} className="hover:text-ink-900">
          ← {project.name}
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Project settings</h1>
        <p className="mt-1 text-sm text-ink-500">
          {isOwner
            ? "Update routing, branding, and error-page behaviour."
            : "Only owners can edit these. Viewing read-only."}
        </p>
      </header>

      {saved && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Saved.
        </div>
      )}
      {err && <ErrorBanner code={err} />}

      <form action={updateProjectAction.bind(null, slug)} className="card space-y-5">
        <Field label="Project name" hint="Shown in dashboards.">
          <input
            className="input"
            name="name"
            defaultValue={project.name}
            maxLength={120}
            disabled={!isOwner}
          />
        </Field>

        <Field
          label="Upstream URL"
          hint="Where customer domain traffic is proxied."
        >
          <input
            className="input"
            type="url"
            name="upstreamUrl"
            defaultValue={project.upstreamUrl}
            maxLength={255}
            disabled={!isOwner}
          />
        </Field>

        <Field
          label="Upstream Host header (optional)"
          hint="Overrides the Host header sent to the upstream."
        >
          <input
            className="input"
            name="upstreamHost"
            defaultValue={project.upstreamHost ?? ""}
            maxLength={255}
            disabled={!isOwner}
          />
        </Field>

        <Field
          label="Custom error page URL (optional)"
          hint="Public HTTPS URL of a static HTML page. Served on 5xx errors instead of Caddy's default. Fetched every 60 seconds."
        >
          <input
            className="input"
            type="url"
            name="errorPageUrl"
            defaultValue={project.errorPageUrl ?? ""}
            placeholder="https://status.yourapp.com/error.html"
            maxLength={2048}
            disabled={!isOwner}
          />
        </Field>

        <div className="flex justify-end pt-2">
          <button className="btn-primary" disabled={!isOwner}>
            {isOwner ? "Save changes" : "View-only"}
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function ErrorBanner({ code }: { code: string }) {
  const message =
    code === "forbidden"
      ? "Only owners can change project settings."
      : "Couldn't save — check the URLs for correctness.";
  return (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
