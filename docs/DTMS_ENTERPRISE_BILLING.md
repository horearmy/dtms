# DTMS Enterprise Billing Module
## Delivery Tracking Management System

**Document Version:** 1.0  
**Status:** Implementation Specification  
**Target:** Enterprise Multi-Tenant SaaS  
**Module:** Billing, Subscription, Invoice & Payment

---

## 1. Tujuan

Modul Billing DTMS bertanggung jawab mengelola seluruh proses komersial tenant mulai dari:

```text
Tenant
  ↓
Contract
  ↓
Subscription / Pricing Plan
  ↓
Usage Metering
  ↓
Billing Calculation
  ↓
Invoice
  ↓
Payment
  ↓
Receipt / Reconciliation
  ↓
Financial Reporting
```

Billing harus bersifat **configurable**, **multi-tenant**, **auditable**, dan tidak bergantung pada hard-coded pricing.

---

## 2. Prinsip Arsitektur

### 2.1 Multi-Tenant

Setiap data billing wajib memiliki `tenant_id`.

Tenant tidak boleh melihat:

- invoice tenant lain
- payment tenant lain
- contract tenant lain
- usage tenant lain
- pricing internal tenant lain

### 2.2 Pricing Tidak Boleh Hard-Code

Harga disimpan sebagai master data dan memiliki versioning.

Contoh:

```text
PLAN_ENTERPRISE
price_version = 3
effective_from = 2026-08-01
price = 10000000
```

Perubahan harga tidak boleh mengubah histori invoice lama.

### 2.3 Immutable Invoice

Invoice yang sudah `ISSUED` tidak boleh diedit secara langsung.

Jika terjadi koreksi gunakan:

- Credit Note
- Debit Note
- Void / Cancel sesuai permission

### 2.4 Auditability

Semua perubahan penting harus masuk `audit_logs`.

Contoh:

```text
CREATE_INVOICE
ISSUE_INVOICE
VOID_INVOICE
RECORD_PAYMENT
REFUND_PAYMENT
CHANGE_SUBSCRIPTION
CHANGE_PRICE
APPLY_DISCOUNT
```

---

# 3. Modul Utama

```text
Billing
├── Pricing Plans
├── Price Components
├── Contracts
├── Subscriptions
├── Usage Metering
├── Billing Runs
├── Invoices
├── Invoice Items
├── Credit Notes
├── Debit Notes
├── Payments
├── Refunds
├── Tax
├── Discounts
├── Payment Reconciliation
├── Collections / Overdue
├── Billing Notifications
└── Billing Reports
```

---

# 4. Pricing Plan

## 4.1 Entity: pricing_plans

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| code | VARCHAR | Unique plan code |
| name | VARCHAR | Plan name |
| description | TEXT | Description |
| billing_model | ENUM | FIXED, PER_UNIT, USAGE, HYBRID |
| billing_cycle | ENUM | MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, CUSTOM |
| status | ENUM | DRAFT, ACTIVE, ARCHIVED |
| currency | VARCHAR(3) | IDR, USD, etc |
| created_at | DATETIME | Creation time |
| updated_at | DATETIME | Last update |

Contoh:

```json
{
  "code": "ENTERPRISE",
  "name": "DTMS Enterprise",
  "billing_model": "HYBRID",
  "billing_cycle": "MONTHLY",
  "currency": "IDR"
}
```

---

# 5. Price Components

Satu plan dapat mempunyai banyak komponen biaya.

Contoh:

```text
Enterprise
├── Base Subscription       Rp5.000.000
├── Vehicle                 Rp100.000 / vehicle
├── User                    Rp50.000 / user
├── API                     RpX / usage
├── Storage                 RpX / GB
└── Notification            RpX / message
```

## Entity: price_components

| Field | Type |
|---|---|
| id | UUID |
| pricing_plan_id | UUID |
| code | VARCHAR |
| name | VARCHAR |
| charge_type | ENUM |
| unit | VARCHAR |
| unit_price | DECIMAL |
| minimum_quantity | DECIMAL |
| maximum_quantity | DECIMAL |
| taxable | BOOLEAN |
| effective_from | DATETIME |
| effective_to | DATETIME |
| status | ENUM |

