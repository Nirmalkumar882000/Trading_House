import { useState } from "react";
import { HelpCircle, CheckCircle, Clock, AlertCircle, Search, Filter, ShieldAlert } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export interface OpenPoint {
  id: string;
  topic: string;
  flows: string;
  requirement: string;
  unresolvedQuestion: string;
  proposedOptions: string[];
  customerDecision: string;
  implementationImpact: string;
  testingImpact: string;
  status: "Pending" | "Approved" | "Deferred";
}

export const OPEN_POINTS: OpenPoint[] = [
  {
    id: "C01",
    topic: "Role & Permission Matrix",
    flows: "F01",
    requirement: "Backend-enforced role-based access for 14 operational and external personas.",
    unresolvedQuestion: "Final sign-off on role taxonomy and whether Graders can perform both Stage 1 and Stage 2.",
    proposedOptions: [
      "[P] Proposal A: Unified Grader role with capability to execute both Stage 1 and Stage 2.",
      "[P] Proposal B: Dedicated Stage 1 rough graders vs Stage 2 precision sorting specialists.",
    ],
    customerDecision: "Approved Proposal A: Unified Grader persona with supervisor task assignment tracking.",
    implementationImpact: "Single employee role with supervisor assignment workflow in quality-check module.",
    testingImpact: "Verify permission blocks on price fields for Receipt Staff and Graders.",
    status: "Approved",
  },
  {
    id: "C02",
    topic: "Market Trip Structure & DC Numbering",
    flows: "F02 · F04",
    requirement: "One market trip can contain multiple products from multiple suppliers with gross, tare, net.",
    unresolvedQuestion: "Whether to issue one multi-supplier DC per trip or individual supplier-wise DCs.",
    proposedOptions: [
      "[P] Proposal A: Single consolidated Transport DC per trip with multi-supplier purchase lines.",
      "[P] Proposal B: Individual supplier sub-challans under a parent trip voucher.",
    ],
    customerDecision: "Approved Proposal A: Single consolidated FleetMate Transport DC containing itemized supplier lines.",
    implementationImpact: "buys field on trips storing array of supplier, product, KG and agreed rates.",
    testingImpact: "Validate 3 signatures check before trip submission.",
    status: "Approved",
  },
  {
    id: "C03",
    topic: "Count-Only Items vs Variable Weight Produce",
    flows: "F03 · F07",
    requirement: "Capture units (boxes, bags, bundles) alongside physical weight in kilograms.",
    unresolvedQuestion: "Should items like Banana (pieces) or Coriander (bundles) bypass scale weigh-in?",
    proposedOptions: [
      "[P] Proposal A: Dual capture (units count + total kilogram net weight) for all produce.",
      "[P] Proposal B: Strict branch by item type (weighed produce vs counted produce).",
    ],
    customerDecision: "Approved Proposal A: All goods carry KG net weight as base inventory, with secondary unit count.",
    implementationImpact: "Normalization ensures item JSON carries standard KG with pack/unit breakdown.",
    testingImpact: "Verify non-zero KG validation on receipt and packing.",
    status: "Approved",
  },
  {
    id: "C04",
    topic: "Crate Tare Standard vs Actual Tare Basis",
    flows: "F03 · F06",
    requirement: "Net weight = Gross weight minus Tare weight.",
    unresolvedQuestion: "Standard tare (e.g. 2.0 kg per plastic crate) vs tare-weighed empty vehicle/crates.",
    proposedOptions: [
      "[P] Proposal A: Configurable standard crate tare (2.0kg plastic crate, 1.2kg wooden box, 0.3kg gunny bag).",
      "[P] Proposal B: Compulsory physical tare scale capture for every vehicle weigh-in.",
    ],
    customerDecision: "Approved Proposal A with manual tare override on weighbridge scale.",
    implementationImpact: "Automatic tare calculation based on container type with manual scale tare button.",
    testingImpact: "Net weight cannot be negative when tare exceeds gross.",
    status: "Approved",
  },
  {
    id: "C05",
    topic: "Supplier Pricing Timing & Payable Creation",
    flows: "F05 · F25",
    requirement: "Market Trader supplier portal allows supplier to enter price per KG against trip DC.",
    unresolvedQuestion: "Does payable ledger update immediately on price submission or after accounting approval?",
    proposedOptions: [
      "[P] Proposal A: Two-step flow: Supplier enters price -> Accounts approves -> Payable posted.",
      "[P] Proposal B: Auto-post payable based on prevailing market benchmark price.",
    ],
    customerDecision: "Pending: Currently operating in two-step flow (Awaiting price -> Priced -> Confirmed).",
    implementationImpact: "supplier-prices module separates Priced status from Confirmed payable status.",
    testingImpact: "Unconfirmed prices do not generate settled payment records.",
    status: "Pending",
  },
  {
    id: "C06",
    topic: "Receipt Weight Variance Threshold (>10%)",
    flows: "F07 · F08",
    requirement: "Compare origin sent weight vs warehouse received weight.",
    unresolvedQuestion: "Action when variance exceeds 10%: auto-reject receipt or mandate supervisor logged reason?",
    proposedOptions: [
      "[P] Proposal A: Block receipt posting until supervisor enters mandatory variance reason.",
      "[P] Proposal B: Automatic deduction from supplier valuation for transit loss.",
    ],
    customerDecision: "Approved Proposal A: Block posting if variance >10% without verified reason; do not auto-penalize supplier.",
    implementationImpact: "Receipt validation enforces diff != 0 requires reason; red alert UI for >10% variance.",
    testingImpact: "Verify posting fails when diff is non-zero and reason is empty or '—'.",
    status: "Approved",
  },
  {
    id: "C07",
    topic: "Returnable Container Deposit & Cycle",
    flows: "F09",
    requirement: "Track plastic crates, wooden boxes and gunny bags received and returned to suppliers.",
    unresolvedQuestion: "Should monetary container deposit be charged on supplier/buyer ledger?",
    proposedOptions: [
      "[P] Proposal A: Physical quantity tracking only (received, returned, net balance with us).",
      "[P] Proposal B: Financial deposit ledger with refundable ₹150/crate charge.",
    ],
    customerDecision: "Deferred: Financial crate deposit deferred to Phase 2; currently tracking physical balances.",
    implementationImpact: "containers module tracks balance = received - returned per supplier.",
    testingImpact: "Verify container balance updates on return.",
    status: "Deferred",
  },
  {
    id: "C08",
    topic: "Two-Stage QC Reconciliation & Trash Rules",
    flows: "F10 · F11 · F12",
    requirement: "Stage 1: splits Grade A and rejects. Stage 2: regrades rejects into Grade B and trash.",
    unresolvedQuestion: "Can Stage 2 recover Grade A from rejected lots? (PDF scope explicitly says Grade B and Trash).",
    proposedOptions: [
      "[P] Proposal A: Strict PDF scope: Stage 2 produces Grade B and trash only.",
      "[P] Proposal B: Scope expansion: Stage 2 allows minor Grade A re-classification.",
    ],
    customerDecision: "Approved Proposal A: Strictly Grade B and Trash in Stage 2. (Grade A recovery requires formal scope change).",
    implementationImpact: "Input = Grade A + Grade B + Trash reconciliation validation enforced.",
    testingImpact: "Grade B cannot exceed rejected quantity; duplicate grading of same receipt blocked.",
    status: "Approved",
  },
  {
    id: "C09",
    topic: "Buyer Credit Limits & Partial Order Fulfilment",
    flows: "F13 · F18",
    requirement: "Check buyer credit limit before confirming sales order.",
    unresolvedQuestion: "Allow partial dispatch if buyer reaches credit limit or inventory is short?",
    proposedOptions: [
      "[P] Proposal A: Allow partial order supply with buyer confirmation; block if credit exceeded.",
      "[P] Proposal B: Strict all-or-nothing order fulfillment.",
    ],
    customerDecision: "Approved Proposal A: Partial dispatch supported; sales DC reflects actual supplied KG.",
    implementationImpact: "Sales order tracks actual supply KG from available packed stock.",
    testingImpact: "Cannot dispatch beyond available packed stock.",
    status: "Approved",
  },
  {
    id: "C10",
    topic: "Packing Loss Tolerance & Same-Day QR Sticker Policy",
    flows: "F14 · F15 · F16",
    requirement: "Pack graded stock into configurable bag sizes (e.g. 250g, 500g, 1kg, 5kg); apply QR stickers.",
    unresolvedQuestion: "Allowed packing loss % and shelf-life expiration on printed stickers.",
    proposedOptions: [
      "[P] Proposal A: Up to 2% packing loss tolerance; stickers must be printed on same packing day; NO selling price.",
      "[P] Proposal B: Allow printing selling price on retail packs.",
    ],
    customerDecision: "Approved Proposal A: Strictly exclude selling price from QR sticker; enforce same-day packing date.",
    implementationImpact: "QrStickerModal excludes selling price; prints net weight, lot, packed date, shelf life.",
    testingImpact: "Verify QR payload does not leak price.",
    status: "Approved",
  },
  {
    id: "C11",
    topic: "FleetMate Integration Retries & DC Sync",
    flows: "F19",
    requirement: "Saving Sales DC automatically creates FleetMate delivery trip.",
    unresolvedQuestion: "Handling FleetMate API connection timeouts or driver re-assignments.",
    proposedOptions: [
      "[P] Proposal A: Auto-generate trip ID locally with async webhook sync to FleetMate.",
      "[P] Proposal B: Synchronous blocking call to FleetMate API with rollback on failure.",
    ],
    customerDecision: "Approved Proposal A: Immediate local FleetMate trip assignment with background sync adapter.",
    implementationImpact: "dispatch module creates FM-xxxx trip ID instantly.",
    testingImpact: "Sales DC cannot exist without vehicle and driver.",
    status: "Approved",
  },
  {
    id: "C12",
    topic: "Delivery Discrepancies & Credit Note Timing",
    flows: "F21 · F22 · F23",
    requirement: "Buyer delivery inspection logs accepted vs issue quantity; issue generates return DC.",
    unresolvedQuestion: "Is credit note issued immediately upon delivery signature or upon warehouse physical receipt?",
    proposedOptions: [
      "[P] Proposal A: Immediate credit note upon signed Return DC at delivery; warehouse receipt only updates physical stock.",
      "[P] Proposal B: Delay credit note until goods are physically re-inspected at warehouse.",
    ],
    customerDecision: "Approved Proposal A: Immediate credit note on signed Return DC; warehouse receipt moves stock to QC without duplicate credit.",
    implementationImpact: "Automatic credit note created once; warehouse receipt does not issue second credit note.",
    testingImpact: "Verify duplicate credit notes are prevented; returned stock moves to QC holding bay.",
    status: "Approved",
  },
  {
    id: "C13",
    topic: "Payment Settlement & Partial Reconciliations",
    flows: "F24 · F25",
    requirement: "Buyer payments allocated against invoices; supplier payments settled against confirmed prices.",
    unresolvedQuestion: "Handling unconfirmed or bounced payments (e.g. cheque clearance delays).",
    proposedOptions: [
      "[P] Proposal A: Status states: Recorded -> Allocated -> Reconciled. Never mark unconfirmed as settled.",
      "[P] Proposal B: Auto-reconcile all digital payments upon gateway callback.",
    ],
    customerDecision: "Approved Proposal A: Strict rule: Never mark unconfirmed payments as settled.",
    implementationImpact: "buyer-payments and invoices track pending, part-paid and reconciled states.",
    testingImpact: "Invoice status remains 'Part paid' if allocated amount < total amount.",
    status: "Approved",
  },
  {
    id: "C14",
    topic: "Employee Payroll & Attendance Formula",
    flows: "F27",
    requirement: "Monthly attendance logs days present; calculates payable salary.",
    unresolvedQuestion: "Standard days divisor (26 days vs calendar days) and overtime rules.",
    proposedOptions: [
      "[P] Proposal A: Standard 26-working-day formula: Salary Payable = (Monthly Base / 26) * Days Present.",
      "[P] Proposal B: Calendar-month day basis (28/30/31 days).",
    ],
    customerDecision: "Approved Proposal A: 26-day basis standard across all employee roles.",
    implementationImpact: "attendance module compute hook computes (base / 26) * days.",
    testingImpact: "Validate salary calculation consistency across roles.",
    status: "Approved",
  },
];

