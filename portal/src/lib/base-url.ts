/**
 * Canonical public origin of the portal. `PORTAL_PUBLIC_URL` is set on the
 * container; Next.js's standalone server otherwise constructs URLs from its
 * internal bind address (0.0.0.0:3000), which leaks through NextResponse
 * redirects as `https://0.0.0.0:3000/...`.
 *
 * Use this helper anywhere the portal needs to construct a URL that'll end
 * up in a browser — Location headers, email templates, OAuth state, etc.
 */
export const PORTAL_PUBLIC_URL = (
  process.env.PORTAL_PUBLIC_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export function portalUrl(path: string): URL {
  return new URL(path, PORTAL_PUBLIC_URL);
}
