// src/lib/plan-constants.ts
// Konstanta plan & pajak — sumber tunggal tanpa dependensi server (aman untuk client components).

export const PLAN_ORDER: string[] = ['FREE', 'STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'];

export type PlanCode = (typeof PLAN_ORDER)[number];

/** PPN Indonesia 11% */
export const PPN_RATE = 0.11;
