---
name: horearmy-deployment
description: Use when changing Horearmy production configuration, Vercel deployment, environment variables, CSP, migrations, health checks, or release verification.
---

# Horearmy Deployment

- Inspect `package.json`, `vercel.json`, `next.config.mjs`, and environment requirements before changing deployment behavior.
- Validate production with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` as applicable.
- Run `npm run db:generate` after Prisma schema changes and use `npm run db:deploy` for production migrations.
- Never commit `.env` files, API keys, tokens, passwords, or private service credentials.
- Keep required secrets such as `AUTH_SECRET` configured in the hosting environment.
- Review CSP, external image/connect/font sources, and analytics gating when adding a third-party dependency.
- Verify `/api/health` and `/api/health/dashboard` behavior without exposing secrets or sensitive database details.
- Prefer backward-compatible migrations and define rollback or recovery steps for destructive changes.
- Confirm cache invalidation, webhook configuration, cron/scheduler behavior, and storage permissions after release.
- Do not claim deployment success without checking the actual build/deployment result.

Important files: `package.json`, `vercel.json`, `next.config.mjs`, `src/middleware.ts`, `src/app/api/health`, `prisma/migrations`.
