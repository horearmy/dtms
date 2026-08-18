// src/lib/integration-hub.ts
// Integration hub — OAuth2 flow, CSV import/export, webhook management.
import { prisma } from './prisma';
import crypto from 'crypto';

// ─── OAuth2 ──────────────────────────────────────────────
interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
}

interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

export function buildOAuthRedirect(config: OAuthConfig, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(' '),
    state,
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

export async function exchangeOAuthCode(
  config: OAuthConfig,
  code: string,
  redirectUri: string,
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
  });

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`OAuth token exchange failed: ${res.status}`);
  const data = await res.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
  };
}

// ─── CSV Import ──────────────────────────────────────────
export interface CsvImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

export function toCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const lines = [headers.join(',')];
  for (const row of data) {
    lines.push(headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n');
}

export async function importCustomers(tenantId: string, rows: Record<string, string>[]): Promise<CsvImportResult> {
  const result: CsvImportResult = { total: rows.length, success: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.name) throw new Error('name is required');
      await prisma.customer.create({
        data: {
          tenantId,
          name: row.name,
          phone: row.phone || '',
          email: row.email || null,
          address: row.address || null,
          city: row.city || null,
          postalCode: row.postalCode || null,
        },
      });
      result.success++;
    } catch (err) {
      result.failed++;
      result.errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  await logIntegrationEvent(tenantId, 'CSV_IMPORT', 'customer', result);
  return result;
}

export async function importDrivers(tenantId: string, rows: Record<string, string>[]): Promise<CsvImportResult> {
  const result: CsvImportResult = { total: rows.length, success: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.name) throw new Error('name is required');
      await prisma.driver.create({
        data: {
          tenantId,
          employeeId: row.employeeId || `EMP-${Date.now()}-${i}`,
          name: row.name,
          phone: row.phone || '',
          status: 'ACTIVE',
        },
      });
      result.success++;
    } catch (err) {
      result.failed++;
      result.errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  await logIntegrationEvent(tenantId, 'CSV_IMPORT', 'driver', result);
  return result;
}

export async function exportShipments(tenantId: string, filters?: { status?: string; from?: string; to?: string }) {
  const where: Record<string, unknown> = { tenantId };
  if (filters?.status) where.status = filters.status;
  if (filters?.from || filters?.to) {
    where.createdAt = {};
    if (filters.from) (where.createdAt as Record<string, unknown>).gte = new Date(filters.from);
    if (filters.to) (where.createdAt as Record<string, unknown>).lte = new Date(filters.to);
  }

  const shipments = await prisma.shipment.findMany({
    where,
    select: {
      trackingNumber: true,
      destination: true,
      origin: true,
      receiver: { select: { name: true, phone: true } },
      status: true,
      serviceType: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  return toCsv(shipments.map((s) => ({
    trackingNumber: s.trackingNumber,
    destination: s.destination,
    origin: s.origin,
    receiverName: s.receiver?.name || '',
    receiverPhone: s.receiver?.phone || '',
    status: s.status,
    serviceType: s.serviceType,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  })));
}

// ─── Integration Logging ─────────────────────────────────
async function logIntegrationEvent(_tenantId: string, type: string, entity: string, result: CsvImportResult) {
  const logger = (await import('./logger')).logger;
  logger.info(`CSV import: ${entity}`, {
    context: 'integration-hub',
    type,
    entity,
    total: result.total,
    success: result.success,
    failed: result.failed,
  });
}

// ─── API Key Management ──────────────────────────────────
export function generateApiKey(): { key: string; hash: string } {
  const key = `dtms_${crypto.randomBytes(32).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, hash };
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}