`charge_type`:

```text
FIXED
PER_VEHICLE
PER_USER
PER_DELIVERY
PER_API_CALL
PER_GB
PER_MESSAGE
CUSTOM_USAGE
```

---

# 6. Contract

Contract mengikat tenant dengan plan dan periode layanan.

## Entity: contracts

| Field | Type |
|---|---|
| id | UUID |
| tenant_id | UUID |
| contract_number | VARCHAR |
| pricing_plan_id | UUID |
| start_date | DATE |
| end_date | DATE |
| billing_cycle | ENUM |
| payment_terms_days | INT |
| auto_renew | BOOLEAN |
| credit_limit | DECIMAL |
| status | ENUM |
| created_at | DATETIME |
| updated_at | DATETIME |

Status:

```text
DRAFT
PENDING_APPROVAL
ACTIVE
SUSPENDED
EXPIRED
TERMINATED
```

---

# 7. Subscription

Subscription menunjukkan layanan yang sedang aktif.

## Entity: subscriptions

| Field | Type |
|---|---|
| id | UUID |
| tenant_id | UUID |
| contract_id | UUID |
| pricing_plan_id | UUID |
| start_date | DATE |
| end_date | DATE |
| status | ENUM |
| billing_anchor_day | INT |
| trial_end_date | DATE |
| cancelled_at | DATETIME |
| created_at | DATETIME |

Status:

```text
TRIAL
ACTIVE
PAST_DUE
SUSPENDED
CANCELLED
EXPIRED
```

---

# 8. Usage Metering

Usage Metering menghitung pemakaian tenant.

Contoh:

```text
Tenant ABC
Vehicles = 75
Users = 24
Deliveries = 12,450
API Calls = 1,250,000
Storage = 82 GB
Notifications = 8,500
```

## Entity: usage_records

| Field | Type |
|---|---|
| id | UUID |
| tenant_id | UUID |
| subscription_id | UUID |
| metric_code | VARCHAR |
| usage_date | DATE |
| quantity | DECIMAL |
| source | VARCHAR |
| reference_id | VARCHAR |
| created_at | DATETIME |

Contoh:

```json
{
  "tenant_id": "TENANT-001",
  "metric_code": "ACTIVE_VEHICLE",
  "usage_date": "2026-08-31",
  "quantity": 75,
  "source": "vehicle_module"
}
```

---

# 9. Billing Run

Billing Run adalah proses periodik untuk menghasilkan invoice.

Contoh:

```text
Billing Run
2026-08-01 → 2026-08-31

Tenant ABC
  ↓
Read Subscription
  ↓
Read Pricing
  ↓
Read Usage
  ↓
Calculate Charge
  ↓
Tax
  ↓
Discount
  ↓
Generate Invoice
```

## Entity: billing_runs

| Field | Type |
|---|---|
| id | UUID |
| billing_period_start | DATE |
| billing_period_end | DATE |
| run_type | ENUM |
| status | ENUM |
| started_at | DATETIME |
| completed_at | DATETIME |
| total_tenants | INT |
| total_invoices | INT |
| total_amount | DECIMAL |
| error_count | INT |

Status:

```text
PENDING
RUNNING
COMPLETED
PARTIAL
FAILED
```

Billing Run harus **idempotent**. Menjalankan proses yang sama dua kali tidak boleh menghasilkan invoice duplikat.

---

# 10. Billing Calculation

Formula dasar:

```text
Subtotal
= Fixed Charges
+ Usage Charges
+ Additional Charges
- Discounts

Taxable Amount
= Subtotal - Tax Exemptions

Tax
= Taxable Amount × Tax Rate

Grand Total
= Subtotal - Discount + Tax
```

Contoh:

```text
Base Subscription       5.000.000
75 Vehicles × 100.000  7.500.000
24 Users × 50.000       1.200.000
API Usage                 500.000
---------------------------------
Subtotal                14.200.000

Discount                 -500.000
---------------------------------
Taxable Amount          13.700.000

Tax                     1.507.000
---------------------------------
Grand Total             15.207.000
```

