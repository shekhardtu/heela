---
title: Domains
description: How Hee represents customer-owned hostnames and manages their lifecycle.
sidebar:
  order: 3
---

A **domain** in Hee is a hostname (FQDN) that one of your customers owns and wants to route through the edge to your application.

## Lifecycle

```
┌─────────┐  register   ┌────────────┐  CNAME    ┌──────────┐  5 min     ┌──────────┐
│ Created │ ──────────▶ │ Unverified │ ────────▶ │ DNS set   │ ────────▶ │ Verified │
└─────────┘             └────────────┘           └──────────┘            └──────────┘
                                                                              │
                                                                              │ first request
                                                                              ▼
                                                                        ┌──────────┐
                                                                        │ Cert     │
                                                                        │ issued   │
                                                                        └──────────┘
```

### Stages

1. **Registered** — You POST the hostname to `/v1/edge/domains`. Hee stores it; no DNS or cert yet.
2. **Unverified** — Customer hasn't yet added the CNAME, or the change hasn't propagated.
3. **Verified** — Hee's probe (every 5 min) confirms the CNAME points to `edge.hee.la`.
4. **Cert issued** — First HTTPS request to the domain triggers Let's Encrypt issuance (~3 s). Subsequent requests serve the cached cert.

## Fields

```typescript
interface Domain {
  hostname: string;           // lowercased FQDN, e.g. "docs.customer.com"
  projectSlug: string;        // owning project
  verified: boolean;          // CNAME confirmed
  verifiedAt: string | null;  // ISO timestamp of first successful verify
  createdAt: string;          // ISO timestamp of registration
  metadata: Record<string, unknown>;  // opaque blob you control
}
```

## Metadata passthrough

The `metadata` field is an arbitrary JSON object that Hee stores with the domain and returns verbatim at lookup time (`GET /v1/edge/resolve?hostname=...`).

Use it to carry anything your upstream needs to know about the domain:

```json
{
  "workspaceId": "ws_abc123",
  "theme": "dark",
  "planTier": "pro",
  "regionHint": "us-east"
}
```

Metadata is never exposed externally — only tokens scoped to the owning project can read it.

## Cross-tenant uniqueness

A hostname can only belong to **one project across all of Hee**. If two projects try to register the same domain, the second one gets a `409 Conflict`. This prevents tenant-A from hijacking tenant-B's domain.

## Soft delete

Removing a domain is a soft delete. The row stays in the database with `removedAt` set; the cert remains valid until natural expiry (~90 days). This gives your support team a grace window if a customer deletes by accident.

## One-way verification

Verification is one-way. Once a domain is verified, we never mark it unverified — even if the CNAME temporarily breaks. Transient DNS outages shouldn't flip a production badge; genuine removals show up as cert renewal failures (which we alert on separately).
