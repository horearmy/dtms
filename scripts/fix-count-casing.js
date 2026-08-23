const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

// _count.select fixes: camelCase -> PascalCase (in Prisma queries)
const COUNT_SELECT_MAP = {
  'warehouses: true': 'Warehouse: true',
  'hubs: true': 'Hub: true',
  'drivers: true': 'Driver: true',
  'shipments: true': 'Shipment: true',
  'vehicles: true': 'Vehicle: true',
  'customers: true': 'Customer: true',
  'geofences: true': 'Geofence: true',
  'regions: true': 'Region: true',
  'branches: true': 'Branch: true',
  'departments: true': 'Department: true',
  'notifications: true': 'Notification: true',
};

// Tenant relation select fixes (not _count, but direct select)
const TENANT_SELECT_MAP = {
  'rateLimit: {': 'TenantRateLimit: {',
  'subscription: {': 'Subscription: {',
};

// Client-side _count access: camelCase -> PascalCase
const COUNT_ACCESS_MAP = {
  '_count.warehouses': '_count.Warehouse',
  '_count.hubs': '_count.Hub',
  '_count.drivers': '_count.Driver',
  '_count.shipments': '_count.Shipment',
  '_count.vehicles': '_count.Vehicle',
  '_count.customers': '_count.Customer',
  '_count.geofences': '_count.Geofence',
  '_count.regions': '_count.Region',
  '_count.branches': '_count.Branch',
  '_count.departments': '_count.Department',
  '_count.notifications': '_count.Notification',
};

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Fix _count.select keys
  for (const [from, to] of Object.entries(COUNT_SELECT_MAP)) {
    content = content.split(from).join(to);
  }

  // Fix Tenant rateLimit select
  for (const [from, to] of Object.entries(TENANT_SELECT_MAP)) {
    content = content.split(from).join(to);
  }

  // Fix client-side _count access (only in non-API files to avoid false positives)
  const rel = path.relative(SRC, filePath);
  if (!rel.startsWith('app\\api\\') && !rel.startsWith('app/api/')) {
    for (const [from, to] of Object.entries(COUNT_ACCESS_MAP)) {
      content = content.split(from).join(to);
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

// Find all .ts/.tsx files in src
function walkDir(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const files = walkDir(SRC);
let changed = 0;
for (const f of files) {
  if (fixFile(f)) {
    changed++;
    console.log('  Fixed:', path.relative(path.join(__dirname, '..'), f));
  }
}
console.log(`\nTotal files changed: ${changed}`);
