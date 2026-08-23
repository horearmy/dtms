const fs = require('fs');
const path = require('path');

// Revert PascalCase relation names back to camelCase in client-side files.
// The prisma.ts normalizer now handles PascalCase->camelCase conversion,
// so all client code and API response property accesses should use camelCase.
// ONLY Prisma include/select/where clauses should stay PascalCase.

const RELATIONS = {
  Shipment: 'shipment',
  Driver: 'driver',
  Vehicle: 'vehicle',
  Tenant: 'tenant',
  User: 'user',
  Geofence: 'geofence',
  Branch: 'branch',
  Organization: 'organization',
  Region: 'region',
  Notification: 'notification',
  Exception: 'exception',
  AuditLog: 'auditLog',
  PasswordResetToken: 'passwordResetToken',
  DemoRequest: 'demoRequest',
  ApiKey: 'apiKey',
  RolePermission: 'rolePermission',
  Message: 'message',
  Customer: 'customer',
  Company: 'company',
  Department: 'department',
  Warehouse: 'warehouse',
  Hub: 'hub',
  ProofOfDelivery: 'pods',
  'Customer_Shipment_senderIdToCustomer': 'sender',
  'Customer_Shipment_receiverIdToCustomer': 'receiver',
};

// Special compound property access patterns
const PROP_ACCESS = {
  '.Shipment.': '.shipment.',
  '.Driver.': '.driver.',
  '.Vehicle.': '.vehicle.',
  '.User.': '.user.',
  '.Tenant.': '.tenant.',
  '.Geofence.': '.geofence.',
  '.Customer_Shipment_senderIdToCustomer.': '.sender.',
  '.Customer_Shipment_receiverIdToCustomer.': '.receiver.',
};

// Files that need revert (client-side + API response property accesses)
const FILES_TO_REVERT = [
  // Client components
  'src/app/(driver)/driver/laporan/page.tsx',
  'src/app/(driver)/driver/page.tsx',
  'src/app/(driver)/driver/tasks/[assignmentId]/page.tsx',
  'src/app/(ops)/audit/page.tsx',
  'src/app/(ops)/dispatch/DispatchBoard.tsx',
  'src/app/(ops)/drivers/page.tsx',
  'src/app/(ops)/exceptions/ExceptionsList.tsx',
  'src/app/(ops)/geofences/page.tsx',
  'src/app/(ops)/komunikasi/page.tsx',
  'src/app/(ops)/shipments/page.tsx',
  'src/app/(ops)/tenant-health/TenantHealthDashboard.tsx',
  'src/app/(ops)/users/page.tsx',
  'src/app/(ops)/users/[id]/page.tsx',
  'src/app/(ops)/vehicles/[id]/page.tsx',
  'src/components/DriverDetailModal.tsx',
  'src/components/DriverStatusCard.tsx',
  'src/components/ReturnTimeline.tsx',
  'src/lib/superadmin-auth.ts',
  'src/lib/tenant.ts',
];

let totalFixed = 0;
for (const rel of FILES_TO_REVERT) {
  const fullPath = path.join(__dirname, '..', rel);
  if (!fs.existsSync(fullPath)) { console.log(`SKIP: ${rel}`); continue; }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const orig = content;
  
  // Revert property accesses: .Shipment. -> .shipment. etc.
  for (const [from, to] of Object.entries(PROP_ACCESS)) {
    const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    content = content.replace(new RegExp(escapedFrom.replace(/\\\./g, '\\.'), 'g'), to);
  }
  
  // Revert type definitions: Shipment: -> shipment: etc.
  // But NOT inside Prisma include/select/where (which these client files don't have)
  for (const [pascal, camel] of Object.entries(RELATIONS)) {
    // Match "Pascal: {" or "Pascal: true" but not "prisma.pascal."
    content = content.replace(new RegExp(`(?<!\\.)${pascal}\\s*:`, 'g'), `${camel}:`);
  }
  
  if (content !== orig) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`REVERTED: ${rel}`);
    totalFixed++;
  } else {
    console.log(`NO CHANGE: ${rel}`);
  }
}

console.log(`\nTotal files reverted: ${totalFixed}`);
