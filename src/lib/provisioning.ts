import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { logger } from './logger';
import { createSubscription } from './billing';

interface ProvisionResult {
  tenantId: string;
  slug: string;
  adminUsername: string;
  adminPassword: string;
  tenantName: string;
}

export async function provisionTenant(requestId: string): Promise<ProvisionResult> {
  const request = await prisma.demoRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('Demo request tidak ditemukan');
  if (request.status !== 'COMPLETED') throw new Error('Status harus COMPLETED');
  if (request.tenantId) throw new Error('Sudah diproses sebelumnya');

  const slug = generateSlug(request.company);
  const adminPassword = generatePassword();
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const log = logger.child('provisioning');

  log.info('Starting tenant provisioning', { company: request.company, slug });

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: request.company,
        slug,
        code: slug.toUpperCase().slice(0, 10),
        status: 'ACTIVE',
        plan: 'FREE',
        timezone: 'Asia/Jakarta',
        locale: 'id-ID',
        currency: 'IDR',
        contactName: request.name,
        contactEmail: request.email,
        contactPhone: request.phone || null,
        maxUsers: 2,
        maxDrivers: 5,
        maxShipments: 50,
      },
    });

    log.info('Tenant created', { tenantId: tenant.id });

    const admin = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: request.name,
        username: 'admin',
        passwordHash,
        email: request.email,
        role: 'ADMIN_OPERASIONAL',
        status: 'ACTIVE',
        mustChangePassword: true,
      },
    });

    log.info('Admin user created', { userId: admin.id });

    await tx.demoRequest.update({
      where: { id: requestId },
      data: { tenantId: tenant.id, provisionedAt: new Date() },
    });

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      adminUsername: admin.username,
      adminPassword,
      tenantName: tenant.name,
    };
  });

  await createSubscription(result.tenantId, 'FREE', 'MONTHLY');

  log.info('Tenant provisioned successfully', {
    tenantId: result.tenantId,
    slug: result.slug,
    adminUsername: result.adminUsername,
  });

  return result;
}

function generateSlug(company: string): string {
  let slug = company
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/^-|-$/g, '');

  if (!slug) slug = 'tenant';

  return slug;
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  for (let i = 0; i < 12; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}
