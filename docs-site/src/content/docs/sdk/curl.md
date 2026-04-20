---
title: curl / direct HTTP
description: Use Hee directly via HTTP — no SDK required.
sidebar:
  order: 2
---

The Hee API is plain REST over HTTPS. Every endpoint is callable with `curl`. Use this when:

- Your language doesn't have an official SDK yet
- You're testing or debugging
- You prefer shell scripts over npm packages

## Auth

All endpoints use HTTP Bearer authentication. Set your token once:

```bash
export HEE_API_TOKEN="hee_0000000000000000000000000000000000000000000000000000000000000000"
export HEE_API_URL="https://api.hee.la"
```

## Register a domain

```bash
curl -X POST "$HEE_API_URL/v1/edge/domains" \
  -H "Authorization: Bearer $HEE_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "hostname": "docs.customer.com",
    "metadata": { "workspaceId": "ws_abc123" }
  }'
```

## List domains

```bash
curl "$HEE_API_URL/v1/edge/domains" \
  -H "Authorization: Bearer $HEE_API_TOKEN" | jq .
```

## Remove a domain

```bash
curl -X DELETE "$HEE_API_URL/v1/edge/domains/docs.customer.com" \
  -H "Authorization: Bearer $HEE_API_TOKEN" \
  -w "HTTP %{http_code}\n"
# HTTP 204
```

## Resolve a domain (metadata lookup)

```bash
curl "$HEE_API_URL/v1/edge/resolve?hostname=docs.customer.com" \
  -H "Authorization: Bearer $HEE_API_TOKEN" | jq .
```

Returns the domain record with `projectSlug`, `upstreamUrl`, and your stored `metadata`. Use this from your upstream app to route multi-tenant requests.

## Health check (unauthenticated)

```bash
curl "$HEE_API_URL/healthz"
# {"status":"ok"}
```

## Writing a custom client

The API shapes are stable and typed. Every endpoint returns JSON. Recipe for a minimal client in any language:

1. Set `Authorization: Bearer <token>` and `Content-Type: application/json`.
2. JSON-encode the body for POST / PATCH.
3. Parse JSON response.
4. Check HTTP status — 2xx OK, 4xx your fault, 5xx our fault.

Nothing stateful. No OAuth dance. No polling required.

## Rate limits

The control plane API itself isn't rate-limited today (Phase 2 adds per-project 100 req/s limits). The underlying Let's Encrypt issuance follows their [rate limits](https://letsencrypt.org/docs/rate-limits/) — 50 certs per week per registered domain.
