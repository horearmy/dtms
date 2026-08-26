# DTMS --- Superadmin Platform Intelligence & Reporting

## Enterprise Reporting Specification

**Dokumen:** Superadmin Platform Intelligence & Reporting\
**Produk:** Delivery Tracking Management System (DTMS)\
**Target User:** SUPER_ADMIN / PLATFORM ADMIN\
**Status:** Implementation Blueprint\
**Tanggal:** Agustus 2026

------------------------------------------------------------------------

## 1. Tujuan

Modul laporan Superadmin diposisikan sebagai **Platform Intelligence &
Reporting Center**, bukan sekadar laporan operasional.

Modul ini memberikan gambaran menyeluruh mengenai: - kesehatan seluruh
tenant; - pertumbuhan platform; - delivery, SLA, dan exception; -
billing, revenue, subscription, dan usage; - user, driver, fleet, dan
customer; - API dan integration; - security dan audit; - system
health; - insight, alert, dan rekomendasi; - custom report dan scheduled
report.

------------------------------------------------------------------------

## 2. Konsep Modul

``` text
SUPER ADMIN
    ↓
PLATFORM INTELLIGENCE
    ├── Executive Summary
    ├── Tenant Analytics
    ├── Operational Analytics
    ├── Billing & Revenue
    ├── User & Usage Analytics
    ├── Fleet & Driver Analytics
    ├── SLA Analytics
    ├── Exception Analytics
    ├── Customer Analytics
    ├── Integration Analytics
    ├── Security Analytics
    ├── System Health
    └── Reports & Export
```

Prinsip:

``` text
DATA
  ↓
AGGREGATION
  ↓
ANALYTICS
  ↓
TREND DETECTION
  ↓
ANOMALY DETECTION
  ↓
BUSINESS INSIGHT
  ↓
RECOMMENDATION
  ↓
ACTION
```

------------------------------------------------------------------------

## 3. Menu Superadmin

``` text
SUPER ADMIN
├── Dashboard
├── Tenants
├── Onboarding
├── Platform Intelligence
│   ├── Executive Summary
│   ├── Tenant Analytics
│   ├── Delivery Analytics
│   ├── SLA Analytics
│   ├── Exception Analytics
│   ├── User & Usage
│   ├── Fleet Analytics
│   ├── Customer Analytics
│   ├── Integration Analytics
│   ├── Security Analytics
│   └── System Health
├── Billing
│   ├── Revenue
│   ├── Subscription
│   ├── Invoice
│   ├── Payment
│   └── Usage
├── Reports
│   ├── Report Center
│   ├── Report Builder
│   ├── Scheduled Reports
│   ├── Generated Reports
│   └── Templates
├── Security
├── Audit
└── Platform Settings
```

------------------------------------------------------------------------

## 4. Executive Platform Report

Halaman pertama harus menjawab kondisi platform secara cepat.

### KPI

``` text
Total Tenant
Active Tenant
New Tenant
Total Delivery
Delivered
SLA Achievement
Revenue
Outstanding Billing
Active Users
Platform Health
```

Contoh:

``` text
Tenant       Delivery       Revenue       Users       Health
128          2.4M           Rp 1.8B       6,482       98.7%
+12.4%       +18.2%         +9.7%         +14.1%      +0.5%
```

### Attention Required

``` text
7 tenant mendekati limit usage
3 tenant memiliki invoice overdue
12 tenant mengalami penurunan delivery >20%
2 integration memiliki error rate tinggi
```

------------------------------------------------------------------------

## 5. Executive Summary

Executive Summary harus menjawab:

1.  Apa yang berubah?
2.  Mengapa berubah?
3.  Apa risikonya?
4.  Apa peluangnya?
5.  Apa yang harus dilakukan?

Contoh:

> Tenant aktif meningkat 12,9% dibanding periode sebelumnya. Namun
> terdapat 4 tenant yang masih berada dalam onboarding lebih dari 14
> hari.

> Revenue meningkat 9,7%, tetapi outstanding invoice meningkat 14,2%.
> Kondisi ini perlu menjadi perhatian pada collection.

------------------------------------------------------------------------

## 6. Tenant Analytics

### KPI

``` text
Total Tenant
Active Tenant
Trial Tenant
Onboarding
UAT
Suspended
Archived
New Tenant
Churned Tenant
```