> Nilai pajak harus configurable dan mengikuti aturan perpajakan yang berlaku pada saat implementasi.

---

# 11. Prorated Billing

Prorated billing diperlukan ketika tenant:

- upgrade plan
- downgrade plan
- menambah kendaraan
- menghapus kendaraan
- mulai layanan di tengah periode

Formula:

```text
Prorated Charge =
Price × Active Days / Total Days
```

Contoh:

```text
Price = Rp1.000.000
Active Days = 15
Total Days = 30

Charge = 1.000.000 × 15/30
       = Rp500.000
```

---

# 12. Invoice

## Entity: invoices

| Field | Type |
|---|---|
| id | UUID |
| tenant_id | UUID |
| contract_id | UUID |
| subscription_id | UUID |
| billing_run_id | UUID |
| invoice_number | VARCHAR |
| invoice_date | DATE |
| billing_period_start | DATE |
| billing_period_end | DATE |
| due_date | DATE |
| currency | VARCHAR(3) |
| subtotal | DECIMAL |
| discount_amount | DECIMAL |
| tax_amount | DECIMAL |
| total_amount | DECIMAL |
| paid_amount | DECIMAL |
| outstanding_amount | DECIMAL |
| status | ENUM |
| issued_at | DATETIME |
| paid_at | DATETIME |
| created_at | DATETIME |

Format invoice:

```text
INV/DTMS/{TENANT_CODE}/{YYYY}/{MM}/{SEQUENCE}
```

Contoh:

```text
INV/DTMS/ABC/2026/08/000123
```

---

# 13. Invoice Item

## Entity: invoice_items

| Field | Type |
|---|---|
| id | UUID |
| invoice_id | UUID |
| price_component_id | UUID |
| description | TEXT |
| quantity | DECIMAL |
| unit_price | DECIMAL |
| discount_amount | DECIMAL |
| tax_rate | DECIMAL |
| tax_amount | DECIMAL |
| line_total | DECIMAL |

Invoice harus menyimpan snapshot harga pada saat invoice dibuat.

Jangan menghitung ulang invoice lama menggunakan harga master terbaru.

---

# 14. Invoice Status

```text
DRAFT
   ↓
PENDING_APPROVAL
   ↓
ISSUED
   ↓
SENT
   ↓
┌───────────────┐
│               │
PAID        PARTIALLY_PAID
│               │
↓               ↓
CLOSED        OUTSTANDING
                │
                ↓
             OVERDUE
                │
                ↓
             SUSPENDED
```

Status tambahan:

```text
VOID
CANCELLED
WRITTEN_OFF
```

---

# 15. Payment

## Entity: payments

| Field | Type |
|---|---|
| id | UUID |
| tenant_id | UUID |
| invoice_id | UUID |
| payment_number | VARCHAR |
| payment_method | ENUM |
| transaction_reference | VARCHAR |
| amount | DECIMAL |
| currency | VARCHAR(3) |
| payment_date | DATETIME |
| status | ENUM |
| gateway_response | JSON |
| created_at | DATETIME |

Payment method:

```text
BANK_TRANSFER
VIRTUAL_ACCOUNT
CREDIT_CARD
DEBIT_CARD
E_WALLET
PAYMENT_GATEWAY
CASH
OTHER
```

Payment status:

```text
PENDING
PROCESSING
SUCCESS
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

---

# 16. Payment Allocation

Satu payment dapat dialokasikan ke satu atau beberapa invoice.

## Entity: payment_allocations

| Field | Type |
|---|---|
| id | UUID |
| payment_id | UUID |
| invoice_id | UUID |
| allocated_amount | DECIMAL |
| allocated_at | DATETIME |

Contoh:

```text
Payment = Rp20.000.000

Invoice A = Rp12.000.000
Invoice B = Rp8.000.000

