# DTMS — Superadmin Security & Authentication Blueprint

**Produk:** Delivery Tracking Management System (DTMS)  
**Scope:** Superadmin / Platform Administrator  
**Target:** Enterprise Multi-Tenant SaaS  
**Status:** Security Design — Implementation Blueprint  
**Version:** 1.0  
**Tanggal:** Agustus 2026

---

# 1. Tujuan

Dokumen ini secara khusus mendefinisikan **pengamanan akun Superadmin dan metode login privileged** pada DTMS.

Dokumen existing DTMS saat ini sudah memiliki JWT 12 jam, TOTP 2FA, password policy, `pwdVersion`, login rate limiting, login-attempt tracking, audit logging, dan Google OAuth. fileciteturn2file0L17-L26

Untuk target enterprise multi-tenant, mekanisme tersebut perlu dinaikkan menjadi:

```text
PRIVILEGED IDENTITY
        ↓
PHISHING-RESISTANT AUTHENTICATION
        ↓
RISK ASSESSMENT
        ↓
SECURE ADMIN SESSION
        ↓
RBAC + ABAC
        ↓
STEP-UP AUTHENTICATION
        ↓
PRIVILEGED ACTION
        ↓
AUDIT + MONITORING
```

---

# 2. Keputusan Arsitektur

## Rekomendasi final

Untuk Superadmin DTMS:

```text
Primary Authentication
    ↓
Passkey / WebAuthn
    OR
FIDO2 Security Key

Fallback
    ↓
TOTP
    ↓
Recovery Codes

Compatibility / Recovery
    ↓
Password
```

Enterprise SSO:

```text
OIDC
SAML
```

dapat ditambahkan melalui Identity Provider.

### Prinsip

**Password + TOTP tidak menjadi desain akhir untuk Superadmin.**

Tetap dapat dipertahankan untuk compatibility, tetapi target utama adalah **phishing-resistant authentication**.

---

# 3. Superadmin Harus Dipisahkan dari User Tenant

Jangan menggunakan:

```text
/api/auth/login
```

untuk semua jenis akun dengan privilege yang sama.

Buat administrative boundary:

```text
https://admin.dtms.com
```

atau:

```text
https://platform.dtms.com
```

Sedangkan aplikasi tenant:

```text
https://app.dtms.com
```

Struktur:

```text
                    DTMS
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
    app.dtms.com          admin.dtms.com
          │                     │
      TENANT USER          PLATFORM ADMIN
```

Superadmin tidak login melalui tenant login biasa.

---

# 4. Identitas Superadmin

Pisahkan:

```text
User Account
```

dari:

```text
Privileged Identity
```

Model:

```text
Person
 │
 ├── Normal Identity
 │
 └── Privileged Identity
       │
       ├── Platform Admin
       ├── Billing Admin
       ├── Security Admin
       └── Support Admin
```

Tujuannya agar privilege platform tidak otomatis melekat pada akun operasional biasa.

---

# 5. Role Superadmin

Jangan hanya memiliki:

```text
SUPER_ADMIN
```

sebagai role tunggal.

Gunakan privilege terpisah:

```text
PLATFORM_ADMIN
TENANT_ADMINISTRATOR
BILLING_ADMIN
SECURITY_ADMIN
SUPPORT_ADMIN
AUDIT_ADMIN
```

Kemudian:

```text
Role
 ↓
Permission
 ↓
Scope
```

Contoh:

```text
SECURITY_ADMIN
 ├── security.read
 ├── security.alert.manage
 ├── session.revoke
 └── authentication.policy.manage
```

---

# 6. RBAC + ABAC

RBAC menentukan:

```text
Apa yang boleh dilakukan?
```

ABAC menentukan:

```text
Pada resource mana?
Dalam scope mana?
Dalam kondisi apa?
```

Contoh:

```text
PLATFORM_ADMIN
+
tenant.read
+
platform.scope
```

Sedangkan:

```text
SUPPORT_ADMIN
+
tenant.read
+
assignedTenantOnly
```

---

# 7. Login Flow Final

```text
USER
  ↓
admin.dtms.com
  ↓
WAF / CDN
  ↓
Rate Limiter
  ↓
Identity Provider
  ↓
Credential Authentication
  ↓
Passkey / FIDO2
  ↓
Risk Assessment
  ↓
MFA / Step-up jika diperlukan
  ↓
Create Secure Session
  ↓
Load Privileged Identity
  ↓
RBAC
  ↓
ABAC
  ↓
Platform Scope
  ↓
SUPERADMIN DASHBOARD
```