### Tenant Growth

``` text
New Tenant
Activated Tenant
Suspended Tenant
Churned Tenant
Renewed Tenant
Upgrade
Downgrade
```

### Tenant Ranking

``` text
Best Performing Tenant
Fastest Growing Tenant
Highest Delivery Volume
Highest Revenue
Highest Usage
Highest SLA
Highest Exception
Highest Risk
```

------------------------------------------------------------------------

## 7. Tenant Health Score

Setiap tenant memiliki health score.

``` text
PT ABC Distribution

██████████████████░░ 87 / 100

Operational       92
Usage             88
Billing           75
System Usage      94
Engagement        82
Support           90
```

Kategori:

``` text
90–100  EXCELLENT
75–89   HEALTHY
60–74   WATCH
40–59   RISK
0–39    CRITICAL
```

Komponen dapat mencakup:

``` text
Operational Health
Usage Health
Billing Health
Engagement Health
Support Health
Integration Health
SLA Health
```

Bobot harus dapat dikonfigurasi.

------------------------------------------------------------------------

## 8. Tenant Risk Detection

Rule awal:

``` text
IF delivery volume turun > 20%
THEN TENANT_RISK = HIGH
```

``` text
IF invoice overdue > threshold
THEN BILLING_RISK = HIGH
```

``` text
IF usage > 80%
THEN CAPACITY_WARNING = TRUE
```

``` text
IF SLA < threshold selama beberapa periode
THEN OPERATIONAL_RISK = HIGH
```

Flow:

``` text
TENANT
  ↓
RISK ENGINE
  ↓
Risk Score
  ↓
Risk Level
  ↓
Recommendation
```

------------------------------------------------------------------------

## 9. Billing & Revenue Report

### KPI

``` text
MRR
ARR
Total Revenue
Collected Revenue
Outstanding
Overdue
Refund
Expansion Revenue
Churned Revenue
```

Contoh:

``` text
MRR                 Rp 1.82 B
ARR                 Rp 21.84 B
Collected           Rp 1.65 B
Outstanding         Rp 170 M
Overdue             Rp 45 M
Collection Rate     90.7%
```

------------------------------------------------------------------------

## 10. Revenue Analytics

Breakdown:

``` text
Revenue by Plan
Revenue by Tenant
Revenue by Industry
Revenue by Region
Revenue by Month
Revenue by Subscription Type
```

------------------------------------------------------------------------

## 11. Subscription Analytics

Status:

``` text
TRIAL
ACTIVE
UPGRADED
DOWNGRADED
RENEWED
CANCELLED
SUSPENDED
CHURNED
```

Metric:

``` text
New Subscription
Upgrade Rate
Downgrade Rate
Renewal Rate
Cancellation Rate
Churn Rate
```

------------------------------------------------------------------------

## 12. Usage Analytics

``` text
Users
Drivers
Shipments
API Calls
GPS Events
Storage
Notifications
Webhooks
```

Contoh:

``` text
PT ABC

Users          48 / 50       96%
Drivers        92 / 100      92%
Shipments      23,800 / 25K  95%
Storage        81%
API Calls      63%
```

Threshold:

``` text
80%  WARNING
90%  CRITICAL WARNING
100% LIMIT REACHED
```

------------------------------------------------------------------------

## 13. Delivery Platform Analytics

``` text
TOTAL SHIPMENTS
    ├── Created
    ├── In Transit
    ├── Delivered
    ├── Failed
    ├── Returned
    ├── Cancelled
    └── Delayed
```

KPI:

``` text
Total Delivery
Delivery Success Rate
Failure Rate
Return Rate
Cancellation Rate
Average Delivery Time
```

------------------------------------------------------------------------

## 14. SLA Analytics

``` text
On-Time Delivery
SLA At Risk
SLA Breach
Completed On Time
Completed Late
```

Contoh:

``` text
On-Time Delivery     94.8%
SLA Breach             3.7%
At Risk                1.5%
```

Tampilkan ranking tenant:

``` text
BEST SLA
1. PT ABC       98.7%
2. PT XYZ       97.9%
3. PT DEF       97.2%

NEEDS ATTENTION
1. PT GHI       81.2%
2. PT JKL       83.4%
3. PT MNO       84.1%
```

------------------------------------------------------------------------

## 15. Exception Analytics

Kategori:

