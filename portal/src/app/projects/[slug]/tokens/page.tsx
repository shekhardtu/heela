import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { heeApi } from "@/lib/hee-api";
import { SESSION_COOKIE, getSessionUser } from "@/lib/session";
import { issueTokenAction, revokeTokenAction } from "../actions";
import { CopyTokenClient } from "./copy-token.client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ new?: string; err?: string }>;
}

export default async function TokensPage(props: PageProps) {
  const { slug } = await props.params;
  const { new: newToken, err } = await props.searchParams;

  const user = await getSessionUser();
  if (!user) redirect("/login");
  const membership = user.projects.find((p) => p.slug === slug);
  if (!membership) notFound();

  const store = await cookies();
  const session = store.get(SESSION_COOKIE)!.value;
  const tokens = await heeApi.portal.listTokens(session, slug);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-ink-500">
        <Link href={`/projects/${slug}`} className="hover:text-ink-900">
          ← {membership.name}
        </Link>
      </nav>

      <header className="mb-10">
        <h1 className="text-2xl font-semibold">API tokens</h1>
        <p className="mt-1 text-sm text-ink-500">
          Use these in your backend with <code className="font-mono">@heela/sdk</code>{" "}
          to register and remove customer domains.
        </p>
      </header>

      {newToken && <JustIssued token={newToken} />}

      {membership.role === "owner" ? (
        <IssueForm slug={slug} err={err} />
      ) : (
        <div className="card text-sm text-ink-500">
          Members can&apos;t issue tokens. Ask an owner to create one for you.
        </div>
      )}

      <div className="mt-8">
        <TokenList slug={slug} tokens={tokens} canRevoke={membership.role === "owner"} />
      </div>
    </main>
  );
}

function IssueForm({ slug, err }: { slug: string; err?: string }) {
  return (
    <form
      action={issueTokenAction.bind(null, slug)}
      className="card space-y-4"
    >
      <h2 className="font-semibold">Issue a new token</h2>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-500">
          Label
        </span>
        <input
          className="input"
          name="name"
          required
          maxLength={120}
          placeholder="production"
        />
        <span className="mt-1 block text-xs text-ink-500">
          Just a human-readable label so you can identify this token later.
        </span>
      </label>
      {err === "issue-failed" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t issue the token. Try again.
        </div>
      )}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary">
          Issue token
        </button>
      </div>
    </form>
  );
}

function JustIssued({ token }: { token: string }) {
  return (
    <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-5">
      <div className="flex items-center gap-2">
        <svg
          className="h-4 w-4 text-yellow-700"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.67-1.16 2.36-1.16 3.03 0l6.28 10.875c.67 1.16-.17 2.625-1.515 2.625H3.72c-1.345 0-2.185-1.465-1.515-2.625L8.485 2.495zM10 6a1 1 0 011 1v4a1 1 0 11-2 0V7a1 1 0 011-1zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <strong className="text-sm text-yellow-900">
          Save this token now — it won&apos;t be shown again
        </strong>
      </div>
      <p className="mt-2 text-xs text-yellow-800">
        Store it as <code className="font-mono">HEE_API_TOKEN</code> in your
        backend&apos;s secrets manager. If you lose it, revoke it and issue a new one.
      </p>
      <CopyTokenClient token={token} />
    </div>
  );
}

function TokenList({
  slug,
  tokens,
  canRevoke,
}: {
  slug: string;
  tokens: Array<{
    tokenId: string;
    name: string;
    prefix: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
  }>;
  canRevoke: boolean;
}) {
  if (tokens.length === 0) {
    return (
      <div className="card text-sm text-ink-500">
        No tokens issued yet. Create one above to get started.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-ink-200">
      <table className="w-full text-sm">
        <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
          <tr>
            <th className="px-4 py-2">Label</th>
            <th className="px-4 py-2">Prefix</th>
            <th className="px-4 py-2">Last used</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t.tokenId} className="border-t border-ink-200">
              <td className="px-4 py-3">{t.name}</td>
              <td className="px-4 py-3 font-mono text-xs">{t.prefix}…</td>
              <td className="px-4 py-3 text-xs text-ink-500">
                {t.lastUsedAt
                  ? new Date(t.lastUsedAt).toLocaleString()
                  : "never"}
              </td>
              <td className="px-4 py-3">
                {t.revokedAt ? (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">
                    revoked
                  </span>
                ) : (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    active
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {canRevoke && !t.revokedAt && (
                  <form
                    action={revokeTokenAction.bind(null, slug, t.tokenId)}
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
  );
}
