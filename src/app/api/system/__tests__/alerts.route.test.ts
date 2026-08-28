import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.ALERT_CRON_SECRET = 'test-cron-secret';
});

const {
  mockScanAlerts,
  mockGuard,
  mockLogAudit,
} = vi.hoisted(() => ({
  mockScanAlerts: vi.fn(),
  mockGuard: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock('@/lib/alerts', () => ({ scanAlerts: mockScanAlerts }));
vi.mock('@/lib/api-guard', () => ({
  guard: mockGuard,
  logAudit: mockLogAudit,
  runWithTenant: (_tenantId: string | null | undefined, fn: () => Promise<unknown>) => fn(),
}));

import { GET, POST } from '../alerts/route';

const SESSION = { id: 'u1', name: 'Admin', username: 'admin', role: 'ADMIN_OPERASIONAL' };

function req(headers: Record<string, string> = {}) {
  return new Request('http://localhost:3001/api/system/alerts', { headers });
}

describe('POST/GET /api/system/alerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('menolak tanpa secret & tanpa sesi (401)', async () => {
    mockGuard.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Tidak terautentikasi' }), { status: 401 }),
    });
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('menolak secret yang salah (401 via guard)', async () => {
    mockGuard.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Tidak terautentikasi' }), { status: 401 }),
    });
    const res = await GET(req({ 'x-cron-secret': 'salah' }));
    expect(res.status).toBe(401);
    expect(mockGuard).toHaveBeenCalled();
  });

  it('menerima x-cron-secret yang benar tanpa sesi', async () => {
    mockScanAlerts.mockResolvedValue(3);
    const res = await POST(req({ 'x-cron-secret': 'test-cron-secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.created).toBe(3);
    expect(body).toHaveProperty('checkedAt');
    expect(body).toHaveProperty('elapsedMs');
    expect(mockGuard).not.toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(null, 'ALERT_SCAN', 'SYSTEM', expect.stringContaining('created=3'));
  });

  it('menerima Authorization Bearer yang benar', async () => {
    mockScanAlerts.mockResolvedValue(0);
    const res = await GET(req({ authorization: 'Bearer test-cron-secret' }));
    expect(res.status).toBe(200);
    expect(mockGuard).not.toHaveBeenCalled();
  });

  it('menerima sesi admin untuk pemicu manual', async () => {
    mockScanAlerts.mockResolvedValue(2);
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledWith(SESSION, 'ALERT_SCAN', 'SYSTEM', expect.stringContaining('created=2'));
  });

  it('role non-admin ditolak (403)', async () => {
    mockScanAlerts.mockResolvedValue(0);
    mockGuard.mockResolvedValue({
      session: SESSION,
      error: new Response(JSON.stringify({ error: 'Tidak memiliki akses' }), { status: 403 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('mengembalikan 500 jika scanAlerts gagal', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockScanAlerts.mockRejectedValue(new Error('db down'));
    const res = await POST(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Terjadi kesalahan');
  });
});
