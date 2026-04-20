Client library for the Hee custom-domain edge. Each SaaS product that uses Hee (Colbin, YoFix, Kundali, or your app) calls this SDK from its backend to register and remove customer hostnames.

## Install

```bash
npm install @hee/sdk
# or
yarn add @hee/sdk
```

## Setup

1. Create a project at https://app.hee.la
2. Issue an API token (shown once at creation)
3. Store the token as `HEE_API_TOKEN` in your backend env

## Usage

```ts
import { HeeClient } from "@hee/sdk";

const hee = new HeeClient({ token: process.env.HEE_API_TOKEN! });

// Register a customer's domain
await hee.domains.register({
  hostname: "engineering.loopai.com",
  metadata: { workspaceSlug: "engineering" },
});

// Tell your customer to CNAME engineering.loopai.com → edge.hee.la

// List all domains under your project
const all = await hee.domains.list();

// Remove a domain (soft-delete)
await hee.domains.remove("engineering.loopai.com");
```

## Errors

All methods throw `HeeError` on non-2xx responses. The error includes `status` and `body` fields for introspection.

```ts
try {
  await hee.domains.register({ hostname: "bad domain" });
} catch (e) {
  if (e instanceof HeeError && e.status === 409) {
    // hostname already claimed by another project
  }
}
```

## Options

```ts
new HeeClient({
  token: string,
  baseUrl?: string,      // default https://api.hee.la
  timeoutMs?: number,    // default 5000
  fetch?: typeof fetch,  // polyfill or test double
});
```
