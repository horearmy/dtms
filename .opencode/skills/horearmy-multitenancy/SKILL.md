---
name: horearmy-multitenancy
description: Use when changing Horearmy tenant isolation, organizations, branches, hierarchy, tenant lifecycle, tenant metadata, or cross-tenant administrative access.
---

# Horearmy Multi-Tenancy

- Treat tenant isolation as a security boundary, not just a filtering convenience.
- For regular users, derive the tenant from `getSession()` and `resolveAccessScope()`.
- Never accept a client-supplied tenant ID as the sole authorization decision.
- Add tenant predicates to every direct Prisma query for tenant-owned data unless the query is intentionally scoped by `tenantStore` and documented.
- Preserve branch scope using `branchId` and `branchIds` from `AccessScope`.
- Keep `SUPER_ADMIN` cross-tenant behavior explicit and limited to intended administration routes.
- Verify both read and mutation paths; a protected page does not protect an unguarded API route.
- Avoid caching tenant data under global keys. Use tenant-specific cache keys or tags.
- Test positive access, cross-tenant denial, branch-level denial, and super-admin behavior.
- Never include another tenant's names, counts, branding, shipment data, or identifiers in responses, logs, exports, or cache entries.

Important files: `src/lib/access-scope.ts`, `src/lib/api-guard.ts`, `src/lib/tenant.ts`, `src/lib/prisma.ts`, `src/middleware.ts`.