Allocation:
A → Rp12.000.000
B → Rp8.000.000
```

---

# 17. Credit Note

Digunakan ketika tenant harus mendapatkan pengurangan tagihan.

Contoh:

```text
Invoice       Rp10.000.000
Credit Note   Rp 1.000.000
Outstanding   Rp 9.000.000
```

## Entity: credit_notes

```text
id
tenant_id
invoice_id
credit_note_number
reason
amount
tax_amount
status
created_at
approved_at
```

Credit note harus memiliki approval jika nominal melewati threshold tertentu.

---

# 18. Debit Note

Digunakan untuk menambahkan tagihan setelah invoice diterbitkan.

Contoh:

```text
Invoice awal        Rp10.000.000
Additional usage    Rp 1.500.000
Debit Note          Rp 1.500.000
```

---

# 19. Discount

Discount harus memiliki rule.

Jenis:

```text
PERCENTAGE
FIXED_AMOUNT
VOLUME
CONTRACT
PROMOTIONAL
CUSTOM
```

Contoh:

```text
Enterprise Discount
10%

Minimum Contract:
12 months
```

Discount harus memiliki:

```text
effective_from
effective_to
approval_status
maximum_discount
```

---

# 20. Tax

Tax jangan hard-coded.

## Entity: tax_rules

```text
id
code
name
rate
country
effective_from
effective_to
status
```

Contoh:

```json
{
  "code": "VAT_STANDARD",
  "name": "Standard VAT",
  "rate": 0.11,
  "status": "ACTIVE"
}
```

Nilai aktual harus dapat dikonfigurasi berdasarkan kebijakan perpajakan yang berlaku.

---

# 21. Overdue & Collection

Sistem harus menghitung:

```text
days_overdue =
current_date - due_date
```

Contoh policy:

```text
0 days      → Due
1-7 days    → Reminder
8-14 days   → Escalation
15-30 days  → Collection
>30 days    → Suspension candidate
```

Semua threshold harus configurable per contract atau tenant.

---

# 22. Grace Period

Jangan langsung suspend tenant.

Contoh:

```text
Invoice Due
    ↓
Grace Period 14 hari
    ↓
Reminder
    ↓
Escalation
    ↓
Suspension Warning
    ↓
