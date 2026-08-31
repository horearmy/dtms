---
name: horearmy-authorization
description: Use when changing Horearmy roles, permissions, access scope, protected routes, plan features, or role-based UI behavior.
---

# Horearmy Authorization

- Distinguish authentication (who the user is) from authorization (what the user may do).
- Use `guardPermission` or `requirePermission` for permission-based API access.
- Use `resolveAccessScope` and `hasPermission` rather than duplicating role-permission queries.
- Keep role checks and permission checks on the server even when the UI also hides controls.
- Preserve explicit behavior for `SUPER_ADMIN`, operational users, drivers, and customer-facing access.
- Apply branch scope to data access, not just to navigation.
- Keep plan feature gating consistent between middleware, server routes, and UI states.
- When adding a permission, update its seed/configuration, route enforcement, UI affordance, and tests.
- Deny by default when a permission, role, tenant, or branch cannot be resolved.
- Test unauthorized, wrong-role, missing-permission, wrong-branch, wrong-tenant, and allowed cases.

Important files: `src/lib/access-scope.ts`, `src/lib/permissions.ts`, `src/lib/api-guard.ts`, `src/lib/plan-constants.ts`, `src/middleware.ts`.
