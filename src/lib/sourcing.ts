import { lines, stock, round, type Data } from './workflow';
export function outstandingDemand(data: Data) {
 const map = new Map<string,{ product:string; demand:number; sold:number; saleable:number; inPipeline:number; outstanding:number; buy:number }>();
 const get=(p:string)=>{const r=map.get(p)||{product:p,demand:0,sold:0,saleable:0,inPipeline:0,outstanding:0,buy:0};map.set(p,r);return r;};
 for(const r of data['purchase-orders']||[]) if(r.status!=='Rejected') {
   const ls = lines(r); const totalQ = ls.reduce((s,l)=>s+l.q,0); const extra = Number(r['extraKg'])||0;
   for(const l of ls) {
     const extraShare = extra > 0 ? (extra * (totalQ > 0 ? (l.q / totalQ) : (1 / Math.max(1, ls.length)))) : 0;
     get(l.p).demand += round(l.q + extraShare);
   }
 }
 for(const r of data['sales-orders']||[]) if(['Dispatched','Closed'].includes(r.status)) for(const l of lines(r)) get(l.p).sold+=l.q;
 for(const s of stock(data)) { if(['Grade A','Allocated','Packed'].includes(s.category)) get(s.product).saleable+=s.qty; if(['Ungraded','Remaining'].includes(s.category))get(s.product).inPipeline+=s.qty; }
 for(const r of data['trips']||[]) for(const l of lines(r,'net')) { const received=(data['receipts']||[]).filter(x=>x['dc']===r.id && x.status==='Posted').reduce((s,x)=>s+(lines(x,'received').find(i=>i.p===l.p)?.q||0),0); get(l.p).inPipeline+=Math.max(0,l.q-received); }
 return [...map.values()].map(r=>({...r,outstanding:round(Math.max(0,r.demand-r.sold)),buy:round(Math.max(0,r.demand-r.sold-r.saleable-r.inPipeline))})).filter(r=>r.demand>0);
}