``` text
Customer Unavailable
Wrong Address
Traffic
Vehicle Breakdown
GPS Problem
Route Deviation
Damaged Goods
Recipient Rejected
Other
```

KPI:

``` text
Exception Volume
Exception Rate
Resolution Time
Open Exceptions
Critical Exceptions
Recurring Exceptions
```

------------------------------------------------------------------------

## 16. Driver & Fleet Analytics

### Driver

``` text
Total Drivers
Active Drivers
Online Drivers
Offline Drivers
Average Driver Score
Delivery per Driver
Failed Delivery per Driver
```

### Fleet

``` text
Total Vehicles
Active Vehicles
Available Vehicles
Maintenance
Utilization
Average Distance
```

------------------------------------------------------------------------

## 17. Customer Analytics

``` text
Total Customers
Active Customers
New Customers
Inactive Customers
Top Customers
Customer Growth
```

Analisis:

``` text
Delivery Volume by Customer
SLA by Customer
Failed Delivery by Customer
Revenue by Customer
```

------------------------------------------------------------------------

## 18. API & Integration Analytics

### KPI

``` text
API Requests
API Success Rate
API Error Rate
Average Latency
Webhook Sent
Webhook Success
Webhook Failed
Integration Active
Integration Error
```

Contoh:

``` text
API Requests       2.8M
Success            99.2%
Error               0.8%
Webhook             1.4M
Failed Webhook      2,341
```

Detail:

``` text
Integration
Tenant
Requests
Success %
Error %
Latency
Last Activity
Failed Webhook
```

------------------------------------------------------------------------

## 19. System Health Report

``` text
API              HEALTHY
Database         HEALTHY
Redis            HEALTHY
Queue            HEALTHY
Tracking         HEALTHY
WebSocket        HEALTHY
Storage          HEALTHY
Notification     WARNING
```

Metric:

``` text
CPU
Memory
Database Latency
API Latency
Error Rate
Queue Depth
GPS Ingestion Rate
WebSocket Connections
Storage Usage
```

------------------------------------------------------------------------

## 20. Security Analytics

``` text
Login Attempts
Failed Login
2FA Adoption
Suspicious Login
Blocked IP
API Abuse
Permission Changes
Admin Actions
```

Contoh:

``` text
Failed Login        1,248
Blocked IP             31
2FA Adoption          82%
Suspicious Login       12
Critical Event          2
```

------------------------------------------------------------------------

## 21. Audit Analytics

Kategori:

``` text
Tenant Changes
User Changes
Role Changes
Permission Changes
Shipment Actions
Billing Changes
Security Events
API Key Actions
Admin Actions
```

Contoh:

``` text
Create Tenant       12
Update Tenant        8
Suspend Tenant       2
Role Changed        31
Billing Changed      7
API Key Created     18
```

------------------------------------------------------------------------

## 22. Report Builder

Superadmin dapat membuat laporan custom.

Flow:

``` text
CREATE REPORT
      ↓
SELECT DATASET
      ↓
SELECT DIMENSION
      ↓
SELECT METRIC
      ↓
FILTER
      ↓
GROUP BY
      ↓
CHART / TABLE
      ↓
SAVE REPORT
```

Dataset:

``` text
Tenants
Shipments
Billing
Usage
SLA
Exceptions
Drivers
Vehicles
Customers
API
Audit
Security
```

Contoh:

``` text
Dataset:
Shipments

Dimension:
Tenant

Metric:
Delivery Success Rate

Filter:
August 2026

Group:
Tenant

Chart:
Bar Chart
```

------------------------------------------------------------------------

## 23. Scheduled Reports

Contoh:

``` text
Daily Platform Summary
Weekly Tenant Report
Weekly Operational Report
Monthly Revenue Report
Monthly Executive Report
Monthly Security Report
```

Output:

``` text
Dashboard
PDF
Excel
CSV
Email
```

Parameter:

``` text
Report Name
Schedule
Timezone
Recipient
Format
Dataset
Filter
Template
Active
```

------------------------------------------------------------------------

## 24. Report Templates

Sediakan template:

``` text
Platform Executive Report
Tenant Performance Report
Revenue Report
Subscription Report
Usage Report
Delivery Report
SLA Report
Exception Report
Fleet Report
Integration Report
Security Report
System Health Report
```

------------------------------------------------------------------------

