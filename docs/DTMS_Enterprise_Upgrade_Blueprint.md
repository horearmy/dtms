# DTMS Enterprise Upgrade Blueprint

## Delivery Tracking Management System --- Enterprise Implementation Specification

**Dokumen:** DTMS Enterprise Upgrade Blueprint\
**Basis:** `FLOW.md` / DTMS v2.0.0\
**Target:** Enterprise Multi-Tenant Delivery Management Platform\
**Status:** Implementation Ready\
**Tanggal:** Agustus 2026

------------------------------------------------------------------------

## 1. Tujuan

Dokumen ini adalah blueprint implementasi untuk mengembangkan DTMS dari
aplikasi delivery tracking menjadi platform enterprise B2B yang dapat
melayani banyak perusahaan dalam satu platform.

Prinsip utama:

1.  Multi-tenant dengan isolasi data yang kuat.
2.  Enterprise onboarding dari prospect sampai go-live.
3.  Order-to-delivery lifecycle yang terstruktur.
4.  Control Tower untuk monitoring operasional.
5.  SLA Engine dan Exception Management.
6.  Real-time tracking dan ETA.
7.  Integration Hub untuk ERP/WMS/CRM/API.
8.  Customer Portal.
9.  Billing dan subscription.
10. Security, audit, observability, compliance, dan governance.

------------------------------------------------------------------------

# 2. Kondisi Existing

DTMS saat ini sudah memiliki fondasi berikut:

-   Multi-tenancy.
-   Tenant context dan tenant-scoped data.
-   JWT authentication.
-   TOTP 2FA.
-   Google OAuth.
-   RBAC dasar.
-   Shipment management.
-   Driver mobile flow.
-   GPS tracking.
-   Geofence.
-   Warehouse scanning.
-   Proof of Delivery.
-   Notification.
-   WhatsApp integration.
-   Reporting dan analytics.
-   Audit log.
-   PostgreSQL.
-   Redis untuk rate limiting.
-   Sentry.
-   REST API.
-   Public tracking.
-   Demo request.
-   Vehicle maintenance.

Jangan melakukan rewrite total. Upgrade dilakukan bertahap di atas
fondasi yang sudah ada.

------------------------------------------------------------------------

# 3. Target Arsitektur Bisnis

Target utama:

``` text
DTMS PLATFORM
│
├── Platform Administration
│   ├── Tenants
│   ├── Plans
│   ├── Subscriptions
│   ├── Billing
│   ├── Platform Users
│   ├── Audit
│   └── System Monitoring
│
├── Tenant Workspace
│   ├── Organization
│   ├── Branch
│   ├── Warehouse
│   ├── Users
│   ├── Customers
│   ├── Drivers
│   ├── Vehicles
│   ├── Orders
│   ├── Shipments
│   ├── Routes
│   ├── Dispatch
│   ├── Tracking
│   ├── POD
│   ├── SLA
│   ├── Exceptions
│   ├── Reports
│   └── Integrations
│
├── Driver Application
│
├── Customer Portal
│
└── Integration Hub
```

------------------------------------------------------------------------

# 4. Enterprise Business Lifecycle

``` text
PROSPECT
  ↓
DEMO REQUEST
  ↓
QUALIFICATION
  ↓
BUSINESS ASSESSMENT
  ↓
PROPOSAL
  ↓
CONTRACT
  ↓
SUBSCRIPTION
  ↓
TENANT CREATED
  ↓
ONBOARDING
  ↓
UAT
  ↓
GO LIVE
  ↓
ACTIVE
  ↓
OPERATIONS
  ↓
ANALYTICS / BILLING / SLA
  ↓
RENEWAL / UPGRADE / OFFBOARDING
```

------------------------------------------------------------------------

# 5. Tenant Lifecycle

Tambahkan lifecycle tenant:

``` text
PROSPECT
PENDING_APPROVAL
ONBOARDING
UAT
ACTIVE
SUSPENDED
GRACE_PERIOD
OFFBOARDING
ARCHIVED
```

### Aturan

-   `PROSPECT`: belum menjadi tenant operasional.
-   `PENDING_APPROVAL`: menunggu persetujuan.
-   `ONBOARDING`: konfigurasi perusahaan.
-   `UAT`: pengujian sebelum produksi.
-   `ACTIVE`: operasional.
-   `SUSPENDED`: akses operasional dibatasi.
-   `GRACE_PERIOD`: masa toleransi pembayaran/kontrak.
-   `OFFBOARDING`: proses penutupan tenant.
-   `ARCHIVED`: data dipertahankan sesuai retention policy.

------------------------------------------------------------------------

# 6. Tenant Onboarding

## 6.1 Flow

``` text
TENANT CREATED
  ↓
COMPANY PROFILE
  ↓
ORGANIZATION STRUCTURE
  ↓
BRANCH
  ↓
WAREHOUSE / HUB
  ↓
USER & ROLE
  ↓
CUSTOMER
  ↓
DRIVER
  ↓
VEHICLE
  ↓
SERVICE TYPE
  ↓
SLA CONFIGURATION
  ↓
NOTIFICATION
  ↓
INTEGRATION
  ↓
DATA IMPORT
  ↓
UAT
  ↓
GO LIVE
```

