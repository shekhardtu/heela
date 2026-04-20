---
title: Tenancy
description: How Hee isolates data between teams, projects, and customers.
sidebar:
  order: 5
---

Hee is a multi-tenant SaaS. This page explains the isolation model so you know exactly what's shared and what's not.

## Isolation layers

```
┌────────────────────────────────────────────────────┐
│                     Hee platform                    │
│  ┌─────────────────┐    ┌─────────────────┐       │
│  │   Account A     │    │   Account B     │       │
│  │  ┌──────────┐  │    │  ┌──────────┐  │       │
│  │  │ Project  │  │    │  │ Project  │  │       │
│  │  │  ├─token │  │    │  │  ├─token │  │       │
│  │  │  └─domain│  │    │  │  └─domain│  │       │
│  │  └──────────┘  │    │  └──────────┘  │       │
│  └─────────────────┘    └─────────────────┘       │
│                                                    │
│            Shared: edge (Caddy), control           │
│                    plane (NestJS), DB (Postgres)   │
└────────────────────────────────────────────────────┘
```

## Account → Project → Domain

- **Account** = a user (currently tied to one email; team membership is project-level).
- **Project** = a tenancy boundary. API tokens and domains are scoped here.
- **Domain** = a customer's hostname inside a project.

An account can belong to multiple projects (e.g., as a contractor to several Hee customers). A user's **role within a project** is what determines what they can see and do there.

## Roles

| Role | Portal access | API tokens | Domains | Billing | Members |
|------|---------------|------------|---------|---------|---------|
| Owner | ✅ | Issue + revoke | Add + remove | ✅ | Invite + remove |
| Admin | ✅ | Issue + revoke | Add + remove | View | View |
| Member | ✅ | View only | Add + remove | — | — |

Service accounts (API tokens) don't have roles — they have the token's fixed scope.

## Data isolation

Queries in the Hee control plane are **always** filtered by project:

```sql
-- Every domain lookup
SELECT * FROM domains WHERE project_id = $1 AND removed_at IS NULL;

-- Cross-project queries are explicitly forbidden at the controller layer
```

The database table structure includes `project_id` on every tenant-scoped row. Violating isolation would require a deliberate code change, not a missed filter.

## Cross-tenant constraints

Some constraints apply **across all tenants**:

- **Hostname uniqueness** — one hostname, one project, forever. Prevents tenant-A from hijacking tenant-B's domain even if tenant-B forgets to register it.
- **Let's Encrypt rate limits** — per-registered-domain, not per-Hee-tenant. If tenant-A registers 50 subdomains of `example.com` in a week, tenant-B can't issue for `foo.example.com`. In practice this never matters — no tenant registers 50 subdomains of someone else's apex.

## Compliance roadmap

| Milestone | Status |
|-----------|--------|
| Soft delete + audit retention | ✅ Shipped |
| Sensitive fields encrypted at rest (AES-256) | ✅ Shipped (Postgres-level) |
| Per-project audit log | 🟡 Phase 3 |
| SOC2 Type I | ⬜ Phase 4 (~€15k one-time) |
| HIPAA BAA | ⬜ Enterprise custom |
| On-premise / dedicated edge | ⬜ Phase 4 |

If you need compliance guarantees today, self-host the edge + control plane — all code is open.
