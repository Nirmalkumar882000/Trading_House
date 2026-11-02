import { describe, it, expect } from 'vitest';
import { MODULES, type Row } from '@/lib/modules';
import { finalInvoiceWithReturns, invoiceReturnSummary } from '@/lib/workflow';

const deliveries: Row[] = [
  { id: 'DLV-1', status: 'QC issue', dc: 'SDC-7', item: JSON.stringify([{ p: 'Tomato', q: 100, rejectKg: 5 }, { p: 'Onion', q: 50, rejectKg: 0 }]) },
  { id: 'DLV-2', status: 'Signed', dc: 'SDC-8', item: JSON.stringify([{ p: 'Tomato', q: 10, rejectKg: 10 }]) },
];
const draft: Row = { id: 'INV-7', status: 'Draft', dc: 'SDC-7', gst: '0', paid: 0, rate: 0, item: JSON.stringify([{ p: 'Tomato', q: 100, saleRate: 40 }, { p: 'Onion', q: 50, saleRate: 30 }]) };

describe('Sales invoice buyer returns', () => {
  it('loads the invoices module with return columns', () => {
    const fields = MODULES.find(m => m.slug === 'invoices')?.fields.map(f => f.key) ?? [];
    expect(fields).toEqual(expect.arrayContaining(['returnKg', 'payable']));
  });

  it('deducts delivery reject KG for the same Sales DC from the buyer amount', () => {
    const summary = invoiceReturnSummary(draft, deliveries);
    expect(summary.returnKg).toBe(5);
    expect(summary.gross).toBe(5500);
    expect(summary.returnValue).toBe(200);
    expect(summary.total).toBe(5300);
    expect(summary.lines[0]).toMatchObject({ sentKg: 100, returnKg: 5, billedKg: 95, amount: 3800 });
  });

  it('can preview without the deduction', () => {
    expect(invoiceReturnSummary(draft, deliveries, false).total).toBe(5500);
  });

  it('creates the final invoice once, without deducting returns twice', () => {
    const issued = finalInvoiceWithReturns(draft, deliveries);
    expect(issued.status).toBe('Issued');
    expect(issued['total']).toBe(5300);
    expect(issued['returnKg']).toBe(5);
    const again = invoiceReturnSummary(issued, deliveries);
    expect(again.applied).toBe(true);
    expect(again.total).toBe(5300);
    expect(again.lines[0]).toMatchObject({ sentKg: 100, returnKg: 5, billedKg: 95 });
  });

  it('keeps payment status when applying returns to a part-paid invoice', () => {
    expect(finalInvoiceWithReturns({ ...draft, status: 'Part paid', paid: 1000 }, deliveries).status).toBe('Part paid');
    expect(finalInvoiceWithReturns({ ...draft, status: 'Part paid', paid: 5300 }, deliveries).status).toBe('Paid');
  });
});

describe('Return DCs raised directly against a sales order', () => {
  const invoice: Row = { id: 'INV-9', status: 'Issued', so: 'SO-9', dc: '', gst: '0', paid: 0, rate: 0, item: JSON.stringify([{ p: 'Cabbage', q: 400, saleRate: 20 }, { p: 'Beetroot', q: 150, saleRate: 20 }]) };
  const returns: Row[] = [{ id: 'RDC-9', status: 'Return DC created', sale: 'SO-9', item: JSON.stringify([{ p: 'Cabbage', q: 3 }, { p: 'Beetroot', q: 5 }]) }];

  it('deducts the returned KG and its value from the invoice even without a Sales DC', () => {
    const summary = invoiceReturnSummary(invoice, [], true, returns);
    expect(summary.returnKg).toBe(8);
    expect(summary.gross).toBe(11000);
    expect(summary.total).toBe(11000 - 8 * 20);
    expect(finalInvoiceWithReturns(invoice, [], returns)['total']).toBe(10840);
  });

  it('does not double count a Return DC generated from a delivery on the same Sales DC', () => {
    const fromDelivery: Row[] = [{ id: 'RDC-7', status: 'Return DC created', sale: 'SO-7', delivery: 'DLV-1', item: JSON.stringify([{ p: 'Tomato', q: 5 }]) }];
    expect(invoiceReturnSummary({ ...draft, so: 'SO-7' }, deliveries, true, fromDelivery).returnKg).toBe(5);
  });
});
