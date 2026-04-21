import Link from "next/link";
import { HeeApiError, heeApi, type InvitePreview } from "@/lib/hee-api";
import { acceptInviteAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string; err?: string }>;
}

/**
 * Invite landing page. Shows the invitee exactly which email they're
 * accepting as, then lets them click through with a single button. No
 * separate magic-link signin — the email link IS the proof of receipt.
 *
 * The email shown here comes from the server-side preview of the invite
 * record (keyed by the token hash). It's not something a client can forge;
 * the user cannot accept this invite as a different email.
 */
export default async function InviteAcceptPage(props: PageProps) {
  const { token, err } = await props.searchParams;

  if (!token) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Invalid invite link</h1>
        <p className="mt-3 text-sm text-ink-500">
          This link is missing the token parameter. Check the email you were
          sent, or ask the inviter to send a new one.
        </p>
      </Shell>
    );
  }

  if (err) {
    return (
      <Shell>
        <ErrorState code={err} />
      </Shell>
    );
  }

  let preview: InvitePreview;
  try {
    preview = await heeApi.portal.previewInvite(token);
  } catch (e) {
    const code =
      e instanceof HeeApiError && e.status === 404
        ? "not-found"
        : e instanceof HeeApiError && e.message.includes("expired")
          ? "expired"
          : e instanceof HeeApiError && e.message.includes("revoked")
            ? "revoked"
            : e instanceof HeeApiError && e.message.includes("accepted")
              ? "used"
              : "failed";
    return (
      <Shell>
        <ErrorState code={code} />
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="font-mono text-xs uppercase tracking-widest text-ink-500">
        Invitation
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        Join <span className="text-accent-600">{preview.projectName}</span>
      </h1>
      <p className="mt-3 text-sm text-ink-500">
        {preview.inviterEmail ? (
          <>
            <span className="font-mono">{preview.inviterEmail}</span> invited
            you
          </>
        ) : (
          "You've been invited"
        )}{" "}
        as{" "}
        <span className="rounded bg-ink-100 px-1.5 py-0.5 font-medium text-ink-700">
          {preview.role}
        </span>
        .
      </p>

      <div className="mt-6 rounded-lg border border-ink-200 bg-ink-50 p-4 text-sm">
        <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
          Accepting as
        </div>
        <div className="mt-1 font-mono text-ink-900">{preview.email}</div>
        <p className="mt-3 text-xs text-ink-500">
          Clicking accept will{" "}
          <strong>sign you in to Hee as this email</strong>. If this isn't
          you, don't click accept — just close this tab.
        </p>
      </div>

      <form action={acceptInviteAction.bind(null, token)} className="mt-6">
        <button className="btn-primary w-full" type="submit">
          Accept &amp; sign in as {preview.email}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-ink-500">
        Expires {new Date(preview.expiresAt).toLocaleDateString()}
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

function ErrorState({ code }: { code: string }) {
  const { title, body } =
    code === "expired"
      ? {
          title: "Invitation expired",
          body: "This link expired. Ask the project owner to send a new one.",
        }
      : code === "revoked"
        ? {
            title: "Invitation revoked",
            body: "The project owner revoked this invitation before you accepted.",
          }
      : code === "used"
        ? {
            title: "Already accepted",
            body: "This invitation has already been used. If you should have access, sign in at app.hee.la.",
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
      <Link href="/projects" className="btn-ghost mt-6 inline-flex">
        Go to projects
      </Link>
    </>
  );
}