Suspended
```

Contract enterprise dapat mempunyai grace period berbeda.

---

# 23. Billing Notification

Event yang dapat menghasilkan notification:

```text
INVOICE_CREATED
INVOICE_ISSUED
INVOICE_SENT
PAYMENT_RECEIVED
PAYMENT_FAILED
PAYMENT_DUE
INVOICE_OVERDUE
SUSPENSION_WARNING
SUBSCRIPTION_EXPIRING
CONTRACT_EXPIRING
```

Channel:

```text
EMAIL
IN_APP
SMS
WHATSAPP
WEBHOOK
```

---

# 24. Role & Permission

Minimal:

### Super Admin
- Manage pricing
- Manage billing configuration
- Manage tax
- Manage tenant billing
- View all reports

### Billing Admin
- Generate billing
- Manage invoice
- Manage payment
- Manage credit/debit note

### Finance
- View invoice
- Verify payment
- Reconciliation
- Financial report

### Tenant Admin
- View subscription
- View invoice
- Download invoice
- View payment
- View outstanding

### Tenant Finance
- View invoice
- Payment
- Payment history

### Auditor
- Read-only
- Audit trail
- Billing history

---

# 25. API Design

## Pricing

```http
GET    /api/v1/billing/plans
POST   /api/v1/billing/plans
GET    /api/v1/billing/plans/{id}
PUT    /api/v1/billing/plans/{id}
POST   /api/v1/billing/plans/{id}/archive
```

## Subscription

```http
GET    /api/v1/tenants/{tenantId}/subscription
POST   /api/v1/tenants/{tenantId}/subscription
PUT    /api/v1/subscriptions/{id}
POST   /api/v1/subscriptions/{id}/upgrade
POST   /api/v1/subscriptions/{id}/cancel
```

## Usage

```http
GET    /api/v1/billing/usage
POST   /api/v1/billing/usage
GET    /api/v1/tenants/{tenantId}/usage
```

## Billing Run

```http
POST   /api/v1/billing/runs
GET    /api/v1/billing/runs
GET    /api/v1/billing/runs/{id}
```

## Invoice

```http
GET    /api/v1/invoices
POST   /api/v1/invoices
GET    /api/v1/invoices/{id}
POST   /api/v1/invoices/{id}/issue
POST   /api/v1/invoices/{id}/send
POST   /api/v1/invoices/{id}/void
GET    /api/v1/invoices/{id}/pdf
```

## Payment

```http
GET    /api/v1/payments
POST   /api/v1/payments
GET    /api/v1/payments/{id}
POST   /api/v1/payments/{id}/refund
```

---

# 26. Billing Engine Service

Direkomendasikan membuat service terpisah:

```text
BillingEngine
├── PricingService
├── ContractService
├── SubscriptionService
├── UsageService
├── CalculationService
├── TaxService
├── DiscountService
├── InvoiceService
├── PaymentService
├── CreditNoteService
├── DebitNoteService
├── CollectionService
└── ReconciliationService
```

Pseudo-flow:

```pseudo
function generateBilling(tenantId, period):

    subscription = getActiveSubscription(tenantId)

    contract = getContract(subscription.contractId)

    pricing = getPricingSnapshot(
        subscription.pricingPlanId,
        period.start
    )

    usage = getUsage(
        tenantId,
        period.start,
        period.end
    )

    charges = calculateCharges(
        pricing,
        usage
    )

    discount = calculateDiscount(
        contract,
        charges
    )

    taxableAmount = charges.subtotal - discount

    tax = calculateTax(
        taxableAmount,
        contract.taxRules
    )

    total = taxableAmount + tax

    invoice = createInvoice(
        tenantId,
        contract,
        period,
        charges,
        discount,
        tax,
        total
    )

    return invoice
```

---

# 27. Database Relationship

```text
tenants
   │
   ├── contracts
   │       │
   │       └── subscriptions
   │                 │
   │                 └── usage_records
   │
   └── invoices
          │
          ├── invoice_items
          │
          ├── credit_notes
          │
          ├── debit_notes
          │
          └── payment_allocations
                       │
                       └── payments

pricing_plans
   │
   └── price_components

billing_runs
   │
   └── invoices

tax_rules
discount_rules
audit_logs
billing_notifications
```

---

# 28. Idempotency

Endpoint yang menghasilkan transaksi harus mendukung idempotency.

Contoh:

```http
POST /api/v1/billing/runs
Idempotency-Key: 2026-08-ABC
```

Jika request dikirim dua kali, sistem harus mengembalikan hasil transaksi yang sama dan tidak membuat invoice kedua.

Untuk payment gateway, `transaction_reference` harus unique.

---

# 29. Audit Trail

## Entity: billing_audit_logs

```text
id
tenant_id
user_id
action
entity_type
entity_id
old_value
new_value
ip_address
user_agent
created_at
```

Contoh:

```json
{
  "action": "CHANGE_PRICE",
  "entity_type": "PRICE_COMPONENT",
  "entity_id": "PRICE-001",
  "old_value": "100000",
  "new_value": "125000"
}
```

---

# 30. Billing Dashboard

Dashboard Admin:

```text
┌─────────────────────────────────────────┐
│ BILLING OVERVIEW                        │
├────────────┬────────────┬───────────────┤
│ MRR        │ RECEIVABLE │ OVERDUE       │
│ Rp850 Jt   │ Rp120 Jt   │ Rp35 Jt       │
├────────────┴────────────┴───────────────┤
│ Revenue Trend                            │
│                                         │
│       ╱────────────                     │
│  ────╯                                  │
├─────────────────────────────────────────┤
│ Invoice Status                          │
│ Paid | Outstanding | Overdue | Draft    │
├─────────────────────────────────────────┤
│ Top Tenants                             │
└─────────────────────────────────────────┘
```

KPI:

```text
MRR
ARR
Total Revenue
Outstanding
Overdue
Collection Rate
Average Payment Days
Active Subscriptions
Churn Rate
ARPU
```

---

# 31. Tenant Billing Dashboard

Tenant hanya melihat datanya sendiri:

```text
Current Plan
Enterprise

