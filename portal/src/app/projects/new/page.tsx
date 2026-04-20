import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HeeApiError, heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE, getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function createProject(formData: FormData): Promise<void> {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const upstreamUrl = String(formData.get("upstreamUrl") ?? "").trim();
  const upstreamHost =
    String(formData.get("upstreamHost") ?? "").trim() || undefined;

  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) redirect("/login");

  try {
    await heeApi.portal.createProject(session, {
      name,
      slug,
      upstreamUrl,
      upstreamHost,
    });
  } catch (err) {
    const code =
      err instanceof HeeApiError
        ? err.status === 409
          ? "slug-taken"
          : "invalid"
        : "unknown";
    redirect(`/projects/new?err=${code}`);
  }

  redirect(`/projects/${slug}`);
}

export default async function NewProjectPage(props: {
  searchParams: Promise<{ err?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { err } = await props.searchParams;

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <nav className="mb-6 text-sm text-ink-500">
        <Link href="/projects" className="hover:text-ink-900">
          ← Projects
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold">New project</h1>
        <p className="mt-1 text-sm text-ink-500">
          A project is a tenant on the Hee edge. Each project has its own API
          tokens + customer domains, routed to a single upstream you control.
        </p>
      </header>

      <form action={createProject} className="card space-y-5">
        <Field
          label="Project name"
          hint="Shown on your dashboard. You can change it later."
        >
          <input
            className="input"
            name="name"
            required
            maxLength={120}
            placeholder="Acme SaaS"
          />
        </Field>

        <Field
          label="Slug"
          hint="URL-safe identifier. Lowercase, hyphens, 2–63 chars. Can't be changed."
        >
          <input
            className="input font-mono"
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9-]{1,62}"
            maxLength={63}
            placeholder="acme"
          />
        </Field>

        <Field
          label="Upstream URL"
          hint="Where customer traffic should be proxied. Typically your app's public URL."
        >
          <input
            className="input"
            name="upstreamUrl"
            type="url"
            required
            maxLength={255}
            placeholder="https://acme.pages.dev"
          />
        </Field>

        <Field
          label="Upstream Host header (optional)"
          hint="Override the Host header sent to the upstream. Leave blank to use the upstream's hostname."
        >
          <input
            className="input"
            name="upstreamHost"
            maxLength={255}
            placeholder="acme.pages.dev"
          />
        </Field>

        {err && <ErrorBanner code={err} />}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/projects" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary">
            Create project
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
    code === "slug-taken"
      ? "That slug is already in use — pick another."
      : code === "invalid"
        ? "One of the fields is invalid. Check the format hints above."
        : "Something went wrong. Try again or contact ops@hee.la.";
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
