---
title: Migrating from Cloudflare for SaaS
description: Step-by-step playbook for moving custom domains off Cloudflare for SaaS to Hee.
sidebar:
  order: 2
---

If you're on Cloudflare for SaaS and bumping into Worker-route gotchas or Enterprise-only limits, this is the playbook to move.

## Before you start

- [ ] **Audit current domains** — list every domain currently registered in CF for SaaS. Export the list.
- [ ] **Identify your upstream(s)** — where do requests end up? (Likely Pages, Workers, or your origin.)
- [ ] **Choose a cutover window** — ideally a low-traffic hour; plan for <10 min per domain.
- [ ] **Create a Hee project** matching your CF-for-SaaS deployment. Use the same `upstreamUrl` so behavior matches exactly.

## Strategy: per-domain cutover (safe, recommended)

Migrate one domain at a time. Each domain has a ~60-second flip where DNS TTL hasn't propagated.

### Per-domain steps

1. **Register in Hee first**:
   ```bash
   curl -X POST https://api.hee.la/v1/edge/domains \
     -H "Authorization: Bearer $HEE_API_TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"hostname":"docs.customer.com","metadata":{"workspaceId":"ws_abc"}}'
   ```
2. **Test routing** (before changing DNS):
   ```bash
   # Force resolution to Hee's edge via --resolve
   curl --resolve docs.customer.com:443:49.13.214.28 \
     https://docs.customer.com/
   ```
   If this 502s, fix your upstream URL in the project **before** touching DNS.
3. **Change the CNAME**:
   ```
   docs.customer.com  CNAME  edge.hee.la     (was: customers.yourapp.com or similar)
   ```
4. **Monitor**:
   ```bash
   watch -n 10 'curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://docs.customer.com/'
   ```
   Expect 200s within 5-15 min as DNS propagates.
5. **Verify in portal** — `verified: true` should appear within 5 min after DNS propagates.
6. **Remove from Cloudflare for SaaS** — once you see all-green, deregister the hostname from CF's Custom Hostnames list to stop double-billing.

## Strategy: big-bang cutover (fast, riskier)

Use only when you have <10 domains or they're all internal.

1. Register all domains in Hee in advance (safe — no DNS change yet).
2. Test each with `curl --resolve` as above.
3. Update all CNAMEs at your DNS provider in one session.
4. Monitor error rates for 1 hour.
5. Remove all hostnames from CF for SaaS after 24 hours of stability.

## Worker routes: the gotcha

If your CF for SaaS setup relied on Workers (auth, routing, A/B tests), **none of that carries over to Hee today.** Options:

- **Move the logic into your app** — often cleaner anyway. Your upstream can run middleware.
- **Keep Workers in front of Hee** — proxy from Cloudflare to Hee's edge. Ugly but works.
- **Wait for Phase 2** — Hee is adding edge middleware in Phase 2 (2026 Q3). Starlight currently has no alternative built-in.

## Let's Encrypt vs Cloudflare Universal SSL

CF for SaaS issues via Cloudflare's cert authority (Google Trust Services LLC typically). Hee issues via Let's Encrypt. Both are publicly trusted — zero browser impact.

One difference: **cert expiry**. CF issues 90-day certs; Hee also issues 90-day certs but renews at 60 days. If your customer had HSTS with long max-age pointing at CF's authority, that's fine — HSTS doesn't bind CA.

## Rollback

If Hee misbehaves:

1. Revert the CNAME back to your old CF for SaaS record.
2. DNS propagation will restore the old path in 5-15 min.
3. The Hee domain registration stays in Hee — re-use it when you fix the issue.

No destructive migration operations. You can flip back and forth safely.

## Hee API compared

| Cloudflare for SaaS | Hee |
|---------------------|-----|
| `POST /zones/{id}/custom_hostnames` | `POST /v1/edge/domains` |
| `GET /zones/{id}/custom_hostnames` | `GET /v1/edge/domains` |
| `DELETE /zones/{id}/custom_hostnames/{id}` | `DELETE /v1/edge/domains/{hostname}` |
| Custom metadata per hostname | Opaque `metadata` JSON |
| Enterprise-only `custom_origin_sni` | Built-in, free |
| TXT record verification | CNAME-based verification (automatic) |

The shapes are similar enough that migrating your integration is typically a 1-hour swap.

## Support

Stuck on migration? Email [ops@hee.la](mailto:ops@hee.la) with your CF zone ID and your Hee project slug. We've done this migration ourselves — we can usually unblock in under an hour.
