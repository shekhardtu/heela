---
title: Quickstart
description: Register your first customer domain through Hee in under 10 minutes.
---

This walks through the full flow: create a project, issue an API token, register a customer's hostname, and verify traffic lands at your app.

## 1. Create an account + project

Sign in with a magic link at [app.hee.la/login](https://app.hee.la/login). You'll land on the projects list. Click **New project** and enter:

- **Name** — any friendly name (shown in portal)
- **Slug** — URL-safe identifier (`acme-saas`)
- **Upstream URL** — where your app lives (`https://acme.pages.dev` or `https://app.acme.com`)

Each project is an isolated tenancy boundary. API tokens, domains, and future billing are scoped here.

## 2. Issue an API token

From the project page, click **API tokens** → **Issue new token**. You'll see the raw token **once**. Copy it now — after 10 seconds it's masked and cannot be retrieved again.

```bash
# Save to your environment
export HEE_API_TOKEN="hee_0000000000000000000000000000000000000000000000000000000000000000"
```

:::caution
Treat API tokens like database passwords. Store them in your secrets manager, never in git. If one leaks, revoke it in the portal — this invalidates every outstanding use immediately.
:::

## 3. Register a customer's hostname

Use the API or the portal. Both are authenticated by the same token.

```bash
curl -X POST https://api.hee.la/v1/edge/domains \
  -H "Authorization: Bearer $HEE_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "hostname": "docs.customer.com",
    "metadata": { "workspaceSlug": "customer" }
  }'
```

Response:

```json
{
  "hostname": "docs.customer.com",
  "projectSlug": "acme-saas",
  "verified": false,
  "verifiedAt": null,
  "createdAt": "2026-04-20T21:47:38.000Z",
  "metadata": { "workspaceSlug": "customer" }
}
```

The `metadata` blob is opaque — Hee passes it back to you untouched at lookup time. Stick whatever you need: workspace IDs, theme overrides, feature flags.

## 4. Customer adds DNS

Tell your customer to add this record in their DNS provider (Cloudflare, Route 53, Namecheap — doesn't matter which):

```
docs.customer.com  CNAME  edge.hee.la
```

That's it. No TXT records, no CAA edits, no pre-provisioned certs.

## 5. Verify

Within 5 minutes of the DNS change, Hee's background probe flips `verified: true`:

```bash
curl https://api.hee.la/v1/edge/domains \
  -H "Authorization: Bearer $HEE_API_TOKEN" | jq '.[0]'
```

```json
{
  "hostname": "docs.customer.com",
  "verified": true,
  "verifiedAt": "2026-04-20T21:52:03.091Z",
  ...
}
```

The portal shows a green **Verified** badge. First HTTPS request to `docs.customer.com` issues a Let's Encrypt cert (~3 s) and then proxies to your upstream URL.

## 6. (Optional) Route traffic within your app

Every request Hee forwards to your upstream carries the **original** hostname in the `Host:` header. If your app routes by subdomain already, nothing else to do. If you need the Hee metadata at runtime, call:

```bash
curl "https://api.hee.la/v1/edge/resolve?hostname=docs.customer.com" \
  -H "Authorization: Bearer $HEE_API_TOKEN"
```

Returns the project slug + metadata blob you registered earlier.

## Next steps

- [Concepts: Edge, projects, domains](/concepts/edge/) — how the pieces fit
- [Guides: DNS setup for customers](/guides/dns-setup/) — copy-paste instructions you can share with your customers
- [Guides: Migrating from Cloudflare for SaaS](/guides/migration-cf-saas/)
- [API reference](/api/rest/)
