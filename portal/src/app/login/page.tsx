"use client";

import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm items-center justify-center px-6">
        <div className="card w-full text-center">
          <h1 className="mb-2 text-xl font-semibold">Check your inbox</h1>
          <p className="text-sm text-ink-500">
            We sent a magic link to <span className="font-mono">{email}</span>.
            Click it to finish signing in.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center justify-center px-6">
      <form onSubmit={submit} className="card w-full">
        <h1 className="mb-1 text-xl font-semibold">Sign in to Hee</h1>
        <p className="mb-6 text-sm text-ink-500">
          We&apos;ll email you a one-tap link.
        </p>
        <label className="mb-2 block text-xs font-medium text-ink-500">
          Work email
        </label>
        <input
          type="email"
          required
          autoFocus
          className="input"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        {err && (
          <p className="mt-3 text-xs text-red-600">{err}</p>
        )}
        <button
          type="submit"
          className="btn-primary mt-6 w-full"
          disabled={loading || !email}
        >
          {loading ? "Sending…" : "Send magic link"}
        </button>
      </form>
    </main>
  );
}
