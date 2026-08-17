import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('../auth', () => ({
  getSession: mockGetSession,
}));

import { guard } from '../api-guard';

beforeEach(() => vi.clearAllMocks());

describe('guard', () => {
  it('return 401 jika tidak ada session', async () => {
    mockGetSession.mockResolvedValue(null);
    const { session, error } = await guard();
    expect(session).toBeNull();
    expect(error).not.toBeNull();
    const json = await error!.json();
    expect(json.error).toBe('Tidak terautentikasi');
  });

  it('return session jika tidak ada role filter', async () => {
    mockGetSession.mockResolvedValue({ id: 'u1', role: 'SUPER_ADMIN', name: 'Admin' });
    const { session, error } = await guard();
    expect(session).toEqual({ id: 'u1', role: 'SUPER_ADMIN', name: 'Admin' });
    expect(error).toBeNull();
  });

  it('return session jika role cocok', async () => {
    mockGetSession.mockResolvedValue({ id: 'u1', role: 'DISPATCHER', name: 'Disp' });
    const { session, error } = await guard('DISPATCHER', 'SUPER_ADMIN');
    expect(session).not.toBeNull();
    expect(error).toBeNull();
  });

  it('return 403 jika role tidak cocok', async () => {
    mockGetSession.mockResolvedValue({ id: 'u1', role: 'DRIVER', name: 'Driver' });
    const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
    expect(session).not.toBeNull();
    expect(error).not.toBeNull();
    const json = await error!.json();
    expect(json.error).toBe('Tidak memiliki akses');
  });

  it('return session + error both populated on 403', async () => {
    mockGetSession.mockResolvedValue({ id: 'u1', role: 'WAREHOUSE', name: 'WH' });
    const { session, error } = await guard('SUPER_ADMIN');
    expect(session?.role).toBe('WAREHOUSE');
    expect(error!.status).toBe(403);
  });
});
