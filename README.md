# Hee

**Custom customer domains for SaaS — without Cloudflare for SaaS pricing.**

Hee is a shared edge that lets you register your customers' hostnames, issue Let's Encrypt certs on demand, and proxy traffic to the right upstream app. Think *Cloudflare for SaaS*, but open source, predictable pricing, and you own the box.

- **Site:** [hee.la](https://hee.la)
- **Portal:** [app.hee.la](https://app.hee.la)
- **Docs:** [docs.hee.la](https://docs.hee.la)
- **API:** [api.hee.la](https://api.hee.la)

## What it does

Your customer adds one DNS record:

```
docs.customer.com  CNAME  edge.hee.la
```

Hee's edge answers the first HTTPS request, issues a Let's Encrypt cert in ~3 seconds, and proxies traffic to your app with the original `Host:` header intact.

Under the hood:

- **Caddy 2** — on-demand TLS with an `ask` hook that checks every hostname against the control plane before issuing a cert (blocks ACME abuse).
- **NestJS control plane** — stores projects, domains, tokens, and a small auth surface for the portal.
- **Next.js portal** — customers sign in with a magic link, create projects, register domains, and issue/revoke API tokens.
- **Postgres** — single source of truth for the control plane.
- **Hetzner** — one small ARM box (€4.99/mo) is enough to serve hundreds of customer domains in alpha.

## Status

Phase 1 (alpha) is live. Real traffic flowing for a handful of design-partner tenants. Not yet recommended for production workloads outside the design-partner group. See [`docs/shared-edge-service-productization.md`](docs/shared-edge-service-productization.md) if it exists, or the roadmap section below.

## Layout

```
edge-infra/
├── infra/
│   ├── cloud-init/edge-1.yml    # first-boot bootstrap
│   ├── caddy/Caddyfile          # routing + on_demand_tls
│   └── hcloud/provision.sh      # Hetzner create wrapper
├── control-plane/               # NestJS API
├── portal/                      # Next.js 15 portal
├── marketing/                   # Astro site at hee.la
├── docs-site/                   # Astro + Starlight at docs.hee.la
├── packages/sdk/                # @heela/sdk (TypeScript)
└── scripts/                     # dev + ops helpers
```

## Quickstart (local dev)

```bash
git clone https://github.com/shekhardtu/heela.git hee
cd hee
cp .env.example .env

# Fast iter (Caddy + mock control plane)
docker compose -f docker-compose.dev.yml up

# Full stack (Caddy + NestJS + Postgres)
docker compose -f docker-compose.full.yml up --build

# Smoke test
bash scripts/test-local.sh
```

## Using Hee (as a SaaS operator)

1. Sign in at [app.hee.la/login](https://app.hee.la/login) (magic link).
2. Create a project, issue an API token.
3. Register a customer hostname via the API or portal.
4. Tell the customer to CNAME to `edge.hee.la`.
5. Hee provisions the cert and proxies traffic on first request.

Full walkthrough: [docs.hee.la/quickstart](https://docs.hee.la/quickstart/).

## Roadmap

- **Phase 1 (alpha, done):** single-region Hetzner, on-demand TLS, portal, SDK, magic-link auth.
- **Phase 1.5:** DNS verification probe, marketing site, docs site, status page.
- **Phase 2 (public beta):** Stripe billing, rate limiting, multi-region edge, Prometheus metrics, project member invites.
- **Phase 3 (scale):** audit logs, branded error pages, email delivery hooks, wildcard hostnames.
- **Phase 4 (enterprise):** bring-your-own-cert, SAML SSO, SOC 2, dedicated edges.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) — free to use, modify, and self-host. If you deploy Hee for your own SaaS, a star on the repo is appreciated but not required.
