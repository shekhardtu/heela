---
title: API Tokens
description: How Hee authenticates server-to-server requests.
sidebar:
  order: 4
---

API tokens authenticate your server when it calls the Hee API — registering new customer domains, listing domains, removing domains, resolving metadata.

## Anatomy

```
hee_0000000000000000000000000000000000000000000000000000000000000000
└┬─┘ └─────────────────────────────────────────────────────────────┘
 prefix                     64 hex chars (256 bits)
```

- `hee_` prefix makes tokens easy to spot in code (linters, scanners, GitHub secret detection).
- 256 bits of entropy — cryptographically equivalent to strong passwords.

## Scope

Every token is scoped to a single project. It can:

- Register new domains in that project
- List domains in that project
- Remove domains from that project
- Resolve metadata for domains in that project

It cannot:

- Access another project's data
- Create or modify projects
- Invite members
- Touch billing

Admin operations require portal session auth (magic link), not API tokens.

## Issuing a token

In the portal: **Projects → [project] → API tokens → Issue new token**.

You'll see the raw token **exactly once**. After 10 seconds the value is masked; after the page navigates away it's gone forever. Hee never stores the plaintext — only a bcrypt hash.

```bash
# In your secrets manager / .env
HEE_API_TOKEN=hee_0000000000000000000000000000000000000000000000000000000000000000
```

## Rotating a token

Tokens don't expire on their own. To rotate:

1. Issue a new token
2. Deploy it to your application
3. Verify traffic works with the new token
4. Revoke the old token in the portal

Revocation is immediate — the old token stops working within 30 seconds (control plane cache TTL).

## If a token leaks

Revoke it in the portal immediately. Then:

- Audit `createdAt` on all recent domain registrations — did anything unexpected appear?
- Check which project is affected — was the token for prod or staging?
- If prod, consider rotating all tokens for defense in depth

Because tokens are project-scoped, a leaked token has a bounded blast radius. It cannot access other projects, members, billing, or admin settings.

## Using a token

Standard HTTP Bearer:

```bash
curl https://api.hee.la/v1/edge/domains \
  -H "Authorization: Bearer $HEE_API_TOKEN"
```

Server-side only. Never ship a token to browser JavaScript — there is no safe way to use Hee tokens from the browser. Proxy through your backend.
