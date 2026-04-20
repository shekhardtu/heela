---
title: Why Hee
description: The design decisions behind a shared SaaS edge, and why the alternatives didn't work.
---

Hee exists because every existing option for offering custom domains to SaaS customers has a sharp edge:

## Cloudflare for SaaS

The industry default — and the reason many teams pay a five-figure Enterprise contract before they've hit 100 customers.

**What works**: Custom Hostnames API, global POP presence, DDoS protection.

**What doesn't**:
- **Custom Origin SNI** is Enterprise-only. Without it, TLS fails when your origin's cert CN doesn't match the customer's domain.
- **Worker routes don't fire on fallback origins.** If your architecture depends on edge middleware (auth, routing, A/B) and you expected it to run for SaaS custom hostnames, it won't. The fallback origin path bypasses routes entirely.
- **Entry price** is the Enterprise sales cycle itself. There's no self-serve path past a few free custom hostnames.

## Approximated

A newer, friendlier alternative. Closed-source, $29+/mo starting tier.

**What works**: Clean API, automatic TLS, reasonable onboarding.

**What doesn't**:
- **Per-domain pricing** adds up fast. At ~200 customers you're paying more than a senior engineer's annual tooling budget.
- **Closed source** — you can't self-host, you can't inspect, you can't fork. If Approximated goes away, you're re-architecting.
- **Single region** (North America primary). Latency-sensitive customers notice.

## Rolling your own

Absolutely viable. Caddy + Postgres + a €5 box covers 80% of what Hee does.

**What works**: Full control, any hyperscaler, no vendor tax.

**What doesn't**:
- **A month of engineering time** to wire `on_demand_tls`, build the multi-tenant control plane, handle cert rate limits, build the verification probe, and produce a portal your non-engineers can use.
- **Ongoing maintenance** — cert rotation, Postgres tuning, DNS changes, deploy automation. None of this is your product.

## What Hee chose

| Decision | Reason |
|----------|--------|
| Caddy + `on_demand_tls` | Battle-tested. `json` config model. Cert management that "just works." |
| Let's Encrypt HTTP-01 | Free, standard, no cert markup. Renewals are Caddy's job. |
| Postgres + TypeORM | Small ops surface. We know it scales past 10k tenants. |
| NestJS control plane | Strongly-typed multi-tenant API with DI. Easy to extend. |
| Single-region alpha | Move fast; multi-region in Phase 2 (Frankfurt + Ashburn first). |
| Open source edge | Escape hatch. If pricing ever goes sideways, customers fork and self-host. |
| Magic-link auth | No password storage. Postmark handles deliverability. |
| Portal + API parity | Every portal action has a REST equivalent. Scriptable end-to-end. |

## When Hee is *not* the right fit

- **Regulated industries** that need on-premise edge (SOC2 is in roadmap; HIPAA/FedRAMP is not). Self-host instead.
- **Wildcards on apex domains** (`*.example.com`) — coming Phase 3. Today we issue per-hostname.
- **Less than 3 custom domains** forever — the free tier has you; no need to buy a plan.
- **Heavy edge logic** (transforms, auth at edge, custom response headers per tenant) — roadmap Phase 2. For now, Hee routes to your upstream untouched.

If you're somewhere between "just one fancy domain" and "Fortune 500 compliance officer," Hee fits.
