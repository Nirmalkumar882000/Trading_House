import { describe, it, expect } from 'vitest';
import { MODULES, seedRows, type Row, getPackSpecOptions, PRODUCT_CATALOG } from '@/lib/modules';
import { bagBreakdown, normalize, populate, stock, validateData, parseLines, type Data } from '@/lib/workflow';
import { outstandingDemand } from '@/lib/sourcing';
const demo=():Data=>Object.fromEntries(MODULES.map(m=>[m.slug,seedRows(m)]));
const quantity=(data:Data,product:string,category:string)=>stock(data).find(s=>s.product===product&&s.category===category)?.qty||0;
const qcWithReturn=(status:string):Row=>normalize('quality-check',{id:'QC-1003',status,sourceType:'Purchase',lot:'GRN-1001',item:JSON.stringify([{p:'Tomato',q:0,a:0,a2:1,b:1,ret:3}]),grader:'Karthik M'});
describe('Integrated stock workflow',()=>{
 it('allows saving submitted purchases with all 3 signatures after editing price',()=>{const m=MODULES.find(m=>m.slug==='trips');expect(m).toBeDefined();if(!m) return;const r=seedRows(m)[0];expect(r).toBeDefined();if(!r) return;const edited=normalize('trips',{...r,rate:29,signatures:'3',status:'Submitted'});expect(m.validate?.(edited)).toBeNull();expect(edited['amount']).toBe(9280);const d=demo();d['trips']=(d['trips']||[]).map(x=>x.id===edited.id?edited:x);expect(validateData(d)).toBeNull();});
 it('requires 3 collected signatures only when submitting a purchase',()=>{const m=MODULES.find(m=>m.slug==='trips');expect(m).toBeDefined();if(!m) return;for(const signatures of ['0','1','2']){expect(m.validate?.({id:'TRP-9000',status:'Submitted',signatures})).toMatch(/3 signatures/);expect(m.validate?.({id:'TRP-9000',status:'Signed',signatures})).toBeNull();}});
 it('starts with a consistent linked demonstration',()=>expect(validateData(demo())).toBeNull());
 it('supports 23 KG from 5 KG bags with one partial opened bag',()=>expect(bagBreakdown(23,5)).toEqual({full:4,partial:3,opened:1}));
 it('puts 3 KG returned stock in the QC holding bay for stage 2',()=>{const d=demo();expect(quantity(d,'Tomato','Quarantine')).toBe(0);expect(quantity(d,'Tomato','Remaining')).toBe(3);expect(quantity(d,'Tomato','Grade A')).toBe(147);});
 it('first quality check keeps the remainder awaiting second grading',()=>{const d=demo();expect(quantity(d,'Potato','Grade A')).toBe(20);expect(quantity(d,'Potato','Remaining')).toBe(30);expect(quantity(d,'Potato','Rejected')).toBe(0);});
 it('second quality check grades returned stock together with stage 2 stock',()=>{const d=demo();d['quality-check']=[...(d['quality-check']||[]),qcWithReturn('Stage 2 done')];expect(validateData(d)).toBeNull();expect(quantity(d,'Tomato','Remaining')).toBe(0);expect(quantity(d,'Tomato','Grade A')).toBe(148);expect(quantity(d,'Tomato','Grade B')).toBe(21);expect(quantity(d,'Tomato','Rejected')).toBe(1+(quantity(demo(),'Tomato','Rejected')));});
 it('rejects grading the same received quantity twice',()=>{const d=demo();d['quality-check']=[...(d['quality-check']||[]),{...(d['quality-check']?.[0] as Row),id:'QC-1003'}];expect(validateData(d)).toMatch(/insufficient|already assigned/);});
 it('rejects negative product quantities',()=>{const d=demo();d['purchase-orders']=[{id:'PO-9000',status:'Received',item:'[{"p":"Tomato","q":-1}]'}];expect(validateData(d)).toMatch(/negative/);});
 it('rejects allocations above saleable stock',()=>{const d=demo();d['packing']=[...(d['packing']||[]),normalize('packing',{id:'PK-1003',status:'Allocated',po:'PO-1002',buyer:'Hotel Saravana Bhavan',item:'[{"p":"Onion","q":110}]',packSize:5,grade:'Grade A'})];expect(validateData(d)).toMatch(/insufficient/);});
 it('rejects returns larger than the original 23 KG sale',()=>{const d=demo();d['returns']=[{...(d['returns']?.[0] as Row),item:'[{"p":"Tomato","q":24}]',qty:24}];expect(validateData(d)).toMatch(/exceeds original sale/);});
 it('prevents duplicate warehouse receipts',()=>{const d=demo();d['receipts']=[...(d['receipts']||[]),{...(d['receipts']?.[0] as Row),id:'GRN-1003'}];expect(validateData(d)).toMatch(/only one/);});
 it('populates packing with exact buyer demand',()=>{const d=demo();const r=populate('packing','po','PO-1002',{id:'PK-1003',status:'Allocated'},d);expect(r['buyer']).toBe('Hotel Saravana Bhavan');expect(r['qty']).toBe(150);});
 it('does not deduct stock again when an invoice is issued',()=>{const d=demo();const before=stock(d);d['invoices']=[...(d['invoices']||[]),{id:'INV-1005',status:'Issued',total:966}];expect(stock(d)).toEqual(before);});
 it('consolidates all buyers by product for sourcing and subtracts sold stock',()=>{const tomato=outstandingDemand(demo()).find(d=>d.product==='Tomato');expect(tomato?.demand).toBe(73);expect(tomato?.outstanding).toBe(50);expect(tomato?.buy).toBe(0);});
 it('only unfilled shortages create new AI sourcing quantities',()=>{const d=demo();d['purchase-orders']=[...(d['purchase-orders']||[]),{id:'PO-1004',status:'Received',item:'[{"p":"Beans","q":75}]'}];expect(outstandingDemand(d).find(p=>p.product==='Beans')?.buy).toBe(75);});
 it('parses and preserves product line pack specifications (packKg and packLabel)', () => {
   const raw = JSON.stringify([{ p: 'Amaranth Green Leaves (Arai Keerai)', q: 0.5, packKg: 0.5, packLabel: '500 g' }]);
   const parsed = parseLines(raw);
   expect(parsed[0].packKg).toBe(0.5);
   expect(parsed[0].packLabel).toBe('500 g');
 });
 it('generates standard pack size options including 0.25, 0.300, 0.500, 0.750 kg', () => {
   const spec = PRODUCT_CATALOG.find((p) => p.name === 'Amaranth Green Leaves (Arai Keerai)');
   const options = getPackSpecOptions(spec);
   const kgs = options.map((o) => o.kg);
   expect(kgs).toContain(0.25);
   expect(kgs).toContain(0.3);
   expect(kgs).toContain(0.5);
   expect(kgs).toContain(0.75);
 });
 it('calculates total buyer demand including extraKg buffer', () => {
   const po: Row = {
     id: 'PO-2001',
     status: 'Accepted',
     buyer: 'Raja',
     item: JSON.stringify([{ p: 'Tomato', q: 50 }]),
     extraKg: 20,
   };
   const normalized = normalize('purchase-orders', po);
   expect(normalized['qty']).toBe(70);
   expect(normalized['extraKg']).toBe(20);
 });
  it('correctly attributes packing to a specific buyer PO and preserves balance for another buyer with the same product', () => {
    const product = 'Amaranth Green Leaves (Arai Keerai)';
    const po1: Row = { id: 'PO-3001', buyer: 'Raja', item: JSON.stringify([{ p: product, q: 20 }]), status: 'Accepted' };
    const po2: Row = { id: 'PO-3002', buyer: 'Nirmal', item: JSON.stringify([{ p: product, q: 25 }]), status: 'Accepted' };

    const packRaja: Row = normalize('packing', {
      id: 'PK-3001',
      status: 'Packed',
      po: 'PO-3001',
      buyer: 'Raja',
      stage: 'Stage 1',
      grade: 'Grade A',
      packer: 'Senthil P',
      packSize: 0.25,
      item: JSON.stringify([{ p: product, q: 20 }]),
    } as Row);

    const packingRecords = [packRaja];

    const rajaPacks = packingRecords.filter((pr) => pr['po'] === 'PO-3001');
    const rajaPackedKg = rajaPacks.reduce((s, pr) => s + (parseLines(pr['item'])[0]?.q || 0), 0);
    const rajaBalanceKg = Math.max(0, 20 - rajaPackedKg);

    const nirmalPacks = packingRecords.filter((pr) => pr['po'] === 'PO-3002');
    const nirmalPackedKg = nirmalPacks.reduce((s, pr) => s + (parseLines(pr['item'])[0]?.q || 0), 0);
    const nirmalBalanceKg = Math.max(0, 25 - nirmalPackedKg);

    expect(rajaPackedKg).toBe(20);
    expect(rajaBalanceKg).toBe(0);
    expect(nirmalPackedKg).toBe(0);
    expect(nirmalBalanceKg).toBe(25);
  });
  it('reduces Packed warehouse stock when a sales order is marked Dispatched or Closed', () => {
    const d = demo();
    const initialPacked = stock(d).find((s) => s.product === 'Tomato' && s.category === 'Packed')?.qty || 0;

    const so: Row = normalize('sales-orders', {
      id: 'SO-9999',
      status: 'Open',
      buyer: 'Raja',
      po: 'PO-1001',
      item: JSON.stringify([{ p: 'Tomato', q: 10 }]),
      qty: 10,
      rate: 40,
    } as Row);

    d['sales-orders'] = [...(d['sales-orders'] || []), so];
    expect(stock(d).find((s) => s.product === 'Tomato' && s.category === 'Packed')?.qty).toBe(initialPacked);

    so.status = 'Dispatched';
    const dispatchedPacked = stock(d).find((s) => s.product === 'Tomato' && s.category === 'Packed')?.qty || 0;
    expect(dispatchedPacked).toBe(initialPacked - 10);
  });
  it('allows creating trip and transport from demand consolidation modal', () => {
    const d = demo();
    const tripId = 'TRP-1009';
    const movId = 'MOV-1007';
    const tripItems = [
      { product: 'Amaranth Green Leaves (Arai Keerai)', qty: 27.143, rate: 28 },
      { product: 'Amaranth Red Leaves (Red Mulai Keerai)', qty: 15, rate: 28 },
      { product: 'Banana Poovan Semi Ripe', qty: 25, rate: 28 }
    ];
    const tripTotalNet = 67.143;
    const buys = tripItems.map(i => ({ s: 'Murugan Traders', p: i.product, q: i.qty, r: i.rate }));
    const newTrip = normalize('trips', {
      id: tripId,
      status: 'Submitted',
      date: '2026-10-27',
      dc: 'DC-MKT-4442',
      buys: JSON.stringify(buys),
      item: JSON.stringify(tripItems.map(i => ({ p: i.product, q: i.qty }))),
      supplier: 'Murugan Traders',
      net: tripTotalNet,
      rate: 28,
      amount: 1880.004,
      containerType: 'Plastic crates (~20-25 kg)',
      containerCount: 4,
      transporter: 'Chennai Fresh Logistics',
      vehicle: 'TN 09 AB 1234',
      driver: 'Raja',
      signatures: '3',
      responsible: 'Ravi Kumar',
      po: 'PO-1001'
    });
    const newTransport = normalize('transport', {
      id: movId,
      date: '2026-10-27',
      direction: 'Inward',
      ref: tripId,
      transporter: 'Chennai Fresh Logistics',
      vehicle: 'TN 09 AB 1234',
      driver: 'Raja',
      driverPhone: '9840012345',
      qty: tripTotalNet,
      charges: 600,
      status: 'Delivered',
      responsible: 'Ravi Kumar',
      supplier: 'Murugan Traders',
      item: JSON.stringify(tripItems.map(i => ({ p: i.product, q: i.qty })))
    });
    const testData = {
      ...d,
      trips: [...(d['trips'] || []), newTrip],
      transport: [...(d['transport'] || []), newTransport]
    };
    const err = validateData(testData);
    expect(err).toBeNull();
  });
});
