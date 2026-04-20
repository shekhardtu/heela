# @heela/sdk

Client library for the [Hee](https://hee.la) custom-domain edge. Each SaaS product backend imports this to register, remove, and list customer hostnames.

[![npm](https://img.shields.io/npm/v/@heela/sdk.svg)](https://www.npmjs.com/package/@heela/sdk)
[![license](https://img.shields.io/npm/l/@heela/sdk.svg)](./LICENSE)

## Install

```bash
npm install @heela/sdk
# or
yarn add @heela/sdk
# or
bun add @heela/sdk
```

## Setup

1. Create a project at [app.hee.la](https://app.hee.la)
2. Issue an API token (shown once at creation — copy immediately)
3. Store the token as `HEE_API_TOKEN` in your backend env

## Usage

```ts
import { HeeClient } from "@heela/sdk";

const hee = new HeeClient({ token: process.env.HEE_API_TOKEN! });

// Register a customer's domain
await hee.domains.register({
  hostname: "docs.customer.com",
  metadata: { workspaceId: "ws_abc123" },
});

// Tell your customer to add: docs.customer.com CNAME edge.hee.la

// List all domains under your project
const all = await hee.domains.list();

// Remove a domain (soft-delete — cert retained 24h in case of re-add)
await hee.domains.remove("docs.customer.com");
```

Server-side only. Never ship the token to browser JavaScript — proxy calls through your backend.

## Errors

All methods throw `HeeError` on non-2xx responses. The error includes `status` and `body` fields for introspection.

```ts
import { HeeClient, HeeError } from "@heela/sdk";

try {
  await hee.domains.register({ hostname: "docs.customer.com" });
} catch (err) {
  if (err instanceof HeeError) {
    if (err.status === 409) {
      // hostname already claimed by another project
    } else if (err.status === 402) {
      // project over plan limit
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
| 404 | Hostname not found |
| 409 | Hostname claimed by another project |

## Options

```ts
new HeeClient({
  token: string,
  baseUrl?: string,      // default https://api.hee.la
  timeoutMs?: number,    // default 5000
  fetch?: typeof fetch,  // polyfill or test double
});
```

## Runtime support

Node.js 18+, Deno, Bun, Cloudflare Workers — anywhere `globalThis.fetch` exists.

## Links

- **Docs**: [docs.hee.la](https://docs.hee.la)
- **Portal**: [app.hee.la](https://app.hee.la)
- **Source**: [github.com/shekhardtu/heela](https://github.com/shekhardtu/heela)
- **Status**: [status.hee.la](https://status.hee.la)

## License

MIT
