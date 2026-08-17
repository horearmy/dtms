import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

const {
  mockPrismaUser,
  mockLoginAttempt,
  mockAuditLog,
  mockTenant,
  mockSetSession,
  mockIsLoginBlocked,
  mockRecordLoginAttempt,
  mockCleanup,
} = vi.hoisted(() => ({
  mockPrismaUser: { findFirst: vi.fn() },
  mockLoginAttempt: { create: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  mockAuditLog: { create: vi.fn() },
  mockTenant: { findUnique: vi.fn() },
  mockSetSession: vi.fn(),
  mockIsLoginBlocked: vi.fn(),
  mockRecordLoginAttempt: vi.fn(),
  mockCleanup: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { user: mockPrismaUser, loginAttempt: mockLoginAttempt, auditLog: mockAuditLog, tenant: mockTenant },
}));
vi.mock('@/lib/auth', () => ({ setSession: mockSetSession }));
vi.mock('@/lib/api-guard', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/tenant', () => ({ setTenantCookie: vi.fn(() => ({ name: 'dtms_tenant', value: '', httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 0 })) }));
vi.mock('@/lib/security', () => ({
  getClientIp: () => '203.0.113.9',
  isLoginBlocked: mockIsLoginBlocked,
  recordLoginAttempt: mockRecordLoginAttempt,
  cleanupLoginAttempts: mockCleanup,
}));

import { POST } from '../login/route';

const HASH = bcrypt.hashSync('StrongPass1', 10);

const USER = {
  id: 'u1',
  name: 'Admin Utama',
  username: 'admin',
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
  pwdVersion: 1,
  mustChangePassword: false,
  passwordHash: HASH,
};

function loginReq(body: unknown) {
  return new NextRequest('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenant.findUnique.mockResolvedValue({ id: 't1', active: true });
  });

  it('menolak jika username/password kosong (400)', async () => {
    const res = await POST(loginReq({}));
    expect(res.status).toBe(400);
  });

  it('mengembalikan 429 jika terblokir brute force', async () => {
    mockIsLoginBlocked.mockResolvedValue(true);
    const res = await POST(loginReq({ username: 'admin', password: 'x', tenantId: 't1' }));
    expect(res.status).toBe(429);
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('menolak user yang tidak ada (401) + catat LOGIN_FAILED', async () => {
    mockIsLoginBlocked.mockResolvedValue(false);
    mockPrismaUser.findFirst.mockResolvedValue(null);
    const res = await POST(loginReq({ username: 'ghost', password: 'Xyz12345', tenantId: 't1' }));
    expect(res.status).toBe(401);
    expect(mockRecordLoginAttempt).toHaveBeenCalledWith('ghost', '203.0.113.9', false);
    expect(mockAuditLog.create).toHaveBeenCalled();
  });

  it('menolak akun non-ACTIVE (403)', async () => {
    mockIsLoginBlocked.mockResolvedValue(false);
    mockPrismaUser.findFirst.mockResolvedValue({ ...USER, status: 'INACTIVE' });
    const res = await POST(loginReq({ username: 'admin', password: 'StrongPass1', tenantId: 't1' }));
    expect(res.status).toBe(403);
    expect(mockRecordLoginAttempt).toHaveBeenCalledWith('admin', '203.0.113.9', false);
  });

  it('menolak password salah (401)', async () => {
    mockIsLoginBlocked.mockResolvedValue(false);
    mockPrismaUser.findFirst.mockResolvedValue(USER);
    const res = await POST(loginReq({ username: 'admin', password: 'WrongPass1', tenantId: 't1' }));
    expect(res.status).toBe(401);
    expect(mockRecordLoginAttempt).toHaveBeenCalledWith('admin', '203.0.113.9', false);
  });

  it('login sukses: setSession + recordLoginAttempt(success) + return user', async () => {
    mockIsLoginBlocked.mockResolvedValue(false);
    mockPrismaUser.findFirst.mockResolvedValue(USER);
    const res = await POST(loginReq({ username: 'Admin', password: 'StrongPass1', tenantId: 't1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: 'u1', name: 'Admin Utama', role: 'SUPER_ADMIN' });
    expect(mockRecordLoginAttempt).toHaveBeenCalledWith('admin', '203.0.113.9', true);
    expect(mockSetSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', username: 'admin', role: 'SUPER_ADMIN', pwdVersion: 1 })
    );
  });

  it('mengembalikan 500 jika prisma gagal', async () => {
    mockIsLoginBlocked.mockResolvedValue(false);
    mockPrismaUser.findFirst.mockRejectedValue(new Error('db down'));
    const res = await POST(loginReq({ username: 'admin', password: 'StrongPass1', tenantId: 't1' }));
    expect(res.status).toBe(500);
  });
});
