import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export const tenantStore = new AsyncLocalStorage<string | null>();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const basePrisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = Record<string, any>;

function addTenantFilter(args: AnyArgs, tenantId: string | null): AnyArgs {
  if (!tenantId) return args;
  const existingWhere = args.where ?? {};
  if (existingWhere.tenantId !== undefined) return args;
  return { ...args, where: { ...existingWhere, tenantId } };
}

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
        const tenantId = tenantStore.getStore() ?? null;
        return query(addTenantFilter(args, tenantId));
      },
      async findFirst({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
        const tenantId = tenantStore.getStore() ?? null;
        return query(addTenantFilter(args, tenantId));
      },
      async findFirstOrThrow({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
        const tenantId = tenantStore.getStore() ?? null;
        return query(addTenantFilter(args, tenantId));
      },
      async count({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
        const tenantId = tenantStore.getStore() ?? null;
        return query(addTenantFilter(args, tenantId));
      },
      async create({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
        const tenantId = tenantStore.getStore() ?? null;
        if (!tenantId) return query(args);
        const data = args.data;
        if (data && typeof data === 'object' && !Array.isArray(data) && !('tenantId' in data && data.tenantId)) {
          return query({ ...args, data: { ...data, tenantId } });
        }
        return query(args);
      },
      async createMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
        const tenantId = tenantStore.getStore() ?? null;
        if (!tenantId) return query(args);
        const data = Array.isArray(args.data) ? args.data : [args.data];
        return query({ ...args, data: data.map((d: AnyArgs) => ({ ...d, tenantId })) });
      },
      async update({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
        const tenantId = tenantStore.getStore() ?? null;
        return query(addTenantFilter(args, tenantId));
      },
      async updateMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
        const tenantId = tenantStore.getStore() ?? null;
        return query(addTenantFilter(args, tenantId));
      },
      async delete({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
        const tenantId = tenantStore.getStore() ?? null;
        return query(addTenantFilter(args, tenantId));
      },
      async deleteMany({ args, query }: { args: AnyArgs; query: (args: AnyArgs) => Promise<unknown> }) {
        const tenantId = tenantStore.getStore() ?? null;
        return query(addTenantFilter(args, tenantId));
      },
    },
  },
});
