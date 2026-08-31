---
name: horearmy-authentication
description: Use when changing Horearmy login, logout, sessions, JWTs, Google OAuth, password reset, password change, API keys, or account recovery.
---

# Horearmy Authentication

- Reuse `getSession`, `setSession`, `clearSession`, `signToken`, and `verifyToken` from `src/lib/auth.ts`.
- Preserve the `dtms_token` cookie contract and the separate super-admin session behavior.
- Keep JWT claims minimal, typed, and free of secrets; treat role and tenant claims as server-validated data.
- Re-check the user record, active status, password version, and relevant security version as existing code does.
- Preserve forced password-change behavior and do not create mutation bypasses.
- Keep 2FA tokens purpose-bound and short-lived; do not accept a token for a different purpose.
- Hash passwords asynchronously and never store or log plaintext passwords.
- Treat API keys as bearer secrets: hash for lookup, enforce active/expiry state and read/write scope, and redact values.
- Return generic authentication errors where detailed errors could enable account enumeration.
- Test success, invalid credentials, expired session, revoked password version, inactive user, 2FA, and API-key scope cases.

Important files: `src/lib/auth.ts`, `src/lib/superadmin-auth.ts`, `src/lib/totp.ts`, `src/lib/webauthn.ts`, `src/app/api/auth`.
