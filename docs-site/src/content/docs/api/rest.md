---
title: REST API reference
description: Every endpoint, every parameter, every response.
sidebar:
  order: 1
---

Base URL: `https://api.hee.la`

All requests require `Authorization: Bearer <token>`. All request/response bodies are JSON.

## Domains

### `POST /v1/edge/domains`

Register a customer's hostname.

**Request**:
```json
{
  "hostname": "docs.customer.com",
  "metadata": { "workspaceId": "ws_abc123" }
}
```

**Response**: `200 OK`
```json
{
  "hostname": "docs.customer.com",
  "projectSlug": "acme-saas",
  "verified": false,
  "verifiedAt": null,
  "createdAt": "2026-04-20T21:47:38.000Z",
  "metadata": { "workspaceId": "ws_abc123" }
}
```

**Errors**:
- `400` — hostname fails FQDN validation
- `409` — hostname claimed by another project
- `402` — project over plan limit

Idempotent — re-registering the same hostname in the same project returns the existing record with merged metadata.

### `GET /v1/edge/domains`

List all domains for the token's project.

**Response**: `200 OK`
```json
[
  { "hostname": "docs.customer.com", "verified": true, ... },
  { "hostname": "app.customer.com", "verified": false, ... }
]
```

### `DELETE /v1/edge/domains/{hostname}`

Soft-delete a domain.

**Response**: `204 No Content`

**Errors**:
- `404` — hostname not found in this project

### `GET /v1/edge/resolve`

Look up routing metadata for a hostname. Used by upstream apps that need to know which project a request belongs to.

**Query**: `?hostname=docs.customer.com`

**Response**: `200 OK`
```json
{
  "hostname": "docs.customer.com",
  "projectSlug": "acme-saas",
  "upstreamUrl": "https://acme.pages.dev",
  "metadata": { "workspaceId": "ws_abc123" }
}
```

## Auth (portal)

These endpoints back the web portal. You probably don't need to call them — the portal handles magic-link + session cookies end-to-end.

### `POST /v1/auth/request-magic-link`

### `POST /v1/auth/callback`

### `GET /v1/auth/me`

### `POST /v1/auth/sign-out`

See [the edge-infra repo](https://github.com/shekhardtu/edge-infra/tree/main/control-plane/src/modules/auth-user) for request/response shapes.

## Portal (session-scoped)

These endpoints require a portal session cookie (from magic-link login), not an API token.

### `POST /v1/portal/projects`

Create a project.

### `GET /v1/portal/projects/{slug}`

Get project details.

### `POST /v1/portal/projects/{slug}/tokens`

Issue an API token. Returns the raw token **once**.

### `GET /v1/portal/projects/{slug}/tokens`

List tokens (hashed preview only).

### `DELETE /v1/portal/projects/{slug}/tokens/{tokenId}`

Revoke a token.

### `POST /v1/portal/projects/{slug}/domains`

Register a domain via portal (parallel to API-token path).

### `GET /v1/portal/projects/{slug}/domains`

List domains.

### `DELETE /v1/portal/projects/{slug}/domains/{hostname}`

Remove a domain.

## Health

### `GET /healthz`

Unauthenticated. Returns `{"status":"ok"}` if the control plane is healthy.

### `GET /_check-hostname?domain=example.com`

Internal — called by Caddy's `on_demand_tls` hook. Returns 200 if a domain is registered, 4xx otherwise. Not documented for external use; subject to change.

## OpenAPI spec

Machine-readable OpenAPI 3.0 is coming in Phase 2. Until then, this page + the [TypeScript SDK types](/sdk/typescript/) are the canonical reference.