export function OpenPointsRegister() {
  const [filter, setFilter] = useState<string>("All");
  const [q, setQ] = useState<string>("");

  const filtered = OPEN_POINTS.filter((p) => {
    const matchesFilter = filter === "All" || p.status === filter;
    const matchesQuery =
      !q ||
      p.id.toLowerCase().includes(q.toLowerCase()) ||
      p.topic.toLowerCase().includes(q.toLowerCase()) ||
      p.requirement.toLowerCase().includes(q.toLowerCase()) ||
      p.customerDecision.toLowerCase().includes(q.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const counts = {
    All: OPEN_POINTS.length,
    Approved: OPEN_POINTS.filter((p) => p.status === "Approved").length,
    Pending: OPEN_POINTS.filter((p) => p.status === "Pending").length,
    Deferred: OPEN_POINTS.filter((p) => p.status === "Deferred").length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Stage A · Setup & Governance</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Active Control Register
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">Customer Decisions & Controls (C01–C14)</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Operational decisions, control parameters, and compliance verification across all 14 business control points.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 shadow-card">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search open points by ID, topic, decision…"
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {(["All", "Approved", "Pending", "Deferred"] as const).map((s) => (
            <Button
              variant="ghost"
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium",
                filter === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s} ({counts[s]})
            </Button>
          ))}
        </div>
      </div>

      {/* Register Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((op) => (
          <div
            key={op.id}
            className="rounded-2xl border bg-card p-5 shadow-card space-y-3 transition-all hover:border-primary/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-bold text-primary">{op.id}</span>
                <span className="text-xs text-muted-foreground ml-2">Flows: {op.flows}</span>
                <h3 className="text-base font-semibold text-foreground mt-0.5">{op.topic}</h3>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  op.status === "Approved" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" :
                  op.status === "Pending" ? "bg-amber-500/10 text-amber-600 border border-amber-500/30" :
                  "bg-muted text-muted-foreground"
                )}
              >
                {op.status === "Approved" ? <CheckCircle className="size-3" /> :
                 op.status === "Pending" ? <Clock className="size-3" /> : <AlertCircle className="size-3" />}
                {op.status}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="rounded-lg bg-muted/40 p-2.5">
                <p className="font-semibold text-muted-foreground uppercase text-[10px]">Operational Requirement</p>
                <p className="mt-0.5 text-foreground">{op.requirement}</p>
              </div>

              <div>
                <p className="font-semibold text-muted-foreground uppercase text-[10px]">Decision Checkpoint</p>
                <p className="mt-0.5 text-foreground">{op.unresolvedQuestion}</p>
              </div>

              <div>
                <p className="font-semibold text-muted-foreground uppercase text-[10px]">Policy Options</p>
                <ul className="mt-1 list-disc list-inside space-y-0.5 text-muted-foreground">
                  {op.proposedOptions.map((opt, i) => (
                    <li key={i}>{opt}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-primary-soft/40 p-2.5 border border-primary/20">
                <p className="font-semibold text-primary uppercase text-[10px]">Agreed Business Policy</p>
                <p className="mt-0.5 font-medium text-foreground">{op.customerDecision}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-muted-foreground font-semibold">Implementation: </span>
                  <span className="text-foreground">{op.implementationImpact}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold">Testing: </span>
                  <span className="text-foreground">{op.testingImpact}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
