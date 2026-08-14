import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({ getSession: mockGetSession }));

import { GET } from '../me/route';

describe('GET /api/auth/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mengembalikan 401 saat tidak login', async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  it('mengembalikan user + roleLabel saat login', async () => {
    mockGetSession.mockResolvedValue({ id: 'u1', name: 'Admin', username: 'admin', role: 'SUPER_ADMIN' });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ id: 'u1', username: 'admin' });
    expect(typeof body.user.roleLabel).toBe('string');
  });

  it('roleLabel untuk role yang tidak dikenal memakai nilai apa adanya', async () => {
    mockGetSession.mockResolvedValue({ id: 'u9', name: 'X', username: 'x', role: 'MYSTERY_ROLE' });
    const res = await GET();
    const body = await res.json();
    expect(body.user.roleLabel).toBe('MYSTERY_ROLE');
  });
});