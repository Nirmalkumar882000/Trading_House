import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Workflow, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck,
  ChevronRight, Sparkles, Filter, ExternalLink
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface FlowDef {
  id: string;
  stage: string;
  stageCode: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  title: string;
  moduleSlug: string;
  description: string;
  inputs: string[];
  outputs: string[];
  decisionPoints: string[];
  acceptanceChecks: string[];
}

export const PROCESS_FLOWS: FlowDef[] = [
  // Stage A
  {
    id: "F01", stage: "Stage A · Business Setup", stageCode: "A", title: "Business Profile & Master Data",
    moduleSlug: "suppliers",
    description: "Registration of Trading House profile, DigiPin, GSTIN, PAN, suppliers, buyers, employees and role access.",
    inputs: ["Legal entity documents", "KYC & GSTIN", "Bank account details", "Market licenses"],
    outputs: ["Trading House master record", "Active supplier directory", "Approved buyer accounts", "Staff credentials"],
    decisionPoints: ["D01: DigiPin verified?", "D02: Supplier KYC approved?", "D03: Role permissions mapped?"],
    acceptanceChecks: ["All mandatory tax fields present", "Role-based restriction on purchase prices verified"],
  },

  // Stage B
  {
    id: "F02", stage: "Stage B · Market Purchase & Pricing", stageCode: "B", title: "Demand Consolidation & Planning",
    moduleSlug: "demand-plan",
    description: "Aggregation of all buyer PO requirements into consolidated product quantities for wholesale purchase.",
    inputs: ["Buyer POs (F13)", "Current saleable stock", "Supplier availability notes"],
    outputs: ["Consolidated purchase requirements (KG)", "Target purchase prices"],
    decisionPoints: ["D04: Demand covered by existing stock?", "D05: Shortage requires new market trip?"],
    acceptanceChecks: ["No guesswork purchases; purchase planned against exact aggregated buyer demand"],
  },
  {
    id: "F03", stage: "Stage B · Market Purchase & Pricing", stageCode: "B", title: "FleetMate Trip & Loading Capture",
    moduleSlug: "trips",
    description: "Creation of market-to-warehouse collection trip with vehicle, driver, units, gross and tare weight.",
    inputs: ["Trip schedule", "Vehicle registration", "Driver profile", "Supplier purchase lines"],
    outputs: ["Trip record in 'Loading' status", "Gross, tare and net weight (KG)", "Container count"],
    decisionPoints: ["D06: Multiple suppliers on trip?", "D07: Vehicle capacity within limits?"],
    acceptanceChecks: ["Net weight = Gross minus Tare; non-zero KG validation enforced"],
  },
  {
    id: "F04", stage: "Stage B · Market Purchase & Pricing", stageCode: "B", title: "Transport DC & 3 Signatures",
    moduleSlug: "trips",
    description: "Generation of Transport Delivery Challan and collection of 3 mandatory digital signatures before dispatch.",
    inputs: ["Trip details", "Supplier verification", "Loader verification", "Driver handover"],
    outputs: ["Transport DC (TDC)", "3 digital signatures recorded", "Status moved to 'Submitted'"],
    decisionPoints: ["D08: All 3 signatures collected?", "D09: Ready for gate pass?"],
    acceptanceChecks: ["System strictly blocks trip submission until all 3 signatures (Supplier, Driver, Loader) are logged"],
  },
  {
    id: "F05", stage: "Stage B · Market Purchase & Pricing", stageCode: "B", title: "Supplier Pricing (Market Trader)",
    moduleSlug: "supplier-prices",
    description: "Supplier enters purchase price per KG against the trip DC in the Market Trader portal; accounts review.",
    inputs: ["Submitted Transport DC", "Market Trader portal entry", "Agreed rate per KG"],
    outputs: ["Priced purchase line", "Purchase valuation amount", "Status: Confirmed"],
    decisionPoints: ["D10: Price within benchmark band?", "D11: Pricing officer confirmed?"],
    acceptanceChecks: ["Receipt staff cannot view purchase prices; amount = qty sent * rate per kg"],
  },

  // Stage C
  {
    id: "F06", stage: "Stage C · Receipt & Containers", stageCode: "C", title: "Warehouse Arrival & Weighbridge",
    moduleSlug: "receipts",
    description: "Physical arrival at warehouse receiving bay; weigh-in via Bluetooth weighing scale or manual fallback.",
    inputs: ["Arrived vehicle", "Transport DC", "Bluetooth scale connection"],
    outputs: ["Gross received weight", "Tare container weight", "Net received weight"],
    decisionPoints: ["D12: BLE scale connected?", "D13: Tare crate standard applied?"],
    acceptanceChecks: ["Tare deduction applied correctly; scale connection status verified"],
  },
  {
    id: "F07", stage: "Stage C · Receipt & Containers", stageCode: "C", title: "Origin vs Received Weight Check",
    moduleSlug: "receipts",
    description: "System compares sent weight against received weight; enforces mandatory reason if variance >10%.",
    inputs: ["DC sent weight", "Actual received weight", "Transit duration"],
    outputs: ["Variance (KG and %)", "Variance reason code", "Supervisor approval flag"],
    decisionPoints: ["D14: Variance exceeds 10% threshold?", "D15: Reason logged & acceptable?"],
    acceptanceChecks: ["Posting strictly blocked if received != sent without a verified reason (Moisture loss, Spillage, etc.)"],
  },
  {
    id: "F08", stage: "Stage C · Receipt & Containers", stageCode: "C", title: "Receipt Posting & Ungraded Stock",
    moduleSlug: "receipts",
    description: "Posting voucher moves actual received KG into warehouse Ungraded inventory at Receiving Bay.",
    inputs: ["Validated receipt voucher", "Verified variance reason"],
    outputs: ["Posted GRN record", "Ungraded stock addition", "Warehouse lot number"],
    decisionPoints: ["D16: Receipt already posted?", "D17: Ready for QC assignment?"],
    acceptanceChecks: ["Supplier-sent qty kept on ledger; warehouse-received qty posted to inventory. Duplicate GRN blocked"],
  },
  {
    id: "F09", stage: "Stage C · Receipt & Containers", stageCode: "C", title: "Returnable Container Tracking",
    moduleSlug: "containers",
    description: "Tracking crates and boxes counted at loading and receipt; managing supplier container balance and returns.",
    inputs: ["Crate count from DC", "Received crate count", "Returned crate voucher"],
    outputs: ["Net container balance with us", "Return DC for empty crates"],
    decisionPoints: ["D18: Container damaged in transit?", "D19: Balance short or returned?"],
    acceptanceChecks: ["Container balance = Received minus Returned; tracked per supplier"],
  },

  // Stage D
  {
    id: "F10", stage: "Stage D · Two-Stage Quality Control", stageCode: "D", title: "Ungraded Stock Selection & QC Task",
    moduleSlug: "quality-check",
    description: "QC supervisor assigns posted ungraded lots to QC graders with start timestamps and lot tracking.",
    inputs: ["Posted receipt lot", "Available ungraded stock", "Assigned grader"],
    outputs: ["QC Task in 'Assigned' status", "Start timestamp", "Input KG allocated"],
    decisionPoints: ["D20: Lot already assigned?", "D21: Grader available?"],
    acceptanceChecks: ["Input KG cannot exceed posted receipt quantity; duplicate assignment prevented"],
  },
  {
    id: "F11", stage: "Stage D · Two-Stage Quality Control", stageCode: "D", title: "Stage 1 Quality Check (Grade A)",
    moduleSlug: "quality-check",
    description: "Grader inspects input produce: captures Grade A quantity and moves remaining rejected stock to holding bay.",
    inputs: ["Assigned lot", "Input produce", "Grading inspection"],
    outputs: ["Grade A quantity (KG)", "First-stage rejected quantity (KG)", "Status: Stage 1 done"],
    decisionPoints: ["D22: Grade A meets specifications?", "D23: Reject qty requires Stage 2?"],
    acceptanceChecks: ["Grade A cannot exceed input quantity; Remaining = Input minus Grade A"],
  },
  {
    id: "F12", stage: "Stage D · Two-Stage Quality Control", stageCode: "D", title: "Stage 2 Quality Check (Grade B / Trash)",
    moduleSlug: "quality-check",
    description: "Remaining stock from Stage 1 (plus buyer returned stock) is graded strictly into Grade B and Trash / Loss.",
    inputs: ["Stage 1 rejected stock", "Buyer returns in QC bay", "Secondary grading"],
    outputs: ["Grade B quantity (KG)", "Trash / Loss quantity (KG)", "100% reconciled output"],
    decisionPoints: ["D24: Produce fit for Grade B secondary sale?", "D25: Trash disposal logged?"],
    acceptanceChecks: ["Input = Grade A + Grade B + Trash (100% weight reconciliation); Grade B cannot exceed rejects"],
  },

  // Stage E
  {
    id: "F13", stage: "Stage E · Orders, Packing & Catalogue", stageCode: "E", title: "Buyer Demand & Customer POs",
    moduleSlug: "purchase-orders",
    description: "Buyers submit purchase orders via Buyer Portal or manual order desk; establishes sales demand.",
    inputs: ["Buyer PO", "Delivery date", "Product & exact KG requirement"],
    outputs: ["Accepted demand record", "Demand summary allocation"],
    decisionPoints: ["D26: Buyer credit limit sufficient?", "D27: Demand converted to SO?"],
    acceptanceChecks: ["Buyer credit checked; non-negative quantities required"],
  },
  {
    id: "F14", stage: "Stage E · Orders, Packing & Catalogue", stageCode: "E", title: "Packing Allocation & Bag Sizes",
    moduleSlug: "packing",
    description: "Allocation of saleable Grade A and Grade B stock into specified bag sizes (e.g. 250g, 500g, 1kg, 5kg).",
    inputs: ["Grade A / Grade B stock", "Buyer demand", "Configured pack size (KG)"],
    outputs: ["Packing job", "Nominal KG packed", "Number of bags"],
    decisionPoints: ["D28: Sufficient graded stock in bay?", "D29: Pack size matches buyer requirement?"],
    acceptanceChecks: ["Cannot allocate stock beyond available saleable grade; bag breakdown calculated"],
  },
  {
    id: "F15", stage: "Stage E · Orders, Packing & Catalogue", stageCode: "E", title: "Bluetooth QR Sticker Printing",
    moduleSlug: "packing",
    description: "Generation of 50mm thermal QR stickers with product, company, weight, packed date, shelf life; NO PRICE.",
    inputs: ["Packed lot", "Pack size", "Shelf-life policy", "Packer name"],
    outputs: ["Thermal QR sticker", "Same-day timestamp", "Serial number"],
    decisionPoints: ["D30: Same-day packing date validated?", "D31: Selling price strictly excluded?"],
    acceptanceChecks: ["Sticker payload strictly excludes selling price per PDF specification; same-day policy enforced"],
  },
  {
    id: "F16", stage: "Stage E · Orders, Packing & Catalogue", stageCode: "E", title: "QR Verification & Sales Stock",
    moduleSlug: "packing",
    description: "Packer scans QR sticker to verify label integrity; moves packed consignment into Dispatch Bay sales inventory.",
    inputs: ["Scanned QR sticker", "Physical packed bags"],
    outputs: ["Packed stock in Sales Inventory", "Status: In sales stock"],
    decisionPoints: ["D32: QR scan matches packing lot?"],
    acceptanceChecks: ["Stock converts from Graded to Packed category; duplicate sales stock creation prevented"],
  },
  {
    id: "F17", stage: "Stage E · Orders, Packing & Catalogue", stageCode: "E", title: "Product Catalogue & Offers",
    moduleSlug: "catalogue",
    description: "Publishing sales inventory to catalogue with GST %, selling prices, live availability and buyer-specific offers.",
    inputs: ["Live sales stock", "Pricing policy", "Buyer tiers"],
    outputs: ["Live catalogue", "WhatsApp/SMS offer broadcast", "Discount rules"],
    decisionPoints: ["D33: Stock available to publish?", "D34: Buyer-specific offer active?"],
    acceptanceChecks: ["Selling prices only editable by authorised pricing officers; live stock visibility"],
  },

  // Stage F
  {
    id: "F18", stage: "Stage F · Sales, Dispatch & Returns", stageCode: "F", title: "Sales Order Creation",
    moduleSlug: "sales-orders",
    description: "Creation of sales order against customer PO; validates packed inventory availability and buyer credit limit.",
    inputs: ["Customer PO", "Sales inventory", "Buyer credit limit"],
    outputs: ["Confirmed Sales Order", "Reserved packed stock"],
    decisionPoints: ["D35: Stock available in dispatch bay?", "D36: Partial order fill required?"],
    acceptanceChecks: ["Sale buyer matches buyer demand; sale quantity cannot exceed available packed stock"],
  },
  {
    id: "F19", stage: "Stage F · Sales, Dispatch & Returns", stageCode: "F", title: "Sales DC & FleetMate Dispatch",
    moduleSlug: "dispatch",
    description: "Saving Sales DC automatically creates a FleetMate delivery trip; vehicle and driver assigned.",
    inputs: ["Confirmed SO", "Vehicle details", "Driver assignment", "Delivery route"],
    outputs: ["Sales Delivery Challan (SDC)", "Automatic FleetMate trip (FM-xxxx)"],
    decisionPoints: ["D37: Transporter assigned?", "D38: FleetMate trip created?"],
    acceptanceChecks: ["Saving Sales DC does NOT deduct sales stock yet (deduction happens at invoice only)"],
  },
  {
    id: "F20", stage: "Stage F · Sales, Dispatch & Returns", stageCode: "F", title: "Sales Invoices & Stock Deduction",
    moduleSlug: "invoices",
    description: "Invoice generated against Sales DC; sales stock reduces exactly once at invoice posting; GST calculated.",
    inputs: ["Sales DC", "Sales order rates", "GST percentage"],
    outputs: ["Sales Invoice (INV)", "Sales stock reduction (once)", "Buyer receivable updated"],
    decisionPoints: ["D39: Correct GST slab applied?", "D40: Stock deducted exactly once?"],
    acceptanceChecks: ["Stock deduction occurs once, linked to invoice; duplicate stock deduction strictly prevented"],
  },
  {
    id: "F21", stage: "Stage F · Sales, Dispatch & Returns", stageCode: "F", title: "Delivery & Buyer QC",
    moduleSlug: "deliveries",
    description: "Buyer inspects goods at delivery location; driver and buyer sign handover; quality issues logged.",
    inputs: ["Delivered goods", "Sales DC", "Buyer QC inspection"],
    outputs: ["Delivery inspection record", "Accepted quantity", "Issue quantity", "Signatures"],
    decisionPoints: ["D41: Quality issues reported?", "D42: Return DC required?"],
    acceptanceChecks: ["Buyer and driver digital signatures recorded; issue quantity branches to Return flow"],
  },
  {
    id: "F22", stage: "Stage F · Sales, Dispatch & Returns", stageCode: "F", title: "Return DC & Automatic Credit Note",
    moduleSlug: "returns",
    description: "Signed return creates one Return DC (RDC) and one automatic invoice-linked buyer credit note.",
    inputs: ["Signed delivery inspection", "Issue quantity", "Original sales invoice"],
    outputs: ["Return Delivery Challan (RDC)", "Automatic Credit Note (CN)", "Buyer receivable adjusted"],
    decisionPoints: ["D43: Issue eligible for credit note?", "D44: Duplicate credit check passed?"],
    acceptanceChecks: ["One credit note per return; duplicate credit note generation strictly blocked"],
  },
  {
    id: "F23", stage: "Stage F · Sales, Dispatch & Returns", stageCode: "F", title: "Warehouse Return Receipt & Regrading",
    moduleSlug: "returns",
    description: "Returned goods physically arrive at warehouse; received into QC holding bay for regrading (F10–F12).",
    inputs: ["Physical returned produce", "Return DC (RDC)"],
    outputs: ["Warehouse receipt voucher", "Stock posted to QC holding bay for Stage 2"],
    decisionPoints: ["D45: Actual returned weight matches RDC?", "D46: Ready for Stage 2 regrading?"],
    acceptanceChecks: ["NO second credit note issued; stock is NOT deducted twice; moves to QC bay for Stage 2"],
  },

  // Stage G
  {
    id: "F24", stage: "Stage G · Finance, People & Reports", stageCode: "G", title: "Buyer Payments & Allocation",
    moduleSlug: "buyer-payments",
    description: "Receive buyer payment via NEFT, UPI, Cash or Cheque; allocate against open invoices and reconcile.",
    inputs: ["Bank remittance / cash", "Buyer name", "Invoice number"],
    outputs: ["Payment receipt voucher", "Invoice status updated (Part paid / Paid)", "Receivable reduced"],
    decisionPoints: ["D47: Payment unconfirmed or cleared?", "D48: Partial allocation applied?"],
    acceptanceChecks: ["Never mark unconfirmed payment as settled; outstanding balance updated accurately"],
  },
  {
    id: "F25", stage: "Stage G · Finance, People & Reports", stageCode: "G", title: "Supplier Payable Settlement",
    moduleSlug: "supplier-payments",
    description: "Review supplier payables based on quantity sent and confirmed market price; execute settlement.",
    inputs: ["Confirmed supplier price", "Quantity sent on DC", "Bank details"],
    outputs: ["Supplier payment voucher", "Payable balance cleared", "Bank transfer ref"],
    decisionPoints: ["D49: Price confirmed by pricing officer?", "D50: Net payment approved?"],
    acceptanceChecks: ["Payable calculated on quantity sent * confirmed price; cannot pay without confirmed price"],
  },
  {
    id: "F26", stage: "Stage G · Finance, People & Reports", stageCode: "G", title: "Manual Buyer Credit Notes",
    moduleSlug: "credit-notes",
    description: "Issuance of manual buyer credit notes for goodwill, commercial rebates or late delivery adjustments.",
    inputs: ["Buyer account", "Original invoice", "Approved goodwill justification"],
    outputs: ["Manual Credit Note", "Buyer ledger credit"],
    decisionPoints: ["D51: Accounts manager approved?", "D52: Not duplicating return credit?"],
    acceptanceChecks: ["Duplicate credit check prevents double adjustment; reason and invoice required"],
  },
  {
    id: "F27", stage: "Stage G · Finance, People & Reports", stageCode: "G", title: "Attendance, Salary & Overheads",
    moduleSlug: "attendance",
    description: "Monthly employee attendance logs, 26-day salary computation, and overhead expense management.",
    inputs: ["Employee attendance", "Monthly base salary", "Vendor expense invoices"],
    outputs: ["Payroll payable = (base / 26) * days", "Overhead expense vouchers"],
    decisionPoints: ["D53: Attendance period locked?", "D54: Expense category allocated?"],
    acceptanceChecks: ["Standard 26-day salary formula applied consistently across all employee roles"],
  },
  {
    id: "F28", stage: "Stage G · Finance, People & Reports", stageCode: "G", title: "Comprehensive Reports & AI Audit",
    moduleSlug: "workflow-reports",
    description: "Management dashboards: stock balances, >10% weight variances, QC grader yield, pack efficiency, P&L, audit trail.",
    inputs: ["Transaction audit log", "Movement ledger", "Stock balances", "Financial ledgers"],
    outputs: ["Live variance reports", "QC performance metrics", "Profit & Loss statement", "AI demand matching"],
    decisionPoints: ["D55: Authorised role to view financial P&L?", "D56: Audit trail complete?"],
    acceptanceChecks: ["AI reports do not invent missing prices or financial values; full before/after audit snapshot"],
  },
];