## 25. Executive Insight Engine

Gunakan:

``` text
DATA
 ↓
TREND DETECTION
 ↓
ANOMALY DETECTION
 ↓
INSIGHT
 ↓
RECOMMENDATION
```

Contoh:

### Positive

> Tenant aktif meningkat 13,4% dalam 30 hari terakhir.

### Attention

> 7 tenant telah menggunakan lebih dari 80% kuota shipment.

### Critical

> 3 tenant mengalami SLA di bawah 85% selama dua minggu berturut-turut.

### Revenue

> Revenue meningkat 9,7%, tetapi outstanding invoice meningkat 14,2%.

### Opportunity

> 12 tenant Business telah menggunakan lebih dari 80% kapasitas paket
> dan berpotensi di-upgrade.

------------------------------------------------------------------------

## 26. Recommendation Engine

Contoh:

``` text
Tenant Usage
     ↓
>80%
     ↓
Recommendation
     ↓
"Pertimbangkan upgrade paket"
```

``` text
SLA turun
   ↓
Operational Risk
   ↓
Recommendation
   ↓
"Review delivery performance tenant"
```

``` text
Invoice overdue
   ↓
Billing Risk
   ↓
Recommendation
   ↓
"Follow-up collection"
```

------------------------------------------------------------------------

## 27. Alert Center

``` text
ALERT CENTER

CRITICAL
3 Tenant SLA Critical

HIGH
7 Tenant Usage >80%

MEDIUM
12 Tenant Delivery turun >20%

INFO
18 Tenant eligible upgrade
```

Entity:

``` text
id
tenantId
category
severity
title
description
metric
threshold
status
assignedTo
createdAt
resolvedAt
```

Status:

``` text
NEW
ACKNOWLEDGED
IN_PROGRESS
RESOLVED
DISMISSED
```

------------------------------------------------------------------------

## 28. Analytics Architecture

Jangan mengambil jutaan shipment langsung setiap dashboard dibuka.

Gunakan:

``` text
TRANSACTION DATABASE
        ↓
EVENT / ETL / JOB
        ↓
AGGREGATION
        ↓
ANALYTICS TABLES
        ↓
REPORT API
        ↓
PLATFORM INTELLIGENCE UI
```

Tahap awal dapat menggunakan PostgreSQL summary tables atau materialized
views.

------------------------------------------------------------------------

## 29. Analytics Tables

Minimal:

``` text
tenant_daily_summary
tenant_monthly_summary

shipment_daily_summary
shipment_monthly_summary

billing_daily_summary
billing_monthly_summary

usage_daily_summary

sla_daily_summary

exception_daily_summary

api_daily_summary

security_daily_summary

system_health_daily_summary
```

Contoh:

``` text
tenant_daily_summary

date
tenantId
activeUsers
activeDrivers
shipments
delivered
failed
slaBreached
apiRequests
storageUsed
revenue
```

------------------------------------------------------------------------

## 30. Report API

``` text
GET /api/v1/platform/reports/executive
GET /api/v1/platform/reports/tenants
GET /api/v1/platform/reports/delivery
GET /api/v1/platform/reports/sla
GET /api/v1/platform/reports/exceptions
GET /api/v1/platform/reports/billing
GET /api/v1/platform/reports/usage
GET /api/v1/platform/reports/fleet
GET /api/v1/platform/reports/customers
GET /api/v1/platform/reports/integrations
GET /api/v1/platform/reports/security
GET /api/v1/platform/reports/system-health
```

Custom Report:

``` text
POST   /api/v1/platform/reports/custom
GET    /api/v1/platform/reports/custom
PATCH  /api/v1/platform/reports/custom/{id}
DELETE /api/v1/platform/reports/custom/{id}
```

Scheduled Report:

``` text
POST   /api/v1/platform/reports/schedules
GET    /api/v1/platform/reports/schedules
PATCH  /api/v1/platform/reports/schedules/{id}
DELETE /api/v1/platform/reports/schedules/{id}
```

------------------------------------------------------------------------

## 31. Standard API Response

``` json
{
  "success": true,
  "data": {
    "period": {
      "from": "2026-08-01",
      "to": "2026-08-31"
    },
    "kpi": {},
    "trend": [],
    "breakdown": [],
    "insights": [],
    "alerts": []
  },
  "meta": {
    "requestId": "..."
  }
}
```

