# Contributing to Hee

Thanks for your interest in contributing. Hee is a shared edge for custom customer domains — Caddy + on-demand Let's Encrypt + a small NestJS control plane + a Next.js portal. This doc covers the essentials for getting changes in.

## Ground rules

- Be respectful. We follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Keep changes focused. One PR per concern — easier to review, easier to revert.
- Write like you read: clear names, no dead code, no speculative abstractions.
- If you're unsure whether a change will be accepted, open an issue first to discuss.

## Development setup

```bash
# Requires Docker + Node 20+
git clone https://github.com/shekhardtu/heela.git hee
cd hee
cp .env.example .env               # fill in real values for local dev
docker compose -f docker-compose.dev.yml up   # Caddy + mock control plane (fast)
# or
docker compose -f docker-compose.full.yml up --build   # Caddy + NestJS + Postgres
```

Smoke test:

```bash
bash scripts/test-local.sh
```

## Repo layout

- `infra/` — Caddyfile, cloud-init, hcloud provisioning
- `control-plane/` — NestJS API (domains, tokens, auth, portal endpoints)
- `portal/` — Next.js 15 customer portal
- `marketing/` — Astro marketing site at hee.la
- `docs-site/` — Astro + Starlight docs at docs.hee.la
- `packages/sdk/` — TypeScript SDK (`@heela/sdk`)
- `scripts/` — dev/ops helpers

## What we're looking for

Good first issues:

- Improving docs — especially `docs-site/src/content/docs/guides/`
- SDK language bindings (Python, Go)
- Small ergonomic fixes in the portal
- Caddyfile ideas (rate limiting, security headers)

If you're unsure where to start, look for issues tagged `good first issue` or `help wanted`.

## Pull requests

1. Fork, branch from `main`.
2. Commit in small, logical units. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
3. Make sure the dev stack starts cleanly and the smoke test passes.
4. Open a PR with a clear description: what changed, why, and how you tested it.
5. We'll review within a few days.

## Reporting security issues

Please **do not** open public issues for security problems. See [SECURITY.md](SECURITY.md) for the private disclosure process.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (same as the project — see [LICENSE](LICENSE)).
