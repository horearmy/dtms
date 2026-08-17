import { prisma } from './prisma';
import { cookies } from 'next/headers';

export type TenantContext = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  plan: string;
};

const COOKIE_NAME = 'dtms_tenant';

export async function resolveTenantFromRequest(): Promise<TenantContext | null> {
  const store = await cookies();
  const slug = store.get(COOKIE_NAME)?.value;
  if (!slug) return null;
  return getTenantBySlug(slug);
}

export async function resolveTenantFromDomain(domain: string): Promise<TenantContext | null> {
  const tenant = await prisma.tenant.findUnique({ where: { domain } });
  if (!tenant || !tenant.active) return null;
  return toContext(tenant);
}

export async function resolveTenantFromSubdomain(host: string): Promise<TenantContext | null> {
  const parts = host.split('.');
  if (parts.length < 3) return null;
  const subdomain = parts[0];
  if (subdomain === 'www' || subdomain === 'app' || subdomain === 'api') return null;
  return getTenantBySlug(subdomain);
}

export async function getTenantBySlug(slug: string): Promise<TenantContext | null> {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || !tenant.active) return null;
  return toContext(tenant);
}

export async function getTenantById(id: string): Promise<TenantContext | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant || !tenant.active) return null;
  return toContext(tenant);
}

export function setTenantCookie(slug: string) {
  return {
    name: COOKIE_NAME,
    value: slug,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  };
}

function toContext(tenant: {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  plan: string;
}): TenantContext {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    logoUrl: tenant.logoUrl,
    faviconUrl: tenant.faviconUrl,
    primaryColor: tenant.primaryColor,
    secondaryColor: tenant.secondaryColor,
    accentColor: tenant.accentColor,
    plan: tenant.plan,
  };
}

export function tenantWhere(tenantId: string | null | undefined) {
  return tenantId ? { tenantId } : {};
}