------------------------------------------------------------------------

## 32. Permission

``` text
platform.report.view
platform.report.export
platform.report.create
platform.report.update
platform.report.delete
platform.report.schedule
platform.report.manage
platform.insight.view
platform.alert.view
platform.alert.manage
```

------------------------------------------------------------------------

## 33. Data Security

Aturan:

``` text
Superadmin
   ↓
Platform Scope
```

Untuk data sensitif:

``` text
Mask PII
Restrict Export
Audit Download
Watermark Report
```

Contoh:

``` text
Phone: 0812****1234
Email: a***@company.com
```

------------------------------------------------------------------------

## 34. Export Architecture

Format:

``` text
PDF
XLSX
CSV
JSON
```

Export besar harus asynchronous:

``` text
CREATE EXPORT
      ↓
QUEUE
      ↓
WORKER
      ↓
GENERATE
      ↓
OBJECT STORAGE
      ↓
DOWNLOAD
```

------------------------------------------------------------------------

## 35. Report Job

Entity:

``` text
ReportJob
```

Field:

``` text
id
tenantId
reportType
requestedBy
parameters
format
status
fileUrl
error
createdAt
startedAt
completedAt
```

Status:

``` text
QUEUED
PROCESSING
COMPLETED
FAILED
EXPIRED
```

------------------------------------------------------------------------

## 36. Report Audit

Catat:

``` text
REPORT_VIEWED
REPORT_CREATED
REPORT_UPDATED
REPORT_DELETED
REPORT_EXPORTED
REPORT_SCHEDULED
REPORT_DOWNLOADED
```

Field audit:

``` text
userId
reportId
reportType
parameters
format
ip
userAgent
timestamp
```

------------------------------------------------------------------------

## 37. Global Filter

Semua report memiliki:

``` text
Date Range
Tenant
Plan
Industry
Region
Status
Service Type
Customer
Branch
```

Default:

``` text
Current Month
```

Preset:

``` text
Today
Yesterday
Last 7 Days
Last 30 Days
This Month
Last Month
This Quarter
This Year
Custom
```

------------------------------------------------------------------------

## 38. Drill Down

KPI harus dapat dibuka ke detail.

Contoh:

``` text
128 Active Tenant
        ↓
Tenant List
        ↓
PT ABC
        ↓
Tenant Detail
        ↓
Delivery / Billing / Usage / SLA
```

Contoh:

``` text
3 SLA Critical
        ↓
Critical Tenant List
        ↓
Tenant Detail
        ↓
Shipment / Exception
```

------------------------------------------------------------------------

## 39. Tenant Intelligence Detail

``` text
Tenant Overview
├── Health Score
├── Subscription
├── Billing
├── Usage
├── Delivery
├── SLA
├── Exceptions
├── Customers
├── Drivers
├── Vehicles
├── API
├── Security
└── Audit
```

------------------------------------------------------------------------

## 40. KPI Dictionary

Semua KPI harus memiliki definisi resmi.

### Active Tenant

``` text
Tenant dengan status ACTIVE.
```

### Delivery Success Rate

``` text
Delivered / Total Completed Delivery × 100
```

### SLA Achievement

``` text
Completed On Time / Total Completed × 100
```

### Churn Rate

``` text
Churned Tenant / Active Tenant pada awal periode × 100
```

### Collection Rate

``` text
Collected Revenue / Total Billed Revenue × 100
```

### Usage Rate

``` text
Actual Usage / Plan Limit × 100
```

KPI Dictionary harus menjadi sumber kebenaran untuk dashboard dan
report.

------------------------------------------------------------------------

## 41. Dashboard Wireframe

