---
title: Self-hosting the edge
description: Run your own Hee edge + control plane for compliance, latency, or sovereignty.
sidebar:
  order: 4
---

Hee's edge and control plane are open source. Run them yourself when SaaS pricing, data residency, or compliance requirements demand it.

## What you need

- **A Linux VM** — 1-2 vCPU, 2 GB RAM handles thousands of domains. Hetzner CX22 (€4/mo), AWS t4g.small, or equivalent.
- **Static public IPv4** — customers CNAME to this.
- **A domain for your edge** — e.g., `edge.yourcompany.com`. Create an A record pointing at the VM's IP.
- **Postgres 15+** — managed (RDS, Supabase, Neon) or a container on the same box for low-volume.

## Architecture

```
Customer CNAME ─▶ edge.yourcompany.com ─▶ [Caddy on :443]
                                                │
                                                │ on_demand_tls "ask" hook
                                                ▼
                                       [Control plane on :5301]
                                                │
                                                ▼
                                         [Postgres]
```

## Install

```bash
# 1. Clone the Hee source repo
git clone https://github.com/shekhardtu/heela.git
cd heela

# 2. Provision your VM (or use your own)
#    Install Docker + Caddy on a fresh Debian/Ubuntu box.

# 3. Set up Postgres and write your control-plane.env
cat > /opt/hee/control-plane.env <<EOF
NODE_ENV=production
PORT=5301
DATABASE_URL=postgres://user:password@host:5432/hee
ADMIN_BOOTSTRAP_TOKEN=$(openssl rand -hex 32)
AUTH_JWT_SECRET=$(openssl rand -hex 48)
PORTAL_BASE_URL=https://app.yourcompany.com
POSTMARK_SERVER_TOKEN=<your postmark token or blank to disable email>
POSTMARK_FROM_ADDRESS=Hee <auth@yourcompany.com>
EOF

# 4. Copy the Caddyfile template
cp infra/caddy/Caddyfile /etc/caddy/Caddyfile
# Edit to replace hee.la references with your domain.

# 5. Launch the control plane + Postgres via compose
cp infra/server/docker-compose.server.yml /opt/hee/docker-compose.yml
cd /opt/hee
docker compose up -d --build

# 6. Reload Caddy
systemctl reload caddy

# 7. Verify
curl https://api.yourcompany.com/healthz
# Expected: {"status":"ok"}
```

## Caddyfile required changes

Replace `hee.la`, `app.hee.la`, `api.hee.la`, `edge.hee.la` with your own hostnames. The `on_demand_tls ask` endpoint must point at your control plane:

```
{
  on_demand_tls {
    ask http://localhost:5301/_check-hostname
  }
}
```

This is the critical hook that prevents anyone on the internet from issuing certs for random domains. Hee's control plane checks the registry before letting Caddy issue.

## Bootstrapping admin

After the control plane is running, use the admin bootstrap token to create your first project:

```bash
curl -X POST https://api.yourcompany.com/v1/admin/projects \
  -H "Authorization: Bearer $ADMIN_BOOTSTRAP_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Production","slug":"prod","upstreamUrl":"https://your.app"}'
```

Then issue an API token for the project (portal or API) and integrate into your SaaS.

## DNS for customers

Your customers CNAME to your edge hostname instead of `edge.hee.la`:

```
docs.customer.com  CNAME  edge.yourcompany.com
```

Everything else works the same.

## Backup

Back up `postgres-data` volume daily. That's the only stateful component — Caddy regenerates certs on demand, the control plane is stateless.

## Multi-region

To run multiple edge nodes sharing cert storage:

1. Use Redis as Caddy's cert store (`storage redis { ... }` in Caddyfile).
2. Deploy N edge nodes, each with the same Caddyfile + connected to the same Redis + control plane.
3. Put GeoDNS (Route 53 latency-based routing, Cloudflare GeoDNS) in front.

Caddy's redis storage plugin: [github.com/gamalan/caddy-tlsredis](https://github.com/gamalan/caddy-tlsredis).

## Support

Self-hosting is unsupported by the hosted Hee team, but the [edge-infra repo](https://github.com/shekhardtu/heela) accepts issues and PRs. For commercial support on self-hosted deployments, email [enterprise@hee.la](mailto:enterprise@hee.la).
