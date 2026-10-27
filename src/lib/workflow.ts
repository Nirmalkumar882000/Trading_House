import type { Row } from './modules';
export type Data = Record<string, Row[]>;
export type ProductLine = { p: string; q: number; a?: number; a2?: number; b?: number; ret?: number; r?: number; packKg?: number; packLabel?: string };
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
        ...(l.packKg !== undefined ? { packKg: num(l.packKg) } : {}),
        ...(l.packLabel !== undefined ? { packLabel: String(l.packLabel) } : {}),
      }));
    }
  } catch { /* legacy product names */ }
  return String(v).split(',').filter(Boolean).map(p => ({ p: p.trim(), q: 0 }));
}
export function lines(r: Row, fallback = 'qty') { const ls = parseLines(r['item']); return ls.map(l => ({ ...l, q: l.q || (ls.length === 1 ? num(r[fallback]) : 0) })); }
export const total = (ls: ProductLine[]) => round(ls.reduce((s,l) => s + l.q, 0));
export const locations = { Ungraded: 'Receiving bay', 'Grade A': 'A · Fresh room', Remaining: 'QC holding bay', 'Grade B': 'B · Secondary room', Rejected: 'Reject isolation', Quarantine: 'Returns inspection bay', Allocated: 'Allocation bay', Packed: 'Dispatch bay' };
export type Category = keyof typeof locations;
export type Movement = { id: string; ref: string; purchase: string; product: string; source: string; destination: string; qty: number; date: string; person: string };
export function movements(data: Data): Movement[] {
  const out: Movement[] = [];
  const move = (r: Row, l: ProductLine, source: string, destination: string, q: number, purchase = '') => {
    if (q > 0) out.push({ id: `${r.id}-${out.length}`, ref: r.id, purchase, product: l.p, source, destination, qty: round(q), date: String(r['date'] || '2026-10-22'), person: String(r['responsible'] || r['grader'] || r['packer'] || 'Ravi Kumar') });
  };
  for (const r of data['receipts'] || []) if (r.status === 'Posted') for (const l of lines(r,'received')) move(r,l,'Market', 'Ungraded', l.q, String(r['dc']));
  for (const r of data['returns'] || []) if (['Received','Sent to QC'].includes(r.status)) for (const l of lines(r)) move(r,l,'Buyer', 'Remaining',l.q,String(r['sale']));
  for (const r of data['quality-check'] || []) {
    if (r.status === 'Assigned') continue;
    for (const l of lines(r,'input')) {
      const a = num(l.a); const rem = round(l.q - a); const source = 'Ungraded';
      move(r,l,source,'Grade A',a,String(r['lot'])); move(r,l,source,'Remaining',rem,String(r['lot']));
      if (r.status === 'Stage 2 done') { move(r,l,'Remaining','Grade A',num(l.a2),String(r['lot'])); move(r,l,'Remaining','Grade B',num(l.b),String(r['lot'])); move(r,l,'Remaining','Rejected',round(rem+num(l.ret)-num(l.a2)-num(l.b)),String(r['lot'])); }
    }
  }
  for (const r of data['packing'] || []) for (const l of lines(r)) {
    move(r,l,String(r['grade']),'Allocated',l.q,String(r['po']));
    if (['Packed','In sales stock'].includes(r.status)) move(r,l,'Allocated','Packed',l.q,String(r['po']));
  }
  for (const r of data['sales-orders'] || []) if (['Dispatched','Closed'].includes(r.status)) for (const l of lines(r)) move(r,l,'Packed','Buyer',l.q,String(r['po']));
  return out;
}
export function stock(data: Data) {
  const map = new Map<string, { product: string; category: Category; qty: number; location: string }>();
  for (const m of movements(data)) for (const [category,sign] of [[m.source,-1],[m.destination,1]] as const) {
    if (!(category in locations)) continue;
    const c = category as Category; const key = `${m.product}|${c}`;
    const v = map.get(key) || { product:m.product, category:c, qty:0, location:locations[c] }; v.qty = round(v.qty + sign*m.qty); map.set(key,v);
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
  const used = (data['quality-check'] || []).filter(x=>x.id!==excludeId && x.status==='Stage 2 done').reduce((s,x)=>s+num(lines(x,'input').find(l=>l.p===product)?.ret),0);
  return Math.max(0, round(returned - used));
}
export const bagBreakdown = (qty: number, size: number) => ({ full: size > 0 ? Math.floor(qty / size) : 0, partial: size > 0 ? round(qty % size) : qty, opened: size > 0 && round(qty % size) > 0 ? 1 : 0 });
export type Buy = { s: string; p: string; q: number; r: number };
export function parseBuys(v: unknown): Buy[] {
  try { const x: unknown = JSON.parse(String(v || '[]')); if (Array.isArray(x)) return x.map(b => ({ s: String(b.s || ''), p: String(b.p || ''), q: num(b.q), r: num(b.r) })); } catch { /* ignore */ }
  return [];
}
export function buysFromTrip(r: Row): Buy[] {
  if (r['buys']) return parseBuys(r['buys']);
  return lines(r, 'net').map(l => ({ s: String(r['supplier'] || ''), p: l.p, q: l.q, r: num(r['rate']) }));
}
export function normalize(slug: string, r: Row): Row {
  if (slug === 'trips' && r['buys']) {
    const buys = parseBuys(r['buys']); const merged = new Map<string, number>();
    for (const b of buys) if (b.p) merged.set(b.p, round((merged.get(b.p) || 0) + b.q));
    const qty = round(buys.reduce((s,b)=>s+b.q,0)); const amount = round(buys.reduce((s,b)=>s+b.q*b.r,0));
    r = { ...r, item: JSON.stringify([...merged].map(([p,q]) => ({ p, q }))), supplier: [...new Set(buys.map(b=>b.s).filter(Boolean))].join(', '), rate: qty ? round(amount/qty) : 0, amount };
  }
  const ls = lines(r, slug === 'receipts' ? 'received' : slug === 'quality-check' ? 'input' : 'qty'); let qty = total(ls);
  const full = { ...r };
  if (ls.length) { full['item'] = JSON.stringify(ls); full['qty'] = qty; }
  if (slug === 'purchase-orders') {
    const extra = num(r['extraKg']);
    full['extraKg'] = extra;
    full['qty'] = round(qty + extra);
  }
  if (slug === 'trips') { full['net'] = qty; full['amount'] = round(qty*num(r['rate'])); }
  if (slug === 'supplier-prices') {
    const hasLineRates = ls.some(l => num(l.r) > 0);
    if (hasLineRates) {
      const lineAmt = ls.reduce((s, l) => s + (l.q * num(l.r)), 0);
      full['amount'] = round(lineAmt);
      if (qty > 0) full['rate'] = round(lineAmt / qty);
    } else {
      full['amount'] = round(qty * num(r['rate']));
    }
  }
  if (slug === 'receipts') {
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
  if (slug === 'quality-check') { full['input'] = qty; full['gradeA'] = round(ls.reduce((s,l)=>s+num(l.a)+(r.status === 'Stage 2 done' ? num(l.a2) : 0),0)); full['reject'] = round(ls.reduce((s,l)=>s+l.q-num(l.a)+(r.status === 'Stage 2 done' ? num(l.ret) : 0),0)); full['gradeB'] = r.status === 'Stage 2 done' ? round(ls.reduce((s,l)=>s+num(l.b),0)) : 0; full['trash'] = r.status === 'Stage 2 done' ? round(ls.reduce((s,l)=>s+num(l.ret),0)+qty-num(full['gradeA'])-num(full['gradeB'])) : 0; }
  if (slug === 'packing') { full['nominal'] = qty; full['packs'] = ls.reduce((s,l)=>s+Math.ceil(l.q / Math.max(0.001,num(r['packSize']))),0); }
  if (slug === 'sales-orders') full['value'] = round(qty*num(r['rate']));
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
  returns:{sale:'sales-orders'}, dispatch:{so:'sales-orders',transporter:'transporters'}, deliveries:{dc:'dispatch'}, invoices:{dc:'dispatch'},
  'supplier-prices':{dc:'trips'}, transport:{transporter:'transporters',ref:'trips'},
};
export function referenceModule(slug: string, key: string, r: Row) {
  if (slug === 'transport' && key === 'ref') {
    if (r['direction'] === 'Outward') return 'sales-orders';
    if (r['direction'] === 'Outward Return') return 'returns';
    return 'trips';
  }
  return references[slug]?.[key];
}
export function populate(slug: string, key: string, value: string, form: Row, data: Data): Row {
  const target = referenceModule(slug,key,form); const ref = (data[target || ''] || []).find(r=>r.id===value || r['name']===value);
  let r: Row = { ...form,[key]:value }; if (!ref) return r;
  if (key === 'transporter') return { ...r, vehicle:ref['vehicle'] || '',driver:ref['driver'] || '',driverPhone:ref['phone'] || '' };
  if (key === 'supplier') return r;
  if (key === 'buyer') return slug === 'sales-orders' ? { ...r, po:'', item:'[]', qty:0, bags:'' } : r;
  if (slug === 'receipts') {
    const tripBuys = ref['buys'] ? parseBuys(ref['buys']) : [];
    const sup = ref['supplier'] || (tripBuys.length > 0 ? [...new Set(tripBuys.map(b => b.s).filter(Boolean))].join(', ') : '');
    r = {
      ...r,
      item: ref['item'] || '',
      sent: num(ref['net']),
      received: num(ref['net']),
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
    const used = (data['quality-check'] || []).filter(x=>x.id!==form.id && x['lot']===value);
    const ls = lines(ref, target==='receipts'?'received':'qty').map(l=>({p:l.p,q:Math.max(0,round(l.q-used.reduce((s,x)=>s+(lines(x,'input').find(i=>i.p===l.p)?.q || 0),0))),a:0,a2:0,b:0,ret:0})).filter(l=>l.q>0);
    r = {...r,item:JSON.stringify(ls)};
  }
  if (slug === 'sales-orders' && key==='po') {
    const sold = (data['sales-orders'] || []).filter(x=>x.id!==form.id && x['po']===value);
    const others = { ...data, 'sales-orders': (data['sales-orders'] || []).filter(x=>x.id!==form.id) };
    const packed = stock(others).filter(x=>x.category==='Packed');
    const ls = lines(ref).map(l=>{ const open = round(l.q - sold.reduce((s,x)=>s+(lines(x).find(i=>i.p===l.p)?.q || 0),0)); const avail = packed.find(x=>x.product===l.p)?.qty || 0; return { p:l.p, q:Math.max(0,Math.min(open,avail)) }; }).filter(l=>l.q>0);
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
    r={...r,buyer:ref['buyer'] || '',item:JSON.stringify(ls),bags,packs:JSON.stringify(packs)};
  }
  if (slug === 'packing' && key==='po') {
    const used = (data['packing'] || []).filter(x=>x.id!==form.id && x['po']===value);
    const ls = lines(ref).map(l=>({...l,q:Math.max(0,round(l.q-used.reduce((s,x)=>s+(lines(x).find(i=>i.p===l.p)?.q || 0),0)))})).filter(l=>l.q>0);
    r={...r,buyer:ref['buyer'] || '',item:JSON.stringify(ls)};
  }
  if (slug === 'returns') r={...r,buyer:ref['buyer'] || '',item:JSON.stringify(lines(ref).map(l=>({...l,q:0})))};
  if (slug === 'dispatch') r={...r,buyer:ref['buyer'] || '',item:ref['item'] || '',qty:num(ref['qty']) || num(ref['net']),supplier:ref['supplier'] || ''};
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
  if (slug === 'deliveries') r={...r,buyer:ref['buyer'] || '',accepted:num(ref['qty']),issueQty:0};
  if (slug === 'invoices') { const sale=(data['sales-orders'] || []).find(x=>x.id===ref['so']); r={...r,buyer:ref['buyer'] || '',taxable:num(sale?.['value'])}; }
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
export function validateData(data: Data): string | null {
  const negative = stock(data).find(s=>s.qty < -0.001); if (negative) return `${negative.product}: insufficient ${negative.category} stock (${negative.qty} kg).`;
  for (const slug of ['purchase-orders','trips','receipts','quality-check','packing','sales-orders','returns','transport','dispatch']) {
    const seen = new Set<string>();
    for (const r of data[slug] || []) {
      if (seen.has(r.id)) return `Duplicate reference ${r.id}.`; seen.add(r.id);
      const ls = lines(r,slug==='receipts'?'received':slug==='quality-check'?'input':'qty');
      if (new Set(ls.map(l=>l.p)).size!==ls.length) return `${r.id}: duplicate products are not allowed.`;
      if (ls.some(l=>!Number.isFinite(l.q) || l.q<0)) return `${r.id}: quantities cannot be negative.`;
      if (['purchase-orders','trips','quality-check','packing','sales-orders','returns'].includes(slug) && (!ls.length || ls.some(l=>l.q<=0 && !(slug==='quality-check' && num(l.ret)>0)))) return `${r.id}: select products with positive KG quantities.`;
      if (slug==='trips' && num(r['rate'])<0) return 'Purchase price cannot be negative.';
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
        const sourceType = 'receipts'; const ref=(data[sourceType] || []).find(x=>x.id===r['lot']);
        if (!ref || ref.status!=='Posted') return `${r.id}: select a received, posted source.`;
        for (const l of ls) {
          if ([num(l.a),num(l.a2),num(l.b),num(l.ret)].some(q=>q<0) || num(l.a)>l.q || num(l.a2)+num(l.b)>round(l.q-num(l.a)+num(l.ret))) return `${r.id}: grades cannot exceed ${l.p} input quantity.`;
          const received = lines(ref,'received').find(x=>x.p===l.p)?.q || 0;
          const graded = (data['quality-check'] || []).filter(x=>x['lot']===r['lot'] ).reduce((s,x)=>s+(lines(x,'input').find(i=>i.p===l.p)?.q || 0),0);
          if (graded>received+0.001) return `${r.id}: ${l.p} is already assigned or graded; input exceeds source.`;
        }
      }
      if (slug==='receipts') {
        const ref=(data['trips'] || []).find(x=>x.id===r['dc']); if (!ref || ref.status!=='Submitted') return `${r.id}: select a submitted purchase.`;
        if ((data['receipts'] || []).filter(x=>x['dc']===r['dc']).length>1) return 'A purchase can have only one warehouse receipt.';
        for (const l of ls) if (l.q>(lines(ref,'net').find(x=>x.p===l.p)?.q || 0)+0.001) return `${l.p}: receipt exceeds purchased quantity.`;
      }
      if (slug==='packing') {
        if (num(r['packSize'])<=0) return 'Bag size must be greater than zero KG.';
        const po=(data['purchase-orders'] || []).find(x=>x.id===r['po']); if (r['po'] && (!po || po.status==='Rejected')) return 'Select an accepted buyer demand.';
        if (po) for (const l of ls) {
          const allocated=(data['packing'] || []).filter(x=>x['po']===r['po']).reduce((s,x)=>s+(lines(x).find(i=>i.p===l.p)?.q || 0),0);
          const poLs = lines(po); const totalBase = poLs.reduce((s, x) => s + x.q, 0); const poLine = poLs.find(x => x.p === l.p);
          const extra = num(po['extraKg']); const extraShare = extra > 0 && poLine ? (totalBase > 0 ? (extra * poLine.q / totalBase) : (extra / Math.max(1, poLs.length))) : 0;
          const maxAllowed = (poLine?.q || 0) + extraShare;
          if (allocated > maxAllowed + 0.001) return `${l.p}: allocation exceeds buyer demand.`;
        }
      }
      if (slug==='sales-orders') {
        const po=(data['purchase-orders'] || []).find(x=>x.id===r['po']); if (!po) return `${r.id}: select the buyer demand to supply.`;
        if (po['buyer']!==r['buyer']) return 'Sale buyer must match the buyer demand.';
        for (const l of ls) {
          const sold=(data['sales-orders'] || []).filter(x=>x['po']===r['po']).reduce((s,x)=>s+(lines(x).find(i=>i.p===l.p)?.q || 0),0);
          const poLs = lines(po); const totalBase = poLs.reduce((s, x) => s + x.q, 0); const poLine = poLs.find(x => x.p === l.p);
          const extra = num(po['extraKg']); const extraShare = extra > 0 && poLine ? (totalBase > 0 ? (extra * poLine.q / totalBase) : (extra / Math.max(1, poLs.length))) : 0;
          const maxAllowed = (poLine?.q || 0) + extraShare;
          if (sold > maxAllowed + 0.001) return `${l.p}: sale exceeds buyer demand.`;
        }
      }
      if (slug==='returns') {
        const sale=(data['sales-orders'] || []).find(x=>x.id===r['sale']); if (!sale || !activeSale(sale)) return 'Returns require an original dispatched sale.';
        for (const l of ls) { const returned=(data['returns'] || []).filter(x=>x['sale']===r['sale']).reduce((s,x)=>s+(lines(x).find(i=>i.p===l.p)?.q || 0),0); if (returned>(lines(sale).find(x=>x.p===l.p)?.q || 0)+0.001) return `${l.p}: returned quantity exceeds original sale.`; }
      }
      if (slug==='dispatch' || slug==='transport') {
        const inward = slug === 'transport' && (r['direction'] === 'Inward' || r['direction'] === 'Inward Return');
        const outwardReturn = slug === 'transport' && r['direction'] === 'Outward Return';
        const key = slug === 'dispatch' ? 'so' : 'ref';
        const targetModule = inward ? 'trips' : outwardReturn ? 'returns' : 'sales-orders';
        const ref = (data[targetModule] || []).find(x => x.id === r[key]);
        if (!ref) return 'Select a valid purchase, return, or sales reference.';
        if (!inward && !outwardReturn && !activeSale(ref)) return 'Outward transport requires a dispatched sale.';
        if ((data[slug] || []).filter(x => x[key] === r[key] && (slug === 'dispatch' || x['direction'] === r['direction'])).length > 1) return 'Transport already exists for this reference.';
        if (num(r['qty']) > total(lines(ref, inward ? 'net' : 'qty')) + 0.001) return 'Loading quantity exceeds referenced quantity.';
      }
    }
  }
  return null;
}
