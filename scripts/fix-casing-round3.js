const fs = require('fs');
const path = require('path');

const fixes = [
  // drivers/[id]/route.ts - where and include: shipment: → Shipment:
  {
    file: 'src/app/api/drivers/[id]/route.ts',
    replacements: [
      [/shipment:\s*\{\s*status/g, 'Shipment: { status'],
      [/shipment:\s*\{\s*\n\s*select/g, 'Shipment: {\n            select'],
    ]
  },

  // driver/status/route.ts - where and include: shipment: → Shipment:
  {
    file: 'src/app/api/driver/status/route.ts',
    replacements: [
      [/shipment:\s*\{\s*status/g, 'Shipment: { status'],
      [/shipment:\s*\{\s*\n\s*select/g, 'Shipment: {\n          select'],
    ]
  },

  // notifications/read/route.ts - where: shipment: → Shipment:, driver: → Driver:
  {
    file: 'src/app/api/notifications/read/route.ts',
    replacements: [
      [/\bshipment:\s*\{\s*DeliveryAssignment/g, 'Shipment: { DeliveryAssignment'],
      [/\bdriver:\s*\{\s*userId/g, 'Driver: { userId'],
    ]
  },

  // notifications/route.ts - where: shipment: → Shipment:, driver: → Driver:
  {
    file: 'src/app/api/notifications/route.ts',
    replacements: [
      [/\bshipment:\s*\{\s*DeliveryAssignment/g, 'Shipment: { DeliveryAssignment'],
      [/\bdriver:\s*\{\s*userId/g, 'Driver: { userId'],
    ]
  },

  // tracking/[resi]/page.tsx - vehicle: true → Vehicle: true
  {
    file: 'src/app/tracking/[resi]/page.tsx',
    replacements: [
      [/vehicle:\s*true/g, 'Vehicle: true'],
    ]
  },

  // analytics/route.ts - vehicle: true → Vehicle: true
  {
    file: 'src/app/api/analytics/route.ts',
    replacements: [
      [/vehicle:\s*true/g, 'Vehicle: true'],
    ]
  },

  // gps/latest/route.ts - vehicle: true → Vehicle: true
  {
    file: 'src/app/api/gps/latest/route.ts',
    replacements: [
      [/vehicle:\s*true/g, 'Vehicle: true'],
    ]
  },

  // shipments/route.ts - vehicle: true → Vehicle: true
  {
    file: 'src/app/api/shipments/route.ts',
    replacements: [
      [/vehicle:\s*true/g, 'Vehicle: true'],
    ]
  },

  // tracking/[resi]/route.ts - vehicle: true → Vehicle: true
  {
    file: 'src/app/api/tracking/[resi]/route.ts',
    replacements: [
      [/vehicle:\s*true/g, 'Vehicle: true'],
    ]
  },

  // dispatch/route.ts - check for lowercase relation names
  {
    file: 'src/app/api/dispatch/route.ts',
    replacements: [
      [/include:\s*\{\s*vehicle:\s*true/g, 'include: { Vehicle: true'],
      [/include:\s*\{\s*driver:\s*true/g, 'include: { Driver: true'],
    ]
  },

  // geofence check for lowercase 'user' and 'geofence'
  {
    file: 'src/lib/geofence.ts',
    replacements: [
      [/include:\s*\{\s*User:\s*true\s*\}/g, 'include: { User: true }'],
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