## 6.2 Data Tenant

Tambahkan/pertahankan:

``` text
Tenant
- id
- name
- slug
- code
- status
- planId
- maxUsers
- maxDrivers
- maxShipments
- logoUrl
- faviconUrl
- primaryColor
- secondaryColor
- accentColor
- domain
- timezone
- locale
- currency
- createdAt
- updatedAt
```

------------------------------------------------------------------------

# 7. Organization Model

Tenant harus dapat memiliki struktur organisasi.

``` text
Tenant
  └── Company
      ├── Branch
      │   ├── Warehouse
      │   └── Hub
      └── Department
```

Minimal entity:

``` text
Company
Branch
Department
Warehouse
Hub
```

Tambahkan `tenantId` pada seluruh entity tenant-scoped.

Untuk data yang hanya dapat dilihat oleh cabang tertentu, gunakan:

``` text
tenantId
organizationId
branchId
```

------------------------------------------------------------------------

# 8. Role dan Permission

## 8.1 Platform Roles

``` text
SUPER_ADMIN
PLATFORM_ADMIN
SUPPORT
BILLING_ADMIN
```

## 8.2 Tenant Roles

``` text
TENANT_ADMIN
OPERATIONS_MANAGER
DISPATCHER
FLEET_MANAGER
WAREHOUSE_MANAGER
WAREHOUSE_OPERATOR
CUSTOMER_SERVICE
FINANCE
MANAGEMENT
AUDITOR
DRIVER
CUSTOMER
```

## 8.3 Permission Model

Jangan hard-code permission hanya berdasarkan role.

Gunakan:

``` text
Role
  ↓
Permission
  ↓
Resource
  ↓
Action
```

Contoh:

``` text
SHIPMENT
- shipment.read
- shipment.create
- shipment.update
- shipment.assign
- shipment.cancel
- shipment.export
```

``` text
DELIVERY
- delivery.dispatch
- delivery.start
- delivery.complete
- delivery.fail
- delivery.reschedule
```

``` text
REPORT
- report.view
- report.export
```

------------------------------------------------------------------------

# 9. ABAC / Data Scope

Untuk enterprise, RBAC harus dilengkapi data scope.

Contoh:

``` text
User
  ↓
Role
  ↓
Tenant
  ↓
Organization
  ↓
Branch
  ↓
Resource
```

Contoh rule:

> Dispatcher Branch Jakarta hanya dapat mengakses shipment Branch
> Jakarta.

Buat helper:

``` text
resolveAccessScope(user)
```

Output minimal:

``` json
{
  "tenantId": "...",
  "organizationIds": [],
  "branchIds": [],
  "permissions": []
}
```

Semua query penting harus menggunakan access scope.

------------------------------------------------------------------------

# 10. Order Management

Jangan langsung membuat shipment dari input order.

Gunakan:

``` text
ORDER
  ↓
VALIDATION
  ↓
ADDRESS VALIDATION
  ↓
SERVICE VALIDATION
  ↓
SLA CALCULATION
  ↓
CAPACITY CHECK
  ↓
ORDER CONFIRMED
  ↓
SHIPMENT CREATED
```

## 10.1 Order Sources

``` text
MANUAL
API
ERP
WMS
CRM
CSV
EDI
MARKETPLACE
```

## 10.2 Order Status

``` text
DRAFT
RECEIVED
VALIDATING
VALIDATED
REJECTED
CONFIRMED
CANCELLED
FULFILLED
```

------------------------------------------------------------------------

# 11. Shipment Lifecycle

Gunakan lifecycle berikut:

``` text
ORDER_CREATED
  ↓
WAREHOUSE_RECEIVED
  ↓
SORTING
  ↓
READY_TO_DISPATCH
  ↓
PLANNING
  ↓
ASSIGNED
  ↓
DISPATCHED
  ↓
IN_TRANSIT
  ↓
ARRIVED_AT_HUB
  ↓
OUT_FOR_DELIVERY
  ↓
DELIVERED
  ↓
POD_VERIFIED
  ↓
COMPLETED
```

Status exception:

``` text
DELIVERY_FAILED
RESCHEDULED
RETURN_TO_SENDER
RETURNED
CANCELLED
LOST
DAMAGED
```

Jangan mengandalkan field `status` saja. Simpan seluruh perubahan
sebagai immutable event.

------------------------------------------------------------------------

# 12. Event-Driven Shipment History

Tambahkan:

``` text
ShipmentEvent
```

Field:

``` text
id
tenantId
shipmentId
eventType
previousStatus
newStatus
actorType
actorId
metadata
latitude
longitude
occurredAt
createdAt
```

Contoh:

``` text
SHIPMENT_CREATED
WAREHOUSE_RECEIVED
SORTED
ASSIGNED
DISPATCHED
GPS_STARTED
ARRIVED_HUB
OUT_FOR_DELIVERY
DELIVERED
POD_SUBMITTED
POD_VERIFIED
COMPLETED
DELIVERY_FAILED
RESCHEDULED
RETURNED
```

Event history tidak boleh dihapus dari UI biasa.

------------------------------------------------------------------------

# 13. Dispatch Management

Buat modul:

``` text
Dispatch Board
```

Flow:

``` text
READY TO DISPATCH
  ↓
ROUTE PLANNING
  ↓
CAPACITY CHECK
  ↓
DRIVER SELECTION
  ↓
VEHICLE SELECTION
  ↓
ASSIGNMENT
  ↓
DISPATCH
```

Dispatcher harus dapat melihat:

-   shipment belum assigned
-   driver available
-   driver busy
-   vehicle available
-   vehicle capacity
-   route
-   SLA deadline
-   priority
-   current GPS
-   estimated workload

------------------------------------------------------------------------

# 14. Control Tower

Ini adalah modul inti enterprise.

## 14.1 Control Tower

``` text
LIVE OPERATIONS
│
├── On Track
├── SLA At Risk
├── SLA Breach
├── Driver Offline
├── Vehicle Breakdown
├── Failed Delivery
├── Route Deviation
├── Geofence Violation
├── Exception
└── Critical Incident
```

## 14.2 KPI

``` text
Active Deliveries
On-Time Delivery
SLA At Risk
SLA Breach
Failed Delivery
Driver Online
Vehicle Online
POD Pending
Open Exceptions
```

## 14.3 Prioritas

``` text
CRITICAL
HIGH
MEDIUM
LOW
```

------------------------------------------------------------------------

# 15. Exception Management

Entity:

``` text
Exception
```

Field minimal:

``` text
id
tenantId
shipmentId
type
severity
status
description
ownerId
dueAt
resolvedAt
resolution
createdBy
createdAt
updatedAt
```

Status:

``` text
OPEN
ASSIGNED
INVESTIGATING
ACTION_REQUIRED
RESOLVED
VERIFIED
CLOSED
CANCELLED
```

Flow:

``` text
EXCEPTION DETECTED
  ↓
CLASSIFICATION
  ↓
SEVERITY
  ↓
ASSIGN PIC
  ↓
INVESTIGATION
  ↓
ACTION
  ↓
RESOLUTION
  ↓
VERIFICATION
  ↓
CLOSED
```

------------------------------------------------------------------------

# 16. SLA Engine

Jangan hard-code SLA hanya berdasarkan service type.

Buat entity:

``` text
SlaPolicy
```

Parameter:

``` text
tenantId
customerId
serviceTypeId
originZoneId
destinationZoneId
priority
startCondition
targetDuration
cutoffTime
calendarId
active
```

SLA harus dapat mempertimbangkan:

``` text
Tenant
Customer
Service Type
Origin
Destination
Zone
Priority
Working Hours
Holiday
Cutoff
```

Status SLA:

``` text
ON_TRACK
AT_RISK
BREACHED
COMPLETED_ON_TIME
COMPLETED_LATE
```

------------------------------------------------------------------------

# 17. ETA Engine

Tambahkan:

``` text
ETA Engine
```

Input:

``` text
Current GPS
Route
Remaining Stops
Traffic / Travel Time
Historical Travel Time
SLA Deadline
```

Output:

``` text
estimatedArrival
estimatedDuration
distanceRemaining
slaStatus
```

Contoh:

``` json
{
  "shipmentId": "...",
  "eta": "2026-08-18T11:18:00+07:00",
  "slaDeadline": "2026-08-18T12:00:00+07:00",
  "slaStatus": "ON_TRACK"
}
```

------------------------------------------------------------------------

# 18. Driver Application

Flow:

``` text
LOGIN
  ↓
TODAY'S PLAN
  ↓
VEHICLE CHECK
  ↓
PRE-TRIP CHECKLIST
  ↓
TASK LIST
  ↓
START ROUTE
  ↓
GPS TRACKING
  ↓
NAVIGATION
  ↓
ARRIVE
  ↓
DELIVERY
  ↓
POD
  ↓
NEXT STOP
  ↓
END TRIP
  ↓
RETURN TO BASE
```

Tambahkan:

``` text
Incident Report
Vehicle Damage
Fuel
Offline Mode
Sync Queue
Push Notification
```

------------------------------------------------------------------------

# 19. Offline Driver Mode

Wajib untuk operasi lapangan.

``` text
ONLINE
  ↓
DOWNLOAD ASSIGNED TASKS
  ↓
OFFLINE
  ↓
STORE ACTIONS LOCALLY
  ↓
GPS BUFFER
  ↓
POD LOCAL STORAGE
  ↓
ONLINE
  ↓
SYNC QUEUE
  ↓
SERVER VALIDATION
  ↓
COMMIT
```

Setiap offline action memiliki:

``` text
localEventId
deviceId
occurredAt
syncStatus
retryCount
```

