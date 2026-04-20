---
title: DNS setup for customers
description: Copy-paste instructions you can share with your customers for setting up CNAMEs at common DNS providers.
sidebar:
  order: 1
---

Your customer needs exactly one DNS change: **a CNAME record** pointing their custom domain to `edge.hee.la`. This page has copy-paste instructions per DNS provider you can include in your own docs.

## The record

```
Type:   CNAME
Name:   docs              (or @ for apex — see below)
Value:  edge.hee.la
TTL:    300 (or default)
Proxy:  DNS only (grey cloud in Cloudflare)
```

## Apex domains (like `customer.com`)

CNAMEs can't be set on apex domains per RFC 1912. Your customer has two options:

1. **Use a subdomain** instead (`www.customer.com`, `app.customer.com`). 95% of cases.
2. **CNAME flattening** (Cloudflare, DNSimple, Namecheap ALIAS) — provider resolves the CNAME internally and serves an A record.
3. **Apex as A record** — Hee publishes `edge.hee.la` A records; your customer points `@` at those IPs. Fragile (IPs change when we add regions); avoid unless no alternative.

## Per-provider instructions

### Cloudflare

1. Log into dash.cloudflare.com, select the zone.
2. DNS → Records → **Add record**
3. Set:
   - Type: **CNAME**
   - Name: `docs` (or whatever subdomain)
   - Target: `edge.hee.la`
   - Proxy status: **DNS only** (grey cloud, NOT orange)
   - TTL: Auto
4. Save.

:::caution
Proxy status **must** be DNS only. Orange-cloud (proxied) breaks TLS because Cloudflare tries to terminate SSL on your behalf.
:::

### Route 53

1. Console → Route 53 → Hosted zones → your zone
2. **Create record**
3. Set:
   - Record name: `docs`
   - Record type: **CNAME**
   - Value: `edge.hee.la`
   - TTL: 300
   - Routing policy: Simple
4. Create.

### Namecheap

1. Dashboard → Domain list → **Manage** → Advanced DNS
2. **Add new record**
3. Set:
   - Type: **CNAME Record**
   - Host: `docs`
   - Value: `edge.hee.la.` (trailing dot important)
   - TTL: Automatic
4. Save.

### Google Domains / Squarespace

1. My domains → DNS → Custom records
2. **Manage custom records** → Create new record
3. Set:
   - Host: `docs`
   - Type: **CNAME**
   - TTL: 1H
   - Data: `edge.hee.la.` (trailing dot)
4. Save.

### Gandi / GoDaddy / generic registrar

Same shape everywhere. Look for: DNS management → add CNAME → name = subdomain, value = `edge.hee.la.`, TTL = 300.

## Verifying propagation

Your customer can check their DNS is live:

```bash
dig +short CNAME docs.customer.com
# Expected: edge.hee.la.
```

Or use the web tool at [https://dnschecker.org](https://dnschecker.org) — paste the hostname, select CNAME, run.

## What happens after DNS is live

1. Hee's probe notices the CNAME within 5 minutes → flips the domain to **verified** in the portal.
2. First HTTPS request triggers a Let's Encrypt cert issuance (~3 s cold).
3. All subsequent requests are fast — the cert is cached at the edge.

No further customer action required.

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Domain stays "Unverified" after 30 min | CNAME not set, or proxied (Cloudflare orange cloud) | Check `dig +short CNAME` returns `edge.hee.la.`; switch Cloudflare to grey cloud |
| `DNS_PROBE_FINISHED_NXDOMAIN` in browser | DNS hasn't propagated yet | Wait 5-30 min; verify with `dig` |
| `NET::ERR_CERT_AUTHORITY_INVALID` | First request hasn't hit Hee yet (no cert issued) | Reload after 10 s; Let's Encrypt issues on first request |
| 502 Bad Gateway | Hee edge is up but your upstream isn't | Check your project's upstream URL; test it directly |
