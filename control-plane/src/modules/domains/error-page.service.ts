import { Injectable, Logger } from "@nestjs/common";
import { DomainsService } from "./domains.service";

interface CacheEntry {
  html: string;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;

/**
 * Fetches + caches tenants' custom error pages so Caddy's handle_errors hook
 * doesn't incur a network round-trip per 5xx. Per-URL cache, TTL 60s.
 *
 * If the project hasn't set an errorPageUrl, or the fetch fails, we render
 * a minimal, unbranded fallback so the visitor always sees *something*.
 */
@Injectable()
export class ErrorPageService {
  private readonly log = new Logger(ErrorPageService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly domains: DomainsService) {}

  async renderFor(hostname: string, status: number): Promise<string> {
    const hit = await this.domains.lookup(hostname);
    const url = hit?.project.errorPageUrl ?? null;
    if (url) {
      const html = await this.fetchCached(url);
      if (html) return html;
    }
    return this.fallback(hostname, status);
  }

  private async fetchCached(url: string): Promise<string | null> {
    const cached = this.cache.get(url);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.html;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3_000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "Hee/1.0 (+https://hee.la)" },
      });
      clearTimeout(timer);
      if (!res.ok) {
        this.log.warn(`error-page fetch ${url} returned ${res.status}`);
        return null;
      }
      const html = await res.text();
      // Bound in-memory cache: 200 entries max.
      if (this.cache.size > 200) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }
      this.cache.set(url, { html, fetchedAt: now });
      return html;
    } catch (err) {
      this.log.warn(`error-page fetch ${url} failed: ${(err as Error).message}`);
      return null;
    }
  }

  private fallback(hostname: string, status: number): string {
    const title = status >= 502 && status <= 504 ? "Upstream unavailable" : "Something went wrong";
    const detail =
      status === 502
        ? "The origin server didn't respond."
        : status === 503
          ? "The origin server is temporarily unavailable."
          : status === 504
            ? "The origin server timed out."
            : `The origin server returned ${status}.`;
    const safeHost = escapeHtml(hostname || "this site");
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${status} · ${escapeHtml(title)}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#cbd5e1;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
  .card{max-width:440px;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:2rem;text-align:center}
  h1{margin:0 0 .5rem 0;font-size:2rem;color:#f1f5f9}
  p{margin:.5rem 0;font-size:.95rem;line-height:1.5}
  code{font-family:ui-monospace,SFMono-Regular,monospace;background:#0f172a;padding:.15rem .4rem;border-radius:4px;font-size:.85rem}
  .status{color:#fb923c;font-weight:600;font-size:.9rem;letter-spacing:.05em;text-transform:uppercase}
</style>
</head>
<body>
  <div class="card">
    <p class="status">${status}</p>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(detail)}</p>
    <p style="margin-top:1.5rem;font-size:.8rem;color:#64748b">Requested: <code>${safeHost}</code></p>
  </div>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