------------------------------------------------------------------------

# 20. Real-Time Tracking Architecture

Existing GPS polling harus dapat ditingkatkan menjadi event-driven.

Target:

``` text
DRIVER APP
   ↓
TRACKING GATEWAY
   ↓
MESSAGE QUEUE
   ↓
TRACKING PROCESSOR
   ├── GPS Storage
   ├── Geofence
   ├── ETA
   ├── Route Deviation
   └── Alert
         ↓
REAL-TIME CHANNEL
         ↓
CONTROL TOWER
```

Gunakan WebSocket atau SSE untuk dashboard.

Polling boleh dipertahankan sebagai fallback.

------------------------------------------------------------------------

# 21. GPS Data

Pertahankan field existing:

``` text
latitude
longitude
speed
heading
accuracy
battery
timestamp
```

Tambahkan:

``` text
tenantId
driverId
vehicleId
shipmentId
deviceId
source
sequence
receivedAt
```

Pisahkan:

``` text
raw GPS
processed GPS
current location
```

Agar data historis tidak membebani query operasional.

------------------------------------------------------------------------

# 22. Geofence Engine

Geofence:

``` text
WAREHOUSE
HUB
OPERATIONAL_AREA
DESTINATION
CUSTOM
```

Event:

``` text
ENTER
EXIT
DWELL
```

Contoh:

``` text
GPS
 ↓
Geofence Engine
 ↓
ENTER WAREHOUSE
 ↓
Warehouse Event
 ↓
Shipment Event
 ↓
Notification
```

------------------------------------------------------------------------

# 23. Warehouse Management

Flow:

``` text
RECEIVE
  ↓
SCAN
  ↓
SORT
  ↓
STAGE
  ↓
READY TO DISPATCH
  ↓
DISPATCH
```

Setiap scan menghasilkan event immutable.

Tambahkan:

``` text
scanType
operatorId
warehouseId
location
deviceId
timestamp
condition
photo
```

------------------------------------------------------------------------

# 24. Proof of Delivery

POD:

``` text
Shipment
  ↓
Arrival
  ↓
Recipient Verification
  ↓
Signature
  ↓
Photo
  ↓
GPS
  ↓
Timestamp
  ↓
POD Submitted
  ↓
POD Verification
  ↓
Completed
```

POD entity:

``` text
id
tenantId
shipmentId
recipientName
recipientPhone
signatureUrl
photoUrl
latitude
longitude
deliveredAt
notes
verificationStatus
verifiedBy
verifiedAt
```

------------------------------------------------------------------------

# 25. Customer Portal

Customer dapat:

``` text
LOGIN
  ↓
DASHBOARD
  ├── Orders
  ├── Shipments
  ├── Live Tracking
  ├── ETA
  ├── POD
  ├── Exceptions
  └── Reports
```

Public tracking:

``` text
Tracking Number
  ↓
Tracking Page
  ↓
Status Timeline
  ↓
ETA
  ↓
Optional Live Map
  ↓
POD
```

Data publik harus menggunakan projection/DTO khusus. Jangan expose
object database secara langsung.

------------------------------------------------------------------------

# 26. Integration Hub

Buat modul:

``` text
Integration Hub
```

Jenis:

``` text
REST API
Webhook
OAuth2
API Key
SFTP
CSV
EDI
```

Struktur:

``` text
External System
   ↓
API Gateway
   ↓
Authentication
   ↓
Rate Limit
   ↓
Validation
   ↓
Mapping
   ↓
DTMS Core
```

Tambahkan:

``` text
IntegrationConfig
IntegrationCredential
IntegrationLog
WebhookSubscription
WebhookDelivery
ApiKey
```

------------------------------------------------------------------------

# 27. API Versioning

Jangan terus memakai endpoint tanpa versi.

Gunakan:

``` text
/api/v1/shipments
/api/v1/drivers
/api/v1/tracking
/api/v1/webhooks
```

Untuk perubahan breaking:

``` text
/api/v2/...
```

Setiap API memiliki:

``` text
Authentication
Authorization
Tenant Scope
Rate Limit
Request ID
Validation
Audit
Error Standard
```

------------------------------------------------------------------------

# 28. Standard API Response

Success:

``` json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Error:

``` json
{
  "success": false,
  "error": {
    "code": "SHIPMENT_NOT_FOUND",
    "message": "Shipment tidak ditemukan"
  },
  "meta": {
    "requestId": "..."
  }
}
```

Gunakan error code yang konsisten.

------------------------------------------------------------------------

# 29. Notification Engine

Event:

``` text
SHIPMENT_CREATED
DISPATCHED
IN_TRANSIT
ETA_CHANGED
SLA_AT_RISK
SLA_BREACHED
DELIVERY_FAILED
POD_CREATED
POD_VERIFIED
DRIVER_OFFLINE
VEHICLE_BREAKDOWN
EXCEPTION_CREATED
```

Channel:

``` text
IN_APP
PUSH
EMAIL
WHATSAPP
SMS
WEBHOOK
```

Gunakan template per tenant.

------------------------------------------------------------------------

# 30. Billing & Subscription

Tambahkan:

``` text
Plan
Subscription
Usage
Invoice
Payment
BillingEvent
```

Contoh usage:

``` text
Active Users
Drivers
Shipments
API Calls
Storage
GPS Events
```

Lifecycle:

``` text
PLAN
 ↓