---

# 8. Primary Authentication — Passkey

Prioritas utama:

```text
WebAuthn / Passkey
```

Flow:

```text
Enter admin account
       ↓
Browser requests Passkey
       ↓
Device biometric / PIN
       ↓
WebAuthn challenge
       ↓
Server verifies credential
       ↓
Authentication SUCCESS
```

Keuntungan:

```text
Phishing resistant
No password transmitted
Cryptographic authentication
Device-bound credential
```

---

# 9. FIDO2 Security Key

Untuk Superadmin dengan privilege tertinggi:

```text
FIDO2 Security Key
```

dapat menjadi faktor tambahan.

Contoh:

```text
Superadmin
   ↓
Passkey
   ↓
FIDO2 Security Key
   ↓
High Assurance Session
```

Untuk operasi tertentu dapat diberlakukan:

```text
Require Hardware-backed Authentication
```

---

# 10. TOTP sebagai Fallback

Tetap dukung:

```text
Google Authenticator
Microsoft Authenticator
Authenticator-compatible TOTP
```

Flow:

```text
Password / Identity
       ↓
TOTP
       ↓
Authentication
```

Namun:

> TOTP bukan pilihan utama jika Passkey/FIDO2 tersedia.

---

# 11. Recovery Codes

Saat MFA pertama kali diaktifkan:

```text
Generate Recovery Codes
```

Contoh:

```text
ABCD-EFGH
IJKL-MNOP
QRST-UVWX
...
```

Aturan:

```text
One-time use
Hashed at rest
Cannot be retrieved
Can be regenerated
All old codes revoked after regeneration
```

---

# 12. Password Policy

Karena password masih digunakan sebagai fallback:

```text
Argon2id
```

Password:

```text
Never plaintext
Never reversible encryption
Never logged
```

Tambahkan:

```text
Password strength
Compromised password check
Password history jika diperlukan
First-login change
Recovery controls
```

Existing DTMS sudah memiliki `mustChangePassword` dan `pwdVersion`; mekanisme ini dipertahankan. fileciteturn2file0L19-L22

---

# 13. Password Version / Session Revocation

Gunakan:

```text
pwdVersion
```

Contoh:

```text
User password changed
       ↓
pwdVersion++
       ↓
All previous sessions invalid
       ↓
Force authentication
```

Untuk Superadmin, tambahkan:

```text
securityVersion
```

Contoh:

```text
MFA changed
Passkey removed
Security policy changed
Emergency revoke
       ↓
securityVersion++
       ↓
All privileged sessions revoked
```

---

# 14. Secure Session

Untuk web admin, gunakan server-side session atau opaque session identifier dengan server-side state.

Cookie:

```text
HttpOnly
Secure
SameSite=Strict
```

Jangan menjadikan browser storage sebagai tempat penyimpanan credential privileged jangka panjang.

Session:

```text
sessionId
userId
identityId
deviceId
createdAt
lastActivityAt
expiresAt
revokedAt
ip
userAgent
authenticationMethod
riskLevel
```

---

# 15. Session Lifetime

Rekomendasi awal:

```text
Idle Timeout:
15–30 menit

Absolute Session:
8–12 jam
```

Untuk environment dengan security requirement tinggi:

```text
Idle Timeout:
15 menit

Sensitive Operation:
Re-authentication
```

Session dapat diperpanjang hanya setelah policy checks.

---

# 16. Session Rotation

Setelah:

```text
Login
MFA
Privilege Escalation
Re-authentication
Password Change
```

lakukan session rotation.

Flow:

```text
Old Session
    ↓
Invalidate
    ↓
Create New Session
```

Mencegah session fixation dan mengurangi dampak credential/session compromise.

---

# 17. Device Management

Buat halaman:

```text
Security
 └── Devices & Sessions
```

Contoh:

```text
Chrome / Windows
Last Seen: 15:02
Authentication: Passkey
Risk: LOW
Status: Active

[ Revoke ]
```

Superadmin dapat:

```text
View Devices
View Sessions
Revoke Session
Revoke All Sessions
Rename Device
Review Login History
```

---

# 18. Risk-Based Authentication

Setiap login diberi risk score.

Input:

