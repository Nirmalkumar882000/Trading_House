import { describe, it, expect } from 'vitest';
import { MODULES, seedRows, type Row } from '@/lib/modules';
import { availableStock, directGradeBSale, gradeBBookingError, gradeBCommitted, gradeBFree, gradeBQueue, gradeBWaiting, normalize, type Data } from '@/lib/workflow';

const demo = (): Data => Object.fromEntries(MODULES.map(m => [m.slug, seedRows(m)]));
const order = (id: string, q: number, bookedAt: string, status = 'Received'): Row =>
  normalize('purchase-orders', { id, status, date: '2026-11-02', bookedAt, buyer: 'Green Basket Stores', grade: 'Grade B', item: JSON.stringify([{ p: 'Tomato', q }]), qty: q });

describe('Grade B booking queue (first come, first served)', () => {
  it('serves earlier bookings first and lets later orders wait instead of being blocked', () => {
    const d = demo();
    const free = gradeBFree(d, 'Tomato');
    expect(free).toBe(Math.max(0, availableStock(d, 'Grade B', 'Tomato') - gradeBCommitted(d, 'Tomato')));
    const first = order('PO-9401', 1, '2026-11-02T09:00:00.000Z');
    const second = order('PO-9402', 50, '2026-11-02T10:00:00.000Z');
    d['purchase-orders'] = [...(d['purchase-orders'] || []), first, second];
    // Buyer orders are never blocked; the late one just waits for the KG not yet free.
    expect(gradeBBookingError(d, 'purchase-orders', second)).toBeNull();
    expect(gradeBWaiting(d, first)).toEqual([]);
    expect(gradeBWaiting(d, second)).toEqual([{ p: 'Tomato', allocated: free - 1, waiting: 50 - (free - 1) }]);
    const queue = gradeBQueue(d, 'Tomato').map(b => b.ref);
    expect(queue.indexOf('PO-9401')).toBeLessThan(queue.indexOf('PO-9402'));
  });

  it('an earlier booking keeps priority even if it was entered later in the list', () => {
    const d = demo();
    const free = gradeBFree(d, 'Tomato');
    const late = order('PO-9501', free, '2026-11-02T11:00:00.000Z');
    const early = order('PO-9502', free, '2026-11-02T08:00:00.000Z');
    d['purchase-orders'] = [...(d['purchase-orders'] || []), late, early];
    expect(gradeBWaiting(d, early)).toEqual([]);
    expect(gradeBWaiting(d, late)[0]?.waiting).toBe(free);
  });

  it('caps a sale to the order allocation and keeps sales from double-selling', () => {
    const d = demo();
    const free = gradeBFree(d, 'Tomato');
    const po = order('PO-9403', free + 5, '2026-11-02T09:00:00.000Z', 'Accepted');
    d['purchase-orders'] = [...(d['purchase-orders'] || []), po];
    const sale = directGradeBSale(po, d, 'SO-9403');
    expect(JSON.parse(String(sale['item']))[0].q).toBe(free);
    expect(gradeBBookingError(d, 'sales-orders', sale)).toBeNull();
    const tooMuch = normalize('sales-orders', { ...sale, item: JSON.stringify([{ p: 'Tomato', q: free + 1, saleRate: 20 }]) });
    expect(gradeBBookingError(d, 'sales-orders', tooMuch)).toMatch(/only .* kg Grade B is free/);
    // After the partial sale the order still waits for the rest, without double counting the sold part.
    d['sales-orders'] = [...(d['sales-orders'] || []), sale];
    expect(gradeBWaiting(d, po)).toEqual([{ p: 'Tomato', allocated: 0, waiting: 5 }]);
  });
});
