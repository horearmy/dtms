const fs = require('fs');
const path = require('path');

const fixes = [
  // gps/global/route.ts - log.driver → log.Driver
  {
    file: 'src/app/api/gps/global/route.ts',
    replacements: [
      [/\blog\.driver\.tenantId/g, 'log.Driver.tenantId'],
      [/\blog\.driver\.id/g, 'log.Driver.id'],
      [/\blog\.driver\.tenant\?\.name/g, 'log.Driver.Tenant?.name'],
      [/\b(l|prevGpsLogs\.map\(\(l\) =>)\ l\.driver\.id/g, '$1 l.Driver.id'],
    ]
  },

  // scoring.ts
  {
    file: 'src/lib/scoring.ts',
    replacements: [
      [/\binclude:\s*\{\s*shipment:\s*\{/g, 'include: { Shipment: {'],
      [/\ba\.shipment\b/g, 'a.Shipment'],
    ]
  },

  // warehouse/scans/route.ts
  {
    file: 'src/app/api/warehouse/scans/route.ts',
    replacements: [
      [/\binclude:\s*\{\s*shipment:\s*\{/g, 'include: { Shipment: {'],
      [/\bs\.shipment\./g, 's.Shipment.'],
    ]
  },

  // control-tower/route.ts
  {
    file: 'src/app/api/control-tower/route.ts',
    replacements: [
      [/\binclude:\s*\{\s*shipment:\s*\{/g, 'include: { Shipment: {'],
      [/\be\.shipment\?/g, 'e.Shipment?'],
    ]
  },

  // geofence.ts
  {
    file: 'src/lib/geofence.ts',
    replacements: [
      [/\binclude:\s*\{\s*user:\s*true\s*\}/g, 'include: { User: true }'],
    ]
  },

  // reset-password/route.ts
  {
    file: 'src/app/api/auth/reset-password/route.ts',
    replacements: [
      [/\binclude:\s*\{\s*user:\s*true\s*\}/g, 'include: { User: true }'],
      [/\bresetToken\.user\b/g, 'resetToken.User'],
    ]
  },

  // auth.ts
  {
    file: 'src/lib/auth.ts',
    replacements: [
      [/\binclude:\s*\{\s*tenant:\s*\{/g, 'include: { Tenant: {'],
      [/\bapiKey\.tenant\b/g, 'apiKey.Tenant'],
    ]
  },

  // demo-requests/route.ts
  {
    file: 'src/app/api/demo-requests/route.ts',
    replacements: [
      [/\binclude:\s*\{\s*tenant:\s*\{/g, 'include: { Tenant: {'],
    ]
  },

  // alerts.ts - check for user: in include
  {
    file: 'src/lib/alerts.ts',
    replacements: [
      [/\binclude:\s*\{\s*user:\s*true\s*\}/g, 'include: { User: true }'],
    ]
  },
];

let totalFixed = 0;
for (const fix of fixes) {
  const fullPath = path.join(__dirname, '..', fix.file);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${fix.file}`);
    continue;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;
  for (const [pattern, replacement] of fix.replacements) {
    content = content.replace(pattern, replacement);
  }
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`FIXED: ${fix.file}`);
    totalFixed++;
  } else {
    console.log(`NO CHANGE: ${fix.file}`);
  }
}
console.log(`\nTotal files fixed: ${totalFixed}`);
