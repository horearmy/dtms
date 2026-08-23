const fs = require('fs');
const path = require('path');

// Revert PascalCase property accesses in API route files back to camelCase.
// The normalizer in prisma.ts converts Prisma PascalCase results back to camelCase,
// so all property accesses on Prisma results should use camelCase.
// Prisma include/select/where clauses stay PascalCase (handled by ':', not '.').

const PROP_REPLACEMENTS = [
  ['.Customer_Shipment_senderIdToCustomer.', '.sender.'],
  ['.Customer_Shipment_receiverIdToCustomer.', '.receiver.'],
  ['.Shipment.', '.shipment.'],
  ['.Driver.', '.driver.'],
  ['.Vehicle.', '.vehicle.'],
  ['.User.', '.user.'],
  ['.Tenant.', '.tenant.'],
  ['.Geofence.', '.geofence.'],
];

const srcDir = path.join(__dirname, '..', 'src', 'app', 'api');
let totalFixed = 0;
const fixed = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue;
    
    let c = fs.readFileSync(p, 'utf8');
    const orig = c;
    
    for (const [from, to] of PROP_REPLACEMENTS) {
      const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      c = c.replace(new RegExp(esc, 'g'), to);
    }
    
    if (c !== orig) {
      fs.writeFileSync(p, c, 'utf8');
      fixed.push(path.relative(path.join(__dirname, '..'), p));
      totalFixed++;
    }
  }
}

walk(srcDir);
console.log(`Total API files reverted: ${totalFixed}`);
for (const f of fixed) console.log(`  ${f}`);
