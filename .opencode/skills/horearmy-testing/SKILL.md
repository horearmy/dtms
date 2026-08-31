---
name: horearmy-testing
description: Use when adding Horearmy features, fixing regressions, writing unit or integration tests, or verifying security, tenant isolation, build, and deployment readiness.
---

# Horearmy Testing

- Start with the smallest relevant test, then run the broader suite when the change crosses boundaries.
- Use Vitest conventions already present in `src/**/__tests__` and `src/integration/__tests__`.
- Test both allowed and denied paths for every protected API or tenant-scoped feature.
- Cover malformed input, empty data, duplicate requests, permission failures, and external-service failures.
- Prefer deterministic fixtures and mock external services; never use production credentials or data in tests.
- For UI changes, verify desktop and mobile behavior, loading, error, empty, focus, and responsive states.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` when appropriate.
- Run `npm test` and report whether failures are test failures, environment failures, or missing test setup.
- Use TestSprite for high-value end-to-end flows only after the local server is running and the test plan is configured.
- Do not weaken assertions or skip tests merely to make a change pass.

Important files: `vitest.config.ts`, `src/**/__tests__`, `src/integration/__tests__`, `package.json`, `opencode.json`.
