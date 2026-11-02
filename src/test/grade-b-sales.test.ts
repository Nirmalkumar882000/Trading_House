import { describe, it, expect } from 'vitest';
import { MODULES, seedRows, type Row } from '@/lib/modules';
import { availableStock, directGradeBSale, gradeBFree, gradeBReserved, marketTripDemand, normalize, populate, stock, validateData, type Data } from '@/lib/workflow';
import { outstandingDemand } from '@/lib/sourcing';

const demo = (): Data => Object.fromEntries(MODULES.map(m => [m.slug, seedRows(m)]));
const gradeBOrder: Row = normalize('purchase-orders', { id: 'PO-9301', status: 'Accepted', date: '2026-10-25', buyer: 'Annapoorna Caterers', grade: 'Grade B', item: JSON.stringify([{ p: 'Tomato', q: 30 }, { p: 'Onion', q: 5 }]), qty: 35 });
const withOrder = (): Data => { const d = demo(); d['purchase-orders'] = [...(d['purchase-orders'] || []), gradeBOrder]; return d; };

describe('Grade B buyer orders', () => {
  it('defaults buyer orders to Grade A and exposes the grade field', () => {
    expect(MODULES.find(m => m.slug === 'purchase-orders')?.fields.some(f => f.key === 'grade')).toBe(true);
    expect(normalize('purchase-orders', { id: 'PO-1', status: 'Received' })['grade']).toBe('Grade A');
  });

  it('caps a direct sale to free Grade B inventory (first come, first served) without packing', () => {
    const d = withOrder();
    const gradeBTomato = availableStock(d, 'Grade B', 'Tomato');
    expect(gradeBTomato).toBeGreaterThan(0);
    const sale = directGradeBSale(gradeBOrder, d, 'SO-9301');
    expect(sale['grade']).toBe('Grade B');
    expect(sale['buyer']).toBe('Annapoorna Caterers');
    const tomato = JSON.parse(String(sale['item'])).find((l: { p: string }) => l.p === 'Tomato');
    // PO-9301 (25 Oct) is booked before open order PO-1010 (26 Oct), so it is served first from the whole stock.
    expect(tomato.q).toBe(Math.min(30, gradeBFree(d, 'Tomato', { po: 'PO-9301' })));
    expect(tomato.q).toBe(gradeBTomato);
  });

  it('deducts Grade B stock (not packed stock) when the sale is dispatched', () => {
    const d = withOrder();
    const before = availableStock(d, 'Grade B', 'Onion');
    const packedBefore = stock(d).find(s => s.category === 'Packed' && s.product === 'Onion')?.qty || 0;
    const sale = normalize('sales-orders', { ...directGradeBSale(gradeBOrder, d, 'SO-9301'), item: JSON.stringify([{ p: 'Onion', q: 5, saleRate: 20 }]), status: 'Dispatched' });
    d['sales-orders'] = [...(d['sales-orders'] || []), sale];
    expect(validateData(d)).toBeNull();
    expect(availableStock(d, 'Grade B', 'Onion')).toBe(before - 5);
    expect(stock(d).find(s => s.category === 'Packed' && s.product === 'Onion')?.qty || 0).toBe(packedBefore);
  });

  it('rejects selling more Grade B than is in inventory', () => {
    const d = withOrder();
    const sale = normalize('sales-orders', { ...directGradeBSale(gradeBOrder, d, 'SO-9301'), item: JSON.stringify([{ p: 'Tomato', q: 30, saleRate: 20 }]), status: 'Dispatched' });
    d['sales-orders'] = [...(d['sales-orders'] || []), sale];
    expect(validateData(d)).toMatch(/insufficient Grade B stock/);
  });

  it('blocks packing a Grade B order', () => {
    const d = withOrder();
    const pack = populate('packing', 'po', 'PO-9301', { id: 'PK-9301', status: 'Allocated', grade: 'Grade B', packer: 'Senthil P', packSize: 1 } as Row, d);
    d['packing'] = [...(d['packing'] || []), { ...pack, item: JSON.stringify([{ p: 'Onion', q: 1 }]) }];
    expect(validateData(d)).toMatch(/Grade B order/);
  });
});

