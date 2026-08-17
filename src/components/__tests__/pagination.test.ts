import { describe, it, expect } from 'vitest';

const PAGE_SIZE = 20;

function totalPages(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

describe('pagination logic', () => {
  it('0 items -> 1 page', () => {
    expect(totalPages(0)).toBe(1);
  });

  it('20 items -> 1 page', () => {
    expect(totalPages(20)).toBe(1);
  });

  it('21 items -> 2 pages', () => {
    expect(totalPages(21)).toBe(2);
  });

  it('100 items -> 5 pages', () => {
    expect(totalPages(100)).toBe(5);
  });

  it('page bounds: skip/take calculation', () => {
    const page = 3;
    const skip = (page - 1) * PAGE_SIZE;
    expect(skip).toBe(40);
  });

  it('pageSize clamped to 100 max', () => {
    const input = 200;
    const clamped = Math.min(100, Math.max(1, input));
    expect(clamped).toBe(100);
  });

  it('pageSize clamped to 1 min', () => {
    const input = -5;
    const clamped = Math.min(100, Math.max(1, input));
    expect(clamped).toBe(1);
  });
});
