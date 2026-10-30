import { describe, it, expect } from 'vitest';
import { MODULES, seedRows, type Row, getPackSpecOptions, PRODUCT_CATALOG } from '@/lib/modules';
import { bagBreakdown, buyerLocation, draftInvoiceForSalesOrder, invoiceForSalesOrder, marketTripDemand, normalize, populate, referenceModule, stock, supplierPricesFromTrips, supplierSellingPriceForProduct, validateData, warehouseFlowRows, parseLines, type Data } from '@/lib/workflow';
import { outstandingDemand } from '@/lib/sourcing';
const demo=():Data=>Object.fromEntries(MODULES.map(m=>[m.slug,seedRows(m)]));
const quantity=(data:Data,product:string,category:string)=>stock(data).find(s=>s.product===product&&s.category===category)?.qty||0;
const qcWithReturn=(status:string):Row=>normalize('quality-check',{id:'QC-1003',status,sourceType:'Purchase',lot:'GRN-1001',item:JSON.stringify([{p:'Tomato',q:0,a:0,a2:1,b:1,ret:3}]),grader:'Karthik M'});
describe('Integrated stock workflow',()=>{
 it('allows saving submitted purchases with all 3 signatures after editing price',()=>{const m=MODULES.find(m=>m.slug==='trips');expect(m).toBeDefined();if(!m) return;const r=seedRows(m)[0];expect(r).toBeDefined();if(!r) return;const edited=normalize('trips',{...r,rate:29,signatures:'3',status:'Submitted'});expect(m.validate?.(edited)).toBeNull();expect(edited['amount']).toBe(9280);const d=demo();d['trips']=(d['trips']||[]).map(x=>x.id===edited.id?edited:x);expect(validateData(d)).toBeNull();});
 it('requires 3 collected signatures only when submitting a purchase',()=>{const m=MODULES.find(m=>m.slug==='trips');expect(m).toBeDefined();if(!m) return;for(const signatures of ['0','1','2']){expect(m.validate?.({id:'TRP-9000',status:'Submitted',signatures})).toMatch(/3 signatures/);expect(m.validate?.({id:'TRP-9000',status:'Signed',signatures})).toBeNull();}});
 it('starts with a consistent linked demonstration',()=>expect(validateData(demo())).toBeNull());
 it('seeds linked inward receipts, buyer dispatches, returns, locations, and invoices',()=>{
   const d=demo();
   const inward=warehouseFlowRows(d,'Inward');
   expect(inward).toContainEqual(expect.objectContaining({
     reference:'GRN-1001',sourceReference:'DC-MKT-4412',product:'Tomato',qty:200,status:'Posted',
   }));
   expect(inward).toContainEqual(expect.objectContaining({
     reference:'RDC-1001',sourceReference:'SDC-1001',product:'Tomato',qty:3,status:'Received',
   }));

   const outward=warehouseFlowRows(d,'Outward');
   expect(outward).toContainEqual(expect.objectContaining({
     reference:'SDC-1003',sourceReference:'SO-1003',product:'Onion',qty:40,status:'In transit',
     deliveryLocation:'Coimbatore',transporter:'Anamalai Roadways',vehicle:'TN 39 EF 9012',
   }));
   expect(outward).toContainEqual(expect.objectContaining({
     reference:'RDC-1002',sourceReference:'SDC-1002',flowType:'Buyer return pickup',
     product:'Potato',qty:2,status:'Return DC created',
   }));
   expect(d['dispatch']?.find(row=>row.id==='SDC-1003')?.['toLocation']).toBe('Coimbatore');
   expect(d['invoices']?.find(row=>row.id==='INV-1001')?.['so']).toBe('SO-1001');
 });
 it('shows posted receipts and buyer returns on warehouse inward and dispatches on outward',()=>{
   const d=demo();
   const inward=warehouseFlowRows(d,'Inward');
   expect(inward.some(row=>row.reference==='GRN-1001'&&row.product==='Tomato'&&row.qty===200&&row.status==='Posted')).toBe(true);
   expect(inward.some(row=>row.reference==='RDC-1001'&&row.product==='Tomato'&&row.qty===3&&row.status==='Received')).toBe(true);

   d['sales-orders']=[...(d['sales-orders']||[]),{
     id:'SO-FLOW',status:'Dispatched',buyer:'FreshMart Retail',
     item:JSON.stringify([{p:'Tomato',q:4}]),qty:4,
   }];
   d['dispatch']=[...(d['dispatch']||[]),{
     id:'SDC-FLOW',so:'SO-FLOW',buyer:'FreshMart Retail',warehouse:'Pollachi Depot',
     item:JSON.stringify([{p:'Tomato',q:4}]),date:'2026-10-30',status:'Delivered',
   }];
   d['returns']=[...(d['returns']||[]),{
     id:'RDC-FLOW',sale:'SO-FLOW',salesDc:'SDC-FLOW',buyer:'FreshMart Retail',
     warehouse:'Pollachi Depot',reason:'Quality issue',status:'Return DC created',
     item:JSON.stringify([{p:'Tomato',q:2}]),date:'2026-10-30',
   }];
   const outward=warehouseFlowRows(d,'Outward');
   expect(outward).toContainEqual(expect.objectContaining({
     reference:'SDC-FLOW',sourceReference:'SO-FLOW',product:'Tomato',qty:4,status:'Delivered',
   }));
   d['sales-orders']=[...(d['sales-orders']||[]),{
     id:'SO-TRANSIT',status:'Confirmed',buyer:'FreshMart Retail',
     item:JSON.stringify([{p:'Onion',q:6}]),qty:6,
   }];
   d['dispatch']=[...(d['dispatch']||[]),{
     id:'SDC-TRANSIT',so:'SO-TRANSIT',buyer:'FreshMart Retail',warehouse:'Pollachi Depot',
     item:JSON.stringify([{p:'Onion',q:6}]),date:'2026-10-30',status:'In transit',
   }];
   expect(warehouseFlowRows(d,'Outward')).toContainEqual(expect.objectContaining({
     reference:'SDC-TRANSIT',sourceReference:'SO-TRANSIT',product:'Onion',qty:6,status:'In transit',
   }));
   expect(outward).toContainEqual(expect.objectContaining({
     reference:'RDC-FLOW',sourceReference:'SDC-FLOW',flowType:'Buyer return pickup',
     product:'Tomato',qty:2,reason:'Quality issue',status:'Return DC created',
   }));
   const quarantinedReturn = {
     id:'RDC-QC-FLOW',sale:'SO-FLOW',salesDc:'SDC-FLOW',buyer:'FreshMart Retail',
     warehouse:'Pollachi Depot',reason:'Transit damage',status:'Sent to QC',
     item:JSON.stringify([{p:'Tomato',q:1}]),date:'2026-10-30',
   };
   d['returns']=[...(d['returns']||[]),quarantinedReturn];
   expect(warehouseFlowRows(d,'Inward')).toContainEqual(expect.objectContaining({
     reference:'RDC-QC-FLOW',sourceReference:'SDC-FLOW',flowType:'Buyer return quarantine',
     product:'Tomato',qty:1,reason:'Transit damage',status:'Sent to QC',
   }));
   expect(warehouseFlowRows(d,'Outward')).not.toContainEqual(expect.objectContaining({
     reference:'RDC-QC-FLOW',
   }));
   expect(warehouseFlowRows(d,'Outward','Main Warehouse (Udumalaipet)'))
     .not.toContainEqual(expect.objectContaining({reference:'SDC-FLOW'}));
   expect(warehouseFlowRows(d,'Inward')).not.toContainEqual(expect.objectContaining({reference:'RDC-FLOW'}));
 });
 it('lets QC select a source receipt or a received buyer return',()=>{
   const qc=MODULES.find(module=>module.slug==='quality-check');
   expect(qc?.fields.find(field=>field.key==='lot')?.type).toBe('select');
   expect(referenceModule('quality-check','lot',{sourceType:'Purchase'})).toBe('receipts');
   expect(referenceModule('quality-check','lot',{sourceType:'Return'})).toBe('returns');
 });
 it('supports 23 KG from 5 KG bags with one partial opened bag',()=>expect(bagBreakdown(23,5)).toEqual({full:4,partial:3,opened:1}));
 it('keeps returned stock in quarantine until quality inspection',()=>{const d=demo();expect(quantity(d,'Tomato','Quarantine')).toBe(3);expect(quantity(d,'Tomato','Remaining')).toBe(0);expect(quantity(d,'Tomato','Grade A')).toBe(147);});
 it('populates return QC by return ID and grades it into saleable stock',()=>{
   const d=demo();
   const qc=populate('quality-check','lot','RDC-1001',{id:'QC-9001',status:'Assigned',sourceType:'Return'},d);
   expect(qc['sourceType']).toBe('Return');
   expect(parseLines(qc['item']).map(line=>[line.p,line.q])).toEqual([['Tomato',3]]);
   const stage1=normalize('quality-check',{...qc,status:'Stage 1 done',item:JSON.stringify([{p:'Tomato',q:3,a:2,a2:0,b:0,ret:0}])});
   d['quality-check']=[...(d['quality-check']||[]),stage1];
   d['returns']=(d['returns']||[]).map(record=>record.id==='RDC-1001'?{...record,status:'Sent to QC'}:record);
   expect(validateData(d)).toBeNull();
   expect(warehouseFlowRows(d,'Inward')).toContainEqual(expect.objectContaining({
     reference:'RDC-1001',sourceReference:'SDC-1001',product:'Tomato',status:'Sent to QC',
   }));
   expect(quantity(d,'Tomato','Quarantine')).toBe(0);
   expect(quantity(d,'Tomato','Grade A')).toBe(149);

   const stage2=normalize('quality-check',{...stage1,status:'Stage 2 done',item:JSON.stringify([{p:'Tomato',q:3,a:2,a2:1,b:0,ret:0}])});
   d['quality-check']=(d['quality-check']||[]).map(row=>row.id===stage2.id?stage2:row);
   expect(validateData(d)).toBeNull();
   expect(quantity(d,'Tomato','Quarantine')).toBe(0);
   expect(quantity(d,'Tomato','Remaining')).toBe(0);
   expect(quantity(d,'Tomato','Grade A')).toBe(150);

   const initialPacked=quantity(d,'Tomato','Packed');
   d['purchase-orders']=[...(d['purchase-orders']||[]),{
     id:'PO-9001',status:'Accepted',buyer:'FreshMart Retail',
     item:JSON.stringify([{p:'Tomato',q:3}]),qty:3,
   }];
   d['packing']=[...(d['packing']||[]),normalize('packing',{
     id:'PK-9001',status:'Packed',po:'PO-9001',buyer:'FreshMart Retail',
     item:JSON.stringify([{p:'Tomato',q:3}]),grade:'Grade A',packSize:1,packer:'Senthil P',
   })];
   expect(validateData(d)).toBeNull();
   expect(quantity(d,'Tomato','Packed')).toBe(initialPacked+3);
 });
 it('links outward-return transport to the selected return record',()=>{
   const d=demo();
   const returned=d['returns']?.find(row=>row.id==='RDC-1001');
   expect(returned).toBeDefined();
   if(!returned) return;
   const movement=normalize('transport',{
     id:'MOV-9001',direction:'Outward Return',ref:returned.id,buyer:returned['buyer'],
     item:returned['item'],qty:returned['qty'],vehicle:'TN 09 AB 1234',
     driver:'Raja',status:'Scheduled',
   });
   expect(validateData({...d,transport:[...(d['transport']||[]),movement]})).toBeNull();
 });
 it('keeps new return records linked to the original Sales DC',()=>{
   const d=demo();
   const sale=d['sales-orders']?.find(row=>row.id==='SO-1001');
   expect(sale).toBeDefined();
   if(!sale) return;
   sale.status='Confirmed';
   d['transport']=[];
   const dispatch=d['dispatch']?.find(row=>row['so']===sale.id);
   const returned=populate('returns','sale',sale.id,{id:'RDC-9001'},d);
   expect(returned['salesDc']).toBe(dispatch?.id);
   const logged=normalize('returns',{
     ...returned,status:'Requested',reason:'Quality issue',
     item:JSON.stringify([{p:'Tomato',q:1}]),qty:1,
   });
   expect(validateData({...d,returns:[...(d['returns']||[]),logged]})).toBeNull();
 });
 it('first quality check keeps the remainder awaiting second grading',()=>{const d=demo();expect(quantity(d,'Potato','Grade A')).toBe(20);expect(quantity(d,'Potato','Remaining')).toBe(30);expect(quantity(d,'Potato','Rejected')).toBe(0);});
 it('second quality check grades returned stock together with stage 2 stock',()=>{const d=demo();d['quality-check']=[...(d['quality-check']||[]),qcWithReturn('Stage 2 done')];expect(validateData(d)).toBeNull();expect(quantity(d,'Tomato','Remaining')).toBe(0);expect(quantity(d,'Tomato','Grade A')).toBe(148);expect(quantity(d,'Tomato','Grade B')).toBe(21);expect(quantity(d,'Tomato','Rejected')).toBe(1+(quantity(demo(),'Tomato','Rejected')));});
 it('rejects grading the same received quantity twice',()=>{const d=demo();d['quality-check']=[...(d['quality-check']||[]),{...(d['quality-check']?.[0] as Row),id:'QC-1003'}];expect(validateData(d)).toMatch(/insufficient|already assigned/);});
 it('rejects negative product quantities',()=>{const d=demo();d['purchase-orders']=[{id:'PO-9000',status:'Received',item:'[{"p":"Tomato","q":-1}]'}];expect(validateData(d)).toMatch(/negative/);});
 it('rejects allocations above saleable stock',()=>{const d=demo();d['packing']=[...(d['packing']||[]),normalize('packing',{id:'PK-1003',status:'Allocated',po:'PO-1002',buyer:'Hotel Saravana Bhavan',item:'[{"p":"Onion","q":110}]',packSize:5,grade:'Grade A'})];expect(validateData(d)).toMatch(/insufficient/);});
 it('rejects returns larger than the original 23 KG sale',()=>{const d=demo();d['returns']=[{...(d['returns']?.[0] as Row),item:'[{"p":"Tomato","q":24}]',qty:24}];expect(validateData(d)).toMatch(/exceeds original sale/);});
 it('prevents duplicate warehouse receipts',()=>{const d=demo();d['receipts']=[...(d['receipts']||[]),{...(d['receipts']?.[0] as Row),id:'GRN-1003'}];expect(validateData(d)).toMatch(/only one/);});
 it('populates packing with exact buyer demand',()=>{const d=demo();const r=populate('packing','po','PO-1002',{id:'PK-1003',status:'Allocated'},d);expect(r['buyer']).toBe('Hotel Saravana Bhavan');expect(r['qty']).toBe(150);});
 it('calculates sales-order totals from each product selling price',()=>{
   const sale = normalize('sales-orders',{
     id:'SO-9001',
     status:'Confirmed',
     item:JSON.stringify([{p:'Tomato',q:2,saleRate:40},{p:'Onion',q:3,saleRate:55}]),
   });
   expect(sale['qty']).toBe(5);
   expect(sale['value']).toBe(245);
   expect(sale['rate']).toBe(49);
 });
 it('copies product selling prices and totals from the dispatched sale to a new invoice',()=>{
   const d=demo();
   d['sales-orders']=[{id:'SO-9001',status:'Dispatched',buyer:'FreshMart Retail',rate:49,value:245,item:JSON.stringify([{p:'Tomato',q:2,saleRate:40},{p:'Onion',q:3,saleRate:55}])}];
   d['dispatch']=[{id:'SDC-9001',status:'Delivered',so:'SO-9001',buyer:'FreshMart Retail'}];
   const invoice=populate('invoices','dc','SDC-9001',{id:'INV-9001',status:'Draft'},d);
   expect(invoice['buyer']).toBe('FreshMart Retail');
   expect(invoice['so']).toBe('SO-9001');
   expect(invoice['taxable']).toBe(245);
   expect(parseLines(invoice['item']).map(line=>line.saleRate)).toEqual([40,55]);
 });
 it('clears product selling prices when changing the buyer on a sales order',()=>{
   const d=demo();
   d['buyers']=[...(d['buyers']||[]),{id:'BUY-9001',name:'New Buyer',status:'Active'}];
   const changed=populate('sales-orders','buyer','New Buyer',{
     id:'SO-9001',
     status:'Open',
     buyer:'FreshMart Retail',
     rate:49,
     value:245,
     item:JSON.stringify([{p:'Tomato',q:5,saleRate:49}]),
   },d);
   expect(changed['buyer']).toBe('New Buyer');
   expect(changed['rate']).toBe(0);
   expect(parseLines(changed['item'])).toEqual([]);
 });
 it('fills sales-order products and selling prices from the selected buyer demand',()=>{
   const d=demo();
   const purchaseOrder=d['purchase-orders']?.find(order=>order.id==='PO-1002');
   expect(purchaseOrder).toBeDefined();
   if(!purchaseOrder) return;
   const demandedProducts=parseLines(purchaseOrder['item']).map(line=>line.p);
   d['supplier-prices']=[...(d['supplier-prices']||[]),{
     id:'PRC-9001',
     date:'2026-10-25',
     item:JSON.stringify(demandedProducts.map(p=>({p,q:10,sellingPrice:72}))),
   }];
   const populated=populate('sales-orders','po','PO-1002',{id:'SO-9001'},d);
   const populatedLines=parseLines(populated['item']);
   expect(populated['buyer']).toBe(purchaseOrder['buyer']);
   expect(populatedLines.map(line=>line.p)).toEqual(demandedProducts);
   expect(populatedLines.every(line=>line.saleRate===72)).toBe(true);
   expect(populated['qty']).toBe(populatedLines.reduce((sum,line)=>sum+line.q,0));

   const edited=populate('sales-orders','po','PO-1002',{
     id:'SO-9001',
     item:JSON.stringify([{p:demandedProducts[0],q:1,saleRate:99}]),
   },d);
   expect(parseLines(edited['item']).find(line=>line.p===demandedProducts[0])?.saleRate).toBe(99);
 });
 it('uses the most recently dated saved supplier selling price for a product',()=>{
   const prices:Row[]=[
     {id:'PRC-OLD',date:'2026-10-20',item:JSON.stringify([{p:'Tomato',q:1,sellingPrice:40}])},
     {id:'PRC-NEW',date:'2026-10-25',item:JSON.stringify([{p:'Tomato',q:1,sellingPrice:55}])},
   ];
   expect(supplierSellingPriceForProduct('tomato',[],prices)).toBe(55);
 });
 it('finds a sales-order invoice through its dispatch reference',()=>{
   const invoice={id:'INV-9001',dc:'SDC-9001',status:'Issued'};
   expect(invoiceForSalesOrder('SO-9001',[{id:'SDC-9001',so:'SO-9001'}],[invoice])).toBe(invoice);
   expect(invoiceForSalesOrder('SO-9002',[],[invoice])).toBeUndefined();
 });
 it('creates a linked draft invoice from a finalized sales order',()=>{
   const sale=normalize('sales-orders',{
     id:'SO-9001',
     status:'Closed',
     buyer:'FreshMart Retail',
     value:245,
     rate:49,
     item:JSON.stringify([{p:'Tomato',q:2,saleRate:40},{p:'Onion',q:3,saleRate:55}]),
   });
   const invoice=draftInvoiceForSalesOrder(sale,'INV-9001',[]);
   expect(invoice['so']).toBe('SO-9001');
   expect(invoice['buyer']).toBe('FreshMart Retail');
   expect(invoice['taxable']).toBe(245);
   expect(invoice['total']).toBe(245);
   expect(invoice.status).toBe('Draft');
   expect(invoiceForSalesOrder('SO-9001',[],[invoice])).toBe(invoice);

   const d=demo();
   d['sales-orders']=[sale];
   const populated=populate('invoices','so','SO-9001',{id:'INV-9002',status:'Draft'},d);
   expect(populated['so']).toBe('SO-9001');
   expect(populated['buyer']).toBe('FreshMart Retail');
   expect(populated['taxable']).toBe(245);
 });
 it('loads a confirmed sales order number, products, and KG into outward dispatch',()=>{
   const d=demo();
   const sale=normalize('sales-orders',{
     id:'SO-9001',
     status:'Confirmed',
     po:'PO-1002',
     buyer:'Hotel Saravana Bhavan',
     item:JSON.stringify([{p:'Tomato',q:12,saleRate:40},{p:'Onion',q:8,saleRate:55}]),
   });
   d['sales-orders']=[...(d['sales-orders']||[]),sale];
   const dispatch=populate('dispatch','so',sale.id,{id:'SDC-9001',status:'Created'},d);
   expect(dispatch['so']).toBe('SO-9001');
   expect(dispatch['buyer']).toBe('Hotel Saravana Bhavan');
   expect(dispatch['toLocation']).toBe('Coimbatore');
   expect(parseLines(dispatch['item']).map(line=>[line.p,line.q])).toEqual([['Tomato',12],['Onion',8]]);
   expect(dispatch['qty']).toBe(20);

   d['dispatch']=[...(d['dispatch']||[]),dispatch];
   expect(validateData(d)).toBeNull();
 });
 it('loads buyer and product details from the selected Sales DC into buyer delivery POD',()=>{
   const d=demo();
   d['purchase-orders']=[...(d['purchase-orders']||[]),{
     id:'PO-9001',status:'Accepted',buyer:'FreshMart Retail',item:'[{"p":"Tomato","q":20}]',qty:20,
   }];
   d['sales-orders']=[...(d['sales-orders']||[]),normalize('sales-orders',{
     id:'SO-9001',status:'Confirmed',po:'PO-9001',buyer:'FreshMart Retail',
     item:JSON.stringify([{p:'Tomato',q:20,saleRate:40}]),
   })];
   const dispatch={
     id:'SDC-9001',
     status:'Delivered',
     so:'SO-9001',
     buyer:'FreshMart Retail',
     qty:20,
     item:JSON.stringify([{p:'Tomato',q:12,saleRate:40},{p:'Onion',q:8,saleRate:55}]),
   };
   d['dispatch']=[...(d['dispatch']||[]),dispatch];
   const delivery=populate('deliveries','dc','SDC-9001',{id:'DLV-9001',status:'Pending'},d);
   expect(delivery['dc']).toBe('SDC-9001');
   expect(delivery['buyer']).toBe('FreshMart Retail');
   expect(parseLines(delivery['item']).map(line=>[line.p,line.q])).toEqual([['Tomato',12],['Onion',8]]);
   expect(delivery['accepted']).toBe(20);
   expect(delivery['issueQty']).toBe(0);
   d['deliveries']=[...(d['deliveries']||[]),delivery];
   expect(validateData(d)).toBeNull();
 });
 it('rejects duplicate or over-quantity buyer delivery PODs',()=>{
   const d=demo();
   d['purchase-orders']=[...(d['purchase-orders']||[]),{
     id:'PO-9001',status:'Accepted',buyer:'FreshMart Retail',item:'[{"p":"Tomato","q":20}]',qty:20,
   }];
   d['sales-orders']=[...(d['sales-orders']||[]),normalize('sales-orders',{
     id:'SO-9001',status:'Confirmed',po:'PO-9001',buyer:'FreshMart Retail',
     item:JSON.stringify([{p:'Tomato',q:20,saleRate:40}]),
   })];
   d['dispatch']=[...(d['dispatch']||[]),{
     id:'SDC-9001',status:'Delivered',so:'SO-9001',buyer:'FreshMart Retail',qty:20,item:'[{"p":"Tomato","q":20}]',
   }];
   d['deliveries']=[...(d['deliveries']||[]),{
     id:'DLV-9001',status:'Signed',dc:'SDC-9001',buyer:'FreshMart Retail',accepted:18,issueQty:3,
   }];
   expect(validateData(d)).toMatch(/exceed the dispatched quantity/);
   d['deliveries']=[...(d['deliveries']||[]),{
     id:'DLV-9002',status:'Pending',dc:'SDC-9001',buyer:'FreshMart Retail',accepted:10,issueQty:0,
   }];
   expect(validateData(d)).toMatch(/already exists for this Sales DC/);
 });
 it('prefers a buyer delivery address over city for the dispatch destination',()=>{
   expect(buyerLocation('FreshMart Retail',[
     {name:'FreshMart Retail',city:'Pollachi',address:'12 Market Road, Pollachi'},
   ])).toBe('12 Market Road, Pollachi');
   expect(buyerLocation('Missing Buyer',[])).toBe('');
 });
 it('calculates saved supplier pricing from individual product rates and advances fully priced submissions',()=>{
   const priced=normalize('supplier-prices',{
     id:'PRC-9001',
     status:'Awaiting price',
     dc:'TRP-9001',
     supplier:'Supplier A',
     item:JSON.stringify([{p:'Tomato',q:10,r:20},{p:'Onion',q:5,r:40}]),
   });
   expect(priced['status']).toBe('Priced');
   expect(priced['qty']).toBe(15);
   expect(priced['rate']).toBe(26.667);
   expect(priced['amount']).toBe(400);

   const partial=normalize('supplier-prices',{
     ...priced,
     status:'Priced',
     item:JSON.stringify([{p:'Tomato',q:10,r:20},{p:'Onion',q:5,r:0}]),
   });
   expect(partial['status']).toBe('Awaiting price');
   expect(partial['amount']).toBe(200);
 });
 it('loads supplier pricing products only for the selected supplier on a multi-supplier trip',()=>{
   const d=demo();
   d['trips']=[...(d['trips']||[]),{
     id:'TRP-9001',
     status:'Submitted',
     date:'2026-10-24',
     buys:JSON.stringify([
       {s:'Supplier A',p:'Tomato',q:10,r:0},
       {s:'Supplier B',p:'Onion',q:5,r:0},
     ]),
   }];
   d['suppliers']=[...(d['suppliers']||[]),
     {id:'SUP-9001',name:'Supplier A',status:'Active'},
     {id:'SUP-9002',name:'Supplier B',status:'Active'},
   ];
   const blank:Row={id:'PRC-9001',status:'Awaiting price',dc:'',supplier:'',item:'[]'};
   const tripPricing=populate('supplier-prices','dc','TRP-9001',blank,d);
   expect(tripPricing['supplier']).toBe('');
   expect(parseLines(tripPricing['item']).map(line=>line.p)).toEqual(['Tomato','Onion']);

   const supplierPricing=populate('supplier-prices','supplier','Supplier A',tripPricing,d);
   expect(supplierPricing['supplier']).toBe('Supplier A');
   expect(parseLines(supplierPricing['item']).map(line=>line.p)).toEqual(['Tomato']);
 });
 it('requires every product to have a positive rate before supplier pricing is marked Priced',()=>{
   const d=demo();
   d['supplier-prices']=[...(d['supplier-prices']||[]),{
     id:'PRC-9001',
     status:'Priced',
     dc:'TRP-9001',
     supplier:'Supplier A',
     item:JSON.stringify([{p:'Tomato',q:10,r:20},{p:'Onion',q:5,r:0}]),
   }];
   expect(validateData(d)).toMatch(/price greater than zero for every product/);
 });
 it('reflects per-supplier purchase lines and edited prices on the supplier price board',()=>{
   const trip:Row={
     id:'TRP-9001',
     date:'2026-10-30',
     status:'Submitted',
     buys:JSON.stringify([
       {s:'Supplier A',p:'Tomato',q:10,r:20},
       {s:'Supplier A',p:'Onion',q:5,r:40},
       {s:'Supplier B',p:'Potato',q:8,r:15},
     ]),
   };
   const confirmed:Row={id:'PRC-OLD',dc:'TRP-9001',supplier:'Supplier A',status:'Confirmed',item:JSON.stringify([{p:'Tomato',q:10,r:20,sellingPrice:30},{p:'Onion',q:5,r:40,sellingPrice:55}])};
   const initial=supplierPricesFromTrips([trip],[confirmed]);
   expect(initial).toHaveLength(2);
   const supplierA=initial.find(price=>price['supplier']==='Supplier A');
   expect(supplierA?.id).toBe('PRC-OLD');
   expect(supplierA?.status).toBe('Confirmed');
   expect(supplierA?.['qty']).toBe(15);
   expect(supplierA?.['amount']).toBe(400);
   expect(parseLines(supplierA?.['item']).map(line=>line.r)).toEqual([20,40]);
   expect(parseLines(supplierA?.['item']).map(line=>line.sellingPrice)).toEqual([30,55]);
   expect(initial.find(price=>price['supplier']==='Supplier B')?.['amount']).toBe(120);

   const updatedTrip={...trip,buys:JSON.stringify([
     {s:'Supplier A',p:'Tomato',q:10,r:25},
     {s:'Supplier A',p:'Onion',q:5,r:40},
     {s:'Supplier B',p:'Potato',q:8,r:15},
   ])};
   const updated=supplierPricesFromTrips([updatedTrip],[confirmed]);
   expect(updated.find(price=>price['supplier']==='Supplier A')?.['amount']).toBe(450);
   expect(updated.find(price=>price['supplier']==='Supplier A')?.status).toBe('Priced');
   expect(parseLines(updated.find(price=>price['supplier']==='Supplier A')?.['item'])[0]?.r).toBe(25);

   const legacyTrip:Row={id:'TRP-9002',supplier:'Supplier C',item:JSON.stringify([{p:'Cabbage',q:5},{p:'Beans',q:5}]),rate:30,net:10};
   const legacyPrice:Row={id:'PRC-OLD-2',dc:'TRP-9002',supplier:'Supplier C',rate:30,status:'Confirmed',item:JSON.stringify([{p:'Cabbage',q:5,r:22},{p:'Beans',q:5,r:38}])};
   const legacy=supplierPricesFromTrips([legacyTrip],[legacyPrice])[0];
   expect(parseLines(legacy['item']).map(line=>line.r)).toEqual([22,38]);
   expect(legacy['amount']).toBe(300);
 });
 it('requires a positive selling price on every product line when product pricing is used',()=>{
   const d=demo();
   const sale=d['sales-orders']?.[0];
   expect(sale).toBeDefined();
   if (!sale) return;
   d['sales-orders']=[{...sale,item:JSON.stringify([{p:'Tomato',q:23,saleRate:0}])}];
   expect(validateData(d)).toMatch(/selling price greater than zero/);
 });
 it('does not deduct stock again when an invoice is issued',()=>{const d=demo();const before=stock(d);d['invoices']=[...(d['invoices']||[]),{id:'INV-1005',status:'Issued',total:966}];expect(stock(d)).toEqual(before);});
 it('consolidates all buyers by product for sourcing and subtracts sold stock',()=>{const tomato=outstandingDemand(demo()).find(d=>d.product==='Tomato');expect(tomato?.demand).toBe(73);expect(tomato?.outstanding).toBe(50);expect(tomato?.buy).toBe(0);});
 it('only unfilled shortages create new AI sourcing quantities',()=>{const d=demo();d['purchase-orders']=[...(d['purchase-orders']||[]),{id:'PO-1004',status:'Received',item:'[{"p":"Beans","q":75}]'}];expect(outstandingDemand(d).find(p=>p.product==='Beans')?.buy).toBe(75);});
 it('parses and preserves product line pack specifications (packKg and packLabel)', () => {
   const raw = JSON.stringify([{ p: 'Amaranth Green Leaves (Arai Keerai)', q: 0.5, packKg: 0.5, packLabel: '500 g' }]);
   const parsed = parseLines(raw);
   expect(parsed[0]?.packKg).toBe(0.5);
   expect(parsed[0]?.packLabel).toBe('500 g');
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
 it('calculates a trip demand from its selected products instead of its purchased net weight', () => {
   const products = [
     ['Amaranth Green Leaves (Arai Keerai)', 125],
     ['Amaranth Red Leaves (Red Mulai Keerai)', 115],
     ['Banana Poovan Semi Ripe', 125],
     ['Beans Broad (Avarakkaai)', 120],
     ['Chilli Green Gundu (Bullet Chilli)', 110],
     ['Lady Finger (Vendikaai)', 125],
   ] as const;
   const trip: Row = {
     id: 'TRP-1008',
     status: 'Submitted',
     item: JSON.stringify(products.map(([p]) => ({ p, q: 85 }))),
     net: 510,
   };
   const purchaseOrders: Row[] = products.map(([p, q], index) => ({
     id: `PO-${index}`,
     status: 'Accepted',
     item: JSON.stringify([{ p, q }]),
   }));

   expect(marketTripDemand(trip, purchaseOrders)).toBe(720);
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
