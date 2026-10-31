import type { Row } from './modules';
import { WAREHOUSES, DEFAULT_WAREHOUSE } from './modules';
export type Data = Record<string, Row[]>;
export type ProductLine = { p: string; q: number; a?: number; a2?: number; b?: number; ret?: number; r?: number; saleRate?: number; sellingPrice?: number; packKg?: number; packLabel?: string; containerType?: string; containerCount?: number; extraKg?: number; reason?: string; sentQ?: number; grader?: string; lineTag?: string; startTime?: string; box?: number; rejectKg?: number; rejectBox?: number; sentBox?: number };
export const num = (v: unknown) => Number(v) || 0;
export const round = (v: number) => Math.round(v * 1000) / 1000;
export function parseLines(v: unknown): ProductLine[] {
  if (!v) return [];
  try {
    const parsed: unknown = JSON.parse(String(v));
    if (Array.isArray(parsed)) {
      return parsed.map(l => ({
        ...l,
        p: String(l.p),
        q: num(l.q),
        ...(l.r !== undefined ? { r: num(l.r) } : {}),
        ...(l.saleRate !== undefined ? { saleRate: num(l.saleRate) } : {}),
        ...(l.sellingPrice !== undefined ? { sellingPrice: num(l.sellingPrice) } : {}),
        ...(l.packKg !== undefined ? { packKg: num(l.packKg) } : {}),
        ...(l.packLabel !== undefined ? { packLabel: String(l.packLabel) } : {}),
        ...(l.containerType !== undefined ? { containerType: String(l.containerType) } : {}),
        ...(l.containerCount !== undefined ? { containerCount: num(l.containerCount) } : {}),
        ...(l.extraKg !== undefined ? { extraKg: num(l.extraKg) } : {}),
        ...(l.reason !== undefined ? { reason: String(l.reason) } : {}),
        ...(l.sentQ !== undefined ? { sentQ: num(l.sentQ) } : {}),
        ...(l.grader !== undefined ? { grader: String(l.grader) } : {}),
        ...(l.lineTag !== undefined ? { lineTag: String(l.lineTag) } : {}),
        ...(l.startTime !== undefined ? { startTime: String(l.startTime) } : {}),
        ...(l.box !== undefined ? { box: num(l.box) } : {}),
        ...(l.rejectKg !== undefined ? { rejectKg: num(l.rejectKg) } : {}),
        ...(l.rejectBox !== undefined ? { rejectBox: num(l.rejectBox) } : {}),
        ...(l.sentBox !== undefined ? { sentBox: num(l.sentBox) } : {}),
      }));
    }
  } catch { /* legacy product names */ }
  return String(v).split(',').filter(Boolean).map(p => ({ p: p.trim(), q: 0 }));
}
export function marketTripDemand(trip: Row, purchaseOrders: Row[]): number {
  const tripProducts = new Set(parseLines(trip['item']).map(line => line.p));
  if (!tripProducts.size) return 0;

  const demandByProduct = new Map<string, number>();
  for (const po of purchaseOrders) {
    if (po.status === 'Rejected') continue;
    const orderLines = parseLines(po['item']);
    const totalBase = orderLines.reduce((sum, line) => sum + num(line.q), 0);
    const extraKg = num(po['extraKg']);

    for (const line of orderLines) {
      const base = num(line.q) || (orderLines.length === 1 ? num(po['qty']) : totalBase ? 0 : Math.round(num(po['qty']) / orderLines.length));
      const extra = line.extraKg !== undefined
        ? num(line.extraKg)
        : orderLines.length === 1 && extraKg > 0
          ? extraKg
          : 0;
      demandByProduct.set(line.p, round((demandByProduct.get(line.p) || 0) + base + extra));
    }
  }

  return round([...tripProducts].reduce((sum, product) => sum + (demandByProduct.get(product) || 0), 0));
}
export function receiptBelongsToBuyer(
  receipt: Row,
  buyerName: string,
  trips: Row[],
  purchaseOrders: Row[],
): boolean {
  const receiptTripRef = String(receipt['dc'] || '');
  const trip = trips.find(item => item.id === receiptTripRef || item['dc'] === receiptTripRef);
  const poRef = String(trip?.['po'] || receipt['po'] || '');
  const purchaseOrder = purchaseOrders.find(order => order.id === poRef);
  return String(purchaseOrder?.['buyer'] || '') === buyerName;
}
export function lines(r: Row, fallback = 'qty') { const ls = parseLines(r['item']); return ls.map(l => ({ ...l, q: l.q || (ls.length === 1 ? num(r[fallback]) : 0) })); }
export const total = (ls: ProductLine[]) => round(ls.reduce((s,l) => s + l.q, 0));
export const locations = { Ungraded: 'Receiving bay', 'Grade A': 'A · Fresh room', Remaining: 'QC holding bay', 'Grade B': 'B · Secondary room', Rejected: 'Reject isolation', Quarantine: 'Returns inspection bay', Allocated: 'Allocation bay', Packed: 'Dispatch bay' };
export type Category = keyof typeof locations;
export type Movement = { id: string; ref: string; purchase: string; product: string; source: string; destination: string; qty: number; date: string; person: string; warehouse: string };
export type WarehouseFlowRow = {
  id: string;
  flowType?: 'Dispatch' | 'Buyer return pickup' | 'Buyer return quarantine';
  reference: string;
  sourceReference: string;
  product: string;
  party: string;
  qty: number;
  status: string;
  date: string;
  warehouse: string;
  reason?: string;
  products?: ProductLine[];
  deliveryLocation?: string;
  transporter?: string;
  vehicle?: string;
  driver?: string;
};
export function warehouseFlowRows(data: Data, direction: 'Inward' | 'Outward', warehouse = 'All'): WarehouseFlowRow[] {
  if (direction === 'Inward') {
    const trips = data['trips'] || [];
    return [
      ...(data['receipts'] || []).flatMap(receipt => {
        const trip = trips.find(entry => entry.id === receipt['dc']);
        const location = String(receipt['warehouse'] || trip?.['warehouse'] || DEFAULT_WAREHOUSE);
        if (warehouse !== 'All' && location !== warehouse) return [];
        return lines(receipt, 'received').map(line => ({
          id: `${receipt.id}-${line.p}`,
          reference: receipt.id,
          sourceReference: String(trip?.['dc'] || receipt['dc'] || '—'),
          product: line.p,
          party: String(receipt['supplier'] || trip?.['supplier'] || 'Market supplier'),
          qty: line.q,
          status: String(receipt.status || '—'),
          date: String(receipt['date'] || ''),
          warehouse: location,
        }));
      }),
      ...(data['returns'] || [])
        .filter(record => ['Received', 'Sent to QC'].includes(record.status))
        .flatMap(record => {
          const location = String(record['warehouse'] || DEFAULT_WAREHOUSE);
          if (warehouse !== 'All' && location !== warehouse) return [];
          return lines(record).map(line => ({
            id: `${record.id}-${line.p}`,
            flowType: 'Buyer return quarantine' as const,
            reference: record.id,
            sourceReference: String(record['salesDc'] || record['sale'] || '—'),
            product: line.p,
            party: String(record['buyer'] || 'Buyer return'),
            qty: line.q,
            status: record.status,
            date: String(record['date'] || ''),
            warehouse: location,
            reason: String(record['reason'] || ''),
          }));
        }),
    ].sort((a, b) => b.date.localeCompare(a.date) || a.reference.localeCompare(b.reference));
  }

  const salesOrders = data['sales-orders'] || [];
  const dispatchRows = (data['dispatch'] || []).flatMap(dispatch => {
    const sale = salesOrders.find(entry => entry.id === dispatch['so']);
    if (!sale || !['Confirmed', 'Dispatched', 'Closed'].includes(sale.status)) return [];
    const location = String(dispatch['warehouse'] || sale['warehouse'] || DEFAULT_WAREHOUSE);
    if (warehouse !== 'All' && location !== warehouse) return [];
    const dispatchLines = lines(dispatch);
    const saleLines = dispatchLines.length > 0 ? dispatchLines : lines(sale);
    return saleLines.map(line => ({
      id: `${dispatch.id}-${line.p}`,
      flowType: 'Dispatch' as const,
      reference: dispatch.id,
      sourceReference: sale.id,
      product: line.p,
      party: String(dispatch['buyer'] || sale['buyer'] || 'Buyer'),
      qty: line.q,
      status: String(dispatch.status || sale.status),
      date: String(dispatch['date'] || sale['date'] || ''),
      warehouse: location,
      products: saleLines,
      deliveryLocation: String(dispatch['toLocation'] || buyerLocation(
        String(dispatch['buyer'] || sale['buyer'] || ''),
        data['buyers'] || [],
      )),
      transporter: String(dispatch['transporter'] || ''),
      vehicle: String(dispatch['vehicle'] || ''),
      driver: String(dispatch['driver'] || ''),
    }));
  });
  const returnPickupRows = (data['returns'] || [])
    .filter(record => ['Requested', 'Return DC created'].includes(record.status))
    .flatMap(record => {
      const location = String(record['warehouse'] || DEFAULT_WAREHOUSE);
      if (warehouse !== 'All' && location !== warehouse) return [];
      return lines(record).map(line => ({
        id: `${record.id}-pickup-${line.p}`,
        flowType: 'Buyer return pickup' as const,
        reference: record.id,
        sourceReference: String(record['salesDc'] || record['sale'] || '—'),
        product: line.p,
        party: String(record['buyer'] || 'Buyer'),
        qty: line.q,
        status: record.status,
        date: String(record['date'] || ''),
        warehouse: location,
        reason: String(record['reason'] || ''),
      }));
    });
  return [...dispatchRows, ...returnPickupRows]
    .sort((a, b) => b.date.localeCompare(a.date) || a.reference.localeCompare(b.reference));
}
export function movements(data: Data): Movement[] {
  const out: Movement[] = [];
  const move = (r: Row, l: ProductLine, source: string, destination: string, q: number, purchase = '', wh = '') => {
    if (q > 0) {
      const warehouse = wh || String(r['warehouse'] || DEFAULT_WAREHOUSE);
      out.push({
        id: `${r.id}-${out.length}`,
        ref: r.id,
        purchase,
        product: l.p,
        source,
        destination,
        qty: round(q),
        date: String(r['date'] || '2026-10-22'),
        person: String(r['responsible'] || r['grader'] || r['packer'] || 'Ravi Kumar'),
        warehouse,
      });
    }
  };
  for (const r of data['receipts'] || []) if (r.status === 'Posted') for (const l of lines(r,'received')) move(r,l,'Market', 'Ungraded', l.q, String(r['dc']), String(r['warehouse'] || DEFAULT_WAREHOUSE));
  for (const r of data['returns'] || []) if (['Received','Sent to QC'].includes(r.status)) for (const l of lines(r)) move(r,l,'Buyer', 'Quarantine',l.q,String(r['sale']), String(r['warehouse'] || DEFAULT_WAREHOUSE));
  for (const r of data['quality-check'] || []) {
    if (r.status === 'Assigned') continue;
    const isReturn = r['sourceType'] === 'Return';
    const qcWh = String(r['warehouse'] || (data[isReturn ? 'returns' : 'receipts'] || []).find(x => x.id === r['lot'])?.['warehouse'] || DEFAULT_WAREHOUSE);
    for (const l of lines(r,'input')) {
      const a = num(l.a); const rem = round(l.q - a); const source = isReturn ? 'Quarantine' : 'Ungraded';
      move(r,l,source,'Grade A',a,String(r['lot']), qcWh); move(r,l,source,'Remaining',rem,String(r['lot']), qcWh);
      if (r.status === 'Stage 2 done') {
        let remainingAvailable = rem;
        let returnedAvailable = isReturn ? 0 : num(l.ret);
        const moveStage2Output = (destination: string, quantity: number) => {
          const fromRemaining = Math.min(remainingAvailable, quantity);
          move(r,l,'Remaining',destination,fromRemaining,String(r['lot']),qcWh);
          remainingAvailable = round(remainingAvailable - fromRemaining);
          const fromQuarantine = Math.min(returnedAvailable, round(quantity - fromRemaining));
          move(r,l,'Quarantine',destination,fromQuarantine,String(r['lot']),qcWh);
          returnedAvailable = round(returnedAvailable - fromQuarantine);
        };
        moveStage2Output('Grade A',num(l.a2));
        moveStage2Output('Grade B',num(l.b));
        moveStage2Output('Rejected',round(rem+num(l.ret)-num(l.a2)-num(l.b)));
      }
    }
  }
  for (const r of data['packing'] || []) {
    const packWh = String(r['warehouse'] || (data['purchase-orders'] || []).find(x => x.id === r['po'])?.['warehouse'] || DEFAULT_WAREHOUSE);
    for (const l of lines(r)) {
      move(r,l,String(r['grade']),'Allocated',l.q,String(r['po']), packWh);
      if (['Packed','In sales stock'].includes(r.status)) move(r,l,'Allocated','Packed',l.q,String(r['po']), packWh);
    }
  }
  for (const r of data['sales-orders'] || []) if (['Dispatched','Closed'].includes(r.status)) {
    const saleWh = String(r['warehouse'] || (data['packing'] || []).find(x => x.id === r['packing'])?.['warehouse'] || DEFAULT_WAREHOUSE);
    for (const l of lines(r)) move(r,l,'Packed','Buyer',l.q,String(r['po']), saleWh);
  }
  return out;
}
export function stock(data: Data, warehouse?: string) {
  const map = new Map<string, { product: string; category: Category; qty: number; location: string; warehouse?: string }>();
  const allMoves = movements(data);
  const moves = warehouse && warehouse !== 'All' ? allMoves.filter(m => m.warehouse === warehouse) : allMoves;
  for (const m of moves) for (const [category,sign] of [[m.source,-1],[m.destination,1]] as const) {
    if (!(category in locations)) continue;
    const c = category as Category; const key = `${m.product}|${c}`;
    const v = map.get(key) || { product:m.product, category:c, qty:0, location:locations[c], warehouse: warehouse || 'All Warehouses' }; v.qty = round(v.qty + sign*m.qty); map.set(key,v);
  }
  return [...map.values()];
}
export type PackLine = { p: string; size: number; bags: number; loose: number };
export function parsePacks(v: unknown): PackLine[] { try { const x: unknown = JSON.parse(String(v || '[]')); return Array.isArray(x) ? x as PackLine[] : []; } catch { return []; } }
export function packsText(packs: PackLine[], ls: ProductLine[]) {
  const out = ls.map(l => {
    const mine = packs.filter(k => k.p === l.p);
    const parts = mine.map(k => k.bags > 0 ? `${k.bags} × ${k.size} kg bags (${round(k.bags*k.size)} kg)` : `${k.loose} kg loose${k.size ? ` (opened ${k.size} kg bag)` : ''}`);
    const nb = mine.reduce((s,k)=>s+k.bags,0);
    return `${l.p}: ${parts.join(' + ') || 'no packed stock'} → ${nb} bags, total ${l.q} kg`;
  });
  const tb = packs.reduce((s,k)=>s+k.bags,0); const tk = total(ls);
  return [...out, `TOTAL: ${tb} bags · ${tk} kg`].join('\n');
}
export function returnsAvailable(data: Data, product: string, excludeId = ''): number {
  const returned = (data['returns'] || []).filter(x=>['Received','Sent to QC'].includes(x.status)).reduce((s,x)=>s+(lines(x).find(l=>l.p===product)?.q || 0),0);
  const qualityChecks = (data['quality-check'] || []).filter(x=>x.id!==excludeId);
  // Sum every line of the product: Stage 1 can split one product into several grader lines.
  const productLines = (x: Row) => lines(x,'input').filter(l=>l.p===product);
  const usedInPurchaseQc = qualityChecks.filter(x=>x['sourceType']!=='Return' && x.status==='Stage 2 done').reduce((s,x)=>s+productLines(x).reduce((t,l)=>t+num(l.ret),0),0);
  const assignedToReturnQc = qualityChecks.filter(x=>x['sourceType']==='Return').reduce((s,x)=>s+productLines(x).reduce((t,l)=>t+l.q,0),0);
  const used = usedInPurchaseQc + assignedToReturnQc;
  return Math.max(0, round(returned - used));
}
export const bagBreakdown = (qty: number, size: number) => ({ full: size > 0 ? Math.floor(qty / size) : 0, partial: size > 0 ? round(qty % size) : qty, opened: size > 0 && round(qty % size) > 0 ? 1 : 0 });
export type Buy = { s: string; p: string; q: number; r: number; ct?: string; cc?: number };
export function parseBuys(v: unknown): Buy[] {
  try { const x: unknown = JSON.parse(String(v || '[]')); if (Array.isArray(x)) return x.map(b => ({ s: String(b.s || ''), p: String(b.p || ''), q: num(b.q), r: num(b.r), ct: String(b.ct || ''), cc: num(b.cc) })); } catch { /* ignore */ }
  return [];
}
export function buysFromTrip(r: Row): Buy[] {
  if (r['buys']) return parseBuys(r['buys']);
  return lines(r, 'net').map(l => ({ s: String(r['supplier'] || ''), p: l.p, q: l.q, r: num(r['rate']) }));
}
export function supplierPricesFromTrips(trips: Row[], savedPrices: Row[]): Row[] {
  const generated: Row[] = [];
  const linkedTripIds = new Set<string>();

  for (const trip of trips) {
    const rawBuys = trip['buys'] ? parseBuys(trip['buys']) : [];
    const buys = rawBuys.length
      ? rawBuys
      : lines(trip, 'net').map(line => ({
        s: String(trip['supplier'] || ''),
        p: line.p,
        q: line.q,
        r: line.r ?? num(trip['rate']),
      }));
    const bySupplier = new Map<string, Buy[]>();
    for (const buy of buys) {
      if (!buy.s || !buy.p || buy.q <= 0) continue;
      const supplierBuys = bySupplier.get(buy.s) || [];
      supplierBuys.push(buy);
      bySupplier.set(buy.s, supplierBuys);
    }

    for (const [supplierIndex, [supplier, supplierBuys]] of [...bySupplier.entries()].entries()) {
      linkedTripIds.add(trip.id);
      const previous = savedPrices.find(price => price['dc'] === trip.id && price['supplier'] === supplier);
      const previousLines = parseLines(previous?.['item']);
      const itemLines = supplierBuys.map(buy => ({
        p: buy.p,
        q: buy.q,
        r: rawBuys.length ? buy.r : previousLines.find(line => line.p === buy.p)?.r ?? buy.r,
        ...(previousLines.find(line => line.p === buy.p)?.sellingPrice !== undefined
          ? { sellingPrice: previousLines.find(line => line.p === buy.p)?.sellingPrice }
          : {}),
      }));
      const qty = total(itemLines);
      const amount = round(itemLines.reduce((sum, line) => sum + line.q * num(line.r), 0));
      const fullyPriced = itemLines.every(line => num(line.r) > 0);
      const confirmedPriceChanged = previous?.status === 'Confirmed' && (
        previousLines.length !== itemLines.length ||
        itemLines.some(line => {
          const previousLine = previousLines.find(existing => existing.p === line.p);
          return !previousLine || num(previousLine.r ?? previous['rate']) !== num(line.r);
        })
      );
      const status = fullyPriced
        ? previous?.status === 'Confirmed' && !confirmedPriceChanged ? 'Confirmed' : 'Priced'
        : 'Awaiting price';

      generated.push(normalize('supplier-prices', {
        ...previous,
        id: previous?.id || `PRC-${trip.id.replace(/[^a-zA-Z0-9]/g, '')}-${supplierIndex + 1}`,
        dc: trip.id,
        date: trip['date'] || previous?.['date'] || '',
        supplier,
        item: JSON.stringify(itemLines),
        qty,
        rate: qty > 0 ? round(amount / qty) : 0,
        amount,
        status,
      }));
    }
  }

  return [...generated, ...savedPrices.filter(price => !linkedTripIds.has(String(price['dc'] || '')))];
}
export function supplierSellingPriceForProduct(product: string, trips: Row[], savedPrices: Row[]): number {
  const matchingPrices = supplierPricesFromTrips(trips, savedPrices)
    .map(price => ({
      date: String(price['date'] || ''),
      id: String(price.id || ''),
      line: parseLines(price['item']).find(item => item.p.toLowerCase() === product.toLowerCase() && num(item.sellingPrice) > 0),
    }))
    .filter((entry): entry is { date: string; id: string; line: ProductLine } => Boolean(entry.line))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return num(matchingPrices[0]?.line?.sellingPrice);
}
/** Sold KG, boxes sent and buyer QC rejects carried on a return line for reference. */
function returnLineContext(sent: ProductLine): ProductLine {
  return { p: sent.p, q: 0, sentQ: sent.q, sentBox: num(sent.box), rejectKg: num(sent.rejectKg), rejectBox: num(sent.rejectBox) };
}
// Returns that have not physically come back yet can still follow edits to the delivery rejects.
export const RETURN_OPEN_STATUSES = ['Requested', 'Return DC created'];
/**
 * Buyer return generated from a delivery's per-product rejects.
 * `undefined` = no rejects; `null` = linked return was already received, leave it untouched.
 */
