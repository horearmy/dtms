'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/**
 * Proxy lazy-loading untuk recharts.
 * Semua komponen di-split dari bundle awal halaman dan hanya dimuat
 * saat halaman yang memakainya dirender (client-side).
 */

const ChartLoading = () => (
  <div className="h-full w-full min-h-[120px] animate-pulse rounded-lg bg-[#F2F4F7]" />
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

const lazyChart = (name: string): AnyComponent =>
  dynamic(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async () => ({ default: (await import('recharts') as any)[name] as AnyComponent }),
    { ssr: false, loading: ChartLoading },
  );

export const AreaChart = lazyChart('AreaChart');
export const Area = lazyChart('Area');
export const BarChart = lazyChart('BarChart');
export const Bar = lazyChart('Bar');
export const LineChart = lazyChart('LineChart');
export const Line = lazyChart('Line');
export const PieChart = lazyChart('PieChart');
export const Pie = lazyChart('Pie');
export const Cell = lazyChart('Cell');
export const XAxis = lazyChart('XAxis');
export const YAxis = lazyChart('YAxis');
export const CartesianGrid = lazyChart('CartesianGrid');
export const Tooltip = lazyChart('Tooltip');
export const ResponsiveContainer = lazyChart('ResponsiveContainer');
export const Legend = lazyChart('Legend');
export const ReferenceDot = lazyChart('ReferenceDot');
