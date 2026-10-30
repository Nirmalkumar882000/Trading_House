import { configureModules } from "./workflow-config";
import { parseLines, parseBuys } from "./workflow";
export { parseLines, parseBuys };
export type FieldType = "text" | "number" | "select" | "date" | "textarea" | "products" | "buys";

export interface ProductItem {
  name: string;
  defaultPackSize: string;
  packSizeKg: number;
  category?: string;
}

export const INITIAL_PRODUCT_CATALOG: ProductItem[] = [
  { name: "Amaranth Green Leaves (Arai Keerai)", defaultPackSize: "250 g", packSizeKg: 0.25, category: "Greens" },
  { name: "Amaranth Red Leaves (Red Mulai Keerai)", defaultPackSize: "150 g", packSizeKg: 0.15, category: "Greens" },
  { name: "Banana Elaichi (Yelakki)", defaultPackSize: "450 g - 550 g", packSizeKg: 0.5, category: "Fruits" },
  { name: "Banana Poovan Semi Ripe", defaultPackSize: "450 - 550 g", packSizeKg: 0.5, category: "Fruits" },
  { name: "Banana Red Semi Ripe", defaultPackSize: "450 g - 500 g", packSizeKg: 0.5, category: "Fruits" },
  { name: "Beans Broad (Avarakkaai)", defaultPackSize: "250 g", packSizeKg: 0.25, category: "Vegetables" },
  { name: "Beans Cluster (Seeni Avaraikkaai)", defaultPackSize: "250 g", packSizeKg: 0.25, category: "Vegetables" },
  { name: "Beans Cowpea", defaultPackSize: "250 g", packSizeKg: 0.25, category: "Vegetables" },
  { name: "Beetroot", defaultPackSize: "400 - 500 g", packSizeKg: 0.5, category: "Vegetables" },
  { name: "Bottle Gourd (Surakkaai)", defaultPackSize: "1 pc", packSizeKg: 1.0, category: "Gourd / Squash" },
  { name: "Cabbage", defaultPackSize: "1 pc", packSizeKg: 1.0, category: "Vegetables" },
  { name: "Chilli Green (Pachchai Milagai)", defaultPackSize: "100 g", packSizeKg: 0.1, category: "Chillies & Spices" },
  { name: "Chilli Green Gundu (Bullet Chilli)", defaultPackSize: "200 g", packSizeKg: 0.2, category: "Chillies & Spices" },
  { name: "Coconut (Thengaai) Medium", defaultPackSize: "1 pc", packSizeKg: 0.5, category: "Coconut" },
  { name: "Coconut Small", defaultPackSize: "1 pc", packSizeKg: 0.35, category: "Coconut" },
  { name: "Coconut Sprout", defaultPackSize: "1 pc", packSizeKg: 0.4, category: "Coconut" },
  { name: "Coriander Leaves (Koththamalli) - Cleaned, with roots", defaultPackSize: "90 g - 100 g", packSizeKg: 0.1, category: "Greens & Herbs" },
  { name: "Curry Leaves (Karuveppilai) - Cleaned, without roots", defaultPackSize: "50 g", packSizeKg: 0.05, category: "Greens & Herbs" },
  { name: "Drumstick", defaultPackSize: "1 pc", packSizeKg: 0.15, category: "Vegetables" },
  { name: "Drumsticks", defaultPackSize: "3 pcs", packSizeKg: 0.45, category: "Vegetables" },
  { name: "Lady Finger (Vendikaai)", defaultPackSize: "250 g", packSizeKg: 0.25, category: "Vegetables" },
  { name: "Mint Leaves", defaultPackSize: "90 - 100 g", packSizeKg: 0.1, category: "Greens & Herbs" },
  { name: "Radish White (Mooli)", defaultPackSize: "500 g", packSizeKg: 0.5, category: "Vegetables" },
  { name: "Spinach (Palak) - Cleaned, without roots", defaultPackSize: "250 g", packSizeKg: 0.25, category: "Greens" },
  { name: "Sweet Corn", defaultPackSize: "1 pc", packSizeKg: 0.35, category: "Vegetables" },
  { name: "Sweet Corn (Cholam)", defaultPackSize: "2 pcs", packSizeKg: 0.7, category: "Vegetables" },
  { name: "Tender Coconut (Elaneer)", defaultPackSize: "1 pc", packSizeKg: 1.5, category: "Coconut" },
  { name: "Tomato Local", defaultPackSize: "500 g", packSizeKg: 0.5, category: "Vegetables" },
  { name: "Tomato Local (Naattu Thakkali)", defaultPackSize: "200 - 300 g", packSizeKg: 0.25, category: "Vegetables" },
  // Staple commodities for full backward-compatibility with tests & workflows:
  { name: "Tomato", defaultPackSize: "500 g", packSizeKg: 0.5, category: "Staples" },
  { name: "Onion", defaultPackSize: "1 kg", packSizeKg: 1.0, category: "Staples" },
  { name: "Potato", defaultPackSize: "1 kg", packSizeKg: 1.0, category: "Staples" },
  { name: "Carrot", defaultPackSize: "500 g", packSizeKg: 0.5, category: "Staples" },
  { name: "Beans", defaultPackSize: "250 g", packSizeKg: 0.25, category: "Staples" },
  { name: "Coriander", defaultPackSize: "100 g", packSizeKg: 0.1, category: "Staples" },
  { name: "Banana", defaultPackSize: "500 g", packSizeKg: 0.5, category: "Staples" },
];

export const PRODUCT_CATALOG: ProductItem[] = [...INITIAL_PRODUCT_CATALOG];

export const ITEMS: string[] = PRODUCT_CATALOG.map((p) => p.name);
export const PRODUCTS: string[] = ITEMS;

