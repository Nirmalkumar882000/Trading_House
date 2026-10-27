import type { Field, ModuleDef } from './modules';
import { normalize } from './workflow';
const products: Field = {key:'item',label:'Products · KG',type:'products',list:true,required:true};
const number = (key:string,label:string,readOnly=false): Field => ({key,label,type:'number',list:true,readOnly,suffix:'kg'});
const ref = (key:string,label:string): Field => ({key,label,type:'select',required:true,list:true});
const date: Field = {key:'date',label:'Date',type:'date',list:true};
const person: Field = {key:'responsible',label:'Responsible person',required:true};
const common = {date:'2026-10-22',responsible:'Ravi Kumar'};
const item = (p:string,q:number,a?:number,a2?:number,b?:number) => JSON.stringify([{p,q,...(a===undefined?{}:{a,a2:a2||0,b:b||0})}]);
export function configureModules(base: ModuleDef[], items: string[]): ModuleDef[] {
 const patches: Record<string,Partial<ModuleDef>> = {
  'purchase-orders':{
    title:'Buyer - Purchase Order',
    description:'Buyer requirements by product and exact KG quantity.',
    fields:[date,ref('buyer','Buyer'),products,{key:'extraKg',label:'Extra KG',type:'number',suffix:'kg',list:true},number('qty','Total demand',true),{key:'deliveryDate',label:'Delivery date',type:'date'}],
    seed:[
      {...common,buyer:'FreshMart Retail',item:item('Tomato',23),qty:23,status:'Accepted'},
      {...common,buyer:'Hotel Saravana Bhavan',item:JSON.stringify([{p:'Tomato',q:50},{p:'Onion',q:100}]),qty:150,status:'Accepted'},
      {...common,buyer:'Nilgiris Supermarket',item:item('Potato',100),extraKg:20,qty:120,status:'Accepted'},
      {date:'2026-10-22',responsible:'Priya S',buyer:'Green Basket Stores',item:JSON.stringify([{p:'Carrot',q:60},{p:'Coriander',q:30}]),extraKg:10,qty:100,deliveryDate:'2026-10-23',status:'Accepted'},
      {date:'2026-10-23',responsible:'Priya S',buyer:'Annapoorna Caterers',item:JSON.stringify([{p:'Cabbage',q:80},{p:'Onion',q:50}]),qty:130,deliveryDate:'2026-10-24',status:'Received'},
      {date:'2026-10-24',responsible:'Ravi Kumar',buyer:'FreshMart Retail',item:JSON.stringify([{p:'Amaranth Green Leaves (Arai Keerai)',q:25},{p:'Beans Broad (Avarakkaai)',q:20},{p:'Lady Finger (Vendikaai)',q:25}]),extraKg:6,qty:76,deliveryDate:'2026-10-25',status:'Accepted'},
      {date:'2026-10-24',responsible:'Priya S',buyer:'Nilgiris Supermarket',item:JSON.stringify([{p:'Amaranth Red Leaves (Red Mulai Keerai)',q:15},{p:'Banana Poovan Semi Ripe',q:25},{p:'Chilli Green Gundu (Bullet Chilli)',q:10}]),qty:50,deliveryDate:'2026-10-25',status:'Accepted'},
    ]
  },
  trips:{
    title:'Bulk market purchases',
    description:'One trip can carry many products bought from many suppliers: add a line per supplier, product, KG and price.',
    fields:[date,{key:'dc',label:'Delivery Challan (DC)',list:true},{key:'buys',label:'Purchase lines · supplier / product / KG / price',type:'buys'},{key:'supplier',label:'Suppliers',readOnly:true,list:true},number('net','Purchased KG',true),{key:'rate',label:'Avg price / KG',type:'number',money:true,readOnly:true,list:true},{key:'amount',label:'Purchase amount',type:'number',money:true,readOnly:true,list:true},{key:'containerType',label:'Container',type:'select',options:['Plastic crates','Wooden boxes','Gunny bags','Carton boxes'],list:true},{key:'containerCount',label:'Containers',type:'number',list:true},ref('transporter','Transporter'),{key:'vehicle',label:'Vehicle number',required:true},{key:'driver',label:'Driver',required:true},{key:'signatures',label:'Signatures collected',type:'select',options:['0','1','2','3']},person],
    seed:[
      {...common,dc:'DC-MKT-4412',supplier:'Murugan Traders',item:JSON.stringify([{p:'Tomato',q:200},{p:'Onion',q:120}]),net:320,rate:28,amount:8960,containerType:'Plastic crates',containerCount:16,transporter:'Chennai Fresh Logistics',vehicle:'TN 09 AB 1234',driver:'Raja',signatures:'3',status:'Submitted'},
      {...common,dc:'DC-MKT-4415',supplier:'Koyambedu Fresh Co',item:item('Potato',150),net:150,rate:22,amount:3300,containerType:'Gunny bags',containerCount:3,transporter:'Chennai Fresh Logistics',vehicle:'TN 09 AB 1234',driver:'Raja',signatures:'3',status:'Submitted'},
      {date:'2026-10-22',responsible:'Priya S',dc:'DC-MKT-4419',supplier:'Sri Lakshmi Vegetables',item:JSON.stringify([{p:'Carrot',q:80},{p:'Coriander',q:40}]),net:120,rate:34.67,amount:4160,containerType:'Plastic crates',containerCount:6,transporter:'Koyambedu Speed Transports',vehicle:'TN 22 CD 5678',driver:'Ganesh',signatures:'3',status:'Submitted'},
      {date:'2026-10-23',responsible:'Ravi Kumar',dc:'DC-MKT-4422',supplier:'Anbu Agro Supplies',item:item('Cabbage',100),net:100,rate:18,amount:1800,containerType:'Gunny bags',containerCount:2,transporter:'Kaveri Express Cargo',vehicle:'TN 07 EF 9012',driver:'Suresh',signatures:'3',status:'Submitted'},
      {date:'2026-10-23',responsible:'Ravi Kumar',dc:'DC-MKT-4428',supplier:'Velu & Sons',item:item('Cabbage',50),net:50,rate:18,amount:900,containerType:'Gunny bags',containerCount:1,transporter:'Koyambedu Speed Transports',vehicle:'TN 22 CD 5678',driver:'Ganesh',signatures:'1',status:'Loading'},
      {date:'2026-10-24',responsible:'Ravi Kumar',dc:'DC-MKT-4435',supplier:'Murugan Traders',item:JSON.stringify([{p:'Amaranth Green Leaves (Arai Keerai)',q:50},{p:'Beans Broad (Avarakkaai)',q:30},{p:'Lady Finger (Vendikaai)',q:40}]),net:120,rate:32,amount:3840,containerType:'Plastic crates',containerCount:12,transporter:'Chennai Fresh Logistics',vehicle:'TN 09 AB 1234',driver:'Raja',signatures:'3',status:'Submitted'},
      {date:'2026-10-24',responsible:'Priya S',dc:'DC-MKT-4440',supplier:'Sri Lakshmi Vegetables',item:JSON.stringify([{p:'Amaranth Red Leaves (Red Mulai Keerai)',q:30},{p:'Banana Poovan Semi Ripe',q:40},{p:'Chilli Green Gundu (Bullet Chilli)',q:20}]),net:90,rate:35,amount:3150,containerType:'Plastic crates',containerCount:8,transporter:'Koyambedu Speed Transports',vehicle:'TN 22 CD 5678',driver:'Ganesh',signatures:'3',status:'Submitted'},
    ]
  },
  receipts:{
    description:'Receive submitted market purchases and post actual KG to the receiving bay.',
    fields:[date,ref('dc','Purchase reference'),products,number('sent','Purchased KG',true),number('received','Received KG',true),number('diff','Transit difference',true),{key:'containerType',label:'Container',type:'select',options:['Plastic crates','Wooden boxes','Gunny bags','Carton boxes'],list:true},{key:'containerCount',label:'Containers received',type:'number',list:true},{key:'reason',label:'Difference reason',type:'select',options:['—','Moisture loss','Spillage','Scale variance','Damaged in transit'],list:true},person],
    seed:[
      {...common,dc:'TRP-1001',item:JSON.stringify([{p:'Tomato',q:200},{p:'Onion',q:120}]),sent:320,received:320,diff:0,containerType:'Plastic crates',containerCount:16,reason:'—',status:'Posted'},
      {...common,dc:'TRP-1002',item:item('Potato',150),sent:150,received:150,diff:0,containerType:'Gunny bags',containerCount:3,reason:'—',status:'Posted'},
      {date:'2026-10-22',responsible:'Priya S',dc:'TRP-1003',item:JSON.stringify([{p:'Carrot',q:78.67},{p:'Coriander',q:39.33}]),sent:120,received:118,diff:-2,containerType:'Plastic crates',containerCount:6,reason:'Moisture loss',status:'Posted'},
      {date:'2026-10-23',responsible:'Priya S',dc:'TRP-1004',item:item('Cabbage',100),sent:100,received:100,diff:0,containerType:'Gunny bags',containerCount:2,reason:'—',status:'Posted'},
      {date:'2026-10-24',responsible:'Ravi Kumar',dc:'TRP-1006',item:JSON.stringify([{p:'Amaranth Green Leaves (Arai Keerai)',q:50},{p:'Beans Broad (Avarakkaai)',q:30},{p:'Lady Finger (Vendikaai)',q:40}]),sent:120,received:120,diff:0,containerType:'Plastic crates',containerCount:12,reason:'—',status:'Posted'},
      {date:'2026-10-24',responsible:'Priya S',dc:'TRP-1007',item:JSON.stringify([{p:'Amaranth Red Leaves (Red Mulai Keerai)',q:30},{p:'Banana Poovan Semi Ripe',q:40},{p:'Chilli Green Gundu (Bullet Chilli)',q:20}]),sent:90,received:90,diff:0,containerType:'Plastic crates',containerCount:8,reason:'—',status:'Posted'},
    ]
  },
  containers:{
    description:'Track crates and boxes counted at loading and receipt, and return them to suppliers.',
    fields:[
      date,
      {key:'type',label:'Container type',type:'select',options:['Plastic crates','Wooden boxes','Gunny bags','Carton boxes'],list:true,required:true},
      {key:'party',label:'Supplier',type:'select',list:true,required:true},
      {key:'out',label:'Received',type:'number',list:true},
      {key:'back',label:'Returned',type:'number',list:true},
      {key:'balance',label:'Balance',type:'number',readOnly:true,list:true},
      {key:'short',label:'Short / Damaged',type:'number'},
      {key:'receipt',label:'Source GRN',readOnly:true},
      {key:'returnDc',label:'Return DC'},
      {key:'returnDate',label:'Return Date',type:'date'},
      person,
    ],
    compute:(r)=>{
      const out = Number(r.out) || 0;
      const back = Number(r.back) || 0;
      const short = Number(r.short) || 0;
      return { balance: Math.max(0, out - back - short) };
    },
    seed:[
      {date:'2026-10-22',responsible:'Ravi Kumar',type:'Plastic crates',party:'Murugan Traders',receipt:'GRN-1001',dc:'TRP-1001',out:16,back:16,short:0,balance:0,returnDate:'2026-10-23',returnDc:'RDC-1001',status:'Returned'},
      {date:'2026-10-22',responsible:'Ravi Kumar',type:'Gunny bags',party:'Koyambedu Fresh Co',receipt:'GRN-1002',dc:'TRP-1002',out:3,back:0,short:0,balance:3,status:'With us'},
      {date:'2026-10-22',responsible:'Priya S',type:'Plastic crates',party:'Sri Lakshmi Vegetables',receipt:'GRN-1003',dc:'TRP-1003',out:6,back:0,short:0,balance:6,status:'With us'},
      {date:'2026-10-23',responsible:'Priya S',type:'Gunny bags',party:'Anbu Agro Supplies',receipt:'GRN-1004',dc:'TRP-1004',out:2,back:2,short:0,balance:0,returnDate:'2026-10-24',returnDc:'RDC-1002',status:'Returned'},
      {date:'2026-10-24',responsible:'Ravi Kumar',type:'Plastic crates',party:'Murugan Traders',receipt:'GRN-1005',dc:'TRP-1006',out:12,back:0,short:0,balance:12,status:'With us'},
      {date:'2026-10-24',responsible:'Priya S',type:'Plastic crates',party:'Sri Lakshmi Vegetables',receipt:'GRN-1006',dc:'TRP-1007',out:8,back:0,short:0,balance:8,status:'With us'},
    ]
  },
  'quality-check':{
    description:'Stage 1 separates Grade A. Only the remainder goes to Stage 2, together with any buyer-returned stock of the same product; Stage 2 grades it into Grade A, Grade B and rejected.',
    fields:[date,ref('lot','Source receipt'),products,{key:'grader',label:'Grader',required:true,list:true},number('input','Input KG',true),number('gradeA','Total Grade A',true),number('reject','After first check',true),number('gradeB','Grade B',true),number('trash','Rejected',true)],
    compute:()=>({}),validate:()=>null,
    seed:[
      {...common,sourceType:'Purchase',lot:'GRN-1001',item:JSON.stringify([{p:'Tomato',q:200,a:150,a2:20,b:20},{p:'Onion',q:120,a:100,a2:5,b:10}]),grader:'Karthik M, Divya R',status:'Stage 2 done'},
      {...common,sourceType:'Purchase',lot:'GRN-1002',item:item('Potato',150,120),grader:'Divya R',status:'Stage 1 done'},
      {id:'QC-1005',date:'2026-10-24',responsible:'Karthik M',sourceType:'Purchase',lot:'GRN-1005',item:JSON.stringify([{p:'Amaranth Green Leaves (Arai Keerai)',q:50,a:45,a2:3,b:2},{p:'Beans Broad (Avarakkaai)',q:30,a:28,a2:1,b:1},{p:'Lady Finger (Vendikaai)',q:40,a:36,a2:2,b:2}]),grader:'Karthik M, Divya R',status:'Stage 2 done'},
    ]
  },
  packing:{
    title:'Buyer allocation & packing',
    description:'Allocate saleable grade stock to buyer demand; pack exact KG using configurable bag sizes.',
    fields:[date,ref('po','Buyer demand'),{key:'buyer',label:'Buyer',readOnly:true,list:true},products,{key:'grade',label:'Stock grade',type:'select',options:['Grade A','Grade B'],list:true},{key:'packer',label:'Packer',required:true},{key:'packSize',label:'Bag size · KG',type:'number',required:true,list:true},number('nominal','Allocated / packed KG',true),{key:'packs',label:'Bags used',type:'number',readOnly:true,list:true},{key:'containerType',label:'Outward container',type:'select',options:['Plastic crates','Corrugated boxes','Gunny bags','Net bags'],list:true},{key:'containerCount',label:'Container count',type:'number',list:true}],
    compute:()=>({}),
    seed:[
      {...common,po:'PO-1001',buyer:'FreshMart Retail',item:item('Tomato',23),grade:'Grade A',packer:'Senthil P',packSize:5,nominal:23,packs:5,containerType:'Plastic crates',containerCount:5,status:'In sales stock'},
      {...common,po:'PO-1003',buyer:'Nilgiris Supermarket',item:item('Potato',100),grade:'Grade A',packer:'Senthil P',packSize:10,nominal:100,packs:10,containerType:'Gunny bags',containerCount:10,status:'Packed'},
      {date:'2026-10-22',responsible:'Senthil P',po:'PO-1002',buyer:'Hotel Saravana Bhavan',item:item('Onion',40),grade:'Grade A',packer:'Senthil P',packSize:5,nominal:40,packs:8,containerType:'Net bags',containerCount:8,status:'In sales stock'},
      {date:'2026-10-24',responsible:'Senthil P',po:'PO-1006',buyer:'FreshMart Retail',item:JSON.stringify([{p:'Amaranth Green Leaves (Arai Keerai)',q:25},{p:'Beans Broad (Avarakkaai)',q:20}]),grade:'Grade A',packer:'Senthil P',packSize:0.25,nominal:45,packs:180,containerType:'Plastic crates',containerCount:6,status:'In sales stock'},
    ]
  },
  'sales-orders':{
    description:'Select a buyer and their demand; packed stock is sent in bags to match the demand. Stock leaves once at dispatch.',
    fields:[date,ref('buyer','Buyer'),ref('po','Buyer demand'),products,number('qty','Actual supply KG',true),{key:'bags',label:'Pack to send (from demand)',type:'textarea',readOnly:true},{key:'rate',label:'Sale price / KG',type:'number',money:true,required:true},{key:'value',label:'Sale value',type:'number',money:true,readOnly:true,list:true},person],
    seed:[
      {...common,packing:'PK-1001',po:'PO-1001',buyer:'FreshMart Retail',item:item('Tomato',23),qty:23,rate:42,value:966,status:'Dispatched'},
      {...common,packing:'PK-1002',po:'PO-1003',buyer:'Nilgiris Supermarket',item:item('Potato',100),qty:100,rate:100,value:10000,status:'Closed'},
      {date:'2026-10-22',responsible:'Ravi Kumar',packing:'PK-1003',po:'PO-1002',buyer:'Hotel Saravana Bhavan',item:item('Onion',40),qty:40,rate:38,value:1520,status:'Confirmed'},
    ]
  },
  returns:{
    title:'Sales returns & quarantine',
    description:'Returns stay in inspection quarantine until their quality check approves a saleable grade.',
    fields:[date,ref('sale','Original sale'),{key:'buyer',label:'Buyer',readOnly:true,list:true},products,number('qty','Returned KG',true),{key:'reason',label:'Return reason',type:'select',options:['Quality issue','Excess supply','Wrong item'],required:true,list:true},person],
    seed:[
      {...common,sale:'SO-1001',buyer:'FreshMart Retail',item:item('Tomato',3),qty:3,reason:'Quality issue',status:'Received'}
    ]
  },
  dispatch:{
    title:'Outward dispatch & delivery',
    description:'Buyer deliveries linked to dispatched sales and transporter records.',
    fields:[date,ref('so','Dispatched sale'),{key:'buyer',label:'Buyer',readOnly:true,list:true},number('qty','Loading KG'),ref('transporter','Transporter'),{key:'vehicle',label:'Vehicle number',required:true},{key:'driver',label:'Driver',required:true},{key:'charges',label:'Transport charges',type:'number',money:true,list:true},person],
    seed:[
      {...common,so:'SO-1001',buyer:'FreshMart Retail',qty:23,transporter:'Chennai Fresh Logistics',vehicle:'TN 09 AB 1234',driver:'Raja',charges:250,status:'Delivered'},
      {...common,so:'SO-1002',buyer:'Nilgiris Supermarket',qty:100,transporter:'Chennai Fresh Logistics',vehicle:'TN 09 AB 1234',driver:'Raja',charges:450,status:'Delivered'},
    ]
  },
  deliveries:{
    seed:[
      {dc:'SDC-1001',buyer:'FreshMart Retail',accepted:20,issueQty:3,remarks:'3 kg soft/damaged in transit',status:'Signed'},
      {dc:'SDC-1002',buyer:'Nilgiris Supermarket',accepted:100,issueQty:0,remarks:'Delivered in full, grade verified',status:'Signed'},
    ]
  },
  invoices:{
    description:'Sales invoice values linked to dispatch; no second stock deduction.',
    seed:[
      {dc:'SDC-1001',buyer:'FreshMart Retail',date:'2026-10-22',taxable:966,gst:'0',total:966,paid:840,status:'Part paid'},
      {dc:'SDC-1002',buyer:'Nilgiris Supermarket',date:'2026-10-22',taxable:10000,gst:'0',total:10000,paid:10000,status:'Paid'},
    ]
  },
  'supplier-prices':{
    seed:[
      {dc:'TRP-1001',supplier:'Murugan Traders',item:JSON.stringify([{p:'Tomato',q:200},{p:'Onion',q:120}]),qty:320,rate:28,amount:8960,status:'Confirmed'},
      {dc:'TRP-1002',supplier:'Koyambedu Fresh Co',item:item('Potato',150),qty:150,rate:22,amount:3300,status:'Confirmed'},
      {dc:'TRP-1003',supplier:'Sri Lakshmi Vegetables',item:JSON.stringify([{p:'Carrot',q:80},{p:'Coriander',q:40}]),qty:120,rate:34.67,amount:4160,status:'Confirmed'},
      {dc:'TRP-1004',supplier:'Anbu Agro Supplies',item:item('Cabbage',100),qty:100,rate:18,amount:1800,status:'Priced'},
      {dc:'TRP-1006',supplier:'Murugan Traders',item:JSON.stringify([{p:'Amaranth Green Leaves (Arai Keerai)',q:50,r:24},{p:'Beans Broad (Avarakkaai)',q:30,r:35},{p:'Lady Finger (Vendikaai)',q:40,r:28}]),qty:120,rate:28.08,amount:3370,status:'Confirmed'},
      {dc:'TRP-1007',supplier:'Sri Lakshmi Vegetables',item:JSON.stringify([{p:'Amaranth Red Leaves (Red Mulai Keerai)',q:30,r:28},{p:'Banana Poovan Semi Ripe',q:40,r:32},{p:'Chilli Green Gundu (Bullet Chilli)',q:20,r:42}]),qty:90,rate:32.89,amount:2960,status:'Confirmed'},
    ]
  },
 };
 const extras: ModuleDef[] = [
  {slug:'business-profile',title:'Business profile & KYC',stage:'A · Setup',flows:'F01',prefix:'BIZ',description:'Trading House legal profile, DigiPin location, GSTIN, PAN, bank accounts and market licenses.',statuses:['Active'],fields:[],seed:[]},
  {slug:'flow-map',title:'Process flow map (F01–F28)',stage:'Workflow & System',flows:'F01–F28',prefix:'FLW',description:'Interactive 28 process flows, 7 business stages and 36 decision points map.',statuses:['Active'],fields:[],seed:[]},
  {slug:'open-points',title:'Customer open points (C01–C14)',stage:'Decisions & Controls',flows:'C01–C14',prefix:'COP',description:'Register of customer decisions, proposed controls [P], implementation and testing impacts.',statuses:['Active'],fields:[],seed:[]},
  {slug:'ai-sourcing',title:'AI sourcing planner',stage:'C · Market purchase',flows:'AI',prefix:'AIP',description:'Compare supplier offer notes with outstanding buyer demand.',statuses:['Open'],fields:[],seed:[]},
  {slug:'vendor-offers',title:'Supplier notes',stage:'C · Market purchase',flows:'Notes',prefix:'OFR',description:'Market supplier offers and availability notes.',statuses:['Recorded'],fields:[date,{key:'vendor',label:'Supplier',required:true,list:true},{key:'notes',label:'Supplier notes',type:'textarea',required:true,list:true}],seed:[
    {date:'2026-10-22',vendor:'Murugan Traders',notes:'Grade A Hybrid Tomatoes 250 kg available at ₹26/kg from Hosur arrival lot; Onion Nasik medium 300 kg at ₹24/kg. Ready for immediate morning pickup.',status:'Recorded'},
    {date:'2026-10-22',vendor:'Sri Lakshmi Vegetables',notes:'Fresh Ooty Carrots 150 kg washed @ ₹30/kg. High brix sweetness. Coriander local farm fresh 60 kg @ ₹38/kg.',status:'Recorded'},
    {date:'2026-10-22',vendor:'Koyambedu Fresh Co',notes:'Hassan Potato table variety 400 kg @ ₹20/kg in 50kg gunny bags. Good storage quality.',status:'Recorded'},
    {date:'2026-10-23',vendor:'Anbu Agro Supplies',notes:'Tiruppur Cabbage crisp heads 200 kg @ ₹16/kg. Country beans tender lot 100 kg @ ₹42/kg arriving tonight.',status:'Recorded'},
  ]},
  {slug:'transporters',title:'Transporters',stage:'A · Setup',flows:'Transport',prefix:'TPT',description:'Market collection and buyer delivery partners.',statuses:['Active','Inactive'],fields:[{key:'name',label:'Transporter name',required:true,list:true},{key:'phone',label:'Phone',required:true,list:true},{key:'vehicle',label:'Vehicle number',required:true,list:true},{key:'driver',label:'Driver',required:true,list:true}],seed:[
    {name:'Chennai Fresh Logistics',phone:'9840012345',vehicle:'TN 09 AB 1234',driver:'Raja',status:'Active'},
    {name:'Koyambedu Speed Transports',phone:'9841098765',vehicle:'TN 22 CD 5678',driver:'Ganesh',status:'Active'},
    {name:'Kaveri Express Cargo',phone:'9444054321',vehicle:'TN 07 EF 9012',driver:'Suresh',status:'Active'},
  ]},
  {slug:'transport',title:'Inward & outward transport',stage:'D · Receipt & containers',flows:'Transport',prefix:'MOV',description:'Purchase and sale transportation with loading KG, drivers, charges, and delivery status.',statuses:['Scheduled','Loading','In transit','Delivered'],fields:[date,{key:'direction',label:'Direction',type:'select',options:['Inward','Inward Return','Outward','Outward Return'],list:true},{key:'supplier',label:'Supplier / Party',list:true},ref('ref','Purchase / sale reference'),{key:'item',label:'Products',type:'products',list:true},ref('transporter','Transporter'),{key:'vehicle',label:'Vehicle number',required:true,list:true},{key:'driver',label:'Driver',required:true,list:true},{key:'driverPhone',label:'Driver phone'},number('qty','Loading KG'),{key:'containerCount',label:'Containers',type:'number'},{key:'charges',label:'Transport charges',type:'number',money:true,list:true},person],seed:[
    {...common,direction:'Inward',supplier:'Murugan Traders',ref:'TRP-1001',item:JSON.stringify([{p:'Tomato',q:200},{p:'Onion',q:120}]),transporter:'Chennai Fresh Logistics',vehicle:'TN 09 AB 1234',driver:'Raja',driverPhone:'9840012345',qty:320,containerCount:16,containerType:'Plastic crates',charges:800,status:'Delivered'},
    {...common,direction:'Inward',supplier:'Koyambedu Fresh Co',ref:'TRP-1002',item:JSON.stringify([{p:'Potato',q:150}]),transporter:'Chennai Fresh Logistics',vehicle:'TN 09 AB 1234',driver:'Raja',driverPhone:'9840012345',qty:150,containerCount:3,containerType:'Gunny bags',charges:500,status:'Delivered'},
    {date:'2026-10-22',responsible:'Priya S',direction:'Inward',supplier:'Sri Lakshmi Vegetables',ref:'TRP-1003',item:JSON.stringify([{p:'Carrot',q:80},{p:'Coriander',q:40}]),transporter:'Koyambedu Speed Transports',vehicle:'TN 22 CD 5678',driver:'Ganesh',driverPhone:'9841098765',qty:118,containerCount:6,containerType:'Plastic crates',charges:450,status:'Delivered'},
    {...common,direction:'Outward',supplier:'Hotel Saravana Bhavan',buyer:'Hotel Saravana Bhavan',ref:'SO-1001',item:JSON.stringify([{p:'Tomato',q:23}]),transporter:'Chennai Fresh Logistics',vehicle:'TN 09 AB 1234',driver:'Raja',driverPhone:'9840012345',qty:23,containerCount:1,containerType:'Plastic crates',charges:250,status:'Delivered'},
    {...common,direction:'Outward',supplier:'Anjappar Chettinad',buyer:'Anjappar Chettinad',ref:'SO-1002',item:JSON.stringify([{p:'Potato',q:100}]),transporter:'Koyambedu Speed Transports',vehicle:'TN 22 CD 5678',driver:'Ganesh',driverPhone:'9841098765',qty:100,containerCount:4,containerType:'Plastic crates',charges:450,status:'Delivered'},
  ]},
  ...['inventory','stock-movements','workflow-reports'].map((slug):ModuleDef=>({slug,title:slug==='inventory'?'Inventory & stock locations':slug==='stock-movements'?'Stock movement history':'Workflow reports',stage:'E · Quality check',flows:slug==='inventory'?'F10 · F11 · F12':slug==='stock-movements'?'F10 · F11 · F12':'F24 · F25 · F26',prefix:'STK',description:slug==='inventory'?'Live KG balances across receiving, grading, quarantine, allocation, and dispatch.':slug==='stock-movements'?'Source, destination, quantity, date, and responsible person for every posted movement.':'Product-wise purchased, graded, sold, returned, and remaining quantities.',statuses:['Live'],fields:[],seed:[]})),
  {slug:'financial-ledgers',title:'Party ledgers (Supplier, Buyer, Agent)',stage:'H · Money & people',flows:'F24 · F25 · F26',prefix:'LDG',description:'Party-wise financial account ledgers: Supplier payables, Buyer receivables, and Transporter / Agent commissions with live running balances.',statuses:['Live'],fields:[],seed:[]},
 ];
 return [...base.map(m=>({...m,...patches[m.slug]})),...extras].map(m=>({...m,fields:m.fields.map(f=>f.type==='products'||f.type==='buys'?{...f,options:items}:f),seed:m.seed.map((r,i)=>normalize(m.slug,{...r,id:(r.id as string)||`${m.prefix}-${1001+i}`,status:String(r['status'] || m.statuses[0])}))}));
}
