"use client";

import { useEffect, useState } from "react";

/**
 * Renders the raw token once with a copy button. After 10 seconds, masks it
 * to protect against shoulder-surfing / screen shares. The URL it was passed
 * via is already stripped on navigation (Next.js redirects, not pushState),
 * so refresh-proofing isn't needed.
 */
export function CopyTokenClient({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [masked, setMasked] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMasked(true), 10_000);
    return () => clearTimeout(t);
  }, []);

  const displayed = masked
    ? `${token.slice(0, 12)}${"•".repeat(16)}${token.slice(-6)}`
    : token;

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard permission denied — user can still select manually */
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2 rounded-md bg-white px-3 py-2 font-mono text-xs text-ink-900">
      <code className="flex-1 break-all select-all">{displayed}</code>
      <button
        onClick={copy}
        className="shrink-0 rounded bg-ink-900 px-2 py-1 text-xs text-white hover:bg-ink-950"
      >
        {copied ? "✓ copied" : "Copy"}
      </button>
    </div>
  );
}
