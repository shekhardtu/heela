import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { acceptInviteAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string; err?: string }>;
}

/**
 * Invite landing page. Gated by the signed link in the invitation email.
 * Flow:
 *   1. Unauthenticated → show sign-in prompt with redirect back here.
 *   2. Authenticated + matching email → click "Accept" → server action.
 *   3. Mismatched email → show error, offer sign-out.
 */
export default async function InviteAcceptPage(props: PageProps) {
  const { token, err } = await props.searchParams;
  const user = await getSessionUser();

  if (!token) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Invalid invite link</h1>
        <p className="mt-3 text-sm text-ink-500">
          This link is missing the token parameter. Check the email you were sent, or ask the inviter to send a new one.
        </p>
      </Shell>
    );
  }

  if (err) {
    return (
      <Shell>
        <ErrorState code={err} token={token} />
      </Shell>
    );
  }

  if (!user) {
    const redirectTo = `/invite/accept?token=${encodeURIComponent(token)}`;
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">You've been invited</h1>
        <p className="mt-3 text-sm text-ink-500">
          Sign in with the email this invitation was sent to, then come back to accept.
        </p>
        <Link
          href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="btn-primary mt-6 inline-flex"
        >
          Sign in to continue
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-semibold">Accept invitation</h1>
      <p className="mt-3 text-sm text-ink-500">
        You're signed in as <span className="font-mono">{user.email}</span>.
        If this is the right email, accept below.
      </p>
      <form action={acceptInviteAction.bind(null, token)} className="mt-6">
        <button className="btn-primary" type="submit">
          Accept invitation
        </button>
      </form>
      <p className="mt-4 text-xs text-ink-500">
        Invited to a different email?{" "}
        <Link
          href="/api/auth/sign-out"
          className="underline"
        >
          Sign out
        </Link>{" "}
        and sign back in with the right account.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6 py-12">
      <div className="card w-full">{children}</div>
    </main>
  );
}

function ErrorState({ code, token }: { code: string; token: string }) {
  const { title, body } =
    code === "wrong-email"
      ? {
          title: "Wrong account",
          body: "This invitation was sent to a different email. Sign out and sign back in with the invited address.",
        }
      : code === "expired"
        ? {
            title: "Invitation expired",
            body: "This link expired. Ask the project owner to send a new one.",
          }
        : code === "revoked"
          ? {
              title: "Invitation revoked",
              body: "The project owner revoked this invitation before you accepted.",
            }
          : code === "not-found"
            ? {
                title: "Invitation not found",
                body: "The link may be malformed. Check the email you received, or ask for a new invite.",
              }
            : {
                title: "Something went wrong",
                body: "We couldn't accept this invitation. Try again, or contact ops@hee.la.",
              };

  return (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-ink-500">{body}</p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/api/auth/sign-out"
          className="btn-ghost"
        >
          Sign out
        </Link>
        <Link
          href={`/invite/accept?token=${encodeURIComponent(token)}`}
          className="btn-primary"
        >
          Retry
        </Link>
      </div>
    </>
  );
}