```text
User
Device
IP
ASN
Location
Browser
Operating System
Login Time
Previous Login
Failed Attempts
Session History
Behavior
```

Contoh:

```text
Known Device
+
Known Location
+
Passkey
+
Normal Time
+
No anomalies

→ LOW RISK
```

Contoh:

```text
New Device
+
Unusual Country
+
Unusual Time
+
Multiple Failed Attempts

→ HIGH RISK
```

---

# 19. Risk Level

```text
LOW
MEDIUM
HIGH
CRITICAL
```

### LOW

```text
Normal authentication
```

### MEDIUM

```text
Additional verification
```

### HIGH

```text
Step-up authentication
```

### CRITICAL

```text
Block
+
Security Alert
+
Manual Review
```

---

# 20. Step-Up Authentication

Tidak semua aktivitas membutuhkan authentication level sama.

## Low Risk

```text
Dashboard
Analytics
Tenant List
Report View
```

Session cukup.

## Medium Risk

```text
Export Report
Create API Key
Change Role
Change Tenant Plan
```

Minta:

```text
Re-authentication
+
MFA
```

## Critical

```text
Delete Tenant
Suspend Tenant
Change Security Policy
Change Billing
Reset Admin
Delete Data
```

Minta:

```text
Passkey / FIDO2
+
Step-up
+
Confirmation
+
Audit
```

---

# 21. Transaction Confirmation

Untuk tindakan destruktif:

```text
DELETE TENANT
```

jangan hanya:

```text
[ Confirm ]
```

Gunakan:

```text
Tenant:
PT ABC Distribution

Type tenant name to confirm:

[ PT ABC Distribution ]

[ Cancel ]
[ Re-authenticate & Delete ]
```

---

# 22. Just-In-Time Privilege

Superadmin tidak harus memiliki semua privilege sepanjang waktu.

Contoh:

```text
Platform Admin
       ↓
Request:
TENANT_DELETE
       ↓
Policy
       ↓
Approval
       ↓
Temporary Privilege
       ↓
Execute
       ↓
Automatic Revocation
```

Contoh privilege:

```text
TENANT_DELETE
BILLING_OVERRIDE
SECURITY_POLICY_CHANGE
USER_IMPERSONATION
DATA_EXPORT_ALL
```

---

# 23. Impersonation

Fitur:

```text
Login as Tenant User
```

sangat sensitif.

Jika diperlukan untuk support:

```text
Support Admin
      ↓
Request Impersonation
      ↓
Reason Required
      ↓
Approval / Policy
      ↓
Temporary Session
      ↓
Banner:
"IMPERSONATION MODE"
      ↓
Audit Everything
      ↓
Automatic End
```

Jangan menggunakan password user tenant untuk impersonation.

---

# 24. Break-Glass Account

Sediakan:

```text
EMERGENCY_ADMIN
```

Default:

```text
DISABLED
```

Flow:

```text
Emergency
 ↓
Activate
 ↓
Strong Authentication
 ↓
Reason
 ↓
Time Limited
 ↓
Full Audit
 ↓
Automatic Disable
```

Break-glass tidak digunakan untuk operasi normal.

---

# 25. Login Rate Limiting

Existing DTMS sudah memiliki login rate limit 10 request/menit per IP dan API 300 request/menit. fileciteturn2file0L23-L25

Untuk Superadmin, gunakan policy lebih ketat dan multi-dimensional:

```text
IP
+
Account
+
Device
+
Endpoint
```

Contoh:

```text
Login
5 failed attempts
       ↓
Progressive delay
       ↓
Risk evaluation
```

Jangan mengandalkan IP-only karena dapat menyebabkan account lockout abuse.

---

# 26. Account Enumeration Protection

Respons login harus generik:

```text
Email atau credential tidak valid.
```

Jangan:

```text
Username ditemukan tetapi password salah.
```

atau:

```text
Username tidak ditemukan.
```

Tujuannya mencegah attacker mengetahui akun privileged yang valid.

---

# 27. Security Event

Minimal event:

```text
SUPERADMIN_LOGIN_SUCCESS
SUPERADMIN_LOGIN_FAILED
SUPERADMIN_MFA_SUCCESS
SUPERADMIN_MFA_FAILED

SUPERADMIN_SESSION_CREATED
SUPERADMIN_SESSION_REVOKED
SUPERADMIN_SESSION_EXPIRED

SUPERADMIN_PASSKEY_ADDED
SUPERADMIN_PASSKEY_REMOVED
SUPERADMIN_FIDO_ADDED
SUPERADMIN_FIDO_REMOVED

SUPERADMIN_PASSWORD_CHANGED
SUPERADMIN_RECOVERY_CODES_REGENERATED

SUPERADMIN_DEVICE_ADDED
SUPERADMIN_DEVICE_REVOKED

SUPERADMIN_PRIVILEGE_REQUESTED
SUPERADMIN_PRIVILEGE_GRANTED
SUPERADMIN_PRIVILEGE_REVOKED

SUPERADMIN_STEP_UP_SUCCESS
SUPERADMIN_STEP_UP_FAILED

SUPERADMIN_IMPERSONATION_STARTED
SUPERADMIN_IMPERSONATION_ENDED

SUPERADMIN_BREAK_GLASS_ACTIVATED
SUPERADMIN_BREAK_GLASS_ENDED
```

---

# 28. Audit Log

Setiap aktivitas privileged:

```text
userId
identityId
role
action
resource
resourceId
tenantId
ip
userAgent
deviceId
authenticationMethod
riskLevel
requestId
timestamp
result
reason
```

Untuk critical action:

```text
approvalId
approvalUser
justification
```

---

# 29. Audit Immutability

Audit tidak boleh mudah diubah oleh Superadmin biasa.

Arsitektur:

```text
Application
    ↓
Audit Event
    ↓
Audit Queue
    ↓
Append-only Storage
    ↓
Security Monitoring
```

Buat permission terpisah:

```text
audit.read
audit.export
```

Jangan berikan:

```text
audit.delete
```

kepada Superadmin operasional.

---

# 30. Login History

Superadmin dapat melihat:

```text
Time
IP
Location
Device
Browser
Authentication Method
Risk
Result
```

Contoh:

```text
26 Aug 15:02
Indonesia
Chrome / Windows
Passkey
LOW
SUCCESS
```

---

# 31. Security Dashboard

```text
SECURITY CENTER
│
├── Active Sessions
├── Devices
├── Login History
├── Authentication Methods
├── Risk Events
├── Failed Login
├── MFA Events
├── Privileged Actions
├── Security Alerts
└── Audit
```

---

# 32. Authentication Methods Dashboard

```text
SUPERADMIN SECURITY

Passkey                 ACTIVE
FIDO2 Security Key      ACTIVE
TOTP                    ACTIVE
Recovery Codes          8 remaining
Password                FALLBACK
```

Status:

```text
ACTIVE
WARNING
REVOKED
EXPIRED
```

---

# 33. Authentication Policy

Buat policy configurable:

```text
requireMFA
requirePasskey
allowPasswordFallback
allowTOTP
maxSessionMinutes
idleTimeoutMinutes
requireStepUpForExport
requireStepUpForBilling
requireStepUpForTenantDelete
requireFIDOForCriticalAction
```

Jangan hard-code security policy di banyak file.

---

# 34. Recommended Superadmin Policy

Default:

```yaml
authentication:
  primary:
    - passkey
    - fido2

  fallback:
    - totp
    - password

  recovery:
    - recovery_code

session:
  idleTimeoutMinutes: 20
  absoluteTimeoutHours: 8
  rotateOnAuthentication: true

risk:
  enabled: true
  mediumAction: step_up
  highAction: step_up
  criticalAction: block_or_fido

privileged:
  requireStepUpFor:
    - tenant_suspend
    - tenant_delete
    - billing_change
    - security_policy_change
    - api_key_create
    - mass_export

audit:
  enabled: true
  immutable: true
```

---

# 35. Database Model

## AdminIdentity

```text
AdminIdentity
- id
- userId
- status
- identityType
- createdAt
- updatedAt
```

## PasskeyCredential

```text
PasskeyCredential
- id
- identityId
- credentialId
- publicKey
- counter
- deviceName
- createdAt
- lastUsedAt
- revokedAt
```

## TotpAuthenticator

```text
TotpAuthenticator
- id
- identityId
- secretEncrypted
- verifiedAt
- lastUsedAt
- revokedAt
```

## AdminSession

```text
AdminSession
- id
- identityId
- sessionHash
- deviceId
- ip
- userAgent
- authenticationMethod
- riskLevel
- createdAt
- lastActivityAt
- expiresAt
- revokedAt
```

## RecoveryCode

