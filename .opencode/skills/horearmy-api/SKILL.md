---
name: horearmy-api
description: Use when creating or modifying Horearmy DTMS API route handlers, request validation, response contracts, authentication guards, or API errors.
---

# Horearmy API

- Locate the nearest existing route with the same domain before implementing a new endpoint.
- Use `guard`, `guardPermission`, `requireAuth`, or `requirePermission` from `src/lib/api-guard.ts` rather than custom auth checks.
- Use `safeJson` for JSON request parsing and return a clear `400` response for malformed input.
- Validate IDs, enums, dates, pagination, file metadata, and numeric limits at the route boundary.
- Derive `tenantId`, user identity, and access scope from the authenticated session, never from a trusted client body.
- Use `tenantStore.run` through the existing guards when database work requires tenant context.
- Return consistent JSON error objects and appropriate status codes: `401`, `403`, `404`, `409`, `413`, `422`, `429`, or `500`.
- Include CSRF protection for browser mutations; API-key requests must respect their read/write scopes.
- Apply `guardPlanLimit` when creating plan-limited resources.
- Record sensitive mutations with `logAudit` without logging passwords, tokens, or raw secrets.
- Do not expose Prisma errors, stack traces, internal IDs, or secret configuration to clients.
- Add or update route tests and run `npm run typecheck`.

Important files: `src/lib/api-guard.ts`, `src/lib/auth.ts`, `src/lib/access-scope.ts`, `src/lib/csrf.ts`, `src/middleware.ts`.