export function syncProductCatalog(newCatalog: ProductItem[]): void {
  PRODUCT_CATALOG.length = 0;
  PRODUCT_CATALOG.push(...newCatalog);
  ITEMS.length = 0;
  for (const item of newCatalog) {
    ITEMS.push(item.name);
  }
}

export const WAREHOUSES = [
  "Main Warehouse (Udumalaipet)",
  "Pollachi Depot",
  "Madathukulam Hub",
  "Dharapuram Hub",
];

export const DEFAULT_WAREHOUSE = WAREHOUSES[0];

export function detectUnitType(packSize?: string): "kg" | "piece" | "range" {
  if (!packSize) return "kg";
  const s = packSize.toLowerCase();
  if (s.includes("pc")) return "piece";
  if (s.includes("-") || s.includes("–")) return "range";
  return "kg";
}

export interface PackSpecOption {
  label: string;
  kg: number;
}

export const STANDARD_PACK_SPECS: PackSpecOption[] = [
  { label: "100 g", kg: 0.1 },
  { label: "150 g", kg: 0.15 },
  { label: "200 g", kg: 0.2 },
  { label: "250 g", kg: 0.25 },
  { label: "300 g", kg: 0.3 },
  { label: "400 g", kg: 0.4 },
  { label: "500 g", kg: 0.5 },
  { label: "750 g", kg: 0.75 },
  { label: "1 kg", kg: 1.0 },
  { label: "1.5 kg", kg: 1.5 },
  { label: "2 kg", kg: 2.0 },
  { label: "5 kg", kg: 5.0 },
];

export function getPackSpecOptions(
  spec?: ProductItem,
  currentPackKg?: number,
  currentPackLabel?: string
): PackSpecOption[] {
  const list: PackSpecOption[] = [];

  if (spec?.defaultPackSize && spec?.packSizeKg) {
    list.push({ label: spec.defaultPackSize, kg: spec.packSizeKg });
  }

  if (spec?.defaultPackSize?.includes("pc") && spec.packSizeKg) {
    const pcKg = spec.packSizeKg;
    list.push(
      { label: "1 pc", kg: pcKg },
      { label: "2 pcs", kg: Math.round(pcKg * 2 * 1000) / 1000 },
      { label: "3 pcs", kg: Math.round(pcKg * 3 * 1000) / 1000 },
      { label: "5 pcs", kg: Math.round(pcKg * 5 * 1000) / 1000 }
    );
  }

  if (currentPackKg && currentPackKg > 0) {
    const lbl = currentPackLabel || (currentPackKg < 1 ? `${Math.round(currentPackKg * 1000)} g` : `${currentPackKg} kg`);
    list.push({ label: lbl, kg: currentPackKg });
  }

  for (const s of STANDARD_PACK_SPECS) {
    if (!list.some((item) => Math.abs(item.kg - s.kg) < 0.001)) {
      list.push(s);
    }
  }

  list.sort((a, b) => a.kg - b.kg);

  const seen = new Set<number>();
  return list.filter((item) => {
    const rounded = Math.round(item.kg * 1000) / 1000;
    if (seen.has(rounded)) return false;
    seen.add(rounded);
    return true;
  });
}

