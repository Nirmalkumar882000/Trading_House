import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  Workflow,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ClipboardList,
  ShoppingBasket,
  Package,
  ScanSearch,
  Boxes,
  Truck,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface StageDefinition {
  letter: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I";
  stepNumber: number;
  title: string;
  shortName: string;
  defaultSlug: string;
  flows: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  accentBg: string;
  accentBorder: string;
  icon: LucideIcon;
  upstream: string;
  downstream: string;
  nextAction: {
    label: string;
    targetSlug: string;
  };
}

export const STAGE_DEFINITIONS: Record<string, StageDefinition> = {
  A: {
    letter: "A",
    stepNumber: 1,
    title: "Stage A · Business Setup & Master Data",
    shortName: "Setup & Masters",
    defaultSlug: "suppliers",
    flows: "F01",
    description: "Register wholesale suppliers, retail buyers, employees, roles, and transport fleet before starting transactions.",
    badgeBg: "bg-slate-500/15",
    badgeText: "text-slate-700 dark:text-slate-300",
    accentBg: "from-slate-500/10 via-card to-background",
    accentBorder: "border-slate-500/30",
    icon: SlidersHorizontal,
    upstream: "Initial trading house onboarding & tax profiles",
    downstream: "Enables buyer PO logging and wholesale supplier purchase trips",
    nextAction: {
      label: "Start Operations: Capture Buyer Demand (Stage B) ➔",
      targetSlug: "purchase-orders",
    },
  },
  B: {
    letter: "B",
    stepNumber: 2,
    title: "Stage B · Buyer Demand First",
    shortName: "Buyer Demand",
    defaultSlug: "demand-plan",
    flows: "F13 · F02",
    description: "Buyers place purchase orders first. The system aggregates all demand + extra buffer KG in Demand Plan to prevent guesswork purchases.",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-800 dark:text-amber-400",
    accentBg: "from-amber-500/10 via-card to-background",
    accentBorder: "border-amber-500/30",
    icon: ClipboardList,
    upstream: "Approved retail buyers from Stage A",
    downstream: "Drives wholesale procurement in Stage C and fleet transport in Stage D",
    nextAction: {
      label: "Plan Market Trip & Purchase Sourcing (Stage C) ➔",
      targetSlug: "demand-plan",
    },
  },
  C: {
    letter: "C",
    stepNumber: 3,
    title: "Stage C · Mandi Sourcing & Pricing",
    shortName: "Mandi Sourcing",
    defaultSlug: "trips",
    flows: "F03 · F04 · F05",
    description: "Fleet vehicle sent to Koyambedu market. Units, gross & tare weights recorded; 3 signatures collected; supplier price confirmed in Market Trader.",
    badgeBg: "bg-blue-500/15",
    badgeText: "text-blue-800 dark:text-blue-400",
    accentBg: "from-blue-500/10 via-card to-background",
    accentBorder: "border-blue-500/30",
    icon: ShoppingBasket,
    upstream: "Aggregated demand matrix from Stage B",
    downstream: "Dispatches vehicle to warehouse bay in Stage D; creates supplier payables in Stage H",
    nextAction: {
      label: "Track Fleet & Receive Goods at Bay GRN (Stage D) ➔",
      targetSlug: "transport",
    },
  },
  D: {
    letter: "D",
    stepNumber: 4,
    title: "Stage D · Inward Receiving & Logistics",
    shortName: "Inward & Logistics",
    defaultSlug: "transport",
    flows: "F06 · F07 · F08 · F09",
    description: "Vehicles tracked in transit. Physical arrivals weighed via Bluetooth scale; variance recorded; crates counted; posted to Ungraded Stock.",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-800 dark:text-emerald-400",
    accentBg: "from-emerald-500/10 via-card to-background",
    accentBorder: "border-emerald-500/30",
    icon: Package,
    upstream: "Submitted market trips from Stage C",
    downstream: "Stock enters Ungraded category; moves to Two-Stage QC in Stage E",
    nextAction: {
      label: "Send Received Lot to Two-Stage QC (Stage E) ➔",
      targetSlug: "quality-check",
    },
  },
  E: {
    letter: "E",
    stepNumber: 5,
    title: "Stage E · Two-Stage Quality Check",
    shortName: "Quality Check",
    defaultSlug: "quality-check",
    flows: "F10 · F11 · F12",
    description: "Ungraded stock assigned to QC grader. Stage 1 splits Grade A vs rejects. Stage 2 splits rejects into Grade B (secondary) vs Trash.",
    badgeBg: "bg-violet-500/15",
    badgeText: "text-violet-800 dark:text-violet-400",
    accentBg: "from-violet-500/10 via-card to-background",
    accentBorder: "border-violet-500/30",
    icon: ScanSearch,
    upstream: "Posted receipts from Stage D",
    downstream: "Grade A & B move to Graded stock for packing; rejects branch to Inward Return",
    nextAction: {
      label: "Allocate Graded Produce to Packing & QR Stickers (Stage F) ➔",
      targetSlug: "packing",
    },
  },
  F: {
    letter: "F",
    stepNumber: 6,
    title: "Stage F · Allocation & Packing",
    shortName: "Allocation & Packing",
    defaultSlug: "packing",
    flows: "F14 · F15 · F16 · F17",
    description: "Graded produce allocated to packers; packed into consumer packs (250g, 500g, 1kg) with thermal QR stickers; moves to Dispatch Bay Sales Stock.",
    badgeBg: "bg-indigo-500/15",
    badgeText: "text-indigo-800 dark:text-indigo-400",
    accentBg: "from-indigo-500/10 via-card to-background",
    accentBorder: "border-indigo-500/30",
    icon: Boxes,
    upstream: "Approved Grade A & Grade B produce from Stage E",
    downstream: "Stock enters Packed category; live catalogue published; ready for sales orders",
    nextAction: {
      label: "Create Sales Orders & Dispatch Fleet (Stage G) ➔",
      targetSlug: "sales-orders",
    },
  },
  G: {
    letter: "G",
    stepNumber: 7,
    title: "Stage G · Sales, Dispatch & Reverse Logistics",
    shortName: "Sales & Delivery",
    defaultSlug: "sales-orders",
    flows: "F18 · F19 · F21 · F22 · F23",
    description: "Sales orders allocate packed stock. Outward DC creates delivery trip. Buyer signs POD. Customer rejections branch to Outward Return.",
    badgeBg: "bg-sky-500/15",
    badgeText: "text-sky-800 dark:text-sky-400",
    accentBg: "from-sky-500/10 via-card to-background",
    accentBorder: "border-sky-500/30",
    icon: Truck,
    upstream: "Packed sales inventory in Dispatch Bay from Stage F",
    downstream: "Delivered goods trigger sales invoice and buyer billing in Stage H",
    nextAction: {
      label: "Generate Sales Invoice & Collect Payment (Stage H) ➔",
      targetSlug: "invoices",
    },
  },
  H: {
    letter: "H",
    stepNumber: 8,
    title: "Stage H · Billing, Payments & Ledgers",
    shortName: "Billing & Ledgers",
    defaultSlug: "financial-ledgers",
    flows: "F20 · F24 · F25 · F26 · F27",
    description: "Invoices issued; buyer payments collected; supplier purchases settled; credit notes adjusted; double-entry ledgers reconciled.",
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-800 dark:text-rose-400",
    accentBg: "from-rose-500/10 via-card to-background",
    accentBorder: "border-rose-500/30",
    icon: Wallet,
    upstream: "Signed deliveries and confirmed purchases from Stages C & G",
    downstream: "Reconciles AP, AR, P&L, and multi-location inventory in Stage I",
    nextAction: {
      label: "View Multi-Location Stock Balances & Audit (Stage I) ➔",
      targetSlug: "inventory",
    },
  },
  I: {
    letter: "I",
    stepNumber: 9,
    title: "Stage I · Inventory, Reports & Audit",
    shortName: "Inventory & Audit",
    defaultSlug: "inventory",
    flows: "F28 · Audit",
    description: "Live multi-location stock balances (Ungraded ➔ Graded ➔ Packed ➔ Sold), shrinkage reconciliation, and process flow map.",
    badgeBg: "bg-teal-500/15",
    badgeText: "text-teal-800 dark:text-teal-400",
    accentBg: "from-teal-500/10 via-card to-background",
    accentBorder: "border-teal-500/30",
    icon: Warehouse,
    upstream: "Stock movements across all preceding stages (D, E, F, G)",
    downstream: "Audited operational cycle complete; restart for next trading day",
    nextAction: {
      label: "Restart Daily Trading Lifecycle (Stage A) ➔",
      targetSlug: "suppliers",
    },
  },
};

