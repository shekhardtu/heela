---
title: TypeScript SDK
description: Official TypeScript/JavaScript SDK for the Hee API.
sidebar:
  order: 1
---

`@heela/sdk` is a thin, zero-dependency TypeScript client for the Hee control plane. Works in Node.js 18+, Deno, Bun, and Cloudflare Workers.

:::note
The package will be published to npm alongside Phase 2 public release. Until then, vendor it from the [edge-infra repo](https://github.com/shekhardtu/heela/tree/main/packages/sdk) or install from a git URL.
:::

## Install

```bash
npm install @heela/sdk
# or
yarn add @heela/sdk
# or
bun add @heela/sdk
```

## Configure

```typescript
import { HeeClient } from "@heela/sdk";

const hee = new HeeClient({
  token: process.env.HEE_API_TOKEN!,
  // optional:
  // baseUrl: "https://api.hee.la",  // default
  // timeoutMs: 5000,                 // default
});
```

:::caution
The SDK is **server-side only**. Never ship API tokens to browser JavaScript — there is no safe way to use Hee tokens from the browser. Proxy all calls through your own backend.
:::

## Register a domain

```typescript
const domain = await hee.domains.register({
  hostname: "docs.customer.com",
  metadata: {
    workspaceId: "ws_abc123",
    theme: "dark",
  },
});

console.log(domain);
// {
//   hostname: "docs.customer.com",
//   projectSlug: "acme-saas",
//   verified: false,
//   verifiedAt: null,
//   createdAt: "2026-04-20T21:47:38.000Z",
//   metadata: { workspaceId: "ws_abc123", theme: "dark" }
// }
```

Registering the same hostname twice is **idempotent** — the second call returns the existing record. If you pass new `metadata`, it's merged in.

## List domains

```typescript
const domains = await hee.domains.list();
// Returns all domains owned by this token's project.
```

## Remove a domain

```typescript
await hee.domains.remove("docs.customer.com");
// Soft delete. Cert retained for 24h in case of re-add.
```

## Error handling

All errors are instances of `HeeError`:

```typescript
import { HeeError } from "@heela/sdk";

try {
  await hee.domains.register({ hostname: "docs.customer.com" });
} catch (err) {
  if (err instanceof HeeError) {
    if (err.status === 409) {
      // hostname is claimed by another project
    } else if (err.status === 402) {
      // project is over its plan limit
    } else {
      // network / server issue
    }
  }
}
```

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 204 | Success (no body, e.g. DELETE) |
| 400 | Invalid hostname format |
| 401 | Invalid or revoked token |
| 402 | Over plan limit |
| 403 | Token not authorized for this project |
| 404 | Hostname not found (on remove) |
| 409 | Hostname claimed by another project |
| 5xx | Control plane outage — retry with backoff |

## Timeouts & retries

The SDK does **not** retry automatically — that's your caller's responsibility. Recommended pattern:

```typescript
async function registerWithRetry(input: { hostname: string }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await hee.domains.register(input);
    } catch (err) {
      if (err instanceof HeeError && err.status < 500) throw err; // don't retry 4xx
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
  throw new Error("Hee registration failed after 3 attempts");
}
```

## Custom fetch / testing

Pass your own `fetch` implementation for testing or non-standard runtimes:

```typescript
import { HeeClient } from "@heela/sdk";

const hee = new HeeClient({
  token: "hee_test_...",
  fetch: customFetch, // e.g. undici, node-fetch, mocked fetch
});
```

## Source

[github.com/shekhardtu/heela/tree/main/packages/sdk](https://github.com/shekhardtu/heela/tree/main/packages/sdk)
