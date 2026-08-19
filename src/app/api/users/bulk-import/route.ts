import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant, guardPlanLimit } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { generateRandomPassword } from '@/lib/security';

const ASSIGNABLE_ROLES: string[] = [
  'SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE',
  'CUSTOMER_SERVICE', 'SUPERVISOR', 'MANAGEMENT',
];

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.USER.CREATE);
  if (error) return error;

  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  const body = await req.json();
  const csv = body.csv?.toString().trim();
  if (!csv) {
    return NextResponse.json({ error: 'CSV kosong' }, { status: 400 });
  }

  return runWithTenant(session?.tenantId ?? null, async () => {
    const tenantId = session?.tenantId ?? null;
    const lines = csv.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const results: { created: number; skipped: number; errors: { row: string; error: string }[] } = {
      created: 0, skipped: 0, errors: [],
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(',').map((p: string) => p.trim());
      if (parts.length < 3) {
        results.errors.push({ row: String(i + 1), error: 'Minimal 3 kolom: nama,username,role' });
        continue;
      }

      const [name, username, role, phone] = parts;

      if (!name || !username || !role) {
        results.errors.push({ row: String(i + 1), error: 'Nama, username, role wajib diisi' });
        continue;
      }
      if (!ASSIGNABLE_ROLES.includes(role)) {
        results.errors.push({ row: String(i + 1), error: `Role "${role}" tidak valid` });
        continue;
      }

      const limitErr = await guardPlanLimit(session, 'users');
      if (limitErr) {
        results.errors.push({ row: String(i + 1), error: 'Batas user tercapai pada plan ini' });
        continue;
      }

      const password = generateRandomPassword(12);

      try {
        await prisma.user.create({
          data: {
            name,
            username: username.toLowerCase(),
            passwordHash: bcrypt.hashSync(password, 10),
            role: role as Role,
            phone: phone || null,
            tenantId,
            status: 'ACTIVE',
            pwdVersion: 1,
            mustChangePassword: true,
          },
        });
        results.created++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Unique constraint')) {
          results.errors.push({ row: String(i + 1), error: `Username "${username}" sudah ada` });
        } else {
          results.errors.push({ row: String(i + 1), error: msg.slice(0, 100) });
        }
      }
    }

    await logAudit(session, 'BULK_IMPORT_USER', 'USER', {
      newData: { total: lines.length, created: results.created, tenantId },
    }, req);

    return NextResponse.json(results);
  });
}
