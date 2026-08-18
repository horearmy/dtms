import { NextResponse } from 'next/server';
import { scanAlerts } from '@/lib/alerts';
import { guard, logAudit } from '@/lib/api-guard';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.ALERT_CRON_SECRET || '';

function secretMatches(req: Request) {
  if (!CRON_SECRET) return false;
  const header = req.headers.get('x-cron-secret');
  if (header === CRON_SECRET) return true;
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ') && auth.slice(7) === CRON_SECRET) return true;
  return false;
}

export async function POST(req: Request) {
  return run(req);
}

export async function GET(req: Request) {
  return run(req);
}

async function run(req: Request) {
  // Izinkan pemanggilan dari scheduler (cron) via secret, ATAU sesi admin (untuk pemicu manual)
  let session = null;
  if (!secretMatches(req)) {
    const g = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'SUPERVISOR');
    if (g.error) return g.error;
    session = g.session;
  }

  try {
    const started = Date.now();
    const created = await scanAlerts();
    const elapsedMs = Date.now() - started;

    await logAudit(session, 'ALERT_SCAN', 'SYSTEM', `created=${created}, ms=${elapsedMs}`);

    return NextResponse.json({
      ok: true,
      created,
      checkedAt: new Date().toISOString(),
      elapsedMs,
    });
  } catch (e) {
    logger.error('Alert scan error', { context: 'alerts', error: String(e) });
    return NextResponse.json({ error: 'Terjadi kesalahan saat memindai alert' }, { status: 500 });
  }
}
