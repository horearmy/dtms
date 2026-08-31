---
name: horearmy-logistics
description: Use when changing Horearmy shipments, dispatch, warehouse, hubs, branches, drivers, vehicles, delivery flow, or logistics business rules.
---

# Horearmy Logistics

- Read the existing shipment and assignment lifecycle before adding a status or transition.
- Keep business transitions explicit and validate that the current state allows the requested action.
- Preserve relations among shipment, customer, driver, vehicle, branch, hub, warehouse, stops, and shipment events.
- Use database transactions for operations that update multiple operational records.
- Keep user-visible status labels separate from stable persisted enum/code values.
- Record meaningful lifecycle changes for tracking, notifications, audit, and reporting.
- Enforce tenant and branch scope on reads and mutations.
- Validate quantities, dates, coordinates, identifiers, and duplicate operations at the boundary.
- Consider idempotency for scan, dispatch, webhook, GPS, and return operations.
- Test normal flow, invalid transition, duplicate request, missing relation, and cross-tenant cases.

Important files: `src/app/(ops)/shipments`, `src/app/(ops)/dispatch`, `src/app/(ops)/warehouse`, `src/lib/alerts.ts`, `src/lib/sla.ts`, `prisma/schema.prisma`.
