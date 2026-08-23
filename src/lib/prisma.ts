import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export const tenantStore = new AsyncLocalStorage<string | null>();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const basePrisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = Record<string, any>;

// Only models that ACTUALLY have a tenantId column in the schema
const TENANT_SCOPED = new Set([
  'user', 'customer', 'shipment', 'shipmentStop', 'shipmentItem',
  'driver', 'vehicle', 'vehicleMaintenance',
  'company', 'branch', 'department', 'warehouse', 'hub',
  'shipmentEvent', 'geofence',
  'exception', 'slaPolicy', 'slaEvent',
  'subscription', 'invoice', 'payment', 'usageRecord',
  'integrationConfig', 'apiKey', 'webhookSubscription',
  'uploadedFile', 'demoRequest', 'rolePermission',
  'auditLog', 'notification', 'message', 'tenantRateLimit',
  'organization', 'region', 'whiteLabel', 'tenantOnboarding', 'tenantHealthMetric',
]);

// Model dengan tenantId nullable yang wajib boleh ditulis tanpa konteks tenant
// (event platform-level: login gagal, aktivitas superadmin, dsb.)
const FAIL_CLOSED_EXEMPT = new Set(['auditLog']);

function addTenantFilter(args: AnyArgs, tenantId: string): AnyArgs {
  if (!tenantId) return args;
  const existingWhere = args.where ?? {};
  if (existingWhere.tenantId !== undefined) return args;
  return { ...args, where: { ...existingWhere, tenantId } };
}

function injectTenantId(data: AnyArgs, tenantId: string): AnyArgs {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if ('tenantId' in data && data.tenantId && data.tenantId !== tenantId) {
      throw new Error('TENANT_MISMATCH: Cannot create record for a different tenant');
    }
    return { ...data, tenantId };
  }
  return data;
}

function assertTenantContext(modelName: string, args: AnyArgs) {
  // Fail closed: block tenant-scoped writes when no tenant context is set,
  // unless the caller explicitly sets tenantId in the payload.
  const data = args?.data;
  const hasExplicitTenant = data && typeof data === 'object' && !Array.isArray(data) && 'tenantId' in data;
  if (!hasExplicitTenant) {
    throw new Error(
      `TENANT_CONTEXT_MISSING: refusing to write model "${modelName}" without a tenant context. ` +
      'Wrap the call in runWithTenant(tenantId, ...) or set tenantId explicitly.'
    );
  }
}

export function runWithTenant<T>(tenantId: string | null, fn: () => Promise<T>): Promise<T> {
  return tenantStore.run(tenantId, fn);
}

function modelExtension(modelName: string) {
  return {
    // findUnique: run query, then verify tenant ownership on result
    async findUnique({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const result = await query(args);
      if (!result) return null;
      const tenantId = tenantStore.getStore() ?? null;
      if (tenantId && TENANT_SCOPED.has(modelName)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = result as any;
        if ('tenantId' in r && r.tenantId !== null && r.tenantId !== tenantId) return null;
      }
      return result;
    },
    async findMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      return (!tenantId || !TENANT_SCOPED.has(modelName)) ? query(args) : query(addTenantFilter(args, tenantId));
    },
    async findFirst({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      return (!tenantId || !TENANT_SCOPED.has(modelName)) ? query(args) : query(addTenantFilter(args, tenantId));
    },
    async count({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      return (!tenantId || !TENANT_SCOPED.has(modelName)) ? query(args) : query(addTenantFilter(args, tenantId));
    },
    async create({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      if (!tenantId && TENANT_SCOPED.has(modelName) && !FAIL_CLOSED_EXEMPT.has(modelName)) assertTenantContext(modelName, args);
      return query(!tenantId || !TENANT_SCOPED.has(modelName) ? args : { ...args, data: injectTenantId(args.data, tenantId) });
    },
    async createMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      if (!tenantId || !TENANT_SCOPED.has(modelName)) return query(args);
      const data = Array.isArray(args.data) ? args.data : [args.data];
      return query({ ...args, data: data.map((d: AnyArgs) => injectTenantId(d, tenantId)) });
    },
    async update({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      return query((!tenantId || !TENANT_SCOPED.has(modelName)) ? args : addTenantFilter(args, tenantId));
    },
    async updateMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      return (!tenantId || !TENANT_SCOPED.has(modelName)) ? query(args) : query(addTenantFilter(args, tenantId));
    },
    async delete({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      return (!tenantId || !TENANT_SCOPED.has(modelName)) ? query(args) : query(addTenantFilter(args, tenantId));
    },
    async deleteMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      return (!tenantId || !TENANT_SCOPED.has(modelName)) ? query(args) : query(addTenantFilter(args, tenantId));
    },
  };
}

// Explicitly list each model for TypeScript compatibility
export const prisma = basePrisma.$extends({
  query: {
    user: modelExtension('user'),
    customer: modelExtension('customer'),
    shipment: modelExtension('shipment'),
    shipmentStop: modelExtension('shipmentStop'),
    shipmentItem: modelExtension('shipmentItem'),
    driver: modelExtension('driver'),
    vehicle: modelExtension('vehicle'),
    vehicleMaintenance: modelExtension('vehicleMaintenance'),
    company: modelExtension('company'),
    branch: modelExtension('branch'),
    department: modelExtension('department'),
    warehouse: modelExtension('warehouse'),
    hub: modelExtension('hub'),
    shipmentEvent: modelExtension('shipmentEvent'),
    geofence: modelExtension('geofence'),
    exception: modelExtension('exception'),
    slaPolicy: modelExtension('slaPolicy'),
    slaEvent: modelExtension('slaEvent'),
    subscription: modelExtension('subscription'),
    invoice: modelExtension('invoice'),
    payment: modelExtension('payment'),
    usageRecord: modelExtension('usageRecord'),
    integrationConfig: modelExtension('integrationConfig'),
    apiKey: modelExtension('apiKey'),
    webhookSubscription: modelExtension('webhookSubscription'),
    uploadedFile: modelExtension('uploadedFile'),
    demoRequest: modelExtension('demoRequest'),
    rolePermission: modelExtension('rolePermission'),
    auditLog: modelExtension('auditLog'),
    notification: modelExtension('notification'),
    message: modelExtension('message'),
    tenantRateLimit: modelExtension('tenantRateLimit'),
    organization: modelExtension('organization'),
    region: modelExtension('region'),
    whiteLabel: modelExtension('whiteLabel'),
    tenantOnboarding: modelExtension('tenantOnboarding'),
    tenantHealthMetric: modelExtension('tenantHealthMetric'),
  },
});