```text
RecoveryCode
- id
- identityId
- codeHash
- usedAt
- createdAt
```

## PrivilegeGrant

```text
PrivilegeGrant
- id
- identityId
- permission
- scope
- reason
- approvedBy
- grantedAt
- expiresAt
- revokedAt
```

## SecurityEvent

```text
SecurityEvent
- id
- identityId
- eventType
- severity
- ip
- deviceId
- requestId
- metadata
- createdAt
```

---

# 36. API Design

Pisahkan admin authentication dari tenant authentication.

```text
POST /api/admin/auth/login
POST /api/admin/auth/passkey/start
POST /api/admin/auth/passkey/verify
POST /api/admin/auth/fido/start
POST /api/admin/auth/fido/verify

POST /api/admin/auth/totp/verify
POST /api/admin/auth/recovery/verify

POST /api/admin/auth/logout
POST /api/admin/auth/revoke-all

GET  /api/admin/auth/me
GET  /api/admin/auth/sessions
DELETE /api/admin/auth/sessions/{id}

GET  /api/admin/security/events
GET  /api/admin/security/login-history

POST /api/admin/security/step-up
POST /api/admin/security/privilege/request
POST /api/admin/security/privilege/approve
POST /api/admin/security/privilege/revoke
```

---

# 37. Authentication State Machine

```text
UNAUTHENTICATED
       ↓
IDENTIFIED
       ↓
PRIMARY_AUTHENTICATED
       ↓
MFA_REQUIRED
       ↓
AUTHENTICATED
       ↓
RISK_EVALUATED
       ↓
PRIVILEGED_SESSION
```

Untuk high-risk:

```text
PRIVILEGED_SESSION
       ↓
STEP_UP_REQUIRED
       ↓
STEP_UP_VERIFIED
       ↓
CRITICAL_ACTION_ALLOWED
```

---

# 38. Jangan Menggunakan Tenant ID untuk Login Superadmin

Existing tenant login menggunakan:

```text
username + password + tenantId
```

pada `/api/auth/login`. fileciteturn1file2L194-L208

Untuk Superadmin:

```text
JANGAN:
username + password + tenantId
```

Gunakan:

```text
admin identity
      ↓
platform scope
```

Superadmin bukan anggota tenant tertentu.

---

# 39. Superadmin Session Scope

Session:

```json
{
  "identityType": "PLATFORM_ADMIN",
  "scope": "PLATFORM",
  "permissions": [
    "tenant.read",
    "tenant.suspend",
    "report.view"
  ],
  "riskLevel": "LOW"
}
```

Bukan:

```json
{
  "tenantId": "tenant_123",
  "role": "SUPER_ADMIN"
}
```

---

# 40. Tenant Switching

Jika Superadmin perlu melihat tenant:

```text
Platform Session
      ↓
Select Tenant
      ↓
Create Scoped Context
      ↓
Tenant View
```

Jangan mengubah platform session menjadi tenant session secara permanen.

Contoh:

```text
PLATFORM SESSION
      │
      ├── Tenant A Context
      ├── Tenant B Context
      └── Tenant C Context
```

Setiap perubahan scope dicatat ke audit.

---

# 41. Security Boundary

```text
                 PLATFORM
                    │
             SUPERADMIN AUTH
                    │
              PLATFORM SCOPE
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
     Tenant A    Tenant B    Tenant N
        │           │           │
    Tenant RBAC Tenant RBAC Tenant RBAC
        │           │           │
      Data A      Data B      Data N
```

Superadmin memiliki akses platform melalui **authorization policy**, bukan karena database query bebas.

---

# 42. Recommended Security Levels

## Level 1 — Normal Admin

```text
Passkey
+
Secure Session
```

## Level 2 — Privileged

```text
Passkey
+
Risk Assessment
+
Step-up
```

## Level 3 — Critical

```text
FIDO2 / Passkey
+
Step-up
+
Confirmation
+
Audit
```

## Level 4 — Emergency

```text
Break Glass
+
Strong Authentication
+
Reason
+
Time Limit
+
Full Audit
```

---

# 43. Implementasi Bertahap

## Phase 1 — Wajib

```text
[ ] Admin authentication boundary
[ ] Secure session
[ ] Passkey/WebAuthn
[ ] TOTP fallback
[ ] Recovery codes
[ ] Rate limiting
[ ] Login history
[ ] Device/session management
[ ] Privileged audit
```

## Phase 2 — Enterprise