export interface Field {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  list?: boolean;
  required?: boolean;
  readOnly?: boolean; // computed
  money?: boolean;
  suffix?: string;
}
export type Row = Record<string, string | number> & { id: string; status: string };
export interface ModuleDef {
  slug: string;
  title: string;
  stage: string;
  flows: string;
  description: string;
  prefix: string;
  statuses: string[];
  fields: Field[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compute?: (r: any) => Partial<Row>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validate?: (r: any) => string | null;
  seed: Record<string, unknown>[];
}

export function totalPacketCount(row: Row): number {
  const ls = parseLines(row["item"]);
  return ls.reduce((sum, l) => {
    const spec =
      PRODUCT_CATALOG.find((item) => item.name.toLowerCase() === l.p.toLowerCase()) ||
      PRODUCT_CATALOG.find((item) => item.name.toLowerCase().includes(l.p.toLowerCase())) ||
      { packSizeKg: 1.0 };
    const packSizeKg = l.packKg ?? (spec.packSizeKg > 0 ? spec.packSizeKg : 1.0);
    return sum + Math.ceil(l.q / packSizeKg);
  }, 0);
}

export const STAGES = [
  "A · Setup",
  "B · Buyer demand",
  "C · Market purchase",
  "D · Receipt & containers",
  "E · Quality check",
  "F · Packing & catalogue",
  "G · Sales & dispatch",
  "H · Money & people",
] as const;

export const SUPPLIERS = ["Murugan Traders", "Sri Lakshmi Vegetables", "Udumalai Fresh Agro", "Pollachi Green Farms", "Velu & Sons"];
export const BUYERS = ["FreshMart Retail", "Green Basket Stores", "Hotel Saravana Bhavan", "Annapoorna Caterers", "Nilgiris Supermarket"];
export const EMPLOYEES = ["Ravi Kumar", "Priya S", "Karthik M", "Divya R", "Senthil P", "Meena K"];
const VEHICLES = ["TN 78 AB 1234", "TN 41 CD 5678", "TN 39 EF 9012"];
const DRIVERS = ["Raja", "Ganesh", "Suresh"];
const n = (v: unknown) => Number(v) || 0;
const d = (day: number) => `2026-10-${String(day).padStart(2, "0")}`;

const BASE_MODULES: ModuleDef[] = [
  // A
  {
    slug: "suppliers", title: "Suppliers", stage: STAGES[0], flows: "F01", prefix: "SUP",
    description: "Market suppliers who sell goods to the Trading House and enter prices in Market Trader.",
    statuses: ["Pending", "Active", "Inactive"],
    fields: [
      { key: "name", label: "Supplier name", list: true, required: true },
      { key: "contact", label: "Contact person", list: true },
      { key: "phone", label: "Phone", list: true },
      { key: "market", label: "Market", type: "select", options: ["Udumalaipet", "Pollachi", "Oddanchatram", "Dharapuram", "Madathukulam"], list: true },
      { key: "gstin", label: "GSTIN" },
      { key: "payable", label: "Outstanding payable", type: "number", money: true, list: true },
    ],
    seed: SUPPLIERS.map((s, i) => ({ name: s, contact: ["Murugan", "Lakshmi", "Bala", "Anbu", "Velu"][i], phone: `98400${10230 + i * 17}`, market: ["Udumalaipet", "Pollachi", "Udumalaipet", "Pollachi", "Oddanchatram"][i], gstin: `33ABCDE${1200 + i}F1Z${i}`, payable: s === "Murugan Traders" ? 3960 : 0, status: i === 4 ? "Pending" : "Active" })),
  },
  {
    slug: "buyers", title: "Buyers", stage: STAGES[0], flows: "F01 · F13", prefix: "BUY",
    description: "Registered buyers who place purchase orders through the Buyer Portal or manually.",
    statuses: ["Registered", "Approved", "On hold"],
    fields: [
      { key: "name", label: "Buyer name", list: true, required: true },
      { key: "type", label: "Type", type: "select", options: ["Retail", "Hotel", "Caterer", "Wholesale"], list: true },
      { key: "city", label: "City", list: true },
      { key: "phone", label: "Phone" },
      { key: "creditLimit", label: "Credit limit", type: "number", money: true, list: true },
      { key: "receivable", label: "Receivable", type: "number", money: true, list: true },
    ],
    seed: BUYERS.map((b, i) => ({ name: b, type: ["Retail", "Retail", "Hotel", "Caterer", "Wholesale"][i], city: ["Udumalaipet", "Pollachi", "Coimbatore", "Tiruppur", "Palani"][i], phone: `90030${44120 + i * 9}`, creditLimit: [200000, 150000, 100000, 75000, 300000][i], receivable: b === "FreshMart Retail" ? 840 : 0, status: i === 3 ? "Registered" : "Approved" })),
  },
  {
    slug: "employees", title: "Employees & access", stage: STAGES[0], flows: "F01", prefix: "EMP",
    description: "Staff with role-based access. Receipt staff cannot see supplier purchase prices.",
    statuses: ["Invited", "Active", "Disabled"],
    fields: [
      { key: "name", label: "Name", list: true, required: true },
      { key: "role", label: "Role", type: "select", options: ["Admin", "Receipt staff", "QC grader", "Packer", "Sales", "Accounts"], list: true },
      { key: "phone", label: "Phone", list: true },
      { key: "salary", label: "Monthly salary", type: "number", money: true, list: true },
      { key: "joined", label: "Joined on", type: "date" },
    ],
    seed: EMPLOYEES.map((e, i) => ({ name: e, role: ["Admin", "Receipt staff", "QC grader", "QC grader", "Packer", "Accounts"][i], phone: `97890${30100 + i * 11}`, salary: [45000, 18000, 16000, 16000, 14000, 28000][i], joined: `202${3 + (i % 3)}-0${(i % 9) + 1}-15`, status: "Active" })),
  },
  // B · demand first
  {
    slug: "product-catalog", title: "Add Catalog", stage: STAGES[1], flows: "F13", prefix: "CAT",
    description: "Product catalog master with default pack sizes, KG weights, and categories for Buyer Purchase Orders.",
    statuses: ["Active"],
    fields: [],
    seed: [],
  },
  {
    slug: "purchase-orders", title: "Buyer - Purchase Order", stage: STAGES[1], flows: "F13", prefix: "PO",
    description: "Step 1 — buyers raise demand first. Market purchase is planned against these POs. POs received from the Buyer Portal or entered manually; both flow into sales orders.",
    statuses: ["Received", "Accepted", "Converted", "Rejected"],
    fields: [
      { key: "date", label: "PO date", type: "date", list: true },
      { key: "buyer", label: "Buyer", type: "select", options: BUYERS, list: true, required: true },
      { key: "source", label: "Source", type: "select", options: ["Buyer Portal", "Manual"], list: true },
      { key: "item", label: "Products", type: "products", options: ITEMS, list: true },
      { key: "extraKg", label: "Extra KG", type: "number", suffix: "kg" },
      { key: "qty", label: "Qty", type: "number", suffix: "kg", list: true },
      { key: "deliveryDate", label: "Delivery date", type: "date" },
    ],
    seed: [
      { date: d(21), buyer: BUYERS[0], source: "Buyer Portal", item: '[{"p":"Cabbage","q":150},{"p":"Tomato","q":150},{"p":"Onion","q":80},{"p":"Coriander","q":20}]', qty: 400, deliveryDate: d(22), status: "Accepted" },
      { date: d(21), buyer: BUYERS[2], source: "Manual", item: '[{"p":"Onion","q":300},{"p":"Potato","q":120}]', qty: 420, deliveryDate: d(22), status: "Accepted" },
      { date: d(21), buyer: BUYERS[1], source: "Buyer Portal", item: '[{"p":"Coriander","q":80}]', qty: 80, deliveryDate: d(23), status: "Received" },
      { date: d(20), buyer: BUYERS[4], source: "Buyer Portal", item: '[{"p":"Potato","q":500}]', qty: 500, deliveryDate: d(21), status: "Converted" },
    ],
  },
  {
    slug: "demand-plan", title: "Demand summary & purchase plan", stage: STAGES[1], flows: "F13 · F02", prefix: "DPL",
    description: "Every buyer's product quantities are added up here. Market purchase is planned against this total — not guesswork.",
    statuses: ["Open"],
    fields: [],
    seed: [],
  },
  // C
  {
    slug: "trips", title: "Market trips & loading", stage: STAGES[2], flows: "F02 · F03 · F04", prefix: "TRP",
    description: "FleetMate market-to-warehouse trip. Record units, gross & tare, then collect 3 signatures to submit.",
    statuses: ["Draft", "Loading", "Signed", "Submitted"],
    fields: [
      { key: "date", label: "Trip date", type: "date", list: true },
      { key: "dc", label: "Delivery Challan (DC)", list: true },
      { key: "po", label: "Against buyer PO", type: "select", options: ["PO-1001", "PO-1002", "PO-1003", "PO-1004"], list: true, required: true },
      { key: "supplier", label: "Supplier", type: "select", options: SUPPLIERS, list: true, required: true },
      { key: "vehicle", label: "Vehicle", type: "select", options: VEHICLES, list: true, required: true },
      { key: "driver", label: "Driver", type: "select", options: DRIVERS },
      { key: "item", label: "Products", type: "products", options: ITEMS, list: true },
      { key: "containerType", label: "Container type", type: "select", options: ["Plastic crates", "Wooden boxes", "Gunny bags", "Carton boxes"], list: true },
      { key: "containerCount", label: "Container count", type: "number", list: true },
      { key: "units", label: "Units (boxes/bags)", type: "number", list: true },
      { key: "gross", label: "Gross weight", type: "number", suffix: "kg" },
      { key: "tare", label: "Tare weight", type: "number", suffix: "kg" },
      { key: "net", label: "Net weight", type: "number", suffix: "kg", readOnly: true, list: true },
      { key: "signatures", label: "Signatures collected", type: "select", options: ["0", "1", "2", "3"], list: true },
    ],
    compute: (r) => ({ net: +(n(r.gross) - n(r.tare)).toFixed(2) }),
    validate: (r) => (r.status === "Submitted" && n(r.signatures) < 3 ? "All 3 signatures (supplier, driver, loader) are required before submission." : null),
    seed: [
      { date: d(21), po: "PO-1001", supplier: SUPPLIERS[0], vehicle: VEHICLES[0], driver: "Raja", item: '[{"p":"Cabbage","q":175},{"p":"Tomato","q":592},{"p":"Coriander","q":40}]', units: 48, gross: 830, tare: 53, net: 777, signatures: "3", status: "Submitted" },
      { date: d(21), po: "PO-1002", supplier: SUPPLIERS[1], vehicle: VEHICLES[1], driver: "Ganesh", item: '[{"p":"Onion","q":1235}]', units: 25, gross: 1260, tare: 25, net: 1235, signatures: "2", status: "Signed" },
      { date: d(21), po: "PO-1003", supplier: SUPPLIERS[3], vehicle: VEHICLES[2], driver: "Suresh", item: '[{"p":"Carrot","q":444}]', units: 30, gross: 480, tare: 36, net: 444, signatures: "0", status: "Loading" },
      { date: d(20), po: "PO-1004", supplier: SUPPLIERS[2], vehicle: VEHICLES[0], driver: "Raja", item: '[{"p":"Coriander","q":198}]', units: 200, gross: 210, tare: 12, net: 198, signatures: "3", status: "Submitted" },
      { date: d(21), po: "PO-1002", supplier: SUPPLIERS[4], vehicle: VEHICLES[1], driver: "Ganesh", item: '[{"p":"Beans","q":0}]', units: 12, gross: 0, tare: 0, net: 0, signatures: "0", status: "Draft" },
    ],
  },
  {
    slug: "supplier-prices", title: "Supplier pricing (Market Trader)", stage: STAGES[2], flows: "F05", prefix: "PRC",
    description: "Supplier enters purchase price against the trip DC in the Market Trader portal.",
    statuses: ["Awaiting price", "Priced", "Confirmed"],
    fields: [
      { key: "date", label: "Trip date", type: "date", list: true },
      { key: "dc", label: "Trip DC", type: "select", required: true, list: true },
      { key: "supplier", label: "Supplier", type: "select", options: SUPPLIERS, required: true, list: true },
      { key: "item", label: "Products", type: "products", options: ITEMS, required: true, list: true },
      { key: "qty", label: "Quantity sent", type: "number", suffix: "kg", list: true },
      { key: "rate", label: "Rate / kg", type: "number", money: true, list: true },
      { key: "amount", label: "Amount", type: "number", money: true, readOnly: true, list: true },
    ],
    compute: (r) => {
      const ls = parseLines(r.item);
      const hasLineRates = ls.some((l) => (Number(l.r) || 0) > 0);
      if (hasLineRates) {
        const totalAmount = Math.round(ls.reduce((sum, l) => sum + (Number(l.q) || 0) * (Number(l.r) || 0), 0));
        const totalQty = ls.reduce((sum, l) => sum + (Number(l.q) || 0), 0);
        const avgRate = totalQty > 0 ? Math.round((totalAmount / totalQty) * 100) / 100 : Number(r.rate) || 0;
        return {
          qty: totalQty || n(r.qty),
          rate: avgRate,
          amount: totalAmount,
        };
      }
      return { amount: Math.round(n(r.qty) * n(r.rate)) };
    },
    seed: [
      { dc: "TRP-1001", supplier: SUPPLIERS[0], item: "Tomato", qty: 592, rate: 28, amount: 16576, status: "Confirmed" },
      { dc: "TRP-1004", supplier: SUPPLIERS[2], item: "Coriander", qty: 198, rate: 45, amount: 8910, status: "Priced" },
      { dc: "TRP-1002", supplier: SUPPLIERS[1], item: "Onion", qty: 1235, rate: 0, amount: 0, status: "Awaiting price" },
    ],
  },
  // C
  {
    slug: "receipts", title: "Warehouse receipts", stage: STAGES[3], flows: "F06 · F07 · F08", prefix: "GRN",
    description: "Capture arrivals, validate weight difference with reasons, then post to ungraded stock. Ledger keeps qty sent; inventory keeps qty received.",
    statuses: ["Arrived", "Weighed", "Validated", "Posted"],
    fields: [
      { key: "date", label: "Received on", type: "date", list: true },
      { key: "route", label: "Receipt route", type: "select", options: ["Market trip", "Direct supplier", "Buyer return"], list: true },
      { key: "dc", label: "Source DC", list: true },
      { key: "item", label: "Products", type: "products", options: ITEMS, list: true },
      { key: "sent", label: "Qty sent", type: "number", suffix: "kg", list: true },
      { key: "received", label: "Qty received", type: "number", suffix: "kg", list: true },
      { key: "diff", label: "Difference", type: "number", suffix: "kg", readOnly: true, list: true },
      { key: "containerType", label: "Container type", type: "select", options: ["Plastic crates", "Wooden boxes", "Gunny bags", "Carton boxes"], list: true },
      { key: "containerCount", label: "Containers received", type: "number", list: true },
      { key: "reason", label: "Difference reason", type: "select", options: ["—", "Moisture loss", "Spillage", "Scale variance", "Damaged in transit"] },
    ],
    compute: (r) => ({ diff: +(n(r.received) - n(r.sent)).toFixed(2) }),
    validate: (r) => (n(r.diff) !== 0 && (!r.reason || r.reason === "—") && ["Validated", "Posted"].includes(String(r.status)) ? "A reason is required when received weight differs from sent." : null),
    seed: [
      { date: d(21), route: "Market trip", dc: "TRP-1001", item: "Cabbage", sent: 175, received: 175, diff: 0, reason: "—", status: "Posted" },
      { date: d(21), route: "Market trip", dc: "TRP-1001", item: "Tomato", sent: 592, received: 585, diff: -7, reason: "Moisture loss", status: "Posted" },
      { date: d(20), route: "Market trip", dc: "TRP-1004", item: "Coriander", sent: 198, received: 198, diff: 0, reason: "—", status: "Posted" },
      { date: d(21), route: "Direct supplier", dc: "DS-2207", item: "Potato", sent: 800, received: 792, diff: -8, reason: "Scale variance", status: "Validated" },
      { date: d(21), route: "Buyer return", dc: "RDC-501", item: "Tomato", sent: 20, received: 18, diff: -2, reason: "—", status: "Weighed" },
      { date: d(21), route: "Market trip", dc: "TRP-1002", item: "Onion", sent: 1235, received: 0, diff: -1235, reason: "—", status: "Arrived" },
    ],
  },
  {
    slug: "containers", title: "Returnable containers", stage: STAGES[3], flows: "F09", prefix: "CNT",
    description: "Track crates and boxes counted at loading and receipt, and return them to suppliers.",
    statuses: ["With us", "Returned", "Short"],
    fields: [
      { key: "type", label: "Container type", type: "select", options: ["Plastic crate", "Wooden box", "Gunny bag"], list: true },
      { key: "party", label: "Supplier", type: "select", options: SUPPLIERS, list: true },
      { key: "out", label: "Received", type: "number", list: true },
      { key: "back", label: "Returned", type: "number", list: true },
      { key: "balance", label: "Balance", type: "number", readOnly: true, list: true },
    ],
    compute: (r) => ({ balance: n(r.out) - n(r.back) }),
    seed: [
      { type: "Plastic crate", party: SUPPLIERS[0], out: 40, back: 40, balance: 0, status: "Returned" },
      { type: "Plastic crate", party: SUPPLIERS[3], out: 30, back: 12, balance: 18, status: "With us" },
      { type: "Wooden box", party: SUPPLIERS[2], out: 15, back: 13, balance: 2, status: "Short" },
      { type: "Gunny bag", party: SUPPLIERS[1], out: 25, back: 20, balance: 5, status: "With us" },
    ],
  },
  // D
  {
    slug: "quality-check", title: "Two-stage quality check", stage: STAGES[4], flows: "F10 · F11 · F12", prefix: "QC",
    description: "Assign ungraded stock to a grader. Stage 1 splits Grade A / rejects; stage 2 regrades rejects into Grade B or trash.",
    statuses: ["Assigned", "Stage 1 done", "Stage 2 done"],
    fields: [
      { key: "lot", label: "Receipt lot", list: true },
      { key: "item", label: "Products", type: "products", options: ITEMS, list: true },
      { key: "grader", label: "Assigned to", type: "select", options: EMPLOYEES, list: true },
      { key: "input", label: "Input qty", type: "number", suffix: "kg", list: true, required: true },
      { key: "gradeA", label: "Grade A", type: "number", suffix: "kg", list: true },
      { key: "reject", label: "Level-1 reject", type: "number", suffix: "kg", readOnly: true, list: true },
      { key: "gradeB", label: "Grade B", type: "number", suffix: "kg", list: true },
      { key: "trash", label: "Trash", type: "number", suffix: "kg", readOnly: true, list: true },
    ],
    compute: (r) => {
      const reject = Math.max(0, n(r.input) - n(r.gradeA));
      return { reject, trash: Math.max(0, reject - n(r.gradeB)) };
    },
    validate: (r) => (n(r.gradeA) > n(r.input) ? "Grade A cannot exceed input quantity." : n(r.gradeB) > n(r.reject) ? "Grade B cannot exceed rejected quantity." : null),
    seed: [
      { lot: "GRN-1001", item: "Cabbage", grader: EMPLOYEES[3], input: 175, gradeA: 175, reject: 0, gradeB: 0, trash: 0, status: "Stage 1 done" },
      { lot: "GRN-1001", item: "Tomato", grader: EMPLOYEES[2], input: 100, gradeA: 70, reject: 30, gradeB: 22, trash: 8, status: "Stage 2 done" },
      { lot: "GRN-1001", item: "Tomato", grader: EMPLOYEES[3], input: 485, gradeA: 410, reject: 75, gradeB: 0, trash: 75, status: "Stage 1 done" },
      { lot: "GRN-1002", item: "Coriander", grader: EMPLOYEES[2], input: 198, gradeA: 0, reject: 198, gradeB: 0, trash: 198, status: "Assigned" },
      { lot: "GRN-1003", item: "Potato", grader: EMPLOYEES[3], input: 792, gradeA: 700, reject: 92, gradeB: 80, trash: 12, status: "Stage 2 done" },
    ],
  },
  // E
  {
    slug: "packing", title: "Packing & QR stickers", stage: STAGES[5], flows: "F14 · F15 · F16", prefix: "PK",
    description: "Allocate graded stock for packing, print same-day QR stickers and convert packed output into sales stock.",
    statuses: ["Allocated", "Stickers printed", "Packed", "In sales stock"],
    fields: [
      { key: "item", label: "Products", type: "products", options: ITEMS, list: true },
      { key: "grade", label: "Grade", type: "select", options: ["Grade A", "Grade B"], list: true },
      { key: "packer", label: "Packer", type: "select", options: EMPLOYEES, list: true },
      { key: "packSize", label: "Pack size", type: "number", suffix: "g", list: true },
      { key: "packs", label: "No. of packs", type: "number", list: true },
      { key: "nominal", label: "Nominal qty", type: "number", suffix: "kg", readOnly: true, list: true },
      { key: "containerType", label: "Container type", type: "select", options: ["Plastic crates", "Corrugated boxes", "Gunny bags", "Net bags"], list: true },
      { key: "containerCount", label: "Container count", type: "number", list: true },
    ],
    compute: (r) => ({ nominal: +((n(r.packSize) * n(r.packs)) / 1000).toFixed(2) }),
    seed: [
      { item: "Tomato", grade: "Grade A", packer: EMPLOYEES[4], packSize: 1000, packs: 150, nominal: 150, status: "In sales stock" },
      { item: "Coriander", grade: "Grade A", packer: EMPLOYEES[4], packSize: 250, packs: 100, nominal: 25, status: "Stickers printed" },
      { item: "Potato", grade: "Grade A", packer: EMPLOYEES[4], packSize: 5000, packs: 100, nominal: 500, status: "Packed" },
      { item: "Tomato", grade: "Grade B", packer: EMPLOYEES[4], packSize: 500, packs: 40, nominal: 20, status: "Allocated" },
    ],
  },
  {
    slug: "catalogue", title: "Catalogue & offers", stage: STAGES[5], flows: "F17", prefix: "SKU",
    description: "Sales inventory catalogue with selling prices and buyer-specific offers.",
    statuses: ["Draft", "Live", "Paused"],
    fields: [
      { key: "name", label: "Product", list: true, required: true },
      { key: "unit", label: "Unit", type: "select", options: ["kg", "pack", "bundle", "piece"], list: true },
      { key: "price", label: "Selling price", type: "number", money: true, list: true },
      { key: "stock", label: "Stock", type: "number", list: true },
      { key: "offer", label: "Buyer offer", list: true },
    ],
    seed: [
      { name: "Tomato Grade A", unit: "kg", price: 42, stock: 147, offer: "5% off > 100 kg", status: "Live" },
      { name: "Onion Grade A", unit: "kg", price: 38, stock: 65, offer: "Wholesale ₹36/kg", status: "Live" },
      { name: "Potato 10kg bag", unit: "pack", price: 280, stock: 20, offer: "Nilgiris special", status: "Live" },
      { name: "Tomato Grade B", unit: "kg", price: 24, stock: 20, offer: "Hotel clearance", status: "Live" },
      { name: "Onion Grade B", unit: "kg", price: 20, stock: 10, offer: "—", status: "Live" },
      { name: "Carrot Ooty Grade A", unit: "kg", price: 48, stock: 78, offer: "Fresh arrival", status: "Live" },
      { name: "Coriander fresh bunch", unit: "pack", price: 20, stock: 39, offer: "—", status: "Live" },
    ],
  },
  // F
  {
    slug: "sales-orders", title: "Sales orders", stage: STAGES[6], flows: "F18", prefix: "SO",
    description: "Sales orders created against a customer PO from sales inventory.",
    statuses: ["Open", "Confirmed", "Dispatched", "Closed"],
    fields: [
      { key: "po", label: "Customer PO", list: true },
      { key: "buyer", label: "Buyer", type: "select", options: BUYERS, list: true, required: true },
      { key: "item", label: "Products", type: "products", options: ITEMS, list: true },
      { key: "qty", label: "Qty", type: "number", list: true },
      { key: "rate", label: "Rate", type: "number", money: true },
      { key: "value", label: "Order value", type: "number", money: true, readOnly: true, list: true },
    ],
    compute: (r) => ({ value: Math.round(n(r.qty) * n(r.rate)) }),
    seed: [
      { po: "PO-1001", buyer: BUYERS[0], item: "Tomato", qty: 150, rate: 42, value: 6300, status: "Dispatched" },
      { po: "PO-1004", buyer: BUYERS[4], item: "Potato", qty: 100, rate: 155, value: 15500, status: "Closed" },
      { po: "PO-1002", buyer: BUYERS[2], item: "Onion", qty: 300, rate: 38, value: 11400, status: "Confirmed" },
    ],
  },
  {
    slug: "dispatch", title: "Sales DC & FleetMate trip", stage: STAGES[6], flows: "F19", prefix: "SDC",
    description: "Saving a sales DC generates a FleetMate delivery trip.",
    statuses: ["Created", "Trip assigned", "In transit", "Delivered"],
    fields: [
      { key: "so", label: "Sales order", list: true },
      { key: "buyer", label: "Buyer", type: "select", options: BUYERS, list: true },
      { key: "vehicle", label: "Vehicle", type: "select", options: VEHICLES, list: true },
      { key: "driver", label: "Driver", type: "select", options: DRIVERS },
      { key: "trip", label: "FleetMate trip", list: true },
      { key: "date", label: "Dispatch date", type: "date", list: true },
    ],
    seed: [
      { so: "SO-1001", buyer: BUYERS[0], vehicle: VEHICLES[2], driver: "Suresh", trip: "FM-88412", date: d(21), status: "In transit" },
      { so: "SO-1002", buyer: BUYERS[4], vehicle: VEHICLES[0], driver: "Raja", trip: "FM-88390", date: d(20), status: "Delivered" },
    ],
  },
  {
    slug: "invoices", title: "Sales invoices", stage: STAGES[6], flows: "F20", prefix: "INV",
    description: "Invoices are raised against the DC; sales stock reduces once, at invoice — not at DC creation.",
    statuses: ["Draft", "Issued", "Part paid", "Paid"],
    fields: [
      { key: "dc", label: "Sales DC", list: true },
      { key: "buyer", label: "Buyer", type: "select", options: BUYERS, list: true },
      { key: "date", label: "Invoice date", type: "date", list: true },
      { key: "taxable", label: "Taxable value", type: "number", money: true },
      { key: "gst", label: "GST %", type: "select", options: ["0", "5", "12", "18"] },
      { key: "total", label: "Invoice total", type: "number", money: true, readOnly: true, list: true },
      { key: "paid", label: "Received", type: "number", money: true, list: true },
    ],
    compute: (r) => ({ total: Math.round(n(r.taxable) * (1 + n(r.gst) / 100)) }),
    seed: [
      { dc: "SDC-1001", buyer: BUYERS[0], date: d(21), taxable: 6300, gst: "0", total: 6300, paid: 0, status: "Issued" },
      { dc: "SDC-1002", buyer: BUYERS[4], date: d(20), taxable: 15500, gst: "0", total: 15500, paid: 15500, status: "Paid" },
      { dc: "SDC-0998", buyer: BUYERS[2], date: d(18), taxable: 33250, gst: "5", total: 34913, paid: 20000, status: "Part paid" },
    ],
  },
  {
    slug: "deliveries", title: "Delivery & buyer QC", stage: STAGES[6], flows: "F21", prefix: "DLV",
    description: "Buyer inspects goods at delivery; driver and buyer sign. Quality issues branch to returns.",
    statuses: ["Pending", "QC passed", "QC issue", "Signed"],
    fields: [
      { key: "dc", label: "Sales DC", list: true },
      { key: "buyer", label: "Buyer", type: "select", options: BUYERS, list: true },
      { key: "accepted", label: "Accepted qty", type: "number", list: true },
      { key: "issueQty", label: "Issue qty", type: "number", list: true },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
    seed: [
      { dc: "SDC-1002", buyer: BUYERS[4], accepted: 100, issueQty: 0, remarks: "All good", status: "Signed" },
      { dc: "SDC-0998", buyer: BUYERS[2], accepted: 280, issueQty: 20, remarks: "Some tomatoes over-ripe", status: "QC issue" },
      { dc: "SDC-1001", buyer: BUYERS[0], accepted: 0, issueQty: 0, remarks: "", status: "Pending" },
    ],
  },
  {
    slug: "returns", title: "Returns & return DC", stage: STAGES[6], flows: "F22 · F23", prefix: "RDC",
    description: "Signed return creates one return DC and one credit note. Returned goods restart grading.",
    statuses: ["Requested", "Return DC created", "Received", "Sent to QC"],
    fields: [
      { key: "invoice", label: "Invoice", list: true },
      { key: "buyer", label: "Buyer", type: "select", options: BUYERS, list: true },
      { key: "item", label: "Products", type: "products", options: ITEMS, list: true },
      { key: "qty", label: "Return qty", type: "number", suffix: "kg", list: true },
      { key: "reason", label: "Reason", type: "select", options: ["Quality issue", "Excess supply", "Wrong item"], list: true },
    ],
    seed: [
      { invoice: "INV-0998", buyer: BUYERS[2], item: "Tomato", qty: 20, reason: "Quality issue", status: "Received" },
      { invoice: "INV-0991", buyer: BUYERS[1], item: "Beans", qty: 8, reason: "Wrong item", status: "Sent to QC" },
    ],
  },
  // G
  {
    slug: "buyer-payments", title: "Buyer payments", stage: STAGES[7], flows: "F24", prefix: "RCP",
    description: "Receive buyer payments and allocate them against invoices.",
    statuses: ["Recorded", "Allocated", "Reconciled"],
    fields: [
      { key: "date", label: "Date", type: "date", list: true },
      { key: "buyer", label: "Buyer", type: "select", options: BUYERS, list: true },
      { key: "invoice", label: "Against invoice", list: true },
      { key: "mode", label: "Mode", type: "select", options: ["UPI", "NEFT", "Cash", "Cheque"], list: true },
      { key: "amount", label: "Amount", type: "number", money: true, list: true, required: true },
    ],
    seed: [
      { date: d(21), buyer: "Nilgiris Supermarket", invoice: "INV-1002", mode: "NEFT", amount: 10000, status: "Reconciled" },
      { date: d(22), buyer: "FreshMart Retail", invoice: "INV-1001", mode: "UPI", amount: 840, status: "Reconciled" },
    ],
  },
  {
    slug: "supplier-payments", title: "Supplier payments", stage: STAGES[7], flows: "F25", prefix: "PAY",
    description: "Pay suppliers from the Trading House ledger using the quantity sent and confirmed price.",
    statuses: ["Due", "Approved", "Paid"],
    fields: [
      { key: "date", label: "Date", type: "date", list: true },
      { key: "supplier", label: "Supplier", type: "select", options: SUPPLIERS, list: true },
      { key: "ref", label: "Price ref", list: true },
      { key: "mode", label: "Mode", type: "select", options: ["NEFT", "UPI", "Cash"], list: true },
      { key: "amount", label: "Amount", type: "number", money: true, list: true, required: true },
    ],
    seed: [
      { date: d(21), supplier: "Murugan Traders", ref: "TRP-1001", mode: "NEFT", amount: 5000, status: "Paid" },
      { date: d(22), supplier: "Udumalai Fresh Agro", ref: "TRP-1002", mode: "UPI", amount: 3300, status: "Paid" },
      { date: d(22), supplier: "Sri Lakshmi Vegetables", ref: "TRP-1003", mode: "NEFT", amount: 3000, status: "Paid" },
    ],
  },
  {
    slug: "credit-notes", title: "Credit notes", stage: STAGES[7], flows: "F22 · F26", prefix: "CN",
    description: "Credit notes from returns and manual buyer credit notes. A quantity cannot be credited twice.",
    statuses: ["Draft", "Issued", "Adjusted"],
    fields: [
      { key: "invoice", label: "Invoice", list: true },
      { key: "buyer", label: "Buyer", type: "select", options: BUYERS, list: true },
      { key: "kind", label: "Type", type: "select", options: ["Return Adjustment", "Manual"], list: true },
      { key: "amount", label: "Amount", type: "number", money: true, list: true },
      { key: "note", label: "Reason", type: "textarea" },
    ],
    seed: [
      { invoice: "INV-1001", buyer: "FreshMart Retail", kind: "Return Adjustment", amount: 126, note: "3 kg tomato returned under RET-1001", status: "Issued" },
    ],
  },
  {
    slug: "attendance", title: "Attendance & salary", stage: STAGES[7], flows: "F27", prefix: "ATT",
    description: "Monthly attendance and salary records linked to employee and period.",
    statuses: ["Open", "Processed", "Paid"],
    fields: [
      { key: "employee", label: "Employee", type: "select", options: EMPLOYEES, list: true },
      { key: "period", label: "Period", type: "select", options: ["Sep 2026", "Oct 2026"], list: true },
      { key: "days", label: "Days present", type: "number", list: true },
      { key: "base", label: "Monthly salary", type: "number", money: true },
      { key: "payable", label: "Salary payable", type: "number", money: true, readOnly: true, list: true },
    ],
    compute: (r) => ({ payable: Math.round((n(r.base) / 26) * n(r.days)) }),
    seed: [
      ...EMPLOYEES.map((e, i) => ({ employee: e, period: "Sep 2026", days: [26, 24, 25, 22, 26, 26][i], base: [45000, 18000, 16000, 16000, 14000, 28000][i], payable: Math.round(([45000, 18000, 16000, 16000, 14000, 28000][i]! / 26) * [26, 24, 25, 22, 26, 26][i]!), status: "Paid" })),
      ...EMPLOYEES.map((e, i) => ({ employee: e, period: "Oct 2026", days: [22, 21, 22, 20, 22, 22][i], base: [45000, 18000, 16000, 16000, 14000, 28000][i], payable: Math.round(([45000, 18000, 16000, 16000, 14000, 28000][i]! / 26) * [22, 21, 22, 20, 22, 22][i]!), status: i < 3 ? "Paid" : "Processed" })),
    ],
  },
  {
    slug: "expenses", title: "Overheads & expenses", stage: STAGES[7], flows: "F27", prefix: "EXP",
    description: "Overhead and promotional costs recorded against the Trading House.",
    statuses: ["Submitted", "Approved", "Paid"],
    fields: [
      { key: "date", label: "Date", type: "date", list: true },
      { key: "category", label: "Category", type: "select", options: ["Rent", "Electricity", "Fuel", "Promotion", "Packaging", "Cold storage", "Misc"], list: true },
      { key: "vendor", label: "Paid to", list: true },
      { key: "amount", label: "Amount", type: "number", money: true, list: true, required: true },
    ],
    seed: [
      { date: d(1), category: "Rent", vendor: "Ramesh Estates", amount: 55000, status: "Paid" },
      { date: d(15), category: "Electricity", vendor: "TNEB", amount: 12840, status: "Paid" },
      { date: d(18), category: "Fuel", vendor: "Indian Oil Corp", amount: 8450, status: "Paid" },
      { date: d(19), category: "Packaging", vendor: "PackWell Solutions", amount: 7600, status: "Approved" },
      { date: d(20), category: "Cold storage", vendor: "Apex Chillers", amount: 6200, status: "Approved" },
      { date: d(21), category: "Promotion", vendor: "Local Trade Ads", amount: 5000, status: "Submitted" },
    ],
  },
];

export const MODULES = configureModules(BASE_MODULES, ITEMS);

const MODULE_ROUTE_ALIASES: Record<string, string> = {
  catalog: "product-catalog",
  "warehouse-receipt": "receipts",
  "warehouse-receipts": "receipts",
  "warehouse-receipt-note": "receipts",
  "warehouse-receipt-notes": "receipts",
  "goods-receipt": "receipts",
  "goods-receipts": "receipts",
  grn: "receipts",
};

export const getModule = (slug: string) => {
  const canonicalSlug = MODULE_ROUTE_ALIASES[slug] || slug;
  return MODULES.find((m) => m.slug === canonicalSlug);
};

export function seedRows(m: ModuleDef): Row[] {
  return m.seed.map((r, i) => ({ ...r, id: (r.id as string) || `${m.prefix}-${1001 + i}` }) as unknown as Row);
}

export function ensureDirectoryDemoData(data: Record<string, Row[]>): Record<string, Row[]> {
  const next = { ...data };
  for (const slug of ["suppliers", "buyers", "transporters"]) {
    if (next[slug]?.length) continue;
    const module = MODULES.find((candidate) => candidate.slug === slug);
    if (module) next[slug] = seedRows(module);
  }
  return next;
}

export const fmtMoney = (v: unknown) => "₹" + (Number(v) || 0).toLocaleString("en-IN");