Current Period
01 Aug 2026 - 31 Aug 2026

Current Usage
75 Vehicles
24 Users
12,450 Deliveries

Current Invoice
Rp15.207.000

Due Date
15 Sep 2026

Outstanding
Rp15.207.000
```

---

# 32. Business Rules

1. Semua billing wajib memiliki `tenant_id`.
2. Invoice `ISSUED` tidak boleh diedit.
3. Invoice number harus unique.
4. Payment reference harus unique.
5. Invoice harus memiliki invoice items.
6. Harga invoice harus merupakan snapshot.
7. Billing Run harus idempotent.
8. Subscription harus memiliki contract aktif.
9. Tenant tidak dapat membuat pricing plan sendiri.
10. Discount di atas threshold harus membutuhkan approval.
11. Credit Note dan Debit Note harus memiliki alasan.
12. Refund harus memiliki payment reference.
13. Semua perubahan transaksi harus tercatat dalam audit log.
14. Tenant suspended tidak dapat menggunakan fitur yang dibatasi contract.
15. Billing tidak boleh menghapus transaksi finansial secara fisik; gunakan void/cancel/reversal.
16. Currency invoice tidak boleh berubah setelah invoice diterbitkan.
17. Due date berasal dari payment terms contract atau konfigurasi yang diizinkan.
18. Usage harus memiliki source/reference agar dapat ditelusuri.
19. Billing calculation harus dapat direproduksi dari snapshot data.
20. Semua operasi finansial harus menggunakan decimal/fixed precision, bukan floating point.

---

# 33. Security

Implementasi minimal:

```text
RBAC
Tenant Isolation
Encryption at Rest
Encryption in Transit
Audit Trail
MFA untuk Finance/Admin
Approval Workflow
API Rate Limiting
Idempotency
Webhook Signature Verification
Secrets Management
Payment Data Tokenization
```

Jangan menyimpan:

- CVV
- PIN
- password payment
- credential payment gateway

Payment card handling sebaiknya menggunakan tokenisasi/payment provider yang sesuai dengan kebutuhan kepatuhan.

---

# 34. Recommended Folder Structure

```text
src/
├── modules/
│   └── billing/
│       ├── controllers/
│       │   ├── BillingController
│       │   ├── InvoiceController
│       │   ├── PaymentController
│       │   └── SubscriptionController
│       │
│       ├── services/
│       │   ├── BillingEngine
│       │   ├── PricingService
│       │   ├── UsageService
│       │   ├── InvoiceService
│       │   ├── PaymentService
│       │   ├── TaxService
│       │   └── CollectionService
│       │
│       ├── models/
│       │   ├── PricingPlan
│       │   ├── Contract
│       │   ├── Subscription
│       │   ├── UsageRecord
│       │   ├── Invoice
│       │   ├── InvoiceItem
│       │   ├── Payment
│       │   └── CreditNote
│       │
│       ├── repositories/
│       ├── validators/
│       ├── policies/
│       ├── jobs/
│       │   ├── GenerateBilling
│       │   ├── SendInvoice
│       │   └── CheckOverdue
│       │
│       └── routes/
│
└── shared/
    ├── Audit
    ├── Notification
    ├── TenantContext
    └── Money
```

---

# 35. Background Jobs

Billing tidak sebaiknya seluruhnya dijalankan melalui request HTTP.

Gunakan queue/worker untuk:

```text
Generate Monthly Billing
Generate Invoice PDF
Send Invoice Email
Send Payment Reminder
Process Payment Webhook
Update Overdue Status
Generate Billing Report
Reconciliation
```

Contoh:

```text
01:00
   ↓
Billing Scheduler
   ↓
Create Billing Run
   ↓
Queue Tenant Billing Jobs
   ↓
Billing Workers
   ↓
Generate Invoice
   ↓
