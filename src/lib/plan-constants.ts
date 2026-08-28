// src/lib/plan-constants.ts
// Konstanta plan & pajak — sumber tunggal tanpa dependensi server (aman untuk client components).

export const PLAN_ORDER: string[] = ['FREE', 'STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'];

export type PlanCode = (typeof PLAN_ORDER)[number];

/** PPN Indonesia 11% */
export const PPN_RATE = 0.11;

// ─── Route → Feature Mapping ─────────────────────────────
// Ditempatkan di file tanpa dependensi server agar middleware Edge bundle tetap ringan.
export const ROUTE_FEATURE_MAP: Record<string, string> = {
  '/control-tower': 'control_tower',
  '/dispatch': 'dispatch',
  '/reports': 'reports',
  '/analytics': 'reports',
  '/sla': 'sla',
  '/exceptions': 'sla',
  '/integrations': 'integrations',
  '/map': 'gps_tracking',
  '/warehouses': 'warehouse_management',
  '/geofences': 'geofencing',
  '/organizations': 'branch_management',
  '/regions': 'branch_management',
  '/branches': 'branch_management',
  '/departments': 'branch_management',
  '/hubs': 'branch_management',
};
