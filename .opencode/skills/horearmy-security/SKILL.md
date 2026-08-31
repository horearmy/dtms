---
name: horearmy-security
description: Use when changing Horearmy authentication, authorization, CSRF, cookies, rate limiting, CSP, API keys, uploads, audit logs, or security-sensitive code.
---

# Horearmy Security

- Threat-model new inputs and state changes before implementation.
- Use existing guards and permission checks; do not rely on UI hiding for authorization.
- Keep `AUTH_SECRET` and all provider credentials in environment variables only.
- Preserve secure, `httpOnly`, `sameSite`, scoped session cookies and password-version invalidation behavior.
- Protect browser mutations with the existing CSRF mechanism. Do not disable it to fix a client request.
- Preserve rate limits for login, GPS ingestion, and general APIs; use Redis configuration for multi-instance production limits.
- Validate file type, size, ownership, and storage path for every upload. Do not trust the filename or MIME type alone.
- Redact tokens, passwords, API keys, cookies, authorization headers, and personal data from logs and audit payloads.
- Preserve security headers and review CSP changes against maps, storage, analytics, and external integrations.
- Use constant-time comparisons or vetted cryptographic libraries for secrets and tokens.
- Add regression tests for unauthorized access, CSRF failure, expired credentials, rate limiting, and tenant isolation.
- Report security weaknesses plainly instead of silently weakening a control.

Important files: `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/api-guard.ts`, `src/lib/csrf.ts`, `src/lib/security.ts`, `next.config.mjs`.