SUBSCRIPTION
 ↓
USAGE
 ↓
INVOICE
 ↓
PAYMENT
 ↓
ACTIVE / GRACE / SUSPENDED
```

------------------------------------------------------------------------

# 31. Audit & Governance

Audit log wajib mencatat:

``` text
userId
tenantId
action
module
resourceType
resourceId
oldData
newData
ip
userAgent
requestId
timestamp
```

Contoh:

``` text
USER_UPDATED
SHIPMENT_CREATED
SHIPMENT_ASSIGNED
SHIPMENT_CANCELLED
POD_VERIFIED
ROLE_CHANGED
API_KEY_CREATED
TENANT_SUSPENDED
```

Audit tidak boleh dihapus oleh tenant admin.

------------------------------------------------------------------------

# 32. Security Target

Pertahankan:

-   JWT/session security.
-   TOTP.
-   Password policy.
-   Rate limiting.
-   Login attempt tracking.
-   Audit log.

Tambahkan bertahap:

``` text
OIDC
SAML SSO
SCIM Provisioning
Session Management
Device Management
API Key Rotation
Secret Management
IP Allowlist
Data Encryption
PII Masking
Security Headers
CSRF Protection
CSP
```

Untuk enterprise, tenant harus dapat mengatur security policy sendiri.

------------------------------------------------------------------------

# 33. File & Document Storage

Jangan menyimpan file besar di database.

Gunakan:

``` text
Object Storage
  ├── POD Photos
  ├── Signatures
  ├── Vehicle Photos
  ├── Documents
  └── Reports
```

Gunakan S3-compatible storage.

Setiap file:

``` text
tenantId
objectKey
fileName
mimeType
size
checksum
uploadedBy
createdAt
```

Object key:

``` text
tenant/{tenantId}/shipment/{shipmentId}/pod/{fileId}
```

------------------------------------------------------------------------

# 34. Search

Naikkan dari PostgreSQL LIKE menjadi:

``` text
Full Text Search
```

Searchable:

``` text
Tracking Number
Order Number
Customer
Receiver
Driver
Vehicle
Address
Exception
POD
```

Gunakan PostgreSQL FTS terlebih dahulu. Search engine terpisah dapat
ditambahkan jika volume sudah membutuhkan.

------------------------------------------------------------------------

# 35. Background Job Architecture

Pindahkan pekerjaan berat dari request HTTP.

Gunakan queue untuk:

``` text
Notification
WhatsApp
Email
GPS Processing
ETA Calculation
SLA Monitoring
Report Generation
File Processing
Webhook Delivery
Data Import
Data Export
```

Flow:

``` text
API
 ↓
QUEUE
 ↓
WORKER
 ↓
PROCESS
 ↓
RETRY
 ↓
DEAD LETTER
```

Setiap job memiliki:

``` text
jobId
attempt
status
createdAt
startedAt
completedAt
error
```

------------------------------------------------------------------------

# 36. Observability

Minimal:

``` text
Application Logs
Error Monitoring
Metrics
Tracing
Health Check
```

Gunakan:

``` text
Structured Logging
Prometheus-compatible Metrics
OpenTelemetry
Sentry
```

Health endpoints:

``` text
/health
/health/live
/health/ready
```

Pantau:

``` text
API latency
Error rate
Queue depth
DB latency
GPS ingestion rate
WebSocket connections
Storage usage
```

------------------------------------------------------------------------

# 37. Reporting & BI

Pisahkan:

``` text
Operational Reports
Management Reports
Executive Analytics
```

## KPI

``` text
Total Shipments
Delivered
Failed
On-Time %
SLA %
Average Delivery Time
Average Transit Time
POD Completion
Driver Utilization
Vehicle Utilization
Exception Rate
Cost / Delivery
```

## Dimension

``` text
Tenant
Branch
Customer
Driver
Vehicle
Route
Service Type
Date
Zone
```

------------------------------------------------------------------------

# 38. Executive Dashboard

``` text
EXECUTIVE CONTROL CENTER

Total Delivery
On-Time Delivery
SLA Achievement
Failed Delivery
Exception Rate
Cost / Delivery

-------------------------------

Delivery Trend
SLA Trend
Branch Performance
Customer Performance
Driver Performance
Fleet Utilization

-------------------------------