export function returnFromDelivery(delivery: Row, data: Data, newId: string): Row | null | undefined {
  const existing = (data['returns'] || []).find(entry => entry['delivery'] === delivery.id);
  if (existing && !RETURN_OPEN_STATUSES.includes(existing.status)) return null;
  const rejected = parseLines(delivery['item'])
    .filter(line => num(line.rejectKg) > 0)
    .map(line => ({ ...returnLineContext(line), q: num(line.rejectKg), ...(num(line.rejectBox) > 0 ? { box: num(line.rejectBox) } : {}) }));
  if (!rejected.length) return undefined;
  const dispatch = (data['dispatch'] || []).find(entry => entry.id === delivery['dc']);
  return normalize('returns', {
    ...existing,
    id: existing?.id || newId,
    date: String(delivery['date'] || existing?.['date'] || new Date().toISOString().slice(0, 10)),
    responsible: String(delivery['responsible'] || existing?.['responsible'] || ''),
    delivery: delivery.id,
    sale: String(dispatch?.['so'] || existing?.['sale'] || ''),
    salesDc: String(delivery['dc'] || ''),
    buyer: String(delivery['buyer'] || dispatch?.['buyer'] || ''),
    warehouse: String(dispatch?.['warehouse'] || existing?.['warehouse'] || DEFAULT_WAREHOUSE),
    item: JSON.stringify(rejected),
    reason: String(existing?.['reason'] || 'Quality issue'),
    status: existing?.status || 'Return DC created',
  });
}
export function invoiceForSalesOrder(salesOrderId: string, dispatches: Row[], invoices: Row[]): Row | undefined {
  return invoices.find(invoice => {
    if (invoice['so'] === salesOrderId || invoice['salesOrder'] === salesOrderId) return true;
    const dispatch = dispatches.find(entry => entry.id === invoice['dc']);
    return dispatch?.['so'] === salesOrderId;
  });
}
export function draftInvoiceForSalesOrder(sale: Row, invoiceId: string, dispatches: Row[], date = new Date().toISOString().slice(0, 10)): Row {
  const taxable = num(sale['value']);
  const dispatch = dispatches.find(entry => entry['so'] === sale.id);
  return {
    id: invoiceId,
    so: sale.id,
    dc: dispatch?.id || '',
    date,
    buyer: String(sale['buyer'] || ''),
    item: sale['item'] || '[]',
    rate: num(sale['rate']),
    taxable,
    gst: '0',
    total: taxable,
    paid: 0,
    status: 'Draft',
  };
}
export function buyerLocation(buyerName: string, buyers: Row[]): string {
  const buyer = buyers.find(entry => String(entry['name'] || '').toLowerCase() === buyerName.toLowerCase());
  return String(buyer?.['location'] || buyer?.['address'] || buyer?.['city'] || '');
}
export function normalize(slug: string, r: Row): Row {
  if (slug === 'trips' && r['buys']) {
    const buys = parseBuys(r['buys']); const merged = new Map<string, number>();
    for (const b of buys) if (b.p) merged.set(b.p, round((merged.get(b.p) || 0) + b.q));
    const qty = round(buys.reduce((s,b)=>s+b.q,0)); const amount = round(buys.reduce((s,b)=>s+b.q*b.r,0));
    // Trip container totals come from the per-line container type and count.
    const containerLines = buys.filter(b => b.cc);
    const containerTotals = containerLines.length ? { containerCount: containerLines.reduce((s,b)=>s+(b.cc||0),0), containerType: [...new Set(containerLines.map(b=>b.ct).filter(Boolean))].join(', ') } : {};
    r = { ...r, item: JSON.stringify([...merged].map(([p,q]) => ({ p, q }))), supplier: [...new Set(buys.map(b=>b.s).filter(Boolean))].join(', '), rate: qty ? round(amount/qty) : 0, amount, ...containerTotals };
  }
  const ls = lines(r, slug === 'receipts' ? 'received' : slug === 'quality-check' ? 'input' : 'qty'); const qty = total(ls);
  const full = { ...r };
  if (ls.length) { full['item'] = JSON.stringify(ls); full['qty'] = qty; }
  if (slug === 'purchase-orders') {
    const hasLineExtra = ls.some(l => l.extraKg !== undefined);
    const extra = hasLineExtra ? round(ls.reduce((s, l) => s + (num(l.extraKg) || 0), 0)) : num(r['extraKg']);
    full['extraKg'] = extra;
    full['qty'] = round(qty + extra);
  }
  if (slug === 'trips') { full['net'] = qty; full['amount'] = r['buys'] ? num(r['amount']) : round(qty*num(r['rate'])); }
  if (slug === 'supplier-prices') {
    const hasLineRates = ls.some(l => l.r !== undefined);
    const pricedLines = ls.map(l => ({
      ...l,
      r: l.r === undefined && !hasLineRates ? num(r['rate']) : num(l.r),
    }));
    if (pricedLines.some(l => l.r !== undefined)) {
      const lineAmt = pricedLines.reduce((s, l) => s + (l.q * num(l.r)), 0);
      full['item'] = JSON.stringify(pricedLines);
      full['amount'] = round(lineAmt);
      if (qty > 0) full['rate'] = round(lineAmt / qty);
    } else {
      full['amount'] = round(qty * num(r['rate']));
    }
    const allLinesPriced = pricedLines.length > 0 && pricedLines.every(l => num(l.r) > 0);
    if (allLinesPriced && r.status === 'Awaiting price') full['status'] = 'Priced';
    if (!allLinesPriced && ['Priced', 'Confirmed'].includes(r.status)) full['status'] = 'Awaiting price';
  }
  if (slug === 'receipts') {
    if (!full['warehouse']) {
      full['warehouse'] = r['warehouse'] || DEFAULT_WAREHOUSE;
    }
    const sent = num(r['sent']);
    const lineTot = total(ls);
    const hasExplicitReceived = r['received'] !== undefined && r['received'] !== null && r['received'] !== '';
    let received = hasExplicitReceived ? num(r['received']) : (lineTot > 0 ? lineTot : sent);
    if (ls.length === 1 && hasExplicitReceived) {
      ls[0].q = received;
      full['item'] = JSON.stringify(ls);
    } else if (ls.length > 1 && lineTot > 0) {
      received = lineTot;
    }
    full['received'] = received;
    full['qty'] = received;
    full['diff'] = round(received - sent);
    if (full['diff'] !== 0 && (!full['reason'] || full['reason'] === '—')) {
      full['reason'] = Math.abs(num(full['diff']) / (sent || 1)) > 0.1 ? 'Spillage' : 'Moisture loss';
    }
  }
  if (slug === 'quality-check') {
    if (!full['warehouse']) {
      full['warehouse'] = r['warehouse'] || DEFAULT_WAREHOUSE;
    }
    full['input'] = qty; full['gradeA'] = round(ls.reduce((s,l)=>s+num(l.a)+(r.status === 'Stage 2 done' ? num(l.a2) : 0),0)); full['reject'] = round(ls.reduce((s,l)=>s+l.q-num(l.a)+(r.status === 'Stage 2 done' ? num(l.ret) : 0),0)); full['gradeB'] = r.status === 'Stage 2 done' ? round(ls.reduce((s,l)=>s+num(l.b),0)) : 0; full['trash'] = r.status === 'Stage 2 done' ? round(ls.reduce((s,l)=>s+num(l.ret),0)+qty-num(full['gradeA'])-num(full['gradeB'])) : 0;
  }
  if (slug === 'packing') { full['nominal'] = qty; full['packs'] = ls.reduce((s,l)=>s+Math.ceil(l.q / Math.max(0.001,num(r['packSize']))),0); }
  if (slug === 'sales-orders') {
    const hasLineSellingRates = ls.some(l => l.saleRate !== undefined);
    if (hasLineSellingRates) {
      const lineValue = ls.reduce((sum, line) => sum + line.q * num(line.saleRate), 0);
      full['value'] = round(lineValue);
      full['rate'] = qty > 0 ? round(lineValue / qty) : 0;
    } else {
      full['value'] = round(qty*num(r['rate']));
    }
  }
  if (slug === 'containers') {
    const out = num(r['out']) || num(r['received']);
    const back = num(r['back']) || num(r['returned']);
    const short = num(r['short']);
    const balance = Math.max(0, round(out - back - short));
    full['out'] = out;
    full['back'] = back;
    full['short'] = short;
    full['balance'] = balance;
    if (balance === 0 && out > 0) {
      full['status'] = short > 0 ? 'Short' : 'Returned';
    } else if (balance > 0) {
      full['status'] = 'With us';
    }
  }
  if (slug === 'returns' && ls.length) full['boxes'] = ls.reduce((s, l) => s + num(l.box), 0);
  if (slug === 'deliveries' && ls.some(l => l.rejectKg !== undefined)) {
    // Buyer QC totals are derived from the per-product reject capture.
    const rejected = round(ls.reduce((s, l) => s + num(l.rejectKg), 0));
    full['issueQty'] = rejected;
    full['accepted'] = Math.max(0, round(qty - rejected));
    full['boxes'] = ls.reduce((s, l) => s + num(l.box), 0);
    full['rejectBoxes'] = ls.reduce((s, l) => s + num(l.rejectBox), 0);
  }
  return full;
}