``` text
┌─────────────────────────────────────────────────────────────┐
│ PLATFORM INTELLIGENCE                      Aug 2026 ▼       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ TENANTS     DELIVERY       REVENUE       SLA      HEALTH    │
│ 128         2.4M          Rp1.8B        94.8%     98.7%     │
│ +12.4%      +18.2%        +9.7%         +2.1%     +0.5%    │
│                                                             │
├──────────────────────────┬──────────────────────────────────┤
│ Tenant Growth            │ Revenue Trend                    │
│        GRAPH             │        GRAPH                     │
├──────────────────────────┼──────────────────────────────────┤
│ Delivery Performance     │ SLA Performance                  │
│        GRAPH             │        GRAPH                     │
├──────────────────────────┴──────────────────────────────────┤
│ ALERT CENTER                                                │
│ 🔴 3 Tenant SLA Critical                                   │
│ 🟠 7 Tenant Usage >80%                                     │
│ 🟡 12 Tenant Delivery turun >20%                           │
│ 💰 3 Tenant Invoice Overdue                                │
├─────────────────────────────────────────────────────────────┤
│ EXECUTIVE INSIGHT                                           │
│ Tenant aktif meningkat 12.9%...                            │
│ Revenue meningkat 9.7%...                                  │
│ 12 tenant berpotensi upgrade...                            │
└─────────────────────────────────────────────────────────────┘
```

------------------------------------------------------------------------

## 42. Prioritas Implementasi

### P0 --- Wajib

``` text
[ ] Executive Summary
[ ] Tenant Analytics
[ ] Delivery Analytics
[ ] SLA Analytics
[ ] Billing Summary
[ ] Usage Analytics
[ ] Tenant Health Score
[ ] Alert Center
[ ] KPI Dictionary
```

### P1 --- Enterprise

``` text
[ ] Exception Analytics
[ ] Fleet Analytics
[ ] Customer Analytics
[ ] Integration Analytics
[ ] Security Analytics
[ ] System Health
[ ] Drill Down
[ ] Report Builder
[ ] Export
```

### P2 --- Advanced

``` text
[ ] Scheduled Reports
[ ] Recommendation Engine
[ ] Risk Detection
[ ] Forecast
[ ] Anomaly Detection
[ ] Advanced BI
```

------------------------------------------------------------------------

## 43. Development Order

``` text
01. Analytics data model
02. KPI dictionary
03. Tenant summary
04. Delivery summary
05. Billing summary
06. Usage summary
07. SLA summary
08. Tenant Health Score
09. Executive Dashboard
10. Alert Center
11. Drill Down
12. Report Builder
13. Export Worker
14. Scheduled Report
15. Insight Engine
16. Recommendation Engine
```

------------------------------------------------------------------------

## 44. Definition of Done

``` text
[ ] Semua KPI memiliki definisi.
[ ] Data tenant terisolasi.
[ ] Executive Summary tersedia.
[ ] Tenant analytics tersedia.
[ ] Delivery analytics tersedia.
[ ] Billing analytics tersedia.
[ ] Usage analytics tersedia.
[ ] SLA analytics tersedia.
[ ] Tenant Health Score tersedia.
[ ] Alert Center tersedia.
[ ] Drill down tersedia.
[ ] Export tersedia.
[ ] Report Builder tersedia.
[ ] Scheduled Report tersedia.
[ ] Semua aktivitas report diaudit.
[ ] Laporan besar diproses asynchronous.
[ ] Dashboard menggunakan data agregasi.
[ ] Semua API menggunakan permission check.
```

------------------------------------------------------------------------

## 45. Target Akhir

``` text
                    PLATFORM INTELLIGENCE
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
       BUSINESS          OPERATIONS          FINANCE
          │                  │                  │
       Tenants            Delivery            Revenue
       Growth             SLA                 MRR
       Churn              Exception           ARR
       Health             Fleet               Invoice
       Usage              Tracking             Payment
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
               ┌─────────────┼─────────────┐
               ▼             ▼             ▼
            SECURITY      PLATFORM      INTEGRATION
               │             │             │
              Audit        Health          API
              Login        Usage           Webhook
              2FA          Storage         Error
               │             │             │
               └─────────────┼─────────────┘
                             ▼
                    EXECUTIVE INSIGHT
                             │
                   ┌─────────┼─────────┐
                   ▼         ▼         ▼
                 TREND      ALERT    ACTION
```

## Prinsip Akhir

Superadmin Report harus berkembang dari:

``` text
BERAPA?
```

menjadi:

``` text
BERAPA?
   ↓
APA YANG BERUBAH?
   ↓
MENGAPA BERUBAH?
   ↓
APA RISIKONYA?
   ↓
APA PELUANGNYA?
   ↓
APA YANG HARUS DILAKUKAN?
```

Dengan demikian **Platform Intelligence** menjadi pusat pengambilan
keputusan DTMS, sedangkan **Reports** menjadi salah satu komponen di
dalamnya.
