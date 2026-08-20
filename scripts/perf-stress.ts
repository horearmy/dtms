/**
 * Performance Stress Test — 10M+ Dataset
 * Run: npx tsx scripts/perf-stress.ts
 *
 * Tests all major API endpoints against a running dev server (localhost:3000)
 * with 10M drivers, 10M vehicles, 10M shipments, 10M GPS logs.
 */

const BASE = 'http://localhost:3000';
const TENANT_A_ID = '357011aa-60f3-46cc-b3d6-7b5231c4747f';
const CONCURRENCY = 10;
const WARMUP_RUNS = 2;

// ─── Helpers ──────────────────────────────────────────────

function extractCookies(setCookie) {
  const tokenMatch = setCookie?.match(/dtms_token=([^;]+)/);
  const csrfMatch = setCookie?.match(/dtms_csrf=([^;]+)/);
  return { token: tokenMatch?.[1] || '', csrf: csrfMatch?.[1] || '' };
}

let authCookie = '';
let csrfToken = '';

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin00001', password: 'admin123', tenantId: TENANT_A_ID }),
    redirect: 'manual',
  });
  const { token, csrf } = extractCookies(res.headers.get('set-cookie'));
  authCookie = `dtms_token=${token}; dtms_csrf=${csrf}`;
  csrfToken = csrf;
  if (!token) throw new Error('Login failed');
}

async function timedFetch(method, path, body) {
  const headers = { Cookie: authCookie, 'x-csrf-token': csrfToken };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const elapsed = performance.now() - start;
  let json = null;
  try { json = await res.json(); } catch { /* */ }
  return { status: res.status, elapsed, json, size: JSON.stringify(json || {}).length };
}

async function timedFetchNoAuth(method, path) {
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, { method, redirect: 'manual' });
  const elapsed = performance.now() - start;
  let json = null;
  try { json = await res.json(); } catch { /* */ }
  return { status: res.status, elapsed, json };
}

// ─── Warmup ───────────────────────────────────────────────

async function warmup() {
  process.stdout.write('  Warmup...');
  const endpoints = [
    ['GET', '/api/drivers?page=1&pageSize=5'],
    ['GET', '/api/vehicles?page=1&pageSize=5'],
    ['GET', '/api/shipments?page=1&pageSize=5'],
    ['GET', '/api/gps/latest?minutes=60'],
  ];
  for (let i = 0; i < WARMUP_RUNS; i++) {
    for (const [method, path] of endpoints) {
      await timedFetch(method, path);
    }
  }
  console.log(' done');
}

// ─── Benchmark runner ─────────────────────────────────────