Critical Exceptions
```

------------------------------------------------------------------------

# 39. Platform Dashboard

Super Admin melihat:

``` text
Active Tenants
Trial Tenants
Suspended Tenants
Total Shipments
GPS Events
API Requests
Storage Usage
System Health
Subscription Revenue
```

Super Admin tidak boleh secara default membaca detail operasional tenant
kecuali melalui support/break-glass authorization.

------------------------------------------------------------------------

# 40. Database Upgrade

Pertahankan entity existing:

``` text
Tenant
User
Customer
Shipment
ShipmentItem
ShipmentStop
Driver
Vehicle
VehicleMaintenance
DailyReport
TrackingEvent
ProofOfDelivery
DeliveryAssignment
GpsLog
Geofence
GeofenceEvent
Notification
AuditLog
WarehouseScan
```

Tambahkan:

``` text
Company
Organization
Branch
Department
Warehouse
Hub

Role
Permission
RolePermission

Order
OrderItem

Route
RouteStop

ShipmentEvent

SlaPolicy
SlaEvent

Exception
ExceptionComment
ExceptionAttachment

EtaSnapshot

IntegrationConfig
IntegrationCredential
IntegrationLog
WebhookSubscription
WebhookDelivery
ApiKey

Plan
Subscription
UsageRecord
Invoice
Payment

Document
FileObject

ImportJob
ExportJob

Device
SyncQueue
```

------------------------------------------------------------------------

# 41. Data Isolation

Minimal semua entity tenant-scoped memiliki:

``` text
tenantId
```

Untuk organization-aware data:

``` text
tenantId
organizationId
branchId
```

Jangan mengandalkan UI untuk isolasi data.

Isolasi harus diterapkan pada:

``` text
API
Service Layer
Repository
Database Policy
Background Jobs
Reports
Exports
Search
Webhooks
```

------------------------------------------------------------------------

# 42. Transaction Boundary

Operasi penting harus atomic.

Contoh assign shipment:

``` text
BEGIN TRANSACTION

Validate shipment
Validate driver
Validate vehicle
Validate capacity
Validate access scope
Create assignment
Update shipment status
Create shipment event
Create audit log
Create notification event

COMMIT
```

Jika salah satu gagal:

``` text
ROLLBACK
```

------------------------------------------------------------------------

# 43. Idempotency

Semua endpoint yang dapat menerima retry harus mendukung idempotency.

Contoh:

``` text
POST /api/v1/shipments
POST /api/v1/shipments/{id}/pod
POST /api/v1/webhooks
POST /api/v1/gps
```

Header:

``` text
Idempotency-Key: <unique-key>
```

Simpan:

``` text
idempotencyKey
tenantId
endpoint
requestHash
response
createdAt
```

------------------------------------------------------------------------

# 44. Deployment Architecture

Target awal:

``` text
                    CDN / WAF
                       │
                       ▼
                 Load Balancer
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
      App Instance 1           App Instance 2
          │                         │
          └────────────┬────────────┘
                       ▼
                  PostgreSQL
                       │
                  Redis / Queue
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Workers      Tracking      Scheduler
                       │
                       ▼
                 Object Storage
```

------------------------------------------------------------------------

# 45. CI/CD

Target:

``` text
Developer
  ↓
GitHub
  ↓
Pull Request
  ↓
Lint
  ↓
Type Check
  ↓
Unit Test
  ↓
Integration Test
  ↓
E2E
  ↓
Security Scan
  ↓
Build
  ↓
Deploy Staging
  ↓
UAT
  ↓
Production
```

Production deployment harus mendukung:

``` text
Rollback
Blue-Green
Canary
Database Migration Safety
```

------------------------------------------------------------------------

# 46. Testing Strategy

## Unit

``` text
Business rules
SLA
ETA
Permission
Validation
Pricing
```

## Integration

``` text
API
Database
Queue
Webhook
Storage
Authentication
```

## E2E

Minimal:

``` text
Login
Create Order
Create Shipment
Assign Driver
Dispatch
Driver Start
GPS
Delivery
POD
Exception
Report
```

## Load Testing

Uji:

``` text
Concurrent Users
GPS Events / second
Shipment Creation / second
Dashboard Requests
Webhook Delivery
Queue Processing
```

------------------------------------------------------------------------

# 47. Migration Strategy

Jangan langsung mengubah semua modul.

## Step 1 --- Safety

``` text
Backup Database
Enable Audit
Add Request ID
Add Tenant Validation
Add Data Integrity Checks
```

## Step 2 --- Organization

``` text
Company
Branch
Warehouse
Hub
Department
```

## Step 3 --- Security

``` text
Permission
Data Scope
Session Management
API Keys
```

## Step 4 --- Workflow

``` text
Order
Shipment Event
Dispatch
Exception
SLA
```

## Step 5 --- Real-time

``` text
Tracking Gateway
Queue
WebSocket/SSE
ETA
```

## Step 6 --- Platform

``` text
Subscription
Billing
Integration Hub
Customer Portal
```

------------------------------------------------------------------------

# 48. Backward Compatibility

Endpoint existing jangan langsung dihapus.

Contoh:

``` text
/api/shipments
```

tetap berjalan sementara.

Tambahkan:

``` text
/api/v1/shipments
```

Buat compatibility layer:

``` text
Legacy API
   ↓
