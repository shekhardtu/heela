import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE, getSessionUser } from "@/lib/session";
import { addDomainAction, removeDomainAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ err?: string }>;
}

export default async function ProjectPage(props: PageProps) {
  const { slug } = await props.params;
  const { err } = await props.searchParams;

  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.projects.some((p) => p.slug === slug)) notFound();

  const store = await cookies();
  const session = store.get(SESSION_COOKIE)!.value;

  const [project, domains] = await Promise.all([
    heeApi.portal.getProject(session, slug),
    heeApi.portal.listDomains(session, slug),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <nav className="mb-6 text-sm text-ink-500">
        <Link href="/projects" className="hover:text-ink-900">
          ← Projects
        </Link>
      </nav>

      <header className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="mt-1 font-mono text-sm text-ink-500">{project.slug}</p>
          <p className="mt-2 text-xs text-ink-500">
            Upstream: <span className="font-mono">{project.upstreamUrl}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${slug}/tokens`}
            className="btn-ghost text-sm"
          >
            API tokens
          </Link>
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">
            {project.role}
          </span>
        </div>
      </header>

      <section className="space-y-8">
        <AddDomainForm slug={slug} err={err} />
        <DomainList slug={slug} domains={domains} />
        <DnsInstructions />
      </section>
    </main>
  );
}

function AddDomainForm({ slug, err }: { slug: string; err?: string }) {
  return (
    <form
      action={addDomainAction.bind(null, slug)}
      className="card space-y-4"
    >
      <h2 className="font-semibold">Add a customer domain</h2>
      <p className="text-sm text-ink-500">
        Register the hostname here; your customer adds a CNAME to{" "}
        <code className="font-mono text-xs">edge.hee.la</code>. First request
        issues a Let&apos;s Encrypt cert.
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-500">
          Hostname
        </label>
        <input
          className="input font-mono"
          name="hostname"
          required
          maxLength={253}
          placeholder="docs.acme.com"
          pattern="^(?=.{1,253}$)(?:(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)\.)+[A-Za-z]{2,}$"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-500">
          Metadata (optional JSON) — returned with edge lookups so you can route within your app
        </label>
        <textarea
          className="input font-mono text-xs"
          name="metadata"
          rows={2}
          placeholder='{"workspaceSlug":"acme"}'
        />
      </div>
      {err && <ErrorBanner code={err} />}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary">
          Register domain
        </button>
      </div>
    </form>
  );
}

function DomainList({
  slug,
  domains,
}: {
  slug: string;
  domains: Array<{ hostname: string; verified: boolean; verifiedAt: string | null; createdAt: string }>;
}) {
  if (domains.length === 0) {
    return (
      <div className="card text-sm text-ink-500">
        No domains registered yet. Add one above.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-ink-200">
      <table className="w-full text-sm">
        <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
          <tr>
            <th className="px-4 py-2">Hostname</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Added</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr key={d.hostname} className="border-t border-ink-200">
              <td className="px-4 py-3 font-mono">{d.hostname}</td>
              <td className="px-4 py-3">
                {d.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    ● Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                    ● Pending DNS
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-ink-500">
                {new Date(d.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <form
                  action={removeDomainAction.bind(null, slug, d.hostname)}
                  className="inline"
                >
                  <button className="text-xs font-medium text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DnsInstructions() {
  return (
    <details className="card cursor-pointer">
      <summary className="font-semibold">
        Customer DNS instructions — share with your customers
      </summary>
      <div className="mt-4 space-y-3 text-sm text-ink-500">
        <p>
          For each domain you register here, your customer adds a single CNAME
          record in their DNS provider (Cloudflare, Route 53, etc.):
        </p>
        <pre className="overflow-x-auto rounded-md bg-ink-50 px-3 py-3 text-xs text-ink-900">
          <code>{`<their domain>   CNAME   edge.hee.la`}</code>
        </pre>
        <p>
          First request after DNS propagates issues a Let&apos;s Encrypt cert
          (~3–8 s cold). Subsequent requests are served from the cached cert.
        </p>
      </div>
    </details>
  );
}

function ErrorBanner({ code }: { code: string }) {
  const message =
    code === "domain-taken"
      ? "This hostname is already claimed by another project."
      : code === "metadata-json"
        ? "Metadata must be valid JSON."
        : code === "remove-failed"
          ? "Couldn't remove that domain — try again."
          : "Something went wrong — check the form and try again.";
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
