---
name: horearmy-database
description: Use when changing Horearmy Prisma models, migrations, relations, indexes, queries, transactions, or database-backed features.
---

# Horearmy Database

- Read the relevant models and existing migrations before changing `prisma/schema.prisma`.
- Preserve tenant ownership and branch relationships for tenant-scoped records.
- Add indexes for frequent filters, foreign keys, tenant IDs, status fields, and time-based operational queries when justified.
- Use `prisma migrate dev` for local development and `prisma migrate deploy` for deployed environments; never edit an applied migration.
- Use explicit `select` clauses for API and dashboard reads to avoid leaking unnecessary fields and to reduce payload size.
- Use transactions for multi-record state changes that must remain atomic.
- Consider uniqueness, soft-delete/status semantics, nullability, and existing production data before changing a field.
- Avoid N+1 queries; prefer a bounded relation query or a carefully justified batch query.
- Regenerate Prisma client with `npm run db:generate` after schema changes.
- Add tests for tenant isolation, permission boundaries, duplicate constraints, and important lifecycle transitions.
- Never place credentials or production data in schema, seed changes, fixtures, or logs.

Important files: `prisma/schema.prisma`, `prisma/migrations`, `src/lib/prisma.ts`, `src/lib/access-scope.ts`.
