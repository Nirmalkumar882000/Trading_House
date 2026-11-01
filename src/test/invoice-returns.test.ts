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
