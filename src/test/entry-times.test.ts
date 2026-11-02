import { describe, it, expect } from 'vitest';
import { MODULES, seedRows, withEntryTimes } from '@/lib/modules';

describe('record entry times', () => {
  it('gives dated demo rows an entry time on their business date', () => {
    const rows = seedRows(MODULES.find(m => m.slug === 'purchase-orders')!);
    for (const r of rows) {
      const at = new Date(String(r['createdAt']));
      expect(Number.isNaN(at.getTime())).toBe(false);
      const [y, m, d] = String(r['date']).split('-').map(Number);
      expect([at.getFullYear(), at.getMonth() + 1, at.getDate()]).toEqual([y, m, d]);
      expect(at.getHours()).toBeGreaterThanOrEqual(9);
    }
  });

  it('fills missing entry times in saved data without touching existing ones', () => {
    const out = withEntryTimes({ 'purchase-orders': [
      { id: 'PO-1', status: 'Received', date: '2026-10-22' },
      { id: 'PO-2', status: 'Received', date: '2026-10-22', createdAt: '2026-11-02T05:00:00.000Z' },
      { id: 'PO-3', status: 'Received' },
    ] });
    const [a, b, c] = out['purchase-orders']!;
    expect(a!['createdAt']).toBeTruthy();
    expect(b!['createdAt']).toBe('2026-11-02T05:00:00.000Z');
    expect(c!['createdAt']).toBeUndefined();
  });
});
