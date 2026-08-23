const fs = require('fs');
const path = require('path');
const srcDir = path.join(__dirname, '..', 'src');

// Map: lowercase → PascalCase for Prisma relation names
const RELATIONS = {
  shipment: 'Shipment',
  driver: 'Driver',
  vehicle: 'Vehicle',
  tenant: 'Tenant',
  user: 'User',
  pods: 'ProofOfDelivery',
};

let totalFixed = 0;
const fixed = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue;
    if (f.includes('.test.') || f.includes('__tests__')) continue;

    let c = fs.readFileSync(p, 'utf8');
    const orig = c;

    for (const [lower, pascal] of Object.entries(RELATIONS)) {
      // 1. Key in object: "lower:" → "PascalCase:" but NOT "prisma.lower." (model accessor)
      // Use negative lookbehind to skip prisma.lower
      c = c.replace(new RegExp(`(?<!prisma\\.)(?<!\\w)${lower}\\s*:\\s*\\{`, 'g'), pascal + ': {');
      c = c.replace(new RegExp(`(?<!prisma\\.)(?<!\\w)${lower}\\s*:\\s*true`, 'g'), pascal + ': true');
    }

    if (c !== orig) {
      fs.writeFileSync(p, c, 'utf8');
      fixed.push(path.relative(path.join(__dirname, '..'), p));
      totalFixed++;
    }
  }
}

walk(srcDir);
console.log(`Total files fixed: ${totalFixed}`);
for (const f of fixed) console.log(`  ${f}`);