export function ProcessFlowMap() {
  const [selectedStage, setSelectedStage] = useState<string>("All");
  const [selectedFlow, setSelectedFlow] = useState<FlowDef | null>(PROCESS_FLOWS[0] ?? null);

  const stages = [
    { code: "All", label: "All 28 Flows" },
    { code: "A", label: "Stage A · Setup" },
    { code: "B", label: "Stage B · Purchase" },
    { code: "C", label: "Stage C · Receipt" },
    { code: "D", label: "Stage D · Two-Stage QC" },
    { code: "E", label: "Stage E · Packing" },
    { code: "F", label: "Stage F · Sales" },
    { code: "G", label: "Stage G · Finance" },
  ];

  const filtered = selectedStage === "All"
    ? PROCESS_FLOWS
    : PROCESS_FLOWS.filter((f) => f.stageCode === selectedStage);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Operational Architecture</span>
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
              Interactive Workflow Map (F01–F28)
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">Trading House Process Flow Map</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Complete business workflow covering all 7 stages, 28 process flows, 56 decision checkpoints,
            and operational acceptance criteria.
          </p>
        </div>
      </div>

      {/* Stage Selector Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border bg-card p-2 shadow-card overflow-x-auto">
        {stages.map((st) => (
          <Button
            key={st.code}
            variant="ghost"
            onClick={() => setSelectedStage(st.code)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-medium whitespace-nowrap",
              selectedStage === st.code ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {st.label}
          </Button>
        ))}
      </div>

      {/* Two Column Layout: Flows Grid & Flow Inspector */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Flows List */}
        <div className="lg:col-span-7 space-y-3">
          {filtered.map((flow) => {
            const isSelected = selectedFlow?.id === flow.id;
            return (
              <div
                key={flow.id}
                onClick={() => setSelectedFlow(flow)}
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-sm",
                  isSelected ? "border-primary bg-primary-soft/50 ring-2 ring-primary/30" : "bg-card hover:border-primary/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary text-primary-foreground">
                        {flow.id}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">{flow.stage}</span>
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold text-foreground">{flow.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{flow.description}</p>
                  </div>
                  <ChevronRight className={cn("size-5 shrink-0 transition-transform", isSelected ? "text-primary rotate-90" : "text-muted-foreground")} />
                </div>

                <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-[11px] text-muted-foreground">
                  <span>{flow.decisionPoints.length} Decision Gates</span>
                  <Link
                    to="/m/$module"
                    params={{ module: flow.moduleSlug }}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open Module <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Flow Inspector */}
        <div className="lg:col-span-5">
          {selectedFlow ? (
            <div className="sticky top-20 rounded-2xl border bg-card p-6 shadow-card space-y-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold px-2.5 py-0.5 rounded bg-primary text-primary-foreground">
                    {selectedFlow.id}
                  </span>
                  <span className="text-xs font-semibold text-primary uppercase">{selectedFlow.stage}</span>
                </div>
                <h2 className="mt-2 text-xl font-bold text-foreground">{selectedFlow.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{selectedFlow.description}</p>
              </div>

              {/* Inputs & Outputs */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-muted/40 p-3 border">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px]">Process Inputs</p>
                  <ul className="mt-1.5 space-y-1 text-foreground">
                    {selectedFlow.inputs.map((inp, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="size-1 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span>{inp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-muted/40 p-3 border">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px]">Process Outputs</p>
                  <ul className="mt-1.5 space-y-1 text-foreground">
                    {selectedFlow.outputs.map((out, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="size-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>{out}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Decision Points */}
              <div className="space-y-2">
                <p className="font-semibold text-muted-foreground uppercase text-xs flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-amber-500" /> Key Decision Gates & Branching
                </p>
                <div className="space-y-1.5">
                  {selectedFlow.decisionPoints.map((dp, i) => (
                    <div key={i} className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-400">
                      {dp}
                    </div>
                  ))}
                </div>
              </div>

              {/* Acceptance Criteria */}
              <div className="space-y-2">
                <p className="font-semibold text-muted-foreground uppercase text-xs flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-600" /> Acceptance Checks & Quality Controls
                </p>
                <ul className="space-y-1 text-xs text-foreground">
                  {selectedFlow.acceptanceChecks.map((ac, i) => (
                    <li key={i} className="flex items-start gap-1.5 rounded-lg bg-muted/30 p-2">
                      <CheckCircle2 className="size-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{ac}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Jump to Module Button */}
              <div className="pt-2">
                <Button asChild className="w-full bg-primary text-primary-foreground">
                  <Link to="/m/$module" params={{ module: selectedFlow.moduleSlug }}>
                    Launch Module for {selectedFlow.id} <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
              Select a process flow to inspect details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