```text
[ ] Risk engine
[ ] Step-up authentication
[ ] RBAC
[ ] ABAC
[ ] Security dashboard
[ ] Session revocation
[ ] Security version
```

## Phase 3 — High Security

```text
[ ] FIDO2 hardware key
[ ] JIT privilege
[ ] Approval workflow
[ ] Break-glass
[ ] Impersonation controls
[ ] Immutable audit
```

## Phase 4 — Enterprise SSO

```text
[ ] OIDC
[ ] SAML
[ ] SCIM
[ ] Enterprise IdP integration
```

---

# 44. Definition of Done

Superadmin Security dianggap siap production apabila:

```text
[ ] Superadmin memiliki authentication boundary terpisah.
[ ] Tenant user tidak dapat masuk ke platform scope.
[ ] Password tidak disimpan plaintext.
[ ] Password menggunakan Argon2id.
[ ] Passkey/WebAuthn tersedia.
[ ] FIDO2 dapat digunakan.
[ ] TOTP fallback tersedia.
[ ] Recovery codes tersedia.
[ ] Secure session tersedia.
[ ] Session rotation tersedia.
[ ] Session revocation tersedia.
[ ] Device management tersedia.
[ ] Login history tersedia.
[ ] Rate limiting tersedia.
[ ] Account enumeration dicegah.
[ ] Risk assessment tersedia.
[ ] Step-up authentication tersedia.
[ ] Critical action membutuhkan re-authentication.
[ ] RBAC tersedia.
[ ] ABAC tersedia.
[ ] JIT privilege tersedia untuk privilege kritis.
[ ] Break-glass tersedia.
[ ] Impersonation diaudit.
[ ] Security event tersedia.
[ ] Audit append-only tersedia.
[ ] Request ID tersedia.
[ ] Security alert tersedia.
[ ] Cross-tenant access diuji.
[ ] Privilege escalation diuji.
[ ] Session attack diuji.
[ ] Authentication bypass diuji.
[ ] Recovery flow diuji.
[ ] Load/rate-limit testing dilakukan.
```

---

# 45. Final Login Architecture

```text
                         SUPERADMIN
                              │
                              ▼
                     admin.dtms.com
                              │
                              ▼
                         WAF / CDN
                              │
                              ▼
                       RATE LIMITER
                              │
                              ▼
                    PLATFORM IDENTITY
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
             PASSKEY                    FIDO2
                 │                         │
                 └────────────┬────────────┘
                              ▼
                       RISK ENGINE
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
               LOW                       HIGH
                 │                         │
                 │                    STEP-UP
                 │                         │
                 └────────────┬────────────┘
                              ▼
                       SECURE SESSION
                              │
                              ▼
                         RBAC + ABAC
                              │
                              ▼
                      PLATFORM SCOPE
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           Tenants         Billing        Security
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                       PRIVILEGED ACTION
                              │
                              ▼
                     IMMUTABLE AUDIT
                              │
                              ▼
                     SECURITY MONITORING
```

---

# 46. Final Recommendation

Untuk DTMS Enterprise, gunakan:

```text
PASSKEY / WEBAUTHN
        +
FIDO2
        +
TOTP FALLBACK
        +
SECURE SESSION
        +
RISK ENGINE
        +
RBAC + ABAC
        +
STEP-UP AUTHENTICATION
        +
JIT PRIVILEGE
        +
BREAK-GLASS
        +
IMMUTABLE AUDIT
```

Jangan berhenti pada:

```text
JWT + Password + TOTP
```

Mekanisme tersebut sudah ada pada DTMS saat ini dan merupakan baseline yang baik, tetapi untuk akun yang dapat mengelola banyak tenant, billing, security, user, API credential, dan konfigurasi platform, desain harus diperlakukan sebagai **Privileged Access Security**, bukan login aplikasi biasa.

Prioritas implementasi:

```text
1. Pisahkan admin.dtms.com
2. Pisahkan Platform Identity
3. Implementasikan Passkey/WebAuthn
4. Tambahkan FIDO2
5. Pertahankan TOTP sebagai fallback
6. Implementasikan secure session
7. Implementasikan risk engine
8. Implementasikan step-up authentication
9. Implementasikan RBAC + ABAC
10. Implementasikan JIT privilege
11. Implementasikan immutable audit
12. Tambahkan OIDC/SAML/SCIM untuk enterprise SSO
```
