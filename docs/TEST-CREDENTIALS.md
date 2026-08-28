# Test Account Credentials for Testsprite

Credentials are intentionally not stored in the repository. Create temporary accounts locally with `scripts/setup-test-accounts.js` and obtain passwords from the local secret manager or environment. Never reuse these accounts in staging or production.

## Super Admin

| Field | Value |
|-------|-------|
| Username | `superadmin` |
| Password | `<local test secret>` |
| Role | SUPER_ADMIN |
| Tenant | (global — not bound to any tenant) |
| URL | `http://localhost:3000` |

---

## Logistik Nusantara Tenant

| Field | Value |
|-------|-------|
| Tenant | PT Logistik Nusantara |
| Slug | `logistik-nusantara` |
| Tenant ID | `cmt27rxey01e3chl4st8bjgop` |
| Plan | ENTERPRISE |

### Tenant Users

| # | Username | Password | Role | Name |
|---|----------|----------|------|------|
| 1 | `logistik_admin` | `<local test secret>` | ADMIN_OPERASIONAL | Admin Logistik |
| 2 | `logistik_disp` | `<local test secret>` | DISPATCHER | Dispatcher Logistik |
| 3 | `logistik_wh` | `<local test secret>` | WAREHOUSE | Staff Gudang |
| 4 | `logistik_driver` | `<local test secret>` | DRIVER | Driver Test |
| 5 | `logistik_cs` | `<local test secret>` | CUSTOMER_SERVICE | Customer Service |
| 6 | `logistik_super` | `<local test secret>` | SUPERVISOR | Supervisor Logistik |
| 7 | `logistik_mgmt` | `<local test secret>` | MANAGEMENT | Manajemen Logistik |

---

## API Usage Notes

### Login

Tenant users **must** include `tenantId` in the login request body:

```json
POST /api/auth/login
{
  "username": "logistik_admin",
  "password": "<local test secret>",
  "tenantId": "cmt27rxey01e3chl4st8bjgop"
}
```

Super Admin does not require `tenantId`:

```json
POST /api/auth/login
{
  "username": "superadmin",
  "password": "<local test secret>"
}
```

### Authenticated API Calls

After login, include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

For mutations, also include:

```
x-csrf-token: <tokenValue from login response>
```

The login response includes:

```json
{
  "token": "...",
  "tokenValue": "...",   // use as x-csrf-token
  "user": { "id": "...", "role": "...", "name": "..." },
  "tenantId": "...",
  "tenantName": "..."
}
```

---

## Frontend URLs

| Page | URL |
|------|-----|
| Landing / Login | `http://localhost:3000` |
| Super Admin Dashboard | `http://localhost:3000/superadmin` |
| Super Admin Tenants | `http://localhost:3000/superadmin/tenants` |
| Tenant Dashboard | `http://localhost:3000/dashboard` |
| Shipment List | `http://localhost:3000/shipments` |
| Driver List | `http://localhost:3000/drivers` |
| Vehicle List | `http://localhost:3000/vehicles` |
| Customer List | `http://localhost:3000/customers` |
| Billing (plan info) | `http://localhost:3000/billing` |
| Settings | `http://localhost:3000/settings` |
| Security Dashboard | `http://localhost:3000/security` |

---

## Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login (returns JWT + CSRF token) |
| `/api/auth/tenants` | GET | List all tenants (public) |
| `/api/auth/me` | GET | Current user info |
| `/api/tenants` | GET | Tenants list (paginated) |
| `/api/shipments` | GET/POST | List/create shipments |
| `/api/drivers` | GET/POST | List/create drivers |
| `/api/vehicles` | GET/POST | List/create vehicles |
| `/api/customers` | GET/POST | List/create customers |
| `/api/billing` | GET/PATCH | Plan info/upgrade |
| `/api/notifications` | GET | Notifications list |
| `/api/health` | GET | System health check |

---

## System Info

- **App URL**: `http://localhost:3000`
- **Framework**: Next.js 15.5.23 (React 19, TypeScript 5.7.3)
- **Database**: PostgreSQL via Prisma 6.19.3
- **Auth**: JWT + CSRF (dtms_csrf cookie + x-csrf-token header)
- **RBAC**: 9 roles with per-tenant permissions
- **Billing**: 5 plans (FREE, STARTER, GROWTH, PRO, ENTERPRISE)
