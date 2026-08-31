---
name: horearmy-branding
description: Use when changing Horearmy tenant logo, favicon, application name, white-label colors, branded layouts, uploads, or tenant branding cache.
---

# Horearmy Branding

- Apply tenant branding only to the authenticated tenant operations UI unless the requirement explicitly includes another surface.
- Load branding through the existing tenant metadata path and pass it into `OpsShell`, `Sidebar`, and `Header` patterns.
- Use CSS variables such as `--brand-primary`, `--brand-secondary`, and `--brand-accent` rather than duplicating inline color logic.
- Preserve readable contrast, focus states, hover states, disabled states, and mobile behavior for arbitrary tenant colors.
- Keep public landing, public tracking, and super-admin surfaces on their intended default branding unless explicitly designed otherwise.
- Validate logo and favicon type, size, storage ownership, and safe URL handling through the existing upload API.
- Invalidate tenant-specific metadata cache after a branding mutation; never invalidate or populate branding under an unsafe global tenant key.
- Provide preview, empty state, error state, and remove behavior for uploaded assets.
- Test two tenants with different branding and verify no visual or cached leakage between them.

Important files: `src/app/(ops)/layout.tsx`, `src/components/OpsShell.tsx`, `src/components/Sidebar.tsx`, `src/components/Header.tsx`, `src/app/(ops)/settings/profile/page.tsx`, `src/app/api/upload/route.ts`, `src/lib/cache.ts`.
