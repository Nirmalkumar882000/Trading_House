import { describe, expect, it } from 'vitest';
import { returnReceiptLines } from '@/components/WarehouseReceiptDialog';

describe('buyer return GRN container counts', () => {
  it('uses the Return DC returned boxes, not the containerCount copied from packing', () => {
    const record = {
      id: 'RDC-1001',
      status: 'Return DC created',
      item: JSON.stringify([
        { p: 'Cabbage', q: 3, containerType: 'Plastic crates', containerCount: 1, box: 2 },
        { p: 'Beetroot', q: 5, containerType: 'Plastic crates', containerCount: 1, box: 3 },
      ]),
    };
    const ls = returnReceiptLines(record);
    expect(ls.map((l) => l.containerCount)).toEqual([2, 3]);
    expect(ls.reduce((s, l) => s + l.containerCount, 0)).toBe(5);
  });
});