Send Notification
```

---

# 36. Implementasi Bertahap

## Phase 1 — Core Billing

```text
Tenant
Pricing Plan
Subscription
Contract
Invoice
Invoice Item
Payment
```

## Phase 2 — Automation

```text
Usage Metering
Billing Run
Recurring Billing
Overdue
Notification
```

## Phase 3 — Enterprise

```text
Credit Note
Debit Note
Discount Engine
Tax Engine
Approval Workflow
Payment Reconciliation
Audit Trail
```

## Phase 4 — Advanced SaaS

```text
Usage-Based Billing
Proration
Multiple Currency
Multiple Tax Jurisdiction
Revenue Analytics
MRR
ARR
Churn
ARPU
Revenue Forecast
```

---

# 37. Acceptance Criteria

### Pricing

- [ ] Admin dapat membuat pricing plan.
- [ ] Admin dapat membuat price component.
- [ ] Harga memiliki effective date.
- [ ] Harga lama tetap tersedia sebagai histori.

### Contract

- [ ] Tenant dapat memiliki contract.
- [ ] Contract memiliki periode aktif.
- [ ] Contract menentukan payment terms.
- [ ] Contract menentukan subscription.

### Billing

- [ ] Sistem dapat menjalankan billing period.
- [ ] Sistem dapat menghitung fixed charge.
- [ ] Sistem dapat menghitung usage charge.
- [ ] Sistem dapat menghitung discount.
- [ ] Sistem dapat menghitung tax.
- [ ] Billing run idempotent.

### Invoice

- [ ] Invoice number unique.
- [ ] Invoice memiliki line items.
- [ ] Invoice dapat diterbitkan.
- [ ] Invoice dapat dikirim.
- [ ] Invoice dapat di-download.
- [ ] Invoice issued tidak dapat diedit.

### Payment

- [ ] Payment dapat dicatat.
- [ ] Payment dapat dialokasikan ke invoice.
- [ ] Partial payment didukung.
- [ ] Refund dapat dicatat.
- [ ] Payment reference unique.

### Enterprise

- [ ] Tenant isolation aktif.
- [ ] RBAC aktif.
- [ ] Audit trail aktif.
- [ ] Approval workflow aktif.
- [ ] Overdue automation aktif.
- [ ] Billing dashboard tersedia.

---

# 38. Final Enterprise Architecture

```text
                    DTMS ENTERPRISE
                           │
          ┌────────────────┴────────────────┐
          │                                 │
   OPERATIONAL LAYER                 COMMERCIAL LAYER
          │                                 │
   Delivery Management                Tenant Management
   Vehicle Management                 Contract Management
   Tracking                            Subscription
   Route                               Pricing
   POD                                 Usage Metering
   Fleet                               Billing Engine
                                       Invoice
                                       Payment
                                       Collection
                                       Reporting
          │                                 │
          └────────────────┬────────────────┘
                           │
                     DATA PLATFORM
                           │
             ┌─────────────┼─────────────┐
             │             │             │
           Audit         Analytics     Notification
             │             │             │
             └─────────────┼─────────────┘
                           │
                      SECURITY LAYER
                           │
                  RBAC / Tenant Isolation
                  Encryption / MFA / Audit
```

## Kesimpulan

Modul Billing DTMS harus diperlakukan sebagai **Enterprise Billing Engine**, bukan sekadar halaman invoice.

Fondasi implementasi yang direkomendasikan:

```text
TENANT
  ↓
CONTRACT
  ↓
SUBSCRIPTION
  ↓
PRICING
  ↓
USAGE
  ↓
BILLING ENGINE
  ↓
INVOICE
  ↓
PAYMENT
  ↓
RECONCILIATION
  ↓
FINANCIAL ANALYTICS
```

Dengan struktur ini, DTMS dapat mendukung model **SaaS B2B multi-tenant**, fixed subscription, per-vehicle billing, per-user billing, usage-based billing, hybrid billing, recurring invoice, proration, discount, tax, overdue, payment, dan enterprise financial reporting.
