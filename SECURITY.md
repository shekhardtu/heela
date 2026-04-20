# Security Policy

## Supported versions

Hee is pre-1.0. Security fixes land on `main`. There are no backported branches today.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Email the maintainer directly: **hari@tryloop.ai**

Include as much of the following as you can:

- Type of issue (e.g., RCE, auth bypass, SSRF, info disclosure)
- Affected component (control plane / portal / edge / SDK / infra)
- Step-by-step reproduction
- Proof-of-concept or exploit code if you have one
- Impact assessment — what an attacker could do with this

## What to expect

- Acknowledgement within 72 hours
- Initial severity assessment within 7 days
- Regular updates until resolution
- Credit in the release notes once the fix ships (unless you prefer to stay anonymous)

## Scope

In scope:

- The control plane API (`api.hee.la`)
- The customer portal (`app.hee.la`)
- The edge proxy and Caddyfile config
- The `@heela/sdk` package
- Infrastructure-as-code in `infra/`

Out of scope:

- Denial-of-service via volumetric attacks
- Issues requiring physical access to a user's device
- Social engineering of Hee staff or users
- Vulnerabilities in third-party dependencies (please report those upstream; we'll bump versions promptly)

## Safe harbour

Good-faith security research is welcome. If you follow this policy, act in good faith, and do not degrade service for real users, we will not pursue legal action and will work with you to fix the issue.

Thanks for helping keep Hee users safe.
