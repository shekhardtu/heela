import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-ink-500">
            Signed in as <span className="font-mono">{user.email}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/projects/new" className="btn-primary text-sm">
            New project
          </Link>
          <form action="/api/auth/sign-out" method="post">
            <button className="btn-ghost text-sm">Sign out</button>
          </form>
        </div>
      </header>

      {user.projects.length === 0 ? (
        <div className="card">
          <h2 className="font-semibold">No projects yet</h2>
          <p className="mt-2 text-sm text-ink-500">
            An admin needs to add you as a member. Contact{" "}
            <a className="underline" href="mailto:ops@hee.la">
              ops@hee.la
            </a>{" "}
            with the email you signed in with.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {user.projects.map((p) => (
            <li key={p.projectId}>
              <Link
                href={`/projects/${p.slug}`}
                className="card block transition hover:border-ink-500"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{p.name}</h2>
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">
                    {p.role}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-ink-500">{p.slug}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