export function syncReceiptContainers(data: Data, receipt: Row): Data {
  const containerType = String(receipt['containerType'] || '').trim();
  const containerCount = num(receipt['containerCount']);
  const containers = data['containers'] || [];

  const trips = data['trips'] || [];
  const trip = trips.find(t => t.id === receipt['dc']);
  const tripBuys = trip?.['buys'] ? parseBuys(trip['buys']) : [];
  const supplier = String(
    receipt['supplier'] ||
    trip?.['supplier'] ||
    (tripBuys.length > 0 ? [...new Set(tripBuys.map(b => b.s).filter(Boolean))].join(', ') : '') ||
    'Murugan Traders'
  );

  const existingIndex = containers.findIndex(
    c => c['receipt'] === receipt.id || c['receiptRef'] === receipt.id || c.id === `CNT-${receipt.id.replace(/\D/g, '')}`
  );

  if (containerCount <= 0 || !containerType) {
    if (existingIndex >= 0) {
      const existing = containers[existingIndex];
      if (num(existing['back']) === 0) {
        const nextContainers = containers.filter((_, idx) => idx !== existingIndex);
        return { ...data, containers: nextContainers };
      }
    }
    return data;
  }

  if (existingIndex >= 0) {
    const existing = containers[existingIndex];
    const back = num(existing['back']);
    const short = num(existing['short']);
    const balance = Math.max(0, containerCount - back - short);
    const updated = normalize('containers', {
      ...existing,
      type: containerType,
      party: supplier || existing['party'] || 'Supplier',
      out: containerCount,
      back,
      short,
      balance,
      date: receipt['date'] || existing['date'] || new Date().toISOString().slice(0, 10),
      receipt: receipt.id,
      dc: String(receipt['dc'] || ''),
      status: balance === 0 ? (short > 0 ? 'Short' : 'Returned') : 'With us',
      responsible: receipt['responsible'] || existing['responsible'] || 'Ravi Kumar',
    });
    const nextContainers = [...containers];
    nextContainers[existingIndex] = updated;
    return { ...data, containers: nextContainers };
  } else {
    const id = `CNT-${receipt.id.replace(/\D/g, '') || String(1001 + containers.length)}`;
    const newRecord = normalize('containers', {
      id,
      type: containerType,
      party: supplier,
      out: containerCount,
      back: 0,
      short: 0,
      balance: containerCount,
      date: receipt['date'] || new Date().toISOString().slice(0, 10),
      receipt: receipt.id,
      dc: String(receipt['dc'] || ''),
      status: 'With us',
      responsible: receipt['responsible'] || 'Ravi Kumar',
    });
    return { ...data, containers: [newRecord, ...containers] };
  }
}

