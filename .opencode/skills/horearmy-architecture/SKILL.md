---
name: horearmy-architecture
description: Use when changing Horearmy DTMS application structure, Next.js App Router pages, layouts, components, server actions, or shared libraries.
---

# Horearmy Architecture

- Preserve the existing Next.js App Router structure under `src/app`.
- Keep tenant-facing operations inside the existing `(ops)` route group and preserve the current route conventions.
- Reuse shared logic from `src/lib` instead of duplicating authentication, access scope, cache, storage, or API behavior.
- Keep server-only code out of client components. Add `"use client"` only when browser state, events, or browser APIs are required.
- Prefer small, focused changes that fit existing component and route patterns.
- Do not introduce a new state manager, ORM, API framework, or folder convention without a concrete requirement.
- Preserve loading, error, empty, and unauthorized states for every new operational screen.
- Check tenant scope, permissions, and plan feature gating when adding a route or navigation item.
- Validate with `npm run typecheck` and `npm run build` after structural changes.

Important files: `src/app`, `src/components`, `src/lib`, `src/middleware.ts`, `next.config.mjs`.
