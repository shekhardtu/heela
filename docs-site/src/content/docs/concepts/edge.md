---
title: Edge
description: What Hee's edge does and how requests flow through it.
sidebar:
  order: 1
---

The **edge** is the part of Hee that sits between your customer's domain and your upstream application. It's a Caddy server (currently single-region in Falkenstein, Germany) that terminates TLS, verifies the request, and reverse-proxies to your app.

## Request flow

```
Customer browser
    │
    │ 1. DNS: docs.customer.com → CNAME → edge.hee.la → 49.13.214.28
    ▼
┌─────────────────────────┐
│  Hee Edge (Caddy)        │
│  - TLS termination       │
│  - on_demand_tls issue   │
│  - ask http://control-   │
│    plane/_check-hostname │
└────────────┬────────────┘
             │ 2. Reverse proxy with Host: docs.customer.com intact
             ▼
┌─────────────────────────┐
│  Your upstream          │
│  (acme.pages.dev)       │
│  - Route by Host header │
│  - Serve content        │
└─────────────────────────┘
```

## What the edge does

| Concern | Handled by Hee | Handled by you |
|---------|----------------|----------------|
| TLS termination | ✅ | — |
| Cert issuance & renewal | ✅ (Let's Encrypt) | — |
| Hostname verification (is this a real customer?) | ✅ (control plane) | — |
| HTTP → HTTPS redirect | ✅ | — |
| Routing to your app | ✅ (one `upstreamUrl` per project) | — |
| Multi-tenant routing *inside* your app | — | ✅ (by `Host:` header) |
| Auth / sessions / business logic | — | ✅ |

## What the edge does *not* do (yet)

- **Edge middleware** — arbitrary code at the edge is a Phase 2 feature
- **Response rewriting** — the edge is a transparent proxy today
- **Per-hostname rate limiting** — planned for Phase 2
- **Custom error pages** — the edge returns Caddy defaults on upstream failure

## Self-hosting

The edge is [Caddy 2.11](https://caddyserver.com) configured for `on_demand_tls` with a single `ask` hook to the Hee control plane. If you ever want to run your own edge — for compliance, latency, or sovereignty reasons — the entire Caddyfile is in the repo. Swap the `ask` target to your own control plane and you're done.

See [Guides: Self-hosting the edge](/guides/self-hosting/) for the full walkthrough.
