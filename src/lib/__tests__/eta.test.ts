import { describe, it, expect, vi, afterEach } from 'vitest';
import { haversineKm, slaDeadlineFor, getSLA, dynamicETA, formatRemaining } from '../eta';

describe('haversineKm', () => {
  it('jarak nol untuk koordinat sama', () => {
    expect(haversineKm(-6.2, 106.816, -6.2, 106.816)).toBeCloseTo(0, 5);
  });

  it('jarak Jakarta (Monas) ke Bandung sekitar 118-120 km', () => {
    const d = haversineKm(-6.1751, 106.8272, -6.9175, 107.6191);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(130);
  });

  it('simetris (a->b == b->a)', () => {
    const ab = haversineKm(-6.2, 106.8, -7.2, 112.7);
    const ba = haversineKm(-7.2, 112.7, -6.2, 106.8);
    expect(ab).toBeCloseTo(ba, 5);
  });
});

describe('slaDeadlineFor', () => {
  const base = new Date('2026-08-14T09:00:00Z');

  it('SAME_DAY menambah 12 jam', () => {
    expect(slaDeadlineFor('SAME_DAY', base)).toEqual(new Date('2026-08-14T21:00:00Z'));
  });

  it('NEXT_DAY menambah 24 jam', () => {
    expect(slaDeadlineFor('NEXT_DAY', base)).toEqual(new Date('2026-08-15T09:00:00Z'));
  });

  it('REGULAR menambah 96 jam', () => {
    expect(slaDeadlineFor('REGULAR', base)).toEqual(new Date('2026-08-18T09:00:00Z'));
  });

  it('service type tak dikenal memakai default 96 jam', () => {
    expect(slaDeadlineFor('UNKNOWN', base)).toEqual(new Date('2026-08-18T09:00:00Z'));
  });
});

describe('getSLA', () => {
  afterEach(() => vi.useRealTimers());

  it('tanpa deadline -> NONE', () => {
    expect(getSLA('IN_TRANSIT', null).type).toBe('NONE');
  });

  it('DELIVERED/RETURNED -> DONE', () => {
    const d = new Date();
    expect(getSLA('DELIVERED', d).type).toBe('DONE');
    expect(getSLA('RETURNED', d).type).toBe('DONE');
  });

  it('deadline lewat -> BREACHED', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'));
    const result = getSLA('IN_TRANSIT', new Date('2026-08-14T09:00:00Z'));
    expect(result.type).toBe('BREACHED');
    expect(result.remainingMs).toBeLessThan(0);
  });

  it('> 80% waktu terpakai -> AT_RISK', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T19:00:00Z'));
    // SAME_DAY SLA 12 jam: deadline 20:00, sekarang 19:00 → 11/12 jam terpakai (91%)
    const result = getSLA('IN_TRANSIT', new Date('2026-08-14T20:00:00Z'), 'SAME_DAY');
    expect(result.type).toBe('AT_RISK');
    expect(result.remainingMs).toBeGreaterThan(0);
  });

  it('waktu masih longgar -> ON_TIME', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T09:00:00Z'));
    const result = getSLA('IN_TRANSIT', new Date('2026-08-14T21:00:00Z'), 'SAME_DAY');
    expect(result.type).toBe('ON_TIME');
  });
});

describe('formatRemaining', () => {
  it('ms <= 0 -> Terlambat', () => {
    expect(formatRemaining(0)).toBe('Terlambat');
    expect(formatRemaining(-5)).toBe('Terlambat');
  });

  it('kurang dari 1 jam -> menit saja', () => {
    expect(formatRemaining(45 * 60000)).toBe('45 mnt');
  });

  it('>= 1 jam -> jam + menit', () => {
    expect(formatRemaining(2 * 3600000 + 5 * 60000)).toBe('2 jam 5 mnt');
  });
});

describe('dynamicETA', () => {
  it('menghasilkan tanggal di masa depan berdasarkan jarak & pemberhentian', () => {
    const before = Date.now();
    const eta = dynamicETA({ distanceKm: 100, avgSpeedKmh: 50, stops: 2 });
    expect(eta.getTime()).toBeGreaterThan(before + 2 * 60 * 60 * 1000);
    expect(eta.getTime()).toBeLessThanOrEqual(before + 10 * 60 * 60 * 1000);
  });
});
