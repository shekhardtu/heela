import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE, getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AuditPage(props: PageProps) {
  const { slug } = await props.params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const membership = user.projects.find((p) => p.slug === slug);
  if (!membership) notFound();

  const store = await cookies();
  const session = store.get(SESSION_COOKIE)!.value;
  const events = await heeApi.portal.listAudit(session, slug, 200);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <nav className="mb-6 text-sm text-ink-500">
        <Link href={`/projects/${slug}`} className="hover:text-ink-900">
          ← {slug}
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="mt-1 text-sm text-ink-500">
          Every mutating action taken on this project. Last 200 events.
        </p>
      </header>

      {events.length === 0 ? (
        <div className="card text-sm text-ink-500">
          No events yet. Actions like issuing tokens, registering domains, or inviting members will appear here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-200">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Target</th>
                <th className="px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.auditEventId} className="border-t border-ink-200 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500" title={e.createdAt}>
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {e.actorEmail ?? <span className="text-ink-500">{e.actorType}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-ink-100 px-2 py-0.5 font-mono text-xs">
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <span className="text-ink-500">{e.targetType}/</span>
                    {e.targetId}
                  </td>
                  <td className="px-4 py-3">
                    {Object.keys(e.metadata).length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-ink-500 hover:text-ink-900">
                          {Object.keys(e.metadata).length} field{Object.keys(e.metadata).length === 1 ? "" : "s"}
                        </summary>
                        <pre className="mt-2 overflow-x-auto rounded bg-ink-50 p-2 text-[11px]">
                          {JSON.stringify(e.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