export function syncReceiptDownstream(data: Data, receipt: Row): Data {
  const qcList = data['quality-check'] || [];
  const linkedQc = qcList.filter(x => x['lot'] === receipt.id);
  if (!linkedQc.length) return data;

  const rLines = lines(receipt, 'received');
  const updatedQc = qcList.map(qc => {
    if (qc['lot'] !== receipt.id) return qc;
    const qcLines = lines(qc, 'input');
    const newLines = qcLines.map(ql => {
      const rl = rLines.find(r => r.p === ql.p);
      if (!rl) return ql;
      const targetQ = rl.q;
      if (ql.q <= 0 || targetQ === ql.q) return { ...ql, q: targetQ };
      const ratio = targetQ / ql.q;
      const a = round(num(ql.a) * ratio);
      const a2 = round(num(ql.a2) * ratio);
      const b = round(num(ql.b) * ratio);
      const ret = num(ql.ret);
      return {
        ...ql,
        p: ql.p,
        q: targetQ,
        a: Math.min(targetQ, a),
        a2: Math.min(targetQ, a2),
        b: Math.min(targetQ, b),
        ret,
      };
    });
    return normalize('quality-check', {
      ...qc,
      item: JSON.stringify(newLines),
      input: total(newLines),
    });
  });

  return {
    ...data,
    'quality-check': updatedQc,
  };
}
export const references: Record<string, Record<string,string>> = {
  trips: { supplier:'suppliers', transporter:'transporters' }, 'purchase-orders':{buyer:'buyers'}, receipts:{dc:'trips'},
  containers: { party:'suppliers', receipt:'receipts' },
  'quality-check':{lot:'receipts'}, packing:{po:'purchase-orders'}, 'sales-orders':{buyer:'buyers',po:'purchase-orders'},
  returns:{sale:'sales-orders'}, dispatch:{so:'sales-orders',transporter:'transporters'}, deliveries:{dc:'dispatch'}, invoices:{dc:'dispatch',so:'sales-orders'},
  'supplier-prices':{dc:'trips',supplier:'suppliers'}, transport:{transporter:'transporters',ref:'trips'},
};
export function referenceModule(slug: string, key: string, r: Row) {
  if (slug === 'transport' && key === 'ref') {
    if (r['direction'] === 'Outward') return 'sales-orders';
    if (r['direction'] === 'Outward Return') return 'returns';
    return 'trips';
  }
  if (slug === 'quality-check' && key === 'lot' && r['sourceType'] === 'Return') return 'returns';
  return references[slug]?.[key];
}
/** Boxes packed for a product against a buyer demand (Split Allocator box counts), scaled to the KG sent. */
export function packedBoxesFor(data: Data, po: unknown, product: string, sentKg: number): number {
  if (!po) return 0;
  let kg = 0; let boxes = 0;
  for (const row of data['packing'] || []) {
    if (row['po'] !== po || row['grade'] === 'Rejected') continue;
    const rowLines = parseLines(row['item']);
    const line = rowLines.find(l => l.p === product);
    if (!line || line.q <= 0) continue;
    const rowKg = total(rowLines);
    kg += line.q;
    boxes += num(row['containerCount']) * (rowKg > 0 ? line.q / rowKg : 1);
  }
  if (kg <= 0 || boxes <= 0) return 0;
  return Math.ceil(boxes * Math.min(1, sentKg / kg) - 1e-9);
}
export function populate(slug: string, key: string, value: string, form: Row, data: Data): Row {
  const target = referenceModule(slug,key,form); const ref = (data[target || ''] || []).find(r=>r.id===value || r['name']===value);
  let r: Row = { ...form,[key]:value }; if (!ref) return r;
  if (key === 'transporter') return { ...r, vehicle:ref['vehicle'] || '',driver:ref['driver'] || '',driverPhone:ref['phone'] || '' };
  if (slug === 'supplier-prices' && (key === 'dc' || key === 'supplier')) {
    const trip = key === 'dc' ? ref : (data['trips'] || []).find(t => t.id === form['dc']);
    if (!trip) return r;
    const selectedSupplier = key === 'supplier' ? String(value) : String(form['supplier'] || '');
    const tripBuys = trip['buys'] ? parseBuys(trip['buys']) : [];
    const matchingBuys = selectedSupplier
      ? tripBuys.filter(b => b.s === selectedSupplier)
      : tripBuys;
    const sourceLines = tripBuys.length > 0
      ? matchingBuys.map(b => ({ p: b.p, q: b.q, r: b.r }))
      : (!selectedSupplier || selectedSupplier === trip['supplier'])
        ? lines(trip, 'net').map(line => ({ ...line, r: num(trip['rate']) }))
        : [];
    const previousLines = parseLines(form['item']);
    const itemLines = sourceLines.map(line => {
      const previous = previousLines.find(existing => existing.p === line.p);
      return { ...line, r: previous?.r ?? line.r ?? 0, ...(previous?.sellingPrice !== undefined ? { sellingPrice: previous.sellingPrice } : {}) };
    });
    const selectedSuppliers = [...new Set(matchingBuys.map(b => b.s).filter(Boolean))];
    return normalize('supplier-prices', {
      ...r,
      dc: trip.id,
      supplier: selectedSupplier || (selectedSuppliers.length === 1 ? selectedSuppliers[0] : (tripBuys.length ? '' : String(trip['supplier'] || ''))),
      date: trip['date'] || form['date'] || '',
      warehouse: trip['warehouse'] || form['warehouse'] || '',
      item: JSON.stringify(itemLines),
      qty: total(itemLines),
      rate: num(trip['rate']),
      amount: itemLines.reduce((sum, line) => sum + line.q * num(line.r), 0),
      status: itemLines.length > 0 && itemLines.every(line => num(line.r) > 0) ? 'Priced' : 'Awaiting price',
    });
  }
  if (key === 'supplier') return r;
  if (key === 'buyer') return slug === 'sales-orders' ? { ...r, po:'', item:'[]', qty:0, bags:'', rate:0, value:0 } : r;
  if (slug === 'receipts') {
    const tripBuys = ref['buys'] ? parseBuys(ref['buys']) : [];
    const sup = ref['supplier'] || (tripBuys.length > 0 ? [...new Set(tripBuys.map(b => b.s).filter(Boolean))].join(', ') : '');
    r = {
      ...r,
      item: ref['item'] || '',
      sent: num(ref['net']),
      received: num(ref['net']),
      warehouse: ref['warehouse'] || r['warehouse'] || DEFAULT_WAREHOUSE,
      containerType: ref['containerType'] || r['containerType'] || 'Plastic crates',
      containerCount: num(ref['containerCount']) || r['containerCount'] || 0,
      supplier: sup || r['supplier'] || '',
    };
  }
  if (slug === 'containers' && key === 'receipt') {
    const trip = (data['trips'] || []).find(t => t.id === ref['dc']);
    const tripBuys = trip?.['buys'] ? parseBuys(trip['buys']) : [];
    const sup = String(ref['supplier'] || trip?.['supplier'] || (tripBuys.length > 0 ? tripBuys[0]?.s : '') || 'Supplier');
    const cnt = num(ref['containerCount']);
    r = {
      ...r,
      party: sup,
      type: ref['containerType'] || r['type'] || 'Plastic crates',
      out: cnt || r['out'] || 0,
      balance: cnt || r['out'] || 0,
      dc: ref['dc'] || '',
    };
  }
  if (slug === 'quality-check') {
    const used = (data['quality-check'] || []).filter(x=>x.id!==form.id && x['lot']===value && x['sourceType']===form['sourceType']);
    const ls = lines(ref, target==='receipts'?'received':'qty').map(l=>{
      const lotLeft = Math.max(0,round(l.q-used.reduce((s,x)=>s+(lines(x,'input').filter(i=>i.p===l.p).reduce((acc, i) => acc + i.q, 0)),0)));
      // Returns already pulled into a purchase Stage 2 pool have left quarantine, so cap at what is still there.
      const q = target === 'returns' ? Math.min(lotLeft, returnsAvailable(data, l.p, form.id)) : lotLeft;
      return {p:l.p,q,a:0,a2:0,b:0,ret:0};
    }).filter(l=>l.q>0);
    r = {
      ...r,
      warehouse: ref['warehouse'] || r['warehouse'] || DEFAULT_WAREHOUSE,
      item: JSON.stringify(ls),
    };
  }
  if (slug === 'sales-orders' && key==='po') {
    const sold = (data['sales-orders'] || []).filter(x=>x.id!==form.id && x['po']===value);
    const others = { ...data, 'sales-orders': (data['sales-orders'] || []).filter(x=>x.id!==form.id) };
    const packed = stock(others).filter(x=>x.category==='Packed');
    const savedPrices = data['supplier-prices'] || [];
    const trips = data['trips'] || [];
    const existingLines = lines(form);
    const ls = lines(ref).map(l=>{
      const open = round(l.q - sold.reduce((s,x)=>s+(lines(x).find(i=>i.p===l.p)?.q || 0),0));
      const avail = packed.find(x=>x.product.toLowerCase()===l.p.toLowerCase())?.qty || 0;
      const existing = existingLines.find(item => item.p === l.p);
      const saleRate = num(existing?.saleRate) > 0
        ? num(existing?.saleRate)
        : supplierSellingPriceForProduct(l.p, trips, savedPrices);
      // Cap to packed stock when some is packed; otherwise start from the open demand so KG, packets and value are visible.
      return { ...l, p:l.p, q:Math.max(0,avail > 0 ? Math.min(open,avail) : open), saleRate };
    });
    const used = (p:string,size:number) => sold.reduce((t,x)=>t+(parsePacks(x['packs']).filter(k=>k.p===p&&k.size===size).reduce((a,k)=>a+k.bags+(k.loose>0?1:0),0)),0);
    const packs: PackLine[] = [];
    for (const l of ls) {
      const pool = new Map<number,number>();
      for (const x of data['packing'] || []) if (x['grade']!=='Rejected' && num(x['packSize'])>0) { const q=lines(x).find(i=>i.p===l.p)?.q; if (q) pool.set(num(x['packSize']),round((pool.get(num(x['packSize']))||0)+q)); }
      let left = l.q; const sizes=[...pool.keys()].sort((a,b)=>b-a); const avail=new Map(sizes.map(sz=>[sz,Math.max(0,Math.floor((pool.get(sz)||0)/sz+1e-9)-used(l.p,sz))]));
      for (const sz of sizes) { const bagsN=Math.min(avail.get(sz)||0,Math.floor(left/sz+1e-9)); if (bagsN>0) { packs.push({p:l.p,size:sz,bags:bagsN,loose:0}); left=round(left-bagsN*sz); avail.set(sz,(avail.get(sz)||0)-bagsN); } }
      if (left>0) { const sz=[...sizes].reverse().find(z=>(avail.get(z)||0)>0&&z>left)||[...sizes].reverse().find(z=>(avail.get(z)||0)>0); if (sz) packs.push({p:l.p,size:sz,bags:0,loose:left}); else packs.push({p:l.p,size:0,bags:0,loose:left}); }
    }
    const bags = packsText(packs, ls);
    r={...r,buyer:ref['buyer'] || '',item:JSON.stringify(ls),qty:total(ls),bags,packs:JSON.stringify(packs)};
  }
  if (slug === 'packing' && key==='po') {
    const used = (data['packing'] || []).filter(x=>x.id!==form.id && x['po']===value);
    const ls = lines(ref).map(l=>({...l,q:Math.max(0,round(l.q-used.reduce((s,x)=>s+(lines(x).find(i=>i.p===l.p)?.q || 0),0)))})).filter(l=>l.q>0);
    r={...r,buyer:ref['buyer'] || '',item:JSON.stringify(ls)};
  }
  if (slug === 'returns') {
    const dispatch = (data['dispatch'] || []).find(entry => entry['so'] === ref.id);
    const delivery = dispatch ? (data['deliveries'] || []).find(entry => entry['dc'] === dispatch.id) : undefined;
    const deliveredLines = parseLines(delivery?.['item']);
    const others = (data['returns'] || []).filter(x => x.id !== form.id && x['sale'] === ref.id);
    const ls = lines(ref).map(l => {
      const sent = deliveredLines.find(d => d.p === l.p) || { ...l, box: packedBoxesFor(data, ref['po'], l.p, l.q) };
      const ctx = returnLineContext(sent);
      // Default the returned KG/boxes to the buyer QC rejects not yet covered by another return.
      const already = others.reduce((s, x) => s + (lines(x).find(i => i.p === l.p)?.q || 0), 0);
      const q = Math.max(0, round(num(ctx.rejectKg) - already));
      return { ...ctx, q, ...(q > 0 && num(ctx.rejectBox) > 0 ? { box: num(ctx.rejectBox) } : {}) };
    });
    r={...r,salesDc:dispatch?.id || '',...(delivery ? { delivery: delivery.id } : {}),buyer:ref['buyer'] || '',item:JSON.stringify(ls)};
  }
  if (slug === 'dispatch') {
    const buyers = data['buyers'] || [];
    r={
      ...r,
      buyer:ref['buyer'] || '',
      toLocation:buyerLocation(String(ref['buyer'] || ''), buyers),
      item:ref['item'] || '',
      qty:num(ref['qty']) || num(ref['net']),
      supplier:ref['supplier'] || '',
    };
  }
  if (slug === 'transport') {
    const tripBuys = ref['buys'] ? parseBuys(ref['buys']) : [];
    const sup = ref['supplier'] || (tripBuys.length > 0 ? [...new Set(tripBuys.map(b => b.s).filter(Boolean))].join(', ') : '');
    const items = ref['item'] || (tripBuys.length > 0 ? JSON.stringify(tripBuys.map(b => ({ p: b.p, q: b.q, r: b.r }))) : '[]');
    const qtyVal = num(ref['qty']) || num(ref['net']) || (parseLines(items).length > 0 ? total(parseLines(items)) : 0);
    r = {
      ...r,
      buyer: ref['buyer'] || '',
      supplier: sup || ref['supplier'] || '',
      item: items,
      qty: qtyVal,
      transporter: ref['transporter'] || r['transporter'] || '',
      vehicle: ref['vehicle'] || r['vehicle'] || '',
      driver: ref['driver'] || r['driver'] || '',
      driverPhone: ref['driverPhone'] || r['driverPhone'] || '',
      containerType: ref['containerType'] || r['containerType'] || 'Plastic crates',
      containerCount: num(ref['containerCount']) || num(r['containerCount']) || 0,
      charges: num(ref['charges']) || num(r['charges']) || 0,
    };
  }
  if (slug === 'deliveries') {
    const sale = (data['sales-orders'] || []).find(entry => entry.id === ref['so']);
    const item = ref['item'] || sale?.['item'] || '[]';
    const dispatchedQty = num(ref['qty']) || num(sale?.['qty']) || total(parseLines(item));
    const sentLines = parseLines(item);
    // A single-product DC can take its box count from the dispatch container count.
    const singleLineBoxes = sentLines.length === 1 ? num(ref['containerCount']) : 0;
    r={
      ...r,
      buyer:ref['buyer'] || sale?.['buyer'] || '',
      item: sentLines.length
        ? JSON.stringify(sentLines.map(line => ({ ...line, box: num(line.box ?? line.containerCount) || packedBoxesFor(data, sale?.['po'], line.p, line.q) || singleLineBoxes, rejectKg: 0, rejectBox: 0 })))
        : item,
      accepted:dispatchedQty,
      issueQty:0,
    };
  }
  if (slug === 'invoices') {
    const sale = key === 'so' ? ref : (data['sales-orders'] || []).find(x => x.id === ref['so']);
    const dispatch = key === 'dc' ? ref : (data['dispatch'] || []).find(entry => entry['so'] === sale?.id);
    r = {
      ...r,
      dc: dispatch?.id || (key === 'dc' ? value : r['dc'] || ''),
      so: sale?.id || '',
      buyer: sale?.['buyer'] || ref['buyer'] || '',
      item: sale?.['item'] || '[]',
      rate: sale?.['rate'] || r['rate'] || 0,
      taxable: num(sale?.['value']),
      gst: r['gst'] || '0',
      paid: num(r['paid']),
      status: r['status'] || 'Draft',
    };
  }
  if (slug === 'supplier-prices') {
    const tripBuys = ref['buys'] ? parseBuys(ref['buys']) : [];
    let ls: ProductLine[] = [];
    if (tripBuys.length > 0) {
      const matchingBuys = form['supplier'] ? tripBuys.filter(b => !b.s || b.s === form['supplier']) : tripBuys;
      const useBuys = matchingBuys.length > 0 ? matchingBuys : tripBuys;
      ls = useBuys.map(b => ({ p: b.p, q: b.q, r: b.r }));
    } else {
      ls = lines(ref, 'net').map(l => ({ ...l, r: num(ref['rate']) }));
    }
    const totQty = total(ls);
    const totAmt = ls.reduce((s, l) => s + l.q * (num(l.r) || 0), 0);
    const avgRate = totQty > 0 ? round(totAmt / totQty) : num(ref['rate']);
    r = {
      ...r,
      supplier: ref['supplier'] || r['supplier'] || '',
      item: JSON.stringify(ls),
      qty: totQty || num(ref['net']),
      rate: avgRate,
      amount: round(totAmt),
    };
  }
  return normalize(slug,r);
}
const activeSale = (r: Row) => ['Dispatched','Closed'].includes(r.status);
const hasSalesDispatch = (saleId: string, data: Data) =>
  (data['dispatch'] || []).some(dispatch => dispatch['so'] === saleId);
