import { unstable_cache } from 'next/cache';

export function cacheData<T>(
  fn: () => Promise<T>,
  keys: string[],
  options: { revalidate?: number; tags?: string[] } = {}
) {
  return unstable_cache(fn, keys, {
    revalidate: options.revalidate ?? 60,
    tags: options.tags ?? keys,
  });
}

export const CACHE_TAGS = {
  DASHBOARD_STATS: 'dashboard-stats',
  SHIPMENT_COUNTS: 'shipment-counts',
  RECENT_SHIPMENTS: 'recent-shipments',
  ACTIVE_SHIPMENTS: 'active-shipments',
  DRIVER_VEHICLE_COUNTS: 'driver-vehicle-counts',
  BRANCH_COUNTS: 'branch-counts',
  TENANT_META: 'tenant-meta',
} as const;
