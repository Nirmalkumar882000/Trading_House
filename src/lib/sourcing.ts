import { lines, stock, round, type Data } from './workflow';

export function outstandingDemand(data: Data) {
  const map = new Map<string, { product: string; demand: number; sold: number; saleable: number; inPipeline: number; outstanding: number; buy: number }>();
  const get = (p: string) => {
    const r = map.get(p) || { product: p, demand: 0, sold: 0, saleable: 0, inPipeline: 0, outstanding: 0, buy: 0 };
    map.set(p, r);
    return r;
  };

  for (const r of data['purchase-orders'] || []) {
    if (r.status !== 'Rejected') {
      const ls = lines(r);
      const totalQ = ls.reduce((s, l) => s + l.q, 0);
      const extra = Number(r['extraKg']) || 0;
      const hasLineExtra = ls.some(l => l.extraKg !== undefined);

      if (hasLineExtra) {
        for (const l of ls) {
          const extraShare = l.extraKg !== undefined ? Number(l.extraKg) || 0 : 0;
          get(l.p).demand += Math.round((l.q + extraShare) * 100) / 100;
        }
      } else if (extra > 0 && totalQ > 0) {
        let remainingExtra = extra;
        const sorted = [...ls].sort((a, b) => b.q - a.q);
        const allocated = new Map<string, number>();
        const isInt = Number.isInteger(extra) && ls.every(x => Number.isInteger(x.q));

        for (let i = 0; i < sorted.length; i++) {
          const l = sorted[i];
          if (i === sorted.length - 1) {
            allocated.set(l.p, (allocated.get(l.p) || 0) + remainingExtra);
          } else {
            const share = isInt
              ? Math.round(extra * (l.q / totalQ))
              : Math.round(extra * (l.q / totalQ) * 100) / 100;
            const safeShare = Math.min(remainingExtra, Math.max(0, share));
            allocated.set(l.p, (allocated.get(l.p) || 0) + safeShare);
            remainingExtra = isInt ? remainingExtra - safeShare : Math.round((remainingExtra - safeShare) * 100) / 100;
          }
        }
        for (const l of ls) {
          const extraShare = allocated.get(l.p) || 0;
          get(l.p).demand += Math.round((l.q + extraShare) * 100) / 100;
        }
      } else {
        for (const l of ls) {
          get(l.p).demand += Math.round(l.q * 100) / 100;
        }
      }
    }
  }

  for (const r of data['sales-orders'] || []) {
    if (['Dispatched', 'Closed'].includes(r.status)) {
      for (const l of lines(r)) {
        get(l.p).sold += l.q;
      }
    }
  }

  for (const s of stock(data)) {
    if (['Grade A', 'Allocated', 'Packed'].includes(s.category)) {
      get(s.product).saleable += s.qty;
    }
    if (['Ungraded', 'Remaining'].includes(s.category)) {
      get(s.product).inPipeline += s.qty;
    }
  }

  for (const r of data['trips'] || []) {
    for (const l of lines(r, 'net')) {
      const received = (data['receipts'] || []).filter(x => x['dc'] === r.id && x.status === 'Posted').reduce((s, x) => s + (lines(x, 'received').find(i => i.p === l.p)?.q || 0), 0);
      get(l.p).inPipeline += Math.max(0, l.q - received);
    }
  }

  return [...map.values()]
    .map(r => ({
      ...r,
      demand: Math.round(r.demand * 100) / 100,
      outstanding: Math.round(Math.max(0, r.demand - r.sold) * 100) / 100,
      buy: Math.round(Math.max(0, r.demand - r.sold - r.saleable - r.inPipeline) * 100) / 100,
    }))
    .filter(r => r.demand > 0);
}
