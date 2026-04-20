// Minimal dev-only mock of the control-plane `/_check-hostname` endpoint.
// Real implementation is NestJS + Postgres; this stand-in uses an in-memory
// allowlist so we can test the Caddy flow end-to-end without external deps.
//
// Zero npm deps — runs with `node server.js` on any Node 20+.
//
// Env:
//   PORT                 — listen port (default 5301)
//   ALLOWED_HOSTNAMES    — comma-separated allowlist (default: engineering.loopai.com,docs.acme.test)

import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 5301);
const ALLOWLIST = new Set(
  (process.env.ALLOWED_HOSTNAMES || "engineering.loopai.com,docs.acme.test,test.local")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/_check-hostname") {
    // Caddy's on_demand_tls ask hook:
    //   200 → issue cert, 4xx/5xx → deny
    const domain = (url.searchParams.get("domain") || "").toLowerCase();
    const allowed = ALLOWLIST.has(domain);
    log(`[check-hostname] domain=${domain} allowed=${allowed}`);
    res.statusCode = allowed ? 200 : 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ domain, allowed }));
    return;
  }

  if (url.pathname === "/_list") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ allowlist: [...ALLOWLIST] }));
    return;
  }

  if (url.pathname === "/_healthz") {
    res.end("ok");
    return;
  }

  res.statusCode = 404;
  res.end("not found");
});

server.listen(PORT, () => {
  log(`mock control-plane listening on :${PORT}`);
  log(`allowlist: ${[...ALLOWLIST].join(", ")}`);
});
