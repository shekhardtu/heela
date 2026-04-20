import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE, getSessionUser } from "@/lib/session";
import { inviteMemberAction, revokeInvitationAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ err?: string }>;
}

export default async function MembersPage(props: PageProps) {
  const { slug } = await props.params;
  const { err } = await props.searchParams;

  const user = await getSessionUser();
  if (!user) redirect("/login");
  const membership = user.projects.find((p) => p.slug === slug);
  if (!membership) notFound();

  const store = await cookies();
  const session = store.get(SESSION_COOKIE)!.value;

  const [project, members, invitations] = await Promise.all([
    heeApi.portal.getProject(session, slug),
    heeApi.portal.listMembers(session, slug),
    heeApi.portal.listInvitations(session, slug),
  ]);

  const isOwner = membership.role === "owner";

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <nav className="mb-6 text-sm text-ink-500">
        <Link href={`/projects/${slug}`} className="hover:text-ink-900">
          ← {project.name}
        </Link>
      </nav>

      <header className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="mt-1 text-sm text-ink-500">
            {members.length} member{members.length === 1 ? "" : "s"} · {invitations.length} pending invite{invitations.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">
          {membership.role}
        </span>
      </header>

      <section className="space-y-10">
        {isOwner && <InviteForm slug={slug} err={err} />}

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
            Current members
          </h2>
          <div className="overflow-hidden rounded-xl border border-ink-200">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-t border-ink-200">
                    <td className="px-4 py-3 font-mono text-xs">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {invitations.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
              Pending invitations
            </h2>
            <div className="overflow-hidden rounded-xl border border-ink-200">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
                  <tr>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Expires</th>
                    <th className="px-4 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((i) => (
                    <tr key={i.invitationId} className="border-t border-ink-200">
                      <td className="px-4 py-3 font-mono text-xs">{i.email}</td>
                      <td className="px-4 py-3 text-ink-500">{i.role}</td>
                      <td className="px-4 py-3 text-xs text-ink-500">
                        {new Date(i.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isOwner && (
                          <form
                            action={revokeInvitationAction.bind(
                              null,
                              slug,
                              i.invitationId,
                            )}
                            className="inline"
                          >
                            <button className="text-xs font-medium text-red-600 hover:underline">
                              Revoke
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function InviteForm({ slug, err }: { slug: string; err?: string }) {
  return (
    <form action={inviteMemberAction.bind(null, slug)} className="card space-y-4">
      <h2 className="font-semibold">Invite a teammate</h2>
      <p className="text-sm text-ink-500">
        They get an email link that expires in 7 days. They sign in with a magic link using the same address.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr,160px,auto]">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">
            Email
          </label>
          <input
            className="input font-mono"
            name="email"
            type="email"
            required
            placeholder="teammate@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">
            Role
          </label>
          <select name="role" className="input" defaultValue="member">
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full sm:w-auto">Invite</button>
        </div>
      </div>
      {err && <ErrorBanner code={err} />}
    </form>
  );
}

function ErrorBanner({ code }: { code: string }) {
  const message =
    code === "already-member"
      ? "That email is already a member of this project."
      : code === "forbidden"
        ? "Only owners can invite teammates."
        : code === "email-required"
          ? "Enter an email to invite."
          : code === "invalid-role"
            ? "Pick a valid role."
            : code === "revoke-failed"
              ? "Couldn't revoke that invite — it may already be accepted or expired."
              : "Couldn't send the invite. Try again.";
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
