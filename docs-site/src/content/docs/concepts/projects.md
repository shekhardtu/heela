---
title: Projects
description: Projects are the top-level tenancy boundary in Hee.
sidebar:
  order: 2
---

A **project** in Hee is the top-level organizational unit. Every custom domain belongs to exactly one project; every API token is scoped to exactly one project.

## Why projects?

Most SaaS teams run multiple products or environments that need independent domain namespaces:

- Production vs staging (different upstreams, different domains)
- Separate products within the same company
- White-label products sold to different partners
- Isolated billing for agency/reseller scenarios

A project gives you that boundary without requiring separate Hee accounts.

## What a project contains

| Field | Description |
|-------|-------------|
| `slug` | URL-safe identifier. Immutable. Used in portal URLs. |
| `name` | Human-friendly display name. |
| `upstreamUrl` | Where Hee reverse-proxies requests for domains in this project. |
| `enabled` | Kill switch. Disable to pause all traffic for this project. |
| `members` | Users with portal access + their role (Owner / Admin / Member). |
| `domains` | Custom domains registered to this project. |
| `apiTokens` | API tokens authorized for this project. |

## Upstream URL

`upstreamUrl` is where Hee routes every request for every domain in this project. Two common patterns:

**Single upstream for all customers** (most common):
```
upstreamUrl: https://acme.pages.dev
```
Your app inspects `Host:` at the edge, routes internally by subdomain.

**Edge-less — one project per customer** (less common):
```
# Project "customer-a"
upstreamUrl: https://customer-a.acme.pages.dev

# Project "customer-b"  
upstreamUrl: https://customer-b.acme.pages.dev
```
Useful when each customer has truly isolated deploys.

## Changing upstream

Upstream can be updated anytime via the portal or API. Changes take effect within ~30 seconds (the edge caches resolutions).

## Deleting a project

Not currently destructive. Setting `enabled: false` revokes all traffic; hard delete is admin-only and requires a support ticket. This protects against accidental mass-disruption.