describe('Grade B across the B → I stages', () => {
  it('keeps Grade B orders out of market purchase demand', () => {
    const tomatoDemand = (d: Data) => outstandingDemand(d).find(r => r.product === 'Tomato')?.demand || 0;
    expect(tomatoDemand(withOrder())).toBe(tomatoDemand(demo()));
    const trip: Row = { id: 'TRP-9', status: 'Loading', item: JSON.stringify([{ p: 'Tomato', q: 1 }]) };
    expect(marketTripDemand(trip, withOrder()['purchase-orders'] || [])).toBe(marketTripDemand(trip, demo()['purchase-orders'] || []));
  });

  it('defaults sales orders to Grade A and tags a sale from a Grade B order as Grade B', () => {
    expect(normalize('sales-orders', { id: 'SO-1', status: 'Open' })['grade']).toBe('Grade A');
    const d = withOrder();
    const fromB = populate('sales-orders', 'po', 'PO-9301', { id: 'SO-9302', status: 'Open', buyer: 'Annapoorna Caterers', grade: 'Grade B' } as Row, d);
    expect(fromB['grade']).toBe('Grade B');
    const fromA = populate('sales-orders', 'po', 'PO-1001', { id: 'SO-9303', status: 'Open', buyer: 'FreshMart Retail' } as Row, d);
    expect(fromA['grade']).toBe('Grade A');
  });

  it('reports Grade B reserved for confirmed (not yet dispatched) Grade B sales', () => {
    const d = withOrder();
    const before = gradeBReserved(d);
    d['sales-orders'] = [...(d['sales-orders'] || []), normalize('sales-orders', { ...directGradeBSale(gradeBOrder, d, 'SO-9301'), item: JSON.stringify([{ p: 'Onion', q: 4, saleRate: 20 }]), status: 'Confirmed' })];
    expect(gradeBReserved(d)).toBe(before + 4);
    expect(gradeBReserved(d, 'Onion')).toBe(4);
    expect(gradeBReserved(d, 'Tomato')).toBe(0);
  });
});

describe('Grade B demo data', () => {
  it('seeds a consistent Grade B flow from buyer order to invoice', () => {
    const d = demo();
    expect(validateData(d)).toBeNull();
    const byId = (slug: string, id: string) => (d[slug] || []).find(r => r.id === id);
    expect(byId('purchase-orders', 'PO-1008')?.['grade']).toBe('Grade B');
    expect(byId('purchase-orders', 'PO-1010')?.status).toBe('Accepted');
    expect(byId('sales-orders', 'SO-1005')).toMatchObject({ grade: 'Grade B', po: 'PO-1008', status: 'Dispatched' });
    expect(byId('dispatch', 'SDC-1005')?.['so']).toBe('SO-1005');
    expect(byId('deliveries', 'DLV-1003')).toMatchObject({ dc: 'SDC-1005', returnRef: 'RDC-1003' });
    expect(byId('returns', 'RDC-1003')?.['delivery']).toBe('DLV-1003');
    expect(byId('invoices', 'INV-1003')).toMatchObject({ so: 'SO-1005', status: 'Draft' });
    // Main warehouse Grade B: 20 kg tomato graded − 8 kg sold; 1 kg reject has not physically returned yet.
    expect(availableStock(d, 'Grade B', 'Tomato')).toBe(12);
    expect(gradeBReserved(d)).toBe(4);
    // The open Grade B order PO-1010 can still be sold from stock.
    const next = directGradeBSale(byId('purchase-orders', 'PO-1010') as Row, d, 'SO-9999');
    expect(JSON.parse(String(next['item']))).toEqual(expect.arrayContaining([expect.objectContaining({ p: 'Tomato', q: 10 })]));
  });
});
