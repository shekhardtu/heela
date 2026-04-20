import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProjectPage(props: PageProps) {
  const { slug } = await props.params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const project = user.projects.find((p) => p.slug === slug);
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <nav className="mb-6 text-sm text-ink-500">
        <Link href="/projects" className="hover:text-ink-900">
          ← Projects
        </Link>
      </nav>

      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="mt-1 font-mono text-sm text-ink-500">{project.slug}</p>
        </div>
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">
          {project.role}
        </span>
      </header>

      <section className="grid gap-6">
        <div className="card">
          <h2 className="mb-2 font-semibold">Add a customer domain</h2>
          <p className="mb-4 text-sm text-ink-500">
            This UI is a stub. For now, your backend registers domains via the
            SDK.
          </p>
          <pre className="overflow-x-auto rounded-md bg-ink-50 px-3 py-3 text-xs text-ink-900">
            <code>{`import { HeeClient } from "@hee/sdk";

const hee = new HeeClient({ token: process.env.HEE_API_TOKEN! });

await hee.domains.register({
  hostname: "docs.acme.com",
  metadata: { workspaceSlug: "acme" },
});`}</code>
          </pre>
        </div>

        <div className="card">
          <h2 className="mb-2 font-semibold">Customer DNS instructions</h2>
          <p className="text-sm text-ink-500">
            Have your customer add this CNAME in their DNS provider:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-ink-50 px-3 py-3 text-xs text-ink-900">
            <code>docs.acme.com  CNAME  edge.hee.la</code>
          </pre>
          <p className="mt-3 text-xs text-ink-500">
            First request after DNS propagates issues a Let&apos;s Encrypt cert
            (5–10 s cold). Subsequent requests are served from the cached cert.
          </p>
        </div>
      </section>
    </main>
  );
}