export function validateData(data: Data): string | null {
  const negative = stock(data).find(s=>s.qty < -0.001); if (negative) return `${negative.product}: insufficient ${negative.category} stock (${negative.qty} kg).`;
  for (const slug of ['purchase-orders','trips','supplier-prices','receipts','quality-check','packing','sales-orders','returns','transport','dispatch','deliveries']) {
    const seen = new Set<string>();
    for (const r of data[slug] || []) {
      if (seen.has(r.id)) return `Duplicate reference ${r.id}.`; seen.add(r.id);
      const ls = lines(r,slug==='receipts'?'received':slug==='quality-check'?'input':'qty');
      if (slug !== 'quality-check' && new Set(ls.map(l=>l.p)).size!==ls.length) return `${r.id}: duplicate products are not allowed.`;
      if (ls.some(l=>!Number.isFinite(l.q) || l.q<0)) return `${r.id}: quantities cannot be negative.`;
      if (['purchase-orders','trips','quality-check','packing','sales-orders','returns'].includes(slug) && (!ls.length || ls.some(l=>l.q<=0 && !(slug==='quality-check' && num(l.ret)>0)))) return `${r.id}: select products with positive KG quantities.`;
      if (slug==='trips' && num(r['rate'])<0) return 'Purchase price cannot be negative.';
      if (slug==='supplier-prices') {
        if (!r['dc'] || !r['supplier']) return `${r.id}: select a purchase trip and supplier.`;
        if (!ls.length || ls.some(line => line.q <= 0)) return `${r.id}: add products with a quantity above zero.`;
        if (ls.some(line => num(line.r) < 0)) return `${r.id}: product prices cannot be negative.`;
        if (['Priced', 'Confirmed'].includes(r.status) && ls.some(line => num(line.r) <= 0)) {
          return `${r.id}: enter a price greater than zero for every product before marking it ${r.status}.`;
        }
        const duplicate = (data['supplier-prices'] || []).some(entry =>
          entry.id !== r.id && entry['dc'] === r['dc'] && entry['supplier'] === r['supplier'],
        );
        if (duplicate) return `${r.id}: a supplier price submission already exists for this trip and supplier.`;
      }
      if (slug==='trips' && r['buys']) {
        const buys = parseBuys(r['buys']);
        if (!buys.length) return `${r.id}: add at least one purchase line.`;
        const seen = new Set<string>();
        for (const b of buys) {
          if (!b.s || !b.p) return `${r.id}: every purchase line needs a supplier and a product.`;
          if (b.q <= 0) return `${r.id}: ${b.p} from ${b.s} needs a KG quantity above zero.`;
          if (b.r < 0) return 'Purchase price cannot be negative.';
          const k = `${b.s}|${b.p}`; if (seen.has(k)) return `${r.id}: ${b.p} from ${b.s} is entered twice; combine the KG into one line.`; seen.add(k);
        }
      }
      if (slug==='quality-check') {
        const sourceType = r['sourceType'] === 'Return' ? 'returns' : 'receipts';
        const ref=(data[sourceType] || []).find(x=>x.id===r['lot']);
        const validSource = sourceType === 'receipts'
          ? ref?.status === 'Posted'
          : !!ref && ['Received','Sent to QC'].includes(ref.status);
        if (!validSource) return `${r.id}: select a received, posted source.`;
        for (const l of ls) {
          if ([num(l.a),num(l.a2),num(l.b),num(l.ret)].some(q=>q<0) || num(l.a)>l.q || num(l.a2)+num(l.b)>round(l.q-num(l.a)+num(l.ret))) return `${r.id}: grades cannot exceed ${l.p} input quantity.`;
        }
        const distinctProducts = [...new Set(ls.map(l => l.p))];
        for (const p of distinctProducts) {
          const received = lines(ref,sourceType==='receipts'?'received':'qty').filter(x=>x.p===p).reduce((s,x)=>s+x.q, 0);
          const graded = (data['quality-check'] || []).filter(x=>x['lot']===r['lot'] && x['sourceType']===r['sourceType']).reduce((s,x)=>s+(lines(x,'input').filter(i=>i.p===p).reduce((acc, i) => acc + i.q, 0)),0);
          if (graded>received+0.001) return `${r.id}: ${p} is already assigned or graded; input exceeds source.`;
        }
      }
      if (slug==='receipts') {
        const ref=(data['trips'] || []).find(x=>x.id===r['dc']); if (!ref || ref.status!=='Submitted') return `${r.id}: select a submitted purchase.`;
        if ((data['receipts'] || []).filter(x=>x['dc']===r['dc']).length>1) return 'A purchase can have only one warehouse receipt.';
        for (const l of ls) if (l.q>(lines(ref,'net').find(x=>x.p===l.p)?.q || 0)+0.001) return `${l.p}: receipt exceeds purchased quantity.`;
        const hasLineReasons = ls.some(l => l.reason !== undefined);
        if (hasLineReasons) {
          for (const l of ls) {
            const sent = num(l.sentQ) || (lines(ref, 'net').find(x => x.p === l.p)?.q || 0);
            if (Math.abs(l.q - sent) > 0.001 && (!l.reason || l.reason === '—')) {
              return `${l.p}: a difference reason is required for its transit variance.`;
            }
          }
        }
      }
      if (slug==='packing') {
        if (num(r['packSize'])<=0) return 'Bag size must be greater than zero KG.';
        const po=(data['purchase-orders'] || []).find(x=>x.id===r['po']); if (r['po'] && (!po || po.status==='Rejected')) return 'Select an accepted buyer demand.';
        if (po) for (const l of ls) {
          const allocated=(data['packing'] || []).filter(x=>x['po']===r['po']).reduce((s,x)=>s+(lines(x).find(i=>i.p===l.p)?.q || 0),0);
          const poLs = lines(po); const totalBase = poLs.reduce((s, x) => s + x.q, 0); const poLine = poLs.find(x => x.p === l.p);
          const extra = num(po['extraKg']); const extraShare = poLine?.extraKg !== undefined ? num(poLine.extraKg) : (extra > 0 && poLine ? (totalBase > 0 ? (extra * poLine.q / totalBase) : (extra / Math.max(1, poLs.length))) : 0);
          const maxAllowed = (poLine?.q || 0) + extraShare;
          if (allocated > maxAllowed + 0.001) return `${l.p}: allocation exceeds buyer demand.`;
        }
      }
      if (slug==='sales-orders') {
        const saleLines = lines(r);
        const usesProductPricing = saleLines.some(line => line.saleRate !== undefined);
        if (usesProductPricing && saleLines.some(line => line.saleRate === undefined || !Number.isFinite(line.saleRate) || line.saleRate <= 0)) {
          return `${r.id}: each product needs a selling price greater than zero per KG.`;
        }
        const po=(data['purchase-orders'] || []).find(x=>x.id===r['po']); if (!po) return `${r.id}: select the buyer demand to supply.`;
        if (po['buyer']!==r['buyer']) return 'Sale buyer must match the buyer demand.';
        for (const l of ls) {
          const sold=(data['sales-orders'] || []).filter(x=>x['po']===r['po']).reduce((s,x)=>s+(lines(x).find(i=>i.p===l.p)?.q || 0),0);
          const poLs = lines(po); const totalBase = poLs.reduce((s, x) => s + x.q, 0); const poLine = poLs.find(x => x.p === l.p);
          const extra = num(po['extraKg']); const extraShare = poLine?.extraKg !== undefined ? num(poLine.extraKg) : (extra > 0 && poLine ? (totalBase > 0 ? (extra * poLine.q / totalBase) : (extra / Math.max(1, poLs.length))) : 0);
          const maxAllowed = (poLine?.q || 0) + extraShare;
          if (sold > maxAllowed + 0.001) return `${l.p}: sale exceeds buyer demand.`;
        }
      }
      if (slug==='returns') {
        const sale=(data['sales-orders'] || []).find(x=>x.id===r['sale']); if (!sale || (!activeSale(sale) && !hasSalesDispatch(sale.id,data))) return 'Returns require an original dispatched sale.';
        if (r['salesDc'] && !(data['dispatch'] || []).some(dispatch => dispatch.id === r['salesDc'] && dispatch['so'] === sale.id)) return 'Select the Sales DC linked to the original sale.';
        for (const l of ls) if (num(l.box) < 0 || (num(l.sentBox) > 0 && num(l.box) > num(l.sentBox))) return `${l.p}: returned boxes exceed the boxes sent.`;
        for (const l of ls) { const returned=(data['returns'] || []).filter(x=>x.id!==r.id && x['sale']===r['sale']).reduce((s,x)=>s+(lines(x).find(i=>i.p===l.p)?.q || 0),0) + l.q; if (returned>(lines(sale).find(x=>x.p===l.p)?.q || 0)+0.001) return `${l.p}: returned quantity exceeds original sale.`; }
      }
      if (slug==='dispatch' || slug==='transport') {
        // Inward Return goes back to a supplier, not against a market trip, so it is checked by container count and supplier.
        if (slug === 'transport' && r['direction'] === 'Inward Return') {
          if (num(r['containerCount']) <= 0) return 'Return container count must be greater than zero.';
          if (!r['supplier']) return 'Select a supplier for the return.';
        } else {
          const inward = slug === 'transport' && r['direction'] === 'Inward';
          const outwardReturn = slug === 'transport' && r['direction'] === 'Outward Return';
          const key = slug === 'dispatch' ? 'so' : 'ref';
          const targetModule = inward ? 'trips' : outwardReturn ? 'returns' : 'sales-orders';
          const ref = (data[targetModule] || []).find(x => x.id === r[key]);
          if (!ref) return 'Select a valid purchase, return, or sales reference.';
          if (slug === 'dispatch' && ref.status !== 'Confirmed' && !activeSale(ref)) return 'Outward dispatch requires a confirmed sales order.';
          if (slug === 'transport' && !inward && !outwardReturn && !activeSale(ref)) return 'Outward transport requires a dispatched sale.';
          if ((data[slug] || []).filter(x => x[key] === r[key] && (slug === 'dispatch' || x['direction'] === r['direction'])).length > 1) return 'Transport already exists for this reference.';
          if (num(r['qty']) > total(lines(ref, inward ? 'net' : 'qty')) + 0.001) return 'Loading quantity exceeds referenced quantity.';
        }
      }
      if (slug === 'deliveries') {
        const dispatch = (data['dispatch'] || []).find(entry => entry.id === r['dc']);
        if (!dispatch) return `${r.id}: select a valid outward Sales DC.`;
        if ((data['deliveries'] || []).some(entry => entry.id !== r.id && entry['dc'] === r['dc'])) {
          return `${r.id}: a proof of delivery already exists for this Sales DC.`;
        }
        const accepted = num(r['accepted']);
        const issues = num(r['issueQty']);
        if (accepted < 0 || issues < 0) return `${r.id}: accepted and issue quantities cannot be negative.`;
        for (const line of parseLines(r['item'])) {
          if (num(line.rejectKg) < 0 || num(line.rejectBox) < 0 || num(line.box) < 0) return `${r.id}: ${line.p} box and reject counts cannot be negative.`;
          if (num(line.rejectKg) > line.q + 0.001) return `${r.id}: ${line.p} rejected KG exceeds the quantity sent.`;
          if (num(line.box) > 0 && num(line.rejectBox) > num(line.box)) return `${r.id}: ${line.p} rejected boxes exceed the boxes sent.`;
        }
        if (accepted + issues > num(dispatch['qty']) + 0.001) {
          return `${r.id}: accepted and issue quantities exceed the dispatched quantity.`;
        }
      }
    }
  }
  return null;
}
