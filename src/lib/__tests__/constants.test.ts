import { describe, it, expect } from 'vitest';
import {
  ON_ROAD_STATUSES,
  ACTIVE_STATUSES,
  NEXT_STATUS,
  formatDateTime,
  formatDate,
  formatNumber,
  coordForCity,
  generateTrackingNumber,
  SLA_HOURS,
} from '../constants';

describe('status lists', () => {
  it('ON_ROAD_STATUSES berisi 5 status perjalanan', () => {
    expect(ON_ROAD_STATUSES).toEqual([
      'DISPATCHED',
      'IN_TRANSIT',
      'ARRIVED_AT_HUB',
      'OUT_FOR_DELIVERY',
      'DELIVERY_FAILED',
    ]);
  });

  it('ACTIVE_STATUSES lebih luas dari ON_ROAD (termasuk order & warehouse)', () => {
    for (const s of ON_ROAD_STATUSES) {
      if (s === 'DELIVERY_FAILED') continue; // gagal = bukan "tugas aktif"
      expect(ACTIVE_STATUSES).toContain(s);
    }
    expect(ACTIVE_STATUSES).toContain('ORDER_CREATED');
    expect(ACTIVE_STATUSES).toContain('WAREHOUSE_RECEIVED');
    expect(ACTIVE_STATUSES).toContain('RESCHEDULED');
  });

  it('DELIVERY_FAILED di ON_ROAD tapi tidak di ACTIVE', () => {
    expect(ON_ROAD_STATUSES).toContain('DELIVERY_FAILED');
    expect(ACTIVE_STATUSES).not.toContain('DELIVERY_FAILED');
  });
});

describe('NEXT_STATUS', () => {
  it('alur standar berurutan', () => {
    expect(NEXT_STATUS.ORDER_CREATED).toBe('WAREHOUSE_RECEIVED');
    expect(NEXT_STATUS.WAREHOUSE_RECEIVED).toBe('DISPATCHED');
    expect(NEXT_STATUS.DISPATCHED).toBe('IN_TRANSIT');
    expect(NEXT_STATUS.IN_TRANSIT).toBe('ARRIVED_AT_HUB');
    expect(NEXT_STATUS.ARRIVED_AT_HUB).toBe('OUT_FOR_DELIVERY');
    expect(NEXT_STATUS.OUT_FOR_DELIVERY).toBe('DELIVERED');
    expect(NEXT_STATUS.RESCHEDULED).toBe('OUT_FOR_DELIVERY');
    expect(NEXT_STATUS.RETURN_TO_SENDER).toBe('RETURNED');
  });
});

describe('formatDateTime / formatDate', () => {
  it('null/undefined -> "-"', () => {
    expect(formatDateTime(null)).toBe('-');
    expect(formatDateTime(undefined)).toBe('-');
    expect(formatDate(null)).toBe('-');
  });

  it('memformat datetime dalam locale id-ID', () => {
    const d = new Date('2026-08-14T09:05:00');
    expect(formatDateTime(d)).toContain('14 Agu 2026');
    expect(formatDateTime(d)).toContain('09.05');
  });

  it('memformat tanggal id-ID', () => {
    const d = new Date('2026-08-14T09:05:00');
    expect(formatDate(d)).toBe('14 Agu 2026');
  });
});

describe('formatNumber', () => {
  it('null -> "0"', () => {
    expect(formatNumber(null)).toBe('0');
    expect(formatNumber(undefined)).toBe('0');
  });

  it('memakai pemisah ribuan id-ID', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
  });
});

describe('coordForCity', () => {
  it('mengenali kota dengan case & spasi berbeda', () => {
    expect(coordForCity('JAKARTA')).toEqual({ lat: -6.2088, lng: 106.8456 });
    expect(coordForCity('Jakarta Selatan')).toEqual({ lat: -6.2615, lng: 106.8104 });
    expect(coordForCity('bandung')).toEqual({ lat: -6.9175, lng: 107.6191 });
  });

  it('null / kota tak dikenal -> null', () => {
    expect(coordForCity(null)).toBeNull();
    expect(coordForCity('Mars')).toBeNull();
  });
});

describe('generateTrackingNumber', () => {
  it('format DTMS-YYYYMMDD-6digit', () => {
    const tn = generateTrackingNumber();
    expect(tn).toMatch(/^DTMS-\d{8}-\d{6}$/);
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    expect(tn.startsWith(`DTMS-${ymd}-`)).toBe(true);
  });

  it('menghasilkan nomor unik berurutan', () => {
    const set = new Set(Array.from({ length: 50 }, () => generateTrackingNumber()));
    expect(set.size).toBe(50);
  });
});

describe('SLA_HOURS', () => {
  it('mendefinisikan SLA untuk 3 tipe layanan', () => {
    expect(SLA_HOURS.SAME_DAY).toBe(12);
    expect(SLA_HOURS.NEXT_DAY).toBe(24);
    expect(SLA_HOURS.REGULAR).toBe(96);
  });
});
