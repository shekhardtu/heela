import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <header className="mb-16">
        <div className="mb-2 text-sm font-semibold tracking-widest text-ink-500">
          HEE
        </div>
        <h1 className="text-5xl font-semibold tracking-tight">
          Custom domains for SaaS, without the Cloudflare Enterprise bill.
        </h1>
        <p className="mt-6 text-lg text-ink-500">
          A shared edge that handles customer-owned hostnames for any product.
          Free Let&apos;s Encrypt certs, multi-region ready, one SDK.
        </p>
        <div className="mt-10 flex gap-3">
          <Link href="/login" className="btn-primary">
            Sign in
          </Link>
          <Link
            href="https://docs.hee.la"
            className="btn-ghost"
            target="_blank"
            rel="noreferrer"
          >
            Read the docs
          </Link>
        </div>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="card">
          <h3 className="mb-2 font-semibold">One line per customer</h3>
          <pre className="overflow-x-auto rounded-md bg-ink-50 px-3 py-3 text-xs text-ink-900">
            <code>{`await hee.domains.register({
  hostname: "docs.acme.com",
  metadata: { workspaceSlug: "acme" },
});`}</code>
          </pre>
        </div>
        <div className="card">
          <h3 className="mb-2 font-semibold">Customer sets one DNS record</h3>
          <pre className="overflow-x-auto rounded-md bg-ink-50 px-3 py-3 text-xs text-ink-900">
            <code>{`docs.acme.com  CNAME  edge.hee.la`}</code>
          </pre>
        </div>
      </section>

      <footer className="mt-24 text-sm text-ink-500">
        <p>
          hee.la · <a href="mailto:ops@hee.la">ops@hee.la</a>
        </p>
      </footer>
    </main>
  );
}