// Map each module slug to its respective stage letter
export const MODULE_STAGE_MAP: Record<string, "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I"> = {
  // A · Setup
  "": "A",
  suppliers: "A",
  buyers: "A",
  employees: "A",
  transporters: "A",
  "business-profile": "A",

  // B · Buyer Demand
  "purchase-orders": "B",
  "demand-plan": "B",

  // C · Mandi Purchase
  trips: "C",
  "supplier-prices": "C",

  // D · Inward & Logistics
  receipts: "D",
  containers: "D",
  transport: "D",

  // E · QC
  "quality-check": "E",

  // F · Allocation & Packing
  packing: "F",
  catalogue: "F",

  // G · Sales & Delivery
  "sales-orders": "G",
  dispatch: "G",
  deliveries: "G",
  returns: "G",

  // H · Billing & Ledgers
  invoices: "H",
  "buyer-payments": "H",
  "supplier-payments": "H",
  "credit-notes": "H",
  "financial-ledgers": "H",
  attendance: "H",
  expenses: "H",

  // I · Inventory & Audit
  inventory: "I",
  "stock-movements": "I",
  "workflow-reports": "I",
  "flow-map": "I",
  "open-points": "I",
};

export function WorkflowStageBanner({ currentSlug }: { currentSlug: string }) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const stageLetter = MODULE_STAGE_MAP[currentSlug] || "A";
  const stage = STAGE_DEFINITIONS[stageLetter] || STAGE_DEFINITIONS.A;

  const stageList: StageDefinition[] = [
    STAGE_DEFINITIONS.A,
    STAGE_DEFINITIONS.B,
    STAGE_DEFINITIONS.C,
    STAGE_DEFINITIONS.D,
    STAGE_DEFINITIONS.E,
    STAGE_DEFINITIONS.F,
    STAGE_DEFINITIONS.G,
    STAGE_DEFINITIONS.H,
    STAGE_DEFINITIONS.I,
  ];

  return (
    <div className={cn("rounded-2xl border bg-gradient-to-r p-4 shadow-xs space-y-3", stage.accentBg, stage.accentBorder)}>
      {/* Top Banner Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-background/80 shadow-2xs border border-border/80">
            <stage.icon className="size-4.5 text-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide", stage.badgeBg, stage.badgeText)}>
                {stage.title} (Step {stage.stepNumber} of 9)
              </span>
              <span className="rounded bg-background/70 px-1.5 py-0.5 text-[10px] font-mono font-bold text-muted-foreground border">
                {stage.flows}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stage.description}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            className="inline-flex items-center gap-1 rounded-lg border bg-background/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Info className="size-3.5 text-muted-foreground" />
            <span>Process Links</span>
            {isDetailsOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          <Link
            to="/m/$module"
            params={{ module: stage.nextAction.targetSlug }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition-all"
          >
            <span>{stage.nextAction.label}</span>
          </Link>
        </div>
      </div>

      {/* 9-Step End-to-End Pipeline Navigation Rail */}
      <div className="overflow-x-auto pt-1">
        <div className="flex items-center min-w-[760px] gap-1 bg-background/60 p-1.5 rounded-xl border border-border/50 text-xs">
          {stageList.map((st, idx) => {
            const isCurrent = st.letter === stageLetter;
            const isPast = st.stepNumber < stage.stepNumber;
            const Icon = st.icon;

            return (
              <div key={st.letter} className="flex items-center flex-1">
                <Link
                  to="/m/$module"
                  params={{ module: st.defaultSlug }}
                  className={cn(
                    "flex flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all text-left",
                    isCurrent
                      ? "bg-primary text-primary-foreground font-bold shadow-xs scale-[1.02]"
                      : isPast
                      ? "text-foreground hover:bg-muted/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black",
                      isCurrent
                        ? "bg-primary-foreground text-primary"
                        : isPast
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isPast ? <CheckCircle2 className="size-3" /> : st.letter}
                  </span>
                  <div className="min-w-0 flex-1 truncate">
                    <p className="text-[11px] leading-tight font-semibold truncate">{st.shortName}</p>
                    <p className="text-[9px] opacity-75 truncate">Step {st.stepNumber}</p>
                  </div>
                </Link>

                {idx < stageList.length - 1 && (
                  <ChevronRight className="size-3 text-muted-foreground/40 shrink-0 mx-0.5" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable Process Links & Data Connections */}
      {isDetailsOpen && (
        <div className="rounded-xl border bg-card p-3.5 space-y-2.5 text-xs animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Workflow className="size-3.5 text-primary" /> Upstream & Downstream Process Handshake
            </span>
            <Link
              to="/m/$module"
              params={{ module: "flow-map" }}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>View Full Interactive Flow Map (F01–F28)</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="rounded-lg border p-2.5 bg-muted/20 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Upstream Input
              </p>
              <p className="font-semibold text-foreground">{stage.upstream}</p>
            </div>
            <div className="rounded-lg border p-2.5 bg-muted/20 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Downstream Output
              </p>
              <p className="font-semibold text-foreground">{stage.downstream}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
