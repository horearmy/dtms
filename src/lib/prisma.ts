import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export const tenantStore = new AsyncLocalStorage<string | null>();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const basePrisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = Record<string, any>;

// Only apply tenant filtering to these models
const TENANT_SCOPED = new Set([
  'user', 'customer', 'shipment', 'shipmentStop', 'shipmentItem',
  'driver', 'vehicle', 'vehicleMaintenance', 'dailyReport',
  'trackingEvent', 'proofOfDelivery',
]);

function addTenantFilter(args: AnyArgs, tenantId: string | null): AnyArgs {
  if (!tenantId) return args;
  const existingWhere = args.where ?? {};
  if (existingWhere.tenantId !== undefined) return args;
  return { ...args, where: { ...existingWhere, tenantId } };
}

function injectTenantId(data: AnyArgs, tenantId: string): AnyArgs {
  if (data && typeof data === 'object' && !Array.isArray(data) && !('tenantId' in data && data.tenantId)) {
    return { ...data, tenantId };
  }
  return data;
}

// Per-model extensions to avoid $allModels issues with models lacking tenantId
function modelExtension(modelName: string) {
  return {
    async findMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      if (!TENANT_SCOPED.has(modelName)) return query(args);
      return query(addTenantFilter(args, tenantId));
    },
    async findFirst({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      if (!TENANT_SCOPED.has(modelName)) return query(args);
      return query(addTenantFilter(args, tenantId));
    },
    async count({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      if (!TENANT_SCOPED.has(modelName)) return query(args);
      return query(addTenantFilter(args, tenantId));
    },
    async create({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      if (!tenantId || !TENANT_SCOPED.has(modelName)) return query(args);
      return query({ ...args, data: injectTenantId(args.data, tenantId) });
    },
    async createMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      if (!tenantId || !TENANT_SCOPED.has(modelName)) return query(args);
      const data = Array.isArray(args.data) ? args.data : [args.data];
      return query({ ...args, data: data.map((d: AnyArgs) => injectTenantId(d, tenantId)) });
    },
    async update({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      if (!TENANT_SCOPED.has(modelName)) return query(args);
      return query(addTenantFilter(args, tenantId));
    },
    async updateMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      if (!TENANT_SCOPED.has(modelName)) return query(args);
      return query(addTenantFilter(args, tenantId));
    },
    async delete({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      if (!TENANT_SCOPED.has(modelName)) return query(args);
      return query(addTenantFilter(args, tenantId));
    },
    async deleteMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
      const tenantId = tenantStore.getStore() ?? null;
      if (!TENANT_SCOPED.has(modelName)) return query(args);
      return query(addTenantFilter(args, tenantId));
    },
  };
}

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
    dailyReport: modelExtension('dailyReport'),
    trackingEvent: modelExtension('trackingEvent'),
    proofOfDelivery: modelExtension('proofOfDelivery'),
  },
});
