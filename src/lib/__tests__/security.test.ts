import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    loginAttempt: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '../prisma';
import { getClientIp, isLoginBlocked, recordLoginAttempt, cleanupLoginAttempts, validatePassword } from '../security';

const mockPrisma = vi.mocked(prisma, true);

describe('validatePassword', () => {
  it('menolak password < 8 karakter', () => {
    expect(validatePassword('Ab1')).toEqual({ valid: false, error: expect.stringContaining('minimal 8') });
  });

  it('menolak tanpa huruf besar', () => {
    expect(validatePassword('abcdefg1')).toEqual({ valid: false, error: expect.stringContaining('huruf besar') });
  });

  it('menolak tanpa huruf kecil', () => {
    expect(validatePassword('ABCDEFG1')).toEqual({ valid: false, error: expect.stringContaining('huruf kecil') });
  });

  it('menolak tanpa angka', () => {
    expect(validatePassword('Abcdefgh')).toEqual({ valid: false, error: expect.stringContaining('angka') });
  });

  it('menerima password valid', () => {
    expect(validatePassword('StrongPass1')).toEqual({ valid: true });
  });
});

describe('getClientIp', () => {
  const req = (headers: Record<string, string | null>) =>
    ({ headers: { get: (k: string) => (k in headers ? headers[k] : null) } }) as never;

  it('mengambil ip pertama dari x-forwarded-for', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5');
  });

  it('fallback ke x-real-ip', () => {
    expect(getClientIp(req({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('fallback local jika tidak ada header', () => {
    expect(getClientIp(req({}))).toBe('local');
  });
});

describe('isLoginBlocked', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blokir jika user gagal 5x dalam window', async () => {
    mockPrisma.loginAttempt.count.mockResolvedValue(5);
    expect(await isLoginBlocked('admin', '1.2.3.4')).toBe(true);
  });

  it('blokir jika ip gagal 20x dalam window', async () => {
    mockPrisma.loginAttempt.count
      .mockResolvedValueOnce(1) // byUsername
      .mockResolvedValueOnce(20); // byIp
    expect(await isLoginBlocked('admin', '1.2.3.4')).toBe(true);
  });

  it('tidak blokir jika di bawah ambang', async () => {
    mockPrisma.loginAttempt.count.mockResolvedValue(2);
    expect(await isLoginBlocked('admin', '1.2.3.4')).toBe(false);
  });

  it('query memakai window 15 menit & success=false', async () => {
    await isLoginBlocked('admin', '1.2.3.4');
    const where = mockPrisma.loginAttempt.count.mock.calls[0][0]?.where;
    expect(where).toMatchObject({ success: false, username: 'admin' });
    expect(where?.createdAt).toHaveProperty('gte');
  });
});

describe('recordLoginAttempt & cleanupLoginAttempts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recordLoginAttempt mencatat attempt', async () => {
    await recordLoginAttempt('admin', '1.2.3.4', true);
    expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith({
      data: { username: 'admin', ip: '1.2.3.4', success: true },
    });
  });

  it('cleanup menghapus attempt lebih tua dari 24 jam', async () => {
    await cleanupLoginAttempts();
    const where = mockPrisma.loginAttempt.deleteMany.mock.calls[0][0]?.where;
    expect(where?.createdAt).toHaveProperty('lt');
  });
});