async function bench(label, fn, runs = 5) {
  const times = [];
  let lastResult = null;
  for (let i = 0; i < runs; i++) {
    const { elapsed, ...rest } = await fn();
    times.push(elapsed);
    lastResult = { elapsed, ...rest };
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const min = times[0];
  const max = times[times.length - 1];
  return { label, avg, p50, p95, min, max, runs, lastResult };
}

// ─── Concurrent test ──────────────────────────────────────

async function concurrencyTest(label, fn, concurrency, totalRequests) {
  const times = [];
  const start = performance.now();

  const queue = [];
  for (let i = 0; i < totalRequests; i++) queue.push(i);

  let idx = 0;
  async function worker() {
    while (idx < queue.length) {
      const myIdx = idx++;
      const t0 = performance.now();
      await fn(myIdx);
      times.push(performance.now() - t0);
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);

  const totalElapsed = performance.now() - start;
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const rps = Math.round((totalRequests / totalElapsed) * 1000);

  return { label, concurrency, totalRequests, totalElapsed, avg, p50, p95, rps };
}

// ─── Format ───────────────────────────────────────────────

function fmt(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printBench(result) {
  const status = result.lastResult?.status || '?';
  const icon = result.p95 < 1000 ? '✅' : result.p95 < 5000 ? '⚠️' : '❌';
  console.log(`  ${icon} ${result.label}`);
  console.log(`     Status: ${status} | Avg: ${fmt(result.avg)} | P50: ${fmt(result.p50)} | P95: ${fmt(result.p95)} | Min: ${fmt(result.min)} | Max: ${fmt(result.max)}`);
}

function printConcurrency(result) {
  const icon = result.rps > 50 ? '✅' : result.rps > 10 ? '⚠️' : '❌';
  console.log(`  ${icon} ${result.label}`);
  console.log(`     RPS: ${result.rps} | Concurrency: ${result.concurrency} | Total: ${result.totalRequests} | Avg: ${fmt(result.avg)} | P95: ${fmt(result.p95)}`);
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   DTMS Performance Stress Test — 10M+ Dataset       ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('▸ Logging in...');
  await login();
  console.log('  Done.\n');

  await warmup();

  // ─── Phase 1: API Response Times ────────────────────────
  console.log('\n━━━ Phase 1: API Response Times (5 runs each) ━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = [];

  results.push(await bench('GET /api/drivers?page=1&pageSize=20', () => timedFetch('GET', '/api/drivers?page=1&pageSize=20')));
  results.push(await bench('GET /api/drivers?page=5000&pageSize=20', () => timedFetch('GET', '/api/drivers?page=5000&pageSize=20')));
  results.push(await bench('GET /api/vehicles?page=1&pageSize=20', () => timedFetch('GET', '/api/vehicles?page=1&pageSize=20')));
  results.push(await bench('GET /api/vehicles?page=5000&pageSize=20', () => timedFetch('GET', '/api/vehicles?page=5000&pageSize=20')));
  results.push(await bench('GET /api/shipments?page=1&pageSize=20', () => timedFetch('GET', '/api/shipments?page=1&pageSize=20')));
  results.push(await bench('GET /api/shipments?page=5000&pageSize=20', () => timedFetch('GET', '/api/shipments?page=5000&pageSize=20')));
  results.push(await bench('GET /api/customers?page=1&pageSize=20', () => timedFetch('GET', '/api/customers?page=1&pageSize=20')));
  results.push(await bench('GET /api/gps/latest?minutes=120', () => timedFetch('GET', '/api/gps/latest?minutes=120')));

  for (const r of results) printBench(r);

  // ─── Phase 2: Pagination Deep Scroll ────────────────────
  console.log('\n━━━ Phase 2: Pagination Deep Scroll ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const pages = [1, 100, 500, 1000, 5000];
  for (const page of pages) {
    const r = await bench(`GET /api/drivers?page=${page}&pageSize=20`, () => timedFetch('GET', `/api/drivers?page=${page}&pageSize=20`), 3);
    printBench(r);
  }

  // ─── Phase 3: Detail View ───────────────────────────────
  console.log('\n━━━ Phase 3: Detail View (single record) ━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get first driver ID
  const firstDriver = await timedFetch('GET', '/api/drivers?page=1&pageSize=1');
  const driverId = firstDriver.json?.items?.[0]?.id;
  if (driverId) {
    const r = await bench(`GET /api/drivers/${driverId}`, () => timedFetch('GET', `/api/drivers/${driverId}`), 3);
    printBench(r);
  }

  const firstVehicle = await timedFetch('GET', '/api/vehicles?page=1&pageSize=1');
  const vehicleId = firstVehicle.json?.items?.[0]?.id;
  if (vehicleId) {
    const r = await bench(`GET /api/vehicles/${vehicleId}`, () => timedFetch('GET', `/api/vehicles/${vehicleId}`), 3);
    printBench(r);
  }

  // ─── Phase 4: Search / Filter ───────────────────────────
  console.log('\n━━━ Phase 4: Search / Filter ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  results.push(await bench('GET /api/drivers?q=Andi', () => timedFetch('GET', '/api/drivers?q=Andi&page=1&pageSize=20'), 3));
  results.push(await bench('GET /api/shipments?q=TRK0620', () => timedFetch('GET', '/api/shipments?q=TRK0620&page=1&pageSize=20'), 3));
  results.push(await bench('GET /api/drivers (pageSize=100)', () => timedFetch('GET', '/api/drivers?page=1&pageSize=100'), 3));
  results.push(await bench('GET /api/vehicles (pageSize=100)', () => timedFetch('GET', '/api/vehicles?page=1&pageSize=100'), 3));

  for (const r of results.slice(-4)) printBench(r);

  // ─── Phase 5: Concurrent Stress Test ────────────────────
  console.log('\n━━━ Phase 5: Concurrent Stress Test ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const concResults = [];

  concResults.push(await concurrencyTest(
    '10 concurrent GET /api/drivers',
    () => timedFetch('GET', '/api/drivers?page=1&pageSize=20'),
    CONCURRENCY, 50
  ));

  concResults.push(await concurrencyTest(
    '10 concurrent GET /api/vehicles',
    () => timedFetch('GET', '/api/vehicles?page=1&pageSize=20'),
    CONCURRENCY, 50
  ));

  concResults.push(await concurrencyTest(
    '10 concurrent GET /api/shipments',
    () => timedFetch('GET', '/api/shipments?page=1&pageSize=20'),
    CONCURRENCY, 50
  ));

  concResults.push(await concurrencyTest(
    '10 concurrent GET /api/gps/latest',
    () => timedFetch('GET', '/api/gps/latest?minutes=60'),
    CONCURRENCY, 30
  ));

  concResults.push(await concurrencyTest(
    'Mixed: drivers + vehicles + shipments (20 concurrent)',
    async (i) => {
      const routes = ['/api/drivers?page=1&pageSize=5', '/api/vehicles?page=1&pageSize=5', '/api/shipments?page=1&pageSize=5'];
      await timedFetch('GET', routes[i % 3]);
    },
    20, 100
  ));

  for (const r of concResults) printConcurrency(r);

  // ─── Phase 6: Memory/Transfer ───────────────────────────
  console.log('\n━━━ Phase 6: Response Size Analysis ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sizes = [];
  sizes.push({ label: 'Drivers list (20)', size: firstDriver.json?.items?.length || 0, bytes: JSON.stringify(firstDriver.json || {}).length });
  sizes.push({ label: 'Vehicles list (20)', size: firstVehicle.json?.items?.length || 0, bytes: JSON.stringify(firstVehicle.json || {}).length });
  const gpsRes = await timedFetch('GET', '/api/gps/latest?minutes=60');
  sizes.push({ label: 'GPS latest (60min)', size: gpsRes.json?.drivers?.length || 0, bytes: JSON.stringify(gpsRes.json || {}).length });

  for (const s of sizes) {
    const kb = (s.bytes / 1024).toFixed(1);
    console.log(`  📦 ${s.label}: ${s.size} records, ${kb} KB`);
  }

  // ─── Summary ────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const allResults = results.slice(0, 8);
  const pass = allResults.filter(r => r.p95 < 3000).length;
  const warn = allResults.filter(r => r.p95 >= 3000 && r.p95 < 10000).length;
  const fail = allResults.filter(r => r.p95 >= 10000).length;

  console.log(`  Total tests: ${allResults.length}`);
  console.log(`  ✅ Pass (< 3s): ${pass}`);
  console.log(`  ⚠️  Warn (3-10s): ${warn}`);
  console.log(`  ❌ Fail (> 10s): ${fail}`);
  console.log('');

  for (const r of concResults) {
    console.log(`  ${r.label}: ${r.rps} req/s`);
  }

  console.log('\n  Dataset size:');
  console.log('    Drivers:    10,000,000');
  console.log('    Vehicles:   10,000,000');
  console.log('    Shipments:  10,000,000');
  console.log('    GPS Logs:   10,000,000');
  console.log('    Tenants:    10,000');
  console.log('    Users:      10,000');
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
