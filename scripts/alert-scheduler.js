// Scheduler daemon untuk memindai alert secara berkala.
//
// Cara pakai:
//   npm run alerts:scheduler            -> jalankan daemon (loop sesuai ALERT_INTERVAL_MIN)
//   npm run alerts:run                  -> jalankan satu kali scan lalu keluar
//   node scripts/alert-scheduler.js --once
//   node scripts/alert-scheduler.js --interval 10
//
// Env (opsional, default di bawah):
//   ALERT_CRON_SECRET    -> secret yang sama dengan .env (wajib jika .env punya secret)
//   ALERT_CRON_URL       -> base URL aplikasi, default http://localhost:3001
//   ALERT_INTERVAL_MIN   -> jeda antar scan dalam menit, default 5
//
// Scheduler memanggil POST {ALERT_CRON_URL}/api/system/alerts dengan header
// `x-cron-secret: <ALERT_CRON_SECRET>`.

const path = require('path');
const fs = require('fs');

// muat .env sederhana (tanpa dependency)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '').trim();
  }
}
loadEnv();

const URL_BASE = process.env.ALERT_CRON_URL || 'http://localhost:3001';
const SECRET = process.env.ALERT_CRON_SECRET || '';
const ENDPOINT = `${URL_BASE.replace(/\/$/, '')}/api/system/alerts`;

function parseArgs() {
  const argv = process.argv.slice(2);
  const opts = { once: argv.includes('--once') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--interval' && argv[i + 1]) opts.intervalMin = Number(argv[i + 1]);
  }
  return opts;
}

async function runOnce() {
  const started = Date.now();
  const headers = { 'content-type': 'application/json' };
  if (SECRET) headers['x-cron-secret'] = SECRET;

  const res = await fetch(ENDPOINT, { method: 'POST', headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body.error || 'gagal menjalankan scan'}`);
  }
  const elapsed = Date.now() - started;
  console.log(
    `[${new Date().toISOString()}] scan OK: created=${body.created} ms=${body.elapsedMs ?? elapsed}`
  );
  return body;
}

async function main() {
  const opts = parseArgs();
  const intervalMin = opts.intervalMin ?? Number(process.env.ALERT_INTERVAL_MIN || 5);

  console.log(`Alert scheduler: ${ENDPOINT}`);
  console.log(`Interval: ${intervalMin} menit${opts.once ? ' (sekali jalan)' : ''}`);

  while (true) {
    try {
      await runOnce();
    } catch (e) {
      console.error(`[${new Date().toISOString()}] GAGAL: ${e.message}`);
    }
    if (opts.once) break;
    await new Promise((r) => setTimeout(r, intervalMin * 60 * 1000));
  }
}

// hentikan bersih saat SIGINT/SIGTERM (ctrl+c)
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
