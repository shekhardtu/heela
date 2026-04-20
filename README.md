Shared edge service for custom customer domains across Colbin, YoFix, Kundali.ai (and eventually a standalone SaaS product).

Built on Caddy + Hetzner. Covers per-customer Let's Encrypt issuance via on-demand TLS, hostname → workspace resolution, and reverse proxying to the right upstream app.

Design docs (Colbin):

- [Shared Edge Service — Multi-Product Custom Domain Platform](https://colbin.com/bin/shared-edge-service-multi-prod-sV-CsSd0) — reference architecture
- Productization plan (not yet in Colbin — see `docs/shared-edge-service-productization.md`)

## Layout

```
edge-infra/
├── infra/
│   ├── cloud-init/edge-1.yml      # first-boot bootstrap for edge-1
│   ├── caddy/Caddyfile            # routing + on_demand_tls config
│   └── hcloud/provision.sh        # idempotent Hetzner create script
├── control-plane/                 # NestJS API — domain_registry + /_check-hostname (Phase 1.5)
├── portal/                        # Next.js customer portal (Phase 2)
└── docs/
    └── runbook.md                 # ops guide
```

## Current phase

**Phase 1 — Alpha.** Single box at Hetzner `fsn1` (Falkenstein), internal-use only for Colbin / YoFix / Kundali. No paying customers yet.

## Infra state

- Hetzner project: `edge-infra`
- Server: `edge-1` (CAX21, ARM, 4 vCPU / 8 GB, €6.49/mo)
- SSH key: `hari-mac` (private key at `~/.ssh/colbin-edge` on Hari's laptop)
- DNS: `edge.colbin.com` → A-record pointing at edge-1's IP (grey-cloud, not proxied)

## Roadmap

See [Productization Plan](docs/shared-edge-service-productization.md) for the full Phase 1 → 4 plan.