Adapter
   ↓
Enterprise Service
```

Setelah semua client pindah:

``` text
Legacy API → Deprecated
```

------------------------------------------------------------------------

# 49. Menu Structure

## Platform

``` text
Dashboard
Tenants
Onboarding
Subscriptions
Billing
Platform Users
Audit
System Health
```

## Tenant

``` text
Dashboard
Control Tower

Orders
Shipments
Dispatch
Routes
Exceptions
SLA

Live Tracking

Drivers
Vehicles
Maintenance

Customers
Warehouse
Hub

Reports
Analytics

Integrations
Notifications

Organization
Users
Roles
Permissions

Settings
```

## Driver

``` text
Today
Tasks
Route
Vehicle Check
Delivery
POD
Incident
Daily Report
Profile
```

## Customer

``` text
Dashboard
Orders
Shipments
Tracking
POD
Reports
Support
```

------------------------------------------------------------------------

# 50. Enterprise Navigation

Sidebar utama:

``` text
🏠 Dashboard

🎯 Control Tower

📦 Orders
🚚 Shipments
🧭 Dispatch
🗺 Routes

📍 Live Tracking

⚠ Exceptions
⏱ SLA

👤 Drivers
🚛 Vehicles
🔧 Maintenance

🏢 Customers
🏭 Warehouses
🏬 Hubs

📊 Reports
📈 Analytics

🔌 Integrations
🔔 Notifications

👥 Organization
🔐 Users & Roles

💳 Billing

⚙ Settings
```

------------------------------------------------------------------------

# 51. Enterprise Definition of Done

Sebuah modul dianggap enterprise-ready jika memenuhi:

``` text
[ ] Tenant isolation
[ ] Permission check
[ ] Data scope check
[ ] Validation
[ ] Audit log
[ ] Error handling
[ ] Request ID
[ ] Idempotency jika diperlukan
[ ] Transaction jika multi-write
[ ] Pagination
[ ] Search
[ ] Filter
[ ] Export permission
[ ] Monitoring
[ ] Test coverage
[ ] Documentation
```

------------------------------------------------------------------------

# 52. Prioritas Implementasi

## P0 --- Wajib

``` text
[ ] Tenant lifecycle
[ ] Organization / Branch
[ ] Permission system
[ ] Data scope
[ ] Order management
[ ] Shipment event model
[ ] Dispatch board
[ ] Control Tower
[ ] Exception management
[ ] SLA Engine
[ ] Audit enhancement
```

## P1 --- Enterprise Operations

``` text
[ ] Real-time WebSocket/SSE
[ ] Tracking gateway
[ ] ETA engine
[ ] Offline driver mode
[ ] Integration Hub
[ ] API versioning
[ ] Customer Portal
[ ] Object storage
[ ] Background job queue
[ ] Observability
```

## P2 --- Platform Commercialization

``` text
[ ] Subscription
[ ] Usage metering
[ ] Billing
[ ] Invoice
[ ] Payment
[ ] Plan management
[ ] Tenant self-service
```

## P3 --- Advanced

``` text
[ ] SAML
[ ] OIDC
[ ] SCIM
[ ] Advanced BI
[ ] Route optimization
[ ] Predictive ETA
[ ] AI anomaly detection
[ ] Cost optimization
```

------------------------------------------------------------------------

# 53. Roadmap

## Phase A --- Enterprise Foundation

``` text
Tenant
Organization
Branch
Warehouse
Hub
RBAC
ABAC/Data Scope
Audit
```

## Phase B --- Operational Core

``` text
Order
Shipment Event
Dispatch
Route
Exception
SLA
```

## Phase C --- Real-Time

``` text
Tracking Gateway
Queue
WebSocket
ETA
Geofence
Control Tower
```

## Phase D --- Ecosystem

``` text
Customer Portal
API Gateway
Webhook
ERP/WMS Integration
Notification Hub
```

## Phase E --- Commercial

``` text
Plans
Subscription
Usage
Billing
Invoice
Payment
```

## Phase F --- Intelligence

``` text
BI
Forecast
ETA Prediction
Route Optimization
Anomaly Detection
```

------------------------------------------------------------------------

# 54. Recommended Development Order

Kerjakan dalam urutan berikut:

``` text
01. Database migration safety
02. Tenant lifecycle
03. Organization / Branch / Warehouse / Hub
04. Permission & data scope
05. Order entity
06. Shipment Event
07. Dispatch Board
08. Exception Management
09. SLA Engine
10. Control Tower
11. Tracking Gateway
12. Queue / Worker
13. WebSocket/SSE
14. ETA Engine
15. Offline Driver
16. Customer Portal
17. Integration Hub
18. Object Storage
19. Observability
20. Subscription & Billing
```

Jangan mengerjakan Billing sebelum core operational flow stabil.

------------------------------------------------------------------------

# 55. Acceptance Criteria Utama

## Multi-Tenant

``` text
[ ] Tenant A tidak dapat membaca Tenant B.
[ ] Tenant A tidak dapat mengubah data Tenant B.
[ ] Export hanya berisi data tenant yang diizinkan.
[ ] Background job membawa tenant context.
[ ] Webhook tidak dapat mengakses tenant lain.
```

## Shipment

``` text
[ ] Semua perubahan status menghasilkan event.
[ ] Status transition tervalidasi.
[ ] Shipment dapat diassign hanya ke driver yang eligible.
[ ] Shipment memiliki SLA.
[ ] Shipment memiliki audit trail.
```

## Tracking

``` text
[ ] GPS masuk melalui authenticated endpoint.
[ ] GPS memiliki tenant context.
[ ] GPS dapat diproses asynchronous.
[ ] Dashboard menerima update real-time.
[ ] GPS stale menghasilkan alert.
```

## POD

``` text
[ ] POD memiliki recipient.
[ ] POD memiliki timestamp.
[ ] POD memiliki GPS.
[ ] POD dapat memiliki foto.
[ ] POD dapat memiliki signature.
[ ] POD diverifikasi sebelum shipment completed.
```

## Exception

``` text
[ ] Exception memiliki severity.
[ ] Exception memiliki owner.
[ ] Exception memiliki SLA.
[ ] Exception memiliki resolution.
[ ] Exception dapat diaudit.
```

------------------------------------------------------------------------

# 56. Prinsip Implementasi

### Jangan

``` text
UI → Database
```

### Gunakan

``` text
UI
 ↓
