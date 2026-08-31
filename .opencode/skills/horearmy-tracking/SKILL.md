---
name: horearmy-tracking
description: Use when changing Horearmy GPS ingestion, vehicle locations, tracking pages, ETA, route timelines, geofences, maps, or public shipment tracking.
---

# Horearmy Tracking

- Separate public tracking reads from authenticated operational and GPS-ingestion paths.
- Validate tracking identifiers, coordinate ranges, timestamps, status values, and payload size.
- Do not expose private customer, tenant, driver, or vehicle data through public tracking responses.
- Preserve the distinction between latest position, historical timeline, shipment events, and return timeline.
- Use bounded queries and retention-aware reads for GPS and timeline data.
- Keep ETA calculations deterministic and document the input assumptions when changing `eta-engine` behavior.
- Validate geofence polygons and coordinate systems before persisting or evaluating them.
- Consider duplicate GPS events, out-of-order timestamps, stale locations, and provider retries.
- Preserve rate limits for GPS ingestion and avoid logging full high-volume payloads.
- Test valid/invalid coordinates, public access, tenant access, stale data, geofence boundaries, ETA edge cases, and duplicate events.

Important files: `src/lib/gps.ts`, `src/lib/gps-processor.ts`, `src/lib/eta.ts`, `src/lib/eta-engine.ts`, `src/lib/geofence.ts`, `src/app/api/track`.