API
 ↓
Authorization
 ↓
Service
 ↓
Business Rule
 ↓
Repository
 ↓
Database
```

Untuk proses asynchronous:

``` text
API
 ↓
Event
 ↓
Queue
 ↓
Worker
 ↓
Service
 ↓
Database
```

------------------------------------------------------------------------

# 57. Struktur Folder Target

Contoh struktur:

``` text
src/
├── app/
│   ├── api/
│   │   └── v1/
│   ├── dashboard/
│   ├── control-tower/
│   ├── orders/
│   ├── shipments/
│   ├── dispatch/
│   ├── tracking/
│   ├── exceptions/
│   ├── sla/
│   ├── drivers/
│   ├── vehicles/
│   ├── customers/
│   ├── warehouses/
│   ├── integrations/
│   ├── reports/
│   ├── analytics/
│   └── settings/
│
├── modules/
│   ├── tenant/
│   ├── organization/
│   ├── auth/
│   ├── order/
│   ├── shipment/
│   ├── dispatch/
│   ├── tracking/
│   ├── eta/
│   ├── sla/
│   ├── exception/
│   ├── notification/
│   ├── billing/
│   └── integration/
│
├── lib/
│   ├── auth/
│   ├── tenant/
│   ├── permissions/
│   ├── database/
│   ├── queue/
│   ├── storage/
│   ├── logging/
│   └── observability/
│
└── workers/
    ├── tracking/
    ├── notifications/
    ├── sla/
    ├── reports/
    ├── imports/
    └── webhooks/
```

------------------------------------------------------------------------

# 58. Final Target

DTMS versi enterprise harus menghasilkan ekosistem berikut:

``` text
                    ┌─────────────────────┐
                    │    DTMS PLATFORM    │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
   PLATFORM ADMIN        COMPANY TENANT        CUSTOMER PORTAL
        │                      │                      │
   Billing                 Operations              Tracking
   Security                Dispatch                POD
   Tenant                  Fleet                   Orders
   Audit                   Warehouse               Reports
        │                      │
        │                ┌─────┴─────┐
        │                ▼           ▼
        │             DRIVER      CONTROL TOWER
        │                │           │
        │                └─────┬─────┘
        │                      ▼
        │                LIVE TRACKING
        │                      │
        │                 ETA / SLA
        │                      │
        │                 EXCEPTION
        │                      │
        └──────────────► ANALYTICS
                               │
                               ▼
                         BUSINESS INSIGHT
```

------------------------------------------------------------------------

# 59. Kesimpulan Implementasi

DTMS tidak perlu dibangun ulang dari nol.

Fondasi existing dipertahankan, lalu dinaikkan menjadi enterprise
melalui:

``` text
CURRENT DTMS
    ↓
Enterprise Tenant
    ↓
Organization
    ↓
RBAC + ABAC
    ↓
Order Management
    ↓
Event-driven Shipment
    ↓
Dispatch
    ↓
Control Tower
    ↓
SLA
    ↓
Exception
    ↓
Real-time Tracking
    ↓
ETA
    ↓
POD
    ↓
Customer Portal
    ↓
Integration Hub
    ↓
Billing
    ↓
Analytics
    ↓
Enterprise Governance
```

**Prioritas pertama adalah P0. Jangan langsung mengerjakan semua modul
sekaligus.**

Target implementasi awal:

> **Tenant + Organization + Permission + Order + Shipment Event +
> Dispatch + Control Tower + Exception + SLA**

Setelah fondasi tersebut stabil, lanjutkan ke real-time tracking, ETA,
integration, customer portal, dan billing.
