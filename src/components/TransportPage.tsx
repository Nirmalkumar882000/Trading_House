import { useState, useMemo, useEffect } from "react";
import {
  Truck,
  ArrowRight,
  ArrowUpRight,
  RotateCcw,
  Plus,
  Search,
  Download,
  Eye,
  MessageCircle,
  FileText,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  Phone,
  Package,
  Boxes,
  Printer,
  Trash2,
  Pencil,
  X,
  Check,
  Building2,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import type { ModuleDef, Row } from "@/lib/modules";
import { PRODUCT_CATALOG } from "@/lib/modules";
import { useStore } from "@/lib/store";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import {
  lines,
  normalize,
  num,
  round,
  total,
  validateData,
  parseLines,
  parseBuys,
  type Data,
  type ProductLine,
} from "@/lib/workflow";
import { Link } from "@tanstack/react-router";

// Helper to determine party (Supplier or Buyer) from transport row and store data
export function getTransportParty(
  r: Row,
  data: Data
): { type: "supplier" | "buyer"; name: string; subtitle: string; refId: string } {
  const dir = String(r["direction"] || "Inward");
  const refId = String(r["ref"] || "");

  if (dir.includes("Inward")) {
    // Supplier side (Inward procurement or Inward return to vendor)
    if (r["supplier"]) {
      const sName = String(r["supplier"]);
      const supObj = (data["suppliers"] || []).find((s) => s["name"] === sName);
      return {
        type: "supplier",
        name: sName,
        subtitle: String(supObj?.["market"] || supObj?.["city"] || "Wholesale Market"),
        refId,
      };
    }
    const trip = (data["trips"] || []).find((t) => t.id === refId || t.id === r["dc"]);
    if (trip) {
      const buys = trip["buys"] ? parseBuys(trip["buys"]) : [];
      const sup =
        trip["supplier"] || (buys.length > 0 ? [...new Set(buys.map((b) => b.s).filter(Boolean))].join(", ") : "");
      if (sup) {
        const supObj = (data["suppliers"] || []).find((s) => s["name"] === sup);
        return {
          type: "supplier",
          name: sup,
          subtitle: String(supObj?.["market"] || supObj?.["city"] || "Wholesale Market"),
          refId,
        };
      }
    }
    return {
      type: "supplier",
      name: String(r["supplier"] || "Market Supplier"),
      subtitle: "Wholesale Market Supplier",
      refId,
    };
  } else {
    // Buyer side (Outward buyer delivery or Outward customer return)
    if (r["buyer"]) {
      const bName = String(r["buyer"]);
      const bObj = (data["buyers"] || []).find((b) => b["name"] === bName);
      return {
        type: "buyer",
        name: bName,
        subtitle: String(bObj?.["city"] || bObj?.["address"] || "Customer Bay"),
        refId,
      };
    }
    const sale = (data["sales-orders"] || []).find((s) => s.id === refId || s.id === r["so"]);
    if (sale?.["buyer"]) {
      const bName = String(sale["buyer"]);
      const bObj = (data["buyers"] || []).find((b) => b["name"] === bName);
      return {
        type: "buyer",
        name: bName,
        subtitle: String(bObj?.["city"] || bObj?.["address"] || "Customer Bay"),
        refId,
      };
    }
    const ret = (data["returns"] || []).find((x) => x.id === refId);
    if (ret?.["buyer"]) {
      const bName = String(ret["buyer"]);
      const bObj = (data["buyers"] || []).find((b) => b["name"] === bName);
      return {
        type: "buyer",
        name: bName,
        subtitle: String(bObj?.["city"] || bObj?.["address"] || "Customer Bay"),
        refId,
      };
    }
    return {
      type: "buyer",
      name: String(r["buyer"] || "Registered Buyer"),
      subtitle: "Commercial Buyer Account",
      refId,
    };
  }
}

// Helper to extract products from a transport row
export function getTransportProducts(r: Row, data: Data): ProductLine[] {
  if (r["item"]) {
    const ls = parseLines(r["item"]);
    if (ls.length > 0) return ls;
  }
  const refId = String(r["ref"] || "");
  const trip = (data["trips"] || []).find((t) => t.id === refId);
  if (trip) {
    if (trip["buys"]) {
      const buys = parseBuys(trip["buys"]);
      if (buys.length > 0) return buys.map((b) => ({ p: b.p, q: b.q, r: b.r }));
    }
    const tripLines = lines(trip);
    if (tripLines.length > 0) return tripLines;
  }
  const sale = (data["sales-orders"] || []).find((s) => s.id === refId);
  if (sale) {
    const sLines = lines(sale);
    if (sLines.length > 0) return sLines;
  }
  const ret = (data["returns"] || []).find((x) => x.id === refId);
  if (ret) {
    const rLines = lines(ret);
    if (rLines.length > 0) return rLines;
  }
  return [];
}

export function TransportPage({ mod }: { mod: ModuleDef }) {
  const { data, upsert, remove } = useStore();
  const rows = data["transport"] || [];
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string>("All");
  const isReturnView = directionFilter === "Inward Return";
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const [viewingChallanRow, setViewingChallanRow] = useState<Row | null>(null);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [isInwardReturnModalOpen, setIsInwardReturnModalOpen] = useState(false);
  const [isOutwardReturnModalOpen, setIsOutwardReturnModalOpen] = useState(false);
  const [showProcessGuide, setShowProcessGuide] = useState(true);
  const [processGuideTab, setProcessGuideTab] = useState<"inward" | "outward">("inward");

  // Direction counts
  const inwardCount = rows.filter((r) => r["direction"] === "Inward").length;
  const inwardReturnCount = rows.filter((r) => r["direction"] === "Inward Return").length;
  const outwardCount = rows.filter((r) => r["direction"] === "Outward").length;
  const outwardReturnCount = rows.filter((r) => r["direction"] === "Outward Return").length;

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Direction filter
      if (directionFilter !== "All" && r["direction"] !== directionFilter) return false;
      // Status filter
      if (statusFilter !== "All" && r.status !== statusFilter) return false;

      // Text search
      if (search.trim()) {
        const term = search.toLowerCase();
        const party = getTransportParty(r, data);
        const products = getTransportProducts(r, data);
        const prodMatch = products.some((p) => p.p.toLowerCase().includes(term));

        const matches =
          r.id.toLowerCase().includes(term) ||
          String(r["ref"] || "").toLowerCase().includes(term) ||
          String(r["transporter"] || "").toLowerCase().includes(term) ||
          String(r["vehicle"] || "").toLowerCase().includes(term) ||
          String(r["driver"] || "").toLowerCase().includes(term) ||
          party.name.toLowerCase().includes(term) ||
          String(r["direction"] || "").toLowerCase().includes(term) ||
          prodMatch;

        if (!matches) return false;
      }
      return true;
    });
  }, [rows, directionFilter, statusFilter, search, data]);

  // Advance status handler
  const advanceStatus = (r: Row) => {
    const statuses = mod.statuses;
    const currentIndex = statuses.indexOf(r.status);
    if (currentIndex < 0 || currentIndex >= statuses.length - 1) return;
    const nextStatus = statuses[currentIndex + 1];

    const updated = normalize("transport", { ...r, status: nextStatus });
    const err = validateData({
      ...data,
      transport: rows.map((x) => (x.id === updated.id ? updated : x)),
    });
    if (err) {
      toast.error(err);
      return;
    }
    upsert("transport", updated);
    toast.success(`Trip ${r.id} advanced to "${nextStatus}"`);
  };

  // WhatsApp gate pass sharing
  const sendWhatsAppGatePass = (r: Row) => {
    const party = getTransportParty(r, data);
    const prods = getTransportProducts(r, data);
    const dir = String(r["direction"] || "Inward");
    const isPickup = dir.includes("Inward");

    const prodLines = prods
      .map((l) => `  • ${l.p}: ${l.q} kg${l.r ? ` (@ ₹${l.r}/kg)` : ""}`)
      .join("\n");

    const msg =
      `*VELAAN BAY LOGISTICS — TRANSPORT GATE PASS (F04/F19)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Trip Movement ID:* ${r.id}\n` +
      `*Direction:* ${dir} (${isPickup ? "Supplier ➔ Bay Receiving" : "Bay Dispatch ➔ Buyer"})\n` +
      `*Date:* ${r["date"]}\n` +
      `*Status:* ${r.status}\n\n` +
      `*PARTY DETAILS:*\n` +
      `• *${isPickup ? "Supplier" : "Buyer"}:* ${party.name}\n` +
      `• *Location:* ${party.subtitle}\n` +
      `• *Ref Order / Trip:* ${r["ref"] || "—"}\n\n` +
      `*FLEET & DRIVER:*\n` +
      `• *Transporter:* ${r["transporter"] || "Private Fleet"}\n` +
      `• *Vehicle No:* ${r["vehicle"] || "TN 09 AB 1234"}\n` +
      `• *Driver Name:* ${r["driver"] || "Assigned Driver"}\n` +
      `• *Driver Phone:* ${r["driverPhone"] || "—"}\n\n` +
      `*MANIFEST & LOADED PRODUCE:*\n${prodLines || `  • Total Produce: ${r["qty"] || 0} kg`}\n\n` +
      `*Total Load:* ${r["qty"] || 0} kg\n` +
      `*Packaging:* ${r["containerCount"] || 0} ${r["containerType"] || "Crates"}\n` +
      `*Freight Charges:* ₹${Number(r["charges"] || 0).toLocaleString("en-IN")}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Official Vehicle Gate Pass verified by Velaan Bay Security & Dispatch._`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  // Export CSV
  const exportCsv = () => {
    const headers = [
      "Trip ID",
      "Date",
      "Direction",
      "Party Type",
      "Party Name",
      "Reference",
      "Transporter",
      "Vehicle",
      "Driver",
      "Driver Phone",
      "Loading KG",
      "Containers",
      "Charges (₹)",
      "Status",
    ];

    const csvRows = filteredRows.map((r) => {
      const party = getTransportParty(r, data);
      return [
        `"${r.id}"`,
        `"${r["date"] || ""}"`,
        `"${r["direction"] || ""}"`,
        `"${party.type}"`,
        `"${party.name}"`,
        `"${r["ref"] || ""}"`,
        `"${r["transporter"] || ""}"`,
        `"${r["vehicle"] || ""}"`,
        `"${r["driver"] || ""}"`,
        `"${r["driverPhone"] || ""}"`,
        r["qty"] || 0,
        `"${r["containerCount"] || 0} ${r["containerType"] || ""}"`,
        r["charges"] || 0,
        `"${r.status}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transport_movements_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const blankRow = (): Row => {
    return {
      id: `MOV-${1001 + rows.length}`,
      date: new Date().toISOString().slice(0, 10),
      direction: "Inward",
      ref: "",
      supplier: "",
      buyer: "",
      transporter: "Chennai Fresh Logistics",
      vehicle: "TN 09 AB 1234",
      driver: "Raja",
      driverPhone: "9840012345",
      qty: 0,
      item: "[]",
      containerType: "Plastic crates (~20-25 kg)",
      containerCount: 0,
      charges: 500,
      status: "Scheduled",
      responsible: "Ravi Kumar",
    };
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
              Stage D · Inward & Logistics (Stage 4/9)
            </span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {rows.length} Total Fleet Movements
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
            {mod.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Complete vehicle tracking for Inward procurement, Inward returns to suppliers, Outward buyer dispatches, and Outward returns with live weight, drivers, and freight fees.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProcessGuide(!showProcessGuide)}
            className="text-xs border-primary/30 text-primary hover:bg-primary/10"
          >
            <ShieldCheck className="size-3.5 mr-1" />
            {showProcessGuide ? "Hide Returns Guide" : "Returns Flow Guide"}
          </Button>
          <Button
            onClick={() => setIsInwardReturnModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-2 text-xs font-bold text-white shadow-xs"
          >
            <RotateCcw className="size-3.5" /> Plan Inward Return (To Vendor)
          </Button>
          <Button
            onClick={() => setIsOutwardReturnModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-3 py-2 text-xs font-bold text-white shadow-xs"
          >
            <RotateCcw className="size-3.5" /> Log Outward Return (From Buyer)
          </Button>
          <Button
            variant="outline"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Download className="size-3.5" /> Export Manifest
          </Button>
          <Button
            onClick={() => setEditingRow(blankRow())}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <Plus className="size-3.5" /> New Movement
          </Button>
        </div>
      </div>

      {/* Interactive Process Flow Guide Banner */}
      {showProcessGuide && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-card via-muted/30 to-background p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wide">
                Transport Architecture
              </span>
              <h3 className="text-sm font-bold text-foreground">
                Returns Logistics & Reverse Flow Guide
              </h3>
            </div>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setProcessGuideTab("inward")}
                className={cn(
                  "px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5",
                  processGuideTab === "inward"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <RotateCcw className="size-3" /> Inward Return (Bay ➔ Supplier)
              </button>
              <button
                type="button"
                onClick={() => setProcessGuideTab("outward")}
                className={cn(
                  "px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5",
                  processGuideTab === "outward"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <RotateCcw className="size-3" /> Outward Return (Buyer ➔ Bay)
              </button>
            </div>
          </div>

          {processGuideTab === "inward" ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                <strong className="text-amber-800 dark:text-amber-300">Inward Return Concept:</strong> Returning rejected produce (identified during Quality Check inspection) or returning empty supplier crates back to the Koyambedu wholesale market vendor.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    <span>Step 1 · QC Rejection</span>
                    <span className="size-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">1</span>
                  </div>
                  <p className="font-semibold text-foreground text-xs">Rejection at Bay</p>
                  <p className="text-[11px] text-muted-foreground">
                    Produce failing specs in Stage E QC is quarantined in Reject Isolation.
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    <span>Step 2 · Dispatch Truck</span>
                    <span className="size-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">2</span>
                  </div>
                  <p className="font-semibold text-foreground text-xs">Plan Return Trip</p>
                  <p className="text-[11px] text-muted-foreground">
                    Assign vehicle & driver. Generate official Return DC & Gate Pass (F09).
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    <span>Step 3 · Mandi Delivery</span>
                    <span className="size-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">3</span>
                  </div>
                  <p className="font-semibold text-foreground text-xs">Supplier Handover</p>
                  <p className="text-[11px] text-muted-foreground">
                    Driver hands over rejected produce/crates to vendor stall with gate pass.
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    <span>Step 4 · Financial Ledger</span>
                    <span className="size-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">4</span>
                  </div>
                  <p className="font-semibold text-foreground text-xs">Debit Note / Balance</p>
                  <p className="text-[11px] text-muted-foreground">
                    Vendor payable or container balance is deducted to prevent loss.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                <strong className="text-purple-800 dark:text-purple-300">Outward Return Concept:</strong> A buyer (e.g. Hotel Saravana Bhavan) returns goods from a dispatched order due to transit damage, spec mismatch, or excess quantity.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-700 dark:text-purple-400">
                    <span>Step 1 · Customer Return</span>
                    <span className="size-4 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px]">1</span>
                  </div>
                  <p className="font-semibold text-foreground text-xs">Return Request Logged</p>
                  <p className="text-[11px] text-muted-foreground">
                    Buyer inspects delivery, specifies returned items, KG, and reason.
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-700 dark:text-purple-400">
                    <span>Step 2 · Vehicle Pickup</span>
                    <span className="size-4 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px]">2</span>
                  </div>
                  <p className="font-semibold text-foreground text-xs">Outward Return Trip</p>
                  <p className="text-[11px] text-muted-foreground">
                    Truck collects returned produce from buyer with Gate Pass acknowledgment.
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-700 dark:text-purple-400">
                    <span>Step 3 · Quarantine at Bay</span>
                    <span className="size-4 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px]">3</span>
                  </div>
                  <p className="font-semibold text-foreground text-xs">QC Holding Bay</p>
                  <p className="text-[11px] text-muted-foreground">
                    Returned goods arrive at Bay Receiving and enter QC holding bay.
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-700 dark:text-purple-400">
                    <span>Step 4 · Credit Note & Regrade</span>
                    <span className="size-4 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px]">4</span>
                  </div>
                  <p className="font-semibold text-foreground text-xs">Credit Note Issued</p>
                  <p className="text-[11px] text-muted-foreground">
                    Buyer ledger receives Credit Note (CN), and Stage 2 QC re-grades salvageable produce.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Pipeline Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {mod.statuses.map((s) => {
          const count = rows.filter((r) => r.status === s).length;
          const isSelected = statusFilter === s;
          const statusColors: Record<string, { bg: string; text: string; border: string }> = {
            Scheduled: {
              bg: "bg-amber-500/10",
              text: "text-amber-800 dark:text-amber-300",
              border: "border-amber-500/30",
            },
            Loading: {
              bg: "bg-blue-500/10",
              text: "text-blue-800 dark:text-blue-300",
              border: "border-blue-500/30",
            },
            "In transit": {
              bg: "bg-purple-500/10",
              text: "text-purple-800 dark:text-purple-300",
              border: "border-purple-500/30",
            },
            Delivered: {
              bg: "bg-emerald-500/10",
              text: "text-emerald-800 dark:text-emerald-300",
              border: "border-emerald-500/30",
            },
          };
          const colors = statusColors[s] || {
            bg: "bg-card",
            text: "text-primary",
            border: "border-border",
          };

          return (
            <button
              type="button"
              key={s}
              onClick={() => setStatusFilter(isSelected ? "All" : s)}
              className={cn(
                "rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5",
                colors.bg,
                isSelected ? cn("ring-2 ring-primary shadow-xs", colors.border) : "border-border/70"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{s}</span>
                <span className={cn("size-2 rounded-full", s === "Delivered" ? "bg-emerald-500" : s === "In transit" ? "bg-purple-500 animate-pulse" : "bg-amber-500")} />
              </div>
              <p className={cn("mt-1.5 font-mono text-2xl font-bold", colors.text)}>
                {count}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {s === "Scheduled" && "Assigned vehicles"}
                {s === "Loading" && "At Bay / Market"}
                {s === "In transit" && "Vehicles on road"}
                {s === "Delivered" && "Completed arrivals"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card space-y-3">
        {/* Direction Filter Tabs & Search Controls */}
        <div className="p-3.5 border-b space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Direction Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDirectionFilter("All")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                  directionFilter === "All"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                All Movements ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter("Inward")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all inline-flex items-center gap-1.5",
                  directionFilter === "Inward"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20"
                )}
              >
                <Truck className="size-3.5" /> Inward ({inwardCount})
                <span className="text-[10px] opacity-80">Supplier ➔ Bay</span>
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter("Inward Return")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all inline-flex items-center gap-1.5",
                  directionFilter === "Inward Return"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
                )}
              >
                <RotateCcw className="size-3.5" /> Inward Return ({inwardReturnCount})
                <span className="text-[10px] opacity-80">Bay ➔ Supplier</span>
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter("Outward")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all inline-flex items-center gap-1.5",
                  directionFilter === "Outward"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-blue-500/10 text-blue-800 dark:text-blue-300 hover:bg-blue-500/20"
                )}
              >
                <ArrowUpRight className="size-3.5" /> Outward ({outwardCount})
                <span className="text-[10px] opacity-80">Bay ➔ Buyer</span>
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter("Outward Return")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all inline-flex items-center gap-1.5",
                  directionFilter === "Outward Return"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-purple-500/10 text-purple-800 dark:text-purple-300 hover:bg-purple-500/20"
                )}
              >
                <RotateCcw className="size-3.5" /> Outward Return ({outwardReturnCount})
                <span className="text-[10px] opacity-80">Buyer ➔ Bay</span>
              </button>
            </div>

            {/* Status pills in filter bar */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              {["All", ...mod.statuses].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                    statusFilter === s
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Movement ID, Supplier, Buyer, Vehicle Number, Driver, or Product..."
              className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* The Transport Movements Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
              <tr>
                <th className="px-3.5 py-3 font-semibold">ID & Date</th>
                <th className="px-3.5 py-3 font-semibold">Flow / Direction</th>
                <th className="px-3.5 py-3 font-semibold">{isReturnView ? "Supplier" : "Supplier / Buyer Party"}</th>
                {!isReturnView && <th className="px-3.5 py-3 font-semibold">Ref Document</th>}
                <th className="px-3.5 py-3 font-semibold">{isReturnView ? "Container Type & Count" : "Products Loaded"}</th>
                {!isReturnView && <th className="px-3.5 py-3 font-semibold">Fleet & Driver</th>}
                {!isReturnView && <th className="px-3.5 py-3 text-right font-semibold">Loading KG</th>}
                {!isReturnView && <th className="px-3.5 py-3 text-right font-semibold">Freight (₹)</th>}
                <th className="px-3.5 py-3 font-semibold">Trip Status</th>
                <th className="px-3.5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredRows.map((r) => {
                const party = getTransportParty(r, data);
                const products = getTransportProducts(r, data);
                const dir = String(r["direction"] || "Inward");
                const isPickup = dir.includes("Inward");
                const nextStatusIndex = mod.statuses.indexOf(r.status);
                const nextStatus = nextStatusIndex >= 0 && nextStatusIndex < mod.statuses.length - 1 ? mod.statuses[nextStatusIndex + 1] : null;

                return (
                  <tr
                    key={r.id}
                    onClick={() => setViewingChallanRow(r)}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    {/* ID & Date */}
                    <td className="px-3.5 py-3 font-mono">
                      <div className="font-bold text-primary">{r.id}</div>
                      <div className="text-[11px] text-muted-foreground">{r["date"]}</div>
                    </td>

                    {/* Direction with visual route */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {dir === "Inward" && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <Truck className="size-3.5 text-emerald-600" /> Inward
                          <span className="text-[10px] font-normal text-muted-foreground">Supplier ➔ Bay</span>
                        </span>
                      )}
                      {dir === "Inward Return" && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                          <RotateCcw className="size-3.5 text-amber-600" /> Inward Return
                          <span className="text-[10px] font-normal text-muted-foreground">Bay ➔ Supplier</span>
                        </span>
                      )}
                      {dir === "Outward" && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-xs font-bold text-blue-800 dark:text-blue-300">
                          <ArrowUpRight className="size-3.5 text-blue-600" /> Outward
                          <span className="text-[10px] font-normal text-muted-foreground">Bay ➔ Buyer</span>
                        </span>
                      )}
                      {dir === "Outward Return" && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-xs font-bold text-purple-800 dark:text-purple-300">
                          <RotateCcw className="size-3.5 text-purple-600" /> Outward Return
                          <span className="text-[10px] font-normal text-muted-foreground">Buyer ➔ Bay</span>
                        </span>
                      )}
                    </td>

                    {/* Supplier / Buyer Party */}
                    <td className="px-3.5 py-3">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        {isPickup ? (
                          <Building2 className="size-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <User className="size-3.5 text-blue-600 shrink-0" />
                        )}
                        <span className="truncate max-w-[180px]">{party.name}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {party.subtitle}
                      </div>
                    </td>

                    {/* Reference Document */}
                    {!isReturnView && (
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {r["ref"] ? (
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground border">
                          {r["ref"]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    )}

                    {/* Products Loaded */}
                    <td className="px-3.5 py-3 max-w-[220px]">
                      {isReturnView ? (
                        <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          {String(r["containerType"] || "—")} · {Number(r["containerCount"]) || 0}
                        </span>
                      ) : products.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {products.slice(0, 2).map((l, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
                            >
                              {l.p}: {l.q} kg
                            </span>
                          ))}
                          {products.length > 2 && (
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                              +{products.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">General Produce</span>
                      )}
                    </td>

                    {/* Transporter & Driver */}
                    {!isReturnView && (
                    <td className="px-3.5 py-3">
                      <div className="font-medium text-foreground text-xs flex items-center gap-1.5">
                        <Truck className="size-3 text-muted-foreground" />
                        <span>{r["transporter"] || "Private Fleet"}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] font-bold text-foreground bg-muted px-1 rounded">
                          {r["vehicle"] || "TN 09 AB 1234"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {r["driver"] || "Raja"}
                        </span>
                      </div>
                    </td>
                    )}

                    {/* Loading KG */}
                    {!isReturnView && (
                    <td className="px-3.5 py-3 text-right tabular-nums whitespace-nowrap">
                      <div className="font-mono font-bold text-foreground text-sm">
                        {Number(r["qty"] || 0).toLocaleString("en-IN")} kg
                      </div>
                      {r["containerCount"] ? (
                        <div className="text-[10px] text-muted-foreground">
                          {r["containerCount"]} crates
                        </div>
                      ) : null}
                    </td>
                    )}

                    {/* Transport Charges */}
                    {!isReturnView && (
                    <td className="px-3.5 py-3 text-right tabular-nums font-mono font-semibold text-foreground whitespace-nowrap">
                      ₹{Number(r["charges"] || 0).toLocaleString("en-IN")}
                    </td>
                    )}

                    {/* Trip Status & Step progression */}
                    <td className="px-3.5 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <StatusBadge status={r.status} statuses={mod.statuses} />
                        {nextStatus && (
                          <div>
                            <button
                              type="button"
                              onClick={() => advanceStatus(r)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline hover:text-primary/80"
                            >
                              <span>Next: {nextStatus}</span>
                              <ArrowRight className="size-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Row Actions */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Gate Pass & Delivery Challan (F04/F19)"
                          onClick={() => setViewingChallanRow(r)}
                          className="size-8 p-0 text-primary hover:bg-primary/10"
                        >
                          <Eye className="size-4" />
                        </Button>
                        {!isReturnView && (<>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Share Gate Pass with Driver / Gate Security on WhatsApp"
                          onClick={() => sendWhatsAppGatePass(r)}
                          className="size-8 p-0 text-emerald-600 hover:bg-emerald-500/10"
                        >
                          <MessageCircle className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Edit transport record"
                          onClick={() => setEditingRow(r)}
                          className="size-8 p-0 text-muted-foreground hover:bg-muted"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete transport movement"
                          onClick={() => {
                            if (confirm(`Delete movement ${r.id}?`)) {
                              remove("transport", r.id);
                              toast.success(`${r.id} deleted`);
                            }
                          }}
                          className="size-8 p-0 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filteredRows.length && (
                <tr>
                  <td colSpan={isReturnView ? 6 : 10} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Truck className="size-10 text-muted-foreground/50 mb-2" />
                      <p className="text-base font-semibold text-foreground">No Transport Movements Found</p>
                      <p className="text-xs text-muted-foreground max-w-sm mt-1">
                        {search
                          ? `No records match "${search}". Try clearing search filters.`
                          : "No transport records created yet. Plan a trip from Demand Consolidation or create a new movement below."}
                      </p>
                      <Button
                        onClick={() => setEditingRow(blankRow())}
                        className="mt-4 text-xs font-semibold bg-primary text-primary-foreground"
                      >
                        <Plus className="size-3.5 mr-1.5" /> Create Transport Movement
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="flex flex-wrap items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground bg-muted/20">
          <div>
            Showing <strong className="text-foreground">{filteredRows.length}</strong> of {rows.length} transport movements
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Inward: Market Supplier ➔ Bay</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500" />
              <span>Outward: Bay ➔ Buyer</span>
            </span>
          </div>
        </div>
      </div>

      {/* MODAL 1: VIEW TRANSPORT DELIVERY CHALLAN & GATE PASS */}
      {viewingChallanRow && (
        <TransportGatePassModal
          row={viewingChallanRow}
          data={data}
          onClose={() => setViewingChallanRow(null)}
          onAdvance={() => {
            advanceStatus(viewingChallanRow);
            const statuses = mod.statuses;
            const currentIndex = statuses.indexOf(viewingChallanRow.status);
            if (currentIndex < statuses.length - 1) {
              setViewingChallanRow({
                ...viewingChallanRow,
                status: statuses[currentIndex + 1],
              });
            }
          }}
          onShareWhatsApp={() => sendWhatsAppGatePass(viewingChallanRow)}
        />
      )}

      {/* MODAL 2: CREATE / EDIT TRANSPORT MOVEMENT */}
      {editingRow && (
        <TransportEditModal
          row={editingRow}
          data={data}
          onClose={() => setEditingRow(null)}
          onSave={(updated) => {
            const full = normalize("transport", updated);
            const err = validateData({
              ...data,
              transport: rows.some((x) => x.id === full.id)
                ? rows.map((x) => (x.id === full.id ? full : x))
                : [...rows, full],
            });
            if (err) {
              toast.error(err);
              return;
            }
            upsert("transport", full);
            setEditingRow(null);
            toast.success(`${full.id} saved successfully!`);
          }}
        />
      )}

      {/* MODAL 3: INWARD RETURN TO SUPPLIER */}
      {isInwardReturnModalOpen && (
        <InwardReturnModal
          data={data}
          rows={rows}
          onClose={() => setIsInwardReturnModalOpen(false)}
          onSave={(returnMovement) => {
            const full = normalize("transport", returnMovement);
            const err = validateData({
              ...data,
              transport: [...rows, full],
            });
            if (err) {
              toast.error(err);
              return;
            }
            upsert("transport", full);
            setIsInwardReturnModalOpen(false);
            setViewingChallanRow(full);
            toast.success(`Inward Return ${full.id} scheduled to ${full["supplier"]}! Vehicle ${full["vehicle"]} dispatched.`);
          }}
        />
      )}

      {/* MODAL 4: OUTWARD RETURN FROM BUYER */}
      {isOutwardReturnModalOpen && (
        <OutwardReturnModal
          data={data}
          rows={rows}
          onClose={() => setIsOutwardReturnModalOpen(false)}
          onSave={(returnRecord, transportRecord) => {
            const fullReturn = normalize("returns", returnRecord);
            const fullTransport = normalize("transport", transportRecord);
            const err = validateData({
              ...data,
              returns: [...(data["returns"] || []), fullReturn],
              transport: [...rows, fullTransport],
            });
            if (err) {
              toast.error(err);
              return;
            }
            upsert("returns", fullReturn);
            upsert("transport", fullTransport);
            setIsOutwardReturnModalOpen(false);
            setViewingChallanRow(fullTransport);
            toast.success(`Customer Return ${fullReturn.id} logged and Outward Return ${fullTransport.id} assigned!`);
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// TRANSPORT GATE PASS & DELIVERY CHALLAN MODAL (F04 / F19)
// -------------------------------------------------------------
function TransportGatePassModal({
  row,
  data,
  onClose,
  onAdvance,
  onShareWhatsApp,
}: {
  row: Row;
  data: Data;
  onClose: () => void;
  onAdvance: () => void;
  onShareWhatsApp: () => void;
}) {
  const party = getTransportParty(row, data);
  const products = getTransportProducts(row, data);
  const dir = String(row["direction"] || "Inward");
  const isPickup = dir.includes("Inward");
  const nextStatusIndex = ["Scheduled", "Loading", "In transit", "Delivered"].indexOf(row.status);
  const nextStatus = nextStatusIndex >= 0 && nextStatusIndex < 3 ? ["Scheduled", "Loading", "In transit", "Delivered"][nextStatusIndex + 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-card border shadow-2xl overflow-hidden my-6">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground">
                  Transport Delivery Challan & Gate Pass
                </h3>
                <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                  {row.id}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Official physical gate pass & vehicle dispatch voucher (F04/F19)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Printable Physical Slip Body */}
        <div className="p-6 space-y-6">
          {/* Company & Document Header */}
          <div className="rounded-xl border p-4 bg-muted/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h2 className="text-base font-extrabold tracking-wide text-foreground uppercase">
                  Velaan Bay Trading House
                </h2>
                <p className="text-xs text-muted-foreground">
                  Wholesale Agri Logistics & Cold-Chain Fleet Gateway · Koyambedu Terminal
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-md bg-foreground px-2 py-0.5 font-mono text-xs font-bold text-background uppercase">
                  {dir} GATE PASS
                </span>
                <p className="text-xs text-muted-foreground mt-1 font-mono">Date: {row["date"]}</p>
              </div>
            </div>

            {/* Route Stepper Diagram */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-card border text-xs">
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isPickup ? "Origin / Pickup Point" : "Origin / Dispatch Bay"}
                </p>
                <p className="font-bold text-foreground">
                  {isPickup ? party.name : "Velaan Bay Central Warehouse"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isPickup ? party.subtitle : "Koyambedu Gate #4, Chennai"}
                </p>
              </div>

              <div className="flex flex-col items-center px-4">
                <span className="text-[10px] font-bold uppercase text-primary tracking-wide">
                  {row["vehicle"] || "TN 09 AB 1234"}
                </span>
                <div className="flex items-center gap-1 my-1">
                  <div className="h-0.5 w-12 bg-primary/40" />
                  <Truck className="size-4 text-primary" />
                  <div className="h-0.5 w-12 bg-primary/40" />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {row["transporter"] || "Transport Fleet"}
                </span>
              </div>

              <div className="space-y-0.5 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isPickup ? "Destination Bay" : "Buyer Delivery Bay"}
                </p>
                <p className="font-bold text-foreground">
                  {isPickup ? "Velaan Bay Receiving Bay" : party.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isPickup ? "Cold Chain Bay #2" : party.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Logistics & Driver Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Party Information */}
            <div className="rounded-xl border p-4 bg-card space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5 text-primary" /> {isPickup ? "Supplier / Trader Details" : "Buyer / Client Details"}
              </h4>
              <div className="space-y-1 text-xs">
                <p className="font-bold text-sm text-foreground">{party.name}</p>
                <p className="text-muted-foreground">{party.subtitle}</p>
                <div className="pt-2 flex items-center justify-between border-t text-[11px]">
                  <span className="text-muted-foreground">Ref Order:</span>
                  <span className="font-mono font-bold text-foreground">{row["ref"] || "—"}</span>
                </div>
              </div>
            </div>

            {/* Vehicle & Driver Information */}
            <div className="rounded-xl border p-4 bg-card space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Truck className="size-3.5 text-primary" /> Transporter & Fleet Driver
              </h4>
              <div className="space-y-1 text-xs">
                <p className="font-bold text-sm text-foreground">{row["transporter"] || "Chennai Fresh Logistics"}</p>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Vehicle Number:</span>
                  <span className="font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">
                    {row["vehicle"] || "TN 09 AB 1234"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Driver Name:</span>
                  <span className="font-medium text-foreground">{row["driver"] || "Raja"}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Driver Phone:</span>
                  <span className="font-mono text-primary font-semibold">{row["driverPhone"] || "9840012345"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Items Table */}
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/60 px-4 py-2.5 border-b flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Manifest of Produce Loaded ({products.length} Items)
              </h4>
              <span className="text-xs font-semibold text-muted-foreground">
                Packaging: {row["containerCount"] || 0} {row["containerType"] || "Plastic crates"}
              </span>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-left text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-2 font-semibold">#</th>
                  <th className="px-4 py-2 font-semibold">Product Name</th>
                  <th className="px-4 py-2 text-right font-semibold">Net Weight (KG)</th>
                  {/* <th className="px-4 py-2 text-right font-semibold">Rate (₹/kg)</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount (₹)</th> */}
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p, idx) => (
                  <tr key={idx} className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                    <td className="px-4 py-2 font-bold text-foreground">{p.p}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold tabular-nums text-foreground">
                      {p.q} kg
                    </td>
                    {/* <td className="px-4 py-2 text-right font-mono tabular-nums text-muted-foreground">
                      {p.r ? `₹${p.r}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground font-bold">
                      {p.r ? `₹${Math.round(p.q * p.r).toLocaleString("en-IN")}` : "—"}
                    </td> */}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-bold border-t">
                <tr>
                  <td colSpan={2} className="px-4 py-2.5 text-foreground">
                    Total Sourced / Loaded Produce
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-primary text-sm tabular-nums">
                    {Number(row["qty"] || total(products)).toLocaleString("en-IN")} kg
                  </td>
                  {/* <td className="px-4 py-2.5 text-right text-muted-foreground">Freight:</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground text-sm tabular-nums">
                    ₹{Number(row["charges"] || 0).toLocaleString("en-IN")}
                  </td> */}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Verification & Signatures Bar */}
          <div className="grid grid-cols-3 gap-3 border-t pt-4 text-center text-xs">
            <div className="rounded-lg border p-3 space-y-4 bg-muted/10">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Driver Signature
              </span>
              <p className="font-mono text-xs font-semibold text-foreground">
                {row["driver"] || "Raja"}
              </p>
            </div>
            <div className="rounded-lg border p-3 space-y-4 bg-muted/10">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Security Gate Out
              </span>
              <div className="flex items-center justify-center gap-1 text-emerald-600 font-bold text-xs">
                <ShieldCheck className="size-3.5" /> Checked & Cleared
              </div>
            </div>
            <div className="rounded-lg border p-3 space-y-4 bg-muted/10">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Warehouse Receiver
              </span>
              <p className="font-mono text-xs font-semibold text-foreground">
                {String(row["responsible"] || "Ravi Kumar")}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between border-t px-6 py-4 bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            onClick={onShareWhatsApp}
            className="text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <Share2 className="size-3.5 mr-1.5" /> Share WhatsApp Gate Pass
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs"
            >
              <Printer className="size-3.5 mr-1.5" /> Print Gate Pass
            </Button>
            {nextStatus && (
              <Button
                size="sm"
                onClick={onAdvance}
                className="bg-primary text-primary-foreground text-xs font-semibold"
              >
                Advance to "{nextStatus}" <ChevronRight className="size-3.5 ml-1" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CREATE / EDIT TRANSPORT MOVEMENT MODAL
// -------------------------------------------------------------
function TransportEditModal({
  row,
  data,
  onClose,
  onSave,
}: {
  row: Row;
  data: Data;
  onClose: () => void;
  onSave: (r: Row) => void;
}) {
  const [form, setForm] = useState<Row>({ ...row });

  const isNew = !data["transport"]?.some((x) => x.id === row.id);
  const suppliers = (data["suppliers"] || []).map((s) => String(s["name"]));
  const buyers = (data["buyers"] || []).map((b) => String(b["name"]));
  const transporters = (data["transporters"] || []).map((t) => String(t["name"]));

  // Selectable reference options based on direction
  const referenceOptions = useMemo(() => {
    const dir = form["direction"];
    if (dir === "Inward" || dir === "Inward Return") {
      return (data["trips"] || []).map((t) => ({
        id: t.id,
        label: `${t.id} · ${t["supplier"] || "Market Trip"} (${t["net"] || 0} kg)`,
        record: t,
      }));
    }
    if (dir === "Outward") {
      return (data["sales-orders"] || []).map((s) => ({
        id: s.id,
        label: `${s.id} · ${s["buyer"] || "Buyer Order"} (${s["qty"] || 0} kg)`,
        record: s,
      }));
    }
    if (dir === "Outward Return") {
      return (data["returns"] || []).map((r) => ({
        id: r.id,
        label: `${r.id} · ${r["buyer"] || "Customer Return"}`,
        record: r,
      }));
    }
    return [];
  }, [form["direction"], data]);

  // Handle reference selection to auto-populate details
  const handleSelectRef = (refId: string) => {
    const option = referenceOptions.find((o) => o.id === refId);
    if (!option) {
      setForm((prev) => ({ ...prev, ref: refId }));
      return;
    }
    const rec = option.record;
    const buys = rec["buys"] ? parseBuys(rec["buys"]) : [];
    const sup =
      rec["supplier"] || (buys.length > 0 ? [...new Set(buys.map((b) => b.s).filter(Boolean))].join(", ") : "");
    const prods =
      rec["item"] ||
      (buys.length > 0 ? JSON.stringify(buys.map((b) => ({ p: b.p, q: b.q, r: b.r }))) : "[]");

    setForm((prev) => ({
      ...prev,
      ref: refId,
      supplier: sup || prev["supplier"] || "",
      buyer: rec["buyer"] || prev["buyer"] || "",
      item: prods,
      qty: Number(rec["qty"]) || Number(rec["net"]) || total(parseLines(prods)) || prev["qty"],
      transporter: rec["transporter"] || prev["transporter"] || "Chennai Fresh Logistics",
      vehicle: rec["vehicle"] || prev["vehicle"] || "TN 09 AB 1234",
      driver: rec["driver"] || prev["driver"] || "Raja",
      driverPhone: rec["driverPhone"] || prev["driverPhone"] || "9840012345",
      containerType: rec["containerType"] || prev["containerType"] || "Plastic crates (~20-25 kg)",
      containerCount: Number(rec["containerCount"]) || prev["containerCount"] || 0,
      charges: Number(rec["charges"]) || prev["charges"] || 500,
    }));
  };

  // Handle transporter selection to auto-populate vehicle & driver
  const handleSelectTransporter = (tName: string) => {
    const tObj = (data["transporters"] || []).find((t) => t["name"] === tName);
    setForm((prev) => ({
      ...prev,
      transporter: tName,
      vehicle: String(tObj?.["vehicle"] || prev["vehicle"] || ""),
      driver: String(tObj?.["driver"] || prev["driver"] || ""),
      driverPhone: String(tObj?.["phone"] || prev["driverPhone"] || ""),
    }));
  };

  const parsedItems = parseLines(form["item"]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-card border shadow-2xl overflow-hidden my-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">
                {isNew ? "New Transport Movement" : `Edit Transport Movement · ${form.id}`}
              </h3>
              <p className="text-xs text-muted-foreground">
                Schedule logistics, assign vehicle, driver, and manifest details
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Movement Direction Selector */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1.5">
              Direction / Transport Route *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "Inward", label: "Inward (Procurement)", sub: "Supplier ➔ Bay" },
                { key: "Inward Return", label: "Inward Return", sub: "Bay ➔ Supplier" },
                { key: "Outward", label: "Outward (Delivery)", sub: "Bay ➔ Buyer" },
                { key: "Outward Return", label: "Outward Return", sub: "Buyer ➔ Bay" },
              ].map((d) => (
                <button
                  type="button"
                  key={d.key}
                  onClick={() => setForm((prev) => ({ ...prev, direction: d.key, ref: "" }))}
                  className={cn(
                    "rounded-xl border p-2.5 text-left transition-all",
                    form["direction"] === d.key
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                      : "border-border hover:bg-muted text-muted-foreground"
                  )}
                >
                  <p className="text-xs font-bold">{d.label}</p>
                  <p className="text-[10px] opacity-80 mt-0.5">{d.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Reference & Party Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Order / Trip Reference
              </label>
              <select
                value={String(form["ref"] || "")}
                onChange={(e) => handleSelectRef(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select Reference Document</option>
                {referenceOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {String(form["direction"]).includes("Inward") ? "Supplier / Trader" : "Buyer / Client"} *
              </label>
              {String(form["direction"]).includes("Inward") ? (
                <select
                  value={String(form["supplier"] || "")}
                  onChange={(e) => setForm((prev) => ({ ...prev, supplier: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={String(form["buyer"] || "")}
                  onChange={(e) => setForm((prev) => ({ ...prev, buyer: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select Buyer</option>
                  {buyers.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Transporter & Fleet Selection */}
          <div className="rounded-xl border p-3.5 bg-muted/20 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Truck className="size-3.5 text-primary" /> Vehicle & Driver Allocation
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Transporter Company
                </label>
                <select
                  value={String(form["transporter"] || "")}
                  onChange={(e) => handleSelectTransporter(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select Transporter</option>
                  {transporters.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Vehicle Number *
                </label>
                <input
                  type="text"
                  value={String(form["vehicle"] || "")}
                  onChange={(e) => setForm((prev) => ({ ...prev, vehicle: e.target.value }))}
                  placeholder="e.g. TN 09 AB 1234"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Driver Name *
                </label>
                <input
                  type="text"
                  value={String(form["driver"] || "")}
                  onChange={(e) => setForm((prev) => ({ ...prev, driver: e.target.value }))}
                  placeholder="e.g. Raja"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Driver Phone Number
                </label>
                <input
                  type="text"
                  value={String(form["driverPhone"] || "")}
                  onChange={(e) => setForm((prev) => ({ ...prev, driverPhone: e.target.value }))}
                  placeholder="e.g. 9840012345"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Weight, Packaging & Charges */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Loading KG *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form["qty"] ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, qty: Number(e.target.value) }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono font-bold text-right outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Number of Crates
              </label>
              <input
                type="number"
                min="0"
                value={form["containerCount"] ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, containerCount: Number(e.target.value) }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono text-right outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Transport Charges (₹)
              </label>
              <input
                type="number"
                min="0"
                value={form["charges"] ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, charges: Number(e.target.value) }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono font-bold text-right outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Trip Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Trip Status
              </label>
              <select
                value={String(form["status"] || "Scheduled")}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20"
              >
                {["Scheduled", "Loading", "In transit", "Delivered"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Movement Date
              </label>
              <input
                type="date"
                value={String(form["date"] || "")}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4 bg-muted/30">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!form["vehicle"]) {
                toast.error("Please enter a vehicle number");
                return;
              }
              onSave(form);
            }}
            className="bg-primary text-primary-foreground text-xs font-semibold"
          >
            <Check className="size-3.5 mr-1" /> Save Movement
          </Button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MODAL 3: INWARD RETURN TO SUPPLIER (BAY ➔ SUPPLIER)
// -------------------------------------------------------------
function InwardReturnModal({
  data,
  rows,
  onClose,
  onSave,
}: {
  data: Data;
  rows: Row[];
  onClose: () => void;
  onSave: (returnMovement: Row) => void;
}) {
  const { nextId } = useStore();
  const suppliers = (data["suppliers"] || []).map((s) => String(s["name"]));
  const trips = data["trips"] || [];
  const transporters = data["transporters"] || [];

  const [selectedSupplier, setSelectedSupplier] = useState<string>(
    suppliers[0] || (trips[0]?.["supplier"] ? String(trips[0]["supplier"]) : "Murugan Traders")
  );

  // Trips from this supplier or all trips
  const supplierTrips = useMemo(() => {
    return trips.filter((t) => !selectedSupplier || t["supplier"] === selectedSupplier);
  }, [trips, selectedSupplier]);

  const [selectedTripId, setSelectedTripId] = useState<string>(
    supplierTrips[0]?.id || trips[0]?.id || ""
  );

  const [returnItems, setReturnItems] = useState<{ p: string; q: number; r: number; reason: string }[]>([
    { p: "Tomato", q: 20, r: 42, reason: "QC Rejection: Rotting & Pest" },
  ]);

  const [containerCount, setContainerCount] = useState<number>(10);
  const [containerType, setContainerType] = useState<string>("Plastic crates (~20-25 kg)");

  const [selectedTransporter, setSelectedTransporter] = useState<string>(
    transporters[0]?.["name"] ? String(transporters[0]["name"]) : "Chennai Fresh Logistics"
  );
  const [vehicle, setVehicle] = useState<string>(
    transporters[0]?.["vehicle"] ? String(transporters[0]["vehicle"]) : "TN 09 AB 1234"
  );
  const [driver, setDriver] = useState<string>(
    transporters[0]?.["driver"] ? String(transporters[0]["driver"]) : "Raja"
  );
  const [driverPhone, setDriverPhone] = useState<string>(
    transporters[0]?.["phone"] ? String(transporters[0]["phone"]) : "9840012345"
  );
  const [charges, setCharges] = useState<number>(350);

  // Auto-populate when selecting trip
  const handleSelectTrip = (tripId: string) => {
    setSelectedTripId(tripId);
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return;

    if (trip["supplier"]) {
      setSelectedSupplier(String(trip["supplier"]));
    }

    // Populate items from trip buys or items
    const buys = trip["buys"] ? parseBuys(trip["buys"]) : [];
    if (buys.length > 0) {
      setReturnItems(
        buys.map((b) => ({
          p: b.p,
          q: Math.min(b.q, 15), // Default sample return quantity
          r: b.r || 40,
          reason: "QC Rejection: Rotting / Bruised",
        }))
      );
    } else {
      const pLines = parseLines(trip["item"]);
      if (pLines.length > 0) {
        setReturnItems(
          pLines.map((l) => ({
            p: l.p,
            q: Math.min(l.q, 15),
            r: l.r || 40,
            reason: "QC Rejection: Bruised in transit",
          }))
        );
      }
    }

    if (trip["transporter"]) setSelectedTransporter(String(trip["transporter"]));
    if (trip["vehicle"]) setVehicle(String(trip["vehicle"]));
    if (trip["driver"]) setDriver(String(trip["driver"]));
    if (trip["driverPhone"]) setDriverPhone(String(trip["driverPhone"]));
  };

  const handleSelectTransporter = (tName: string) => {
    const tObj = transporters.find((t) => t["name"] === tName);
    setSelectedTransporter(tName);
    if (tObj) {
      setVehicle(String(tObj["vehicle"] || vehicle));
      setDriver(String(tObj["driver"] || driver));
      setDriverPhone(String(tObj["phone"] || driverPhone));
    }
  };

  const handleAddItem = () => {
    setReturnItems((prev) => [
      ...prev,
      { p: PRODUCT_CATALOG[0]?.name || "Onion", q: 10, r: 35, reason: "Grade mismatch" },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setReturnItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalKg = returnItems.reduce((acc, it) => acc + (Number(it.q) || 0), 0);
  const totalVal = returnItems.reduce((acc, it) => acc + (Number(it.q) || 0) * (Number(it.r) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-card border shadow-2xl overflow-hidden my-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-amber-500/10">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground">Plan Inward Return</h3>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                  Bay Receiving ➔ Market Supplier
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Return rejected produce failing Stage E specs or return empty crates to Koyambedu vendor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Flow Stepper Explainer Banner */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            <div className="flex items-center justify-between font-bold text-amber-800 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <RotateCcw className="size-3.5 text-amber-600" /> Reverse Supply Chain Protocol
              </span>
              <span className="text-[10px] font-mono">Gate Pass (F09) · Debit Note</span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              This movement creates an official Return Gate Pass and assigns a transport vehicle to dispatch rejected goods back to the Koyambedu wholesale stall. Vendor payables will be adjusted accordingly.
            </p>
          </div>

          {/* Supplier & Source Trip Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Wholesale Supplier / Vendor *
              </label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              >
                {suppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">
                Source Market Trip Reference (Optional)
              </label>
              <select
                value={selectedTripId}
                onChange={(e) => handleSelectTrip(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">No Trip Reference (Direct Vendor Return)</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t["supplier"] || "Market Trip"} ({t["net"] || 0} kg)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Return Items Manifest */}
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/60 px-4 py-2 border-b flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-muted-foreground text-[11px]">
                Produce / Items Being Returned to Supplier
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddItem}
                className="h-6 text-[11px] text-primary hover:bg-primary/10 px-2"
              >
                <Plus className="size-3 mr-1" /> Add Product
              </Button>
            </div>

            <div className="divide-y p-2 space-y-2">
              {returnItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                  <div className="col-span-3">
                    <label className="block text-[10px] text-muted-foreground">Product</label>
                    <select
                      value={item.p}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReturnItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, p: val } : it))
                        );
                      }}
                      className="w-full rounded border bg-background px-2 py-1.5 text-xs"
                    >
                      {PRODUCT_CATALOG.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] text-muted-foreground">Return KG</label>
                    <input
                      type="number"
                      min="0.5"
                      step="any"
                      value={item.q}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setReturnItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, q: val } : it))
                        );
                      }}
                      className="w-full rounded border bg-background px-2 py-1.5 text-xs text-right font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] text-muted-foreground">Rate (₹/kg)</label>
                    <input
                      type="number"
                      min="0"
                      value={item.r}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setReturnItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, r: val } : it))
                        );
                      }}
                      className="w-full rounded border bg-background px-2 py-1.5 text-xs text-right font-mono"
                    />
                  </div>

                  <div className="col-span-4">
                    <label className="block text-[10px] text-muted-foreground">Rejection Reason</label>
                    <select
                      value={item.reason}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReturnItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, reason: val } : it))
                        );
                      }}
                      className="w-full rounded border bg-background px-2 py-1.5 text-xs"
                    >
                      <option value="QC Rejection: Rotting & Pest">QC Rejection: Rotting & Pest</option>
                      <option value="QC Rejection: Bruised / Soft">QC Rejection: Bruised / Soft</option>
                      <option value="Size & Grading Mismatch">Size & Grading Mismatch</option>
                      <option value="Excess Sourced Produce">Excess Sourced Produce</option>
                      <option value="Empty Crates Return">Empty Crates Return</option>
                    </select>
                  </div>

                  <div className="col-span-1 text-right pt-4">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={returnItems.length <= 1}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-muted/40 px-4 py-2 border-t flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Total Return Weight:</span>
              <div className="flex items-center gap-4">
                <span className="font-mono text-primary font-bold">{totalKg} kg</span>
                <span className="text-muted-foreground">Est. Value:</span>
                <span className="font-mono font-bold text-foreground">
                  ₹{Math.round(totalVal).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Containers & Packaging Return */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Empty Crates / Bins Being Returned
              </label>
              <input
                type="number"
                min="0"
                value={containerCount}
                onChange={(e) => setContainerCount(Number(e.target.value) || 0)}
                placeholder="e.g. 10"
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono font-bold text-right outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">Container Type</label>
              <input
                type="text"
                value={containerType}
                onChange={(e) => setContainerType(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Vehicle & Driver Allocation */}
          <div className="rounded-xl border p-3.5 bg-muted/20 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Truck className="size-3.5 text-primary" /> Return Vehicle & Driver Assignment
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Transporter Fleet
                </label>
                <select
                  value={selectedTransporter}
                  onChange={(e) => handleSelectTransporter(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {transporters.map((t) => (
                    <option key={String(t["name"])} value={String(t["name"])}>
                      {String(t["name"])}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Vehicle Number *
                </label>
                <input
                  type="text"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  placeholder="e.g. TN 09 AB 1234"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Driver Mobile
                </label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-[11px] font-semibold text-foreground">
                Reverse Freight / Transport Charge (₹)
              </span>
              <input
                type="number"
                min="0"
                value={charges}
                onChange={(e) => setCharges(Number(e.target.value) || 0)}
                className="w-28 rounded-lg border bg-background px-3 py-1.5 text-xs font-mono font-bold text-right outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between border-t px-6 py-4 bg-muted/30">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={() => {
              if (!vehicle.trim()) {
                toast.error("Please enter a vehicle number");
                return;
              }
              if (totalKg <= 0 && containerCount <= 0) {
                toast.error("Please specify items or crates being returned");
                return;
              }

              let newId = "";
              try {
                newId = nextId("transport");
              } catch {
                const max = Math.max(1000, ...rows.map((r) => Number(r.id.split("-")[1]) || 0));
                newId = `MOV-${max + 1}`;
              }

              const returnMovement: Row = {
                id: newId,
                date: new Date().toISOString().slice(0, 10),
                direction: "Inward Return",
                supplier: selectedSupplier,
                ref: selectedTripId || (trips[0]?.id || ""),
                item: JSON.stringify(returnItems.map((i) => ({ p: i.p, q: Number(i.q), r: Number(i.r) }))),
                qty: totalKg,
                containerType,
                containerCount,
                transporter: selectedTransporter,
                vehicle,
                driver,
                driverPhone,
                charges,
                status: "Scheduled",
                dc: `RET-DC-${newId.replace("MOV-", "")}`,
                responsible: "Ravi Kumar",
              };

              onSave(returnMovement);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs"
          >
            <Check className="size-3.5 mr-1.5" /> Dispatch Return & Generate Gate Pass (F09)
          </Button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MODAL 4: OUTWARD RETURN FROM BUYER (BUYER ➔ BAY RECEIVING)
// -------------------------------------------------------------
function OutwardReturnModal({
  data,
  rows,
  onClose,
  onSave,
}: {
  data: Data;
  rows: Row[];
  onClose: () => void;
  onSave: (returnRecord: Row, transportRecord: Row) => void;
}) {
  const { nextId } = useStore();
  const salesOrders = data["sales-orders"] || [];
  const buyers = (data["buyers"] || []).map((b) => String(b["name"]));
  const transporters = data["transporters"] || [];

  const [selectedBuyer, setSelectedBuyer] = useState<string>(
    salesOrders[0]?.["buyer"] ? String(salesOrders[0]["buyer"]) : buyers[0] || "FreshMart Retail"
  );

  // Filter sales orders for selected buyer
  const buyerSalesOrders = useMemo(() => {
    return salesOrders.filter((s) => !selectedBuyer || s["buyer"] === selectedBuyer);
  }, [salesOrders, selectedBuyer]);

  const [selectedSoId, setSelectedSoId] = useState<string>(
    buyerSalesOrders[0]?.id || salesOrders[0]?.id || ""
  );

  // Current selected sales order
  const currentSo = useMemo(() => {
    return salesOrders.find((s) => s.id === selectedSoId) || buyerSalesOrders[0] || salesOrders[0];
  }, [salesOrders, selectedSoId, buyerSalesOrders]);

  // Return items state: map each product with returnQty
  const [returnItems, setReturnItems] = useState<{ p: string; maxQ: number; q: number; r: number; reason: string }[]>([]);

  // When currentSo changes, update returnItems
  useEffect(() => {
    if (currentSo) {
      const items = lines(currentSo).map((l) => ({
        p: l.p,
        maxQ: l.q,
        q: Math.min(l.q, 5), // default sample return
        r: l.r || 40,
        reason: "Quality issue",
      }));
      setReturnItems(items.length > 0 ? items : [{ p: "Tomato", maxQ: 25, q: 5, r: 40, reason: "Quality issue" }]);
      if (currentSo["buyer"] && currentSo["buyer"] !== selectedBuyer) {
        setSelectedBuyer(String(currentSo["buyer"]));
      }
    }
  }, [currentSo?.id]);

  const [containerCount, setContainerCount] = useState<number>(4);
  const [primaryReason, setPrimaryReason] = useState<string>("Quality issue");

  const [selectedTransporter, setSelectedTransporter] = useState<string>(
    transporters[0]?.["name"] ? String(transporters[0]["name"]) : "Chennai Fresh Logistics"
  );
  const [vehicle, setVehicle] = useState<string>(
    transporters[0]?.["vehicle"] ? String(transporters[0]["vehicle"]) : "TN 09 AB 1234"
  );
  const [driver, setDriver] = useState<string>(
    transporters[0]?.["driver"] ? String(transporters[0]["driver"]) : "Raja"
  );
  const [driverPhone, setDriverPhone] = useState<string>(
    transporters[0]?.["phone"] ? String(transporters[0]["phone"]) : "9840012345"
  );
  const [charges, setCharges] = useState<number>(250);

  const handleSelectTransporter = (tName: string) => {
    const tObj = transporters.find((t) => t["name"] === tName);
    setSelectedTransporter(tName);
    if (tObj) {
      setVehicle(String(tObj["vehicle"] || vehicle));
      setDriver(String(tObj["driver"] || driver));
      setDriverPhone(String(tObj["phone"] || driverPhone));
    }
  };

  const totalReturnedKg = returnItems.reduce((acc, it) => acc + (Number(it.q) || 0), 0);
  const totalVal = returnItems.reduce((acc, it) => acc + (Number(it.q) || 0) * (Number(it.r) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-card border shadow-2xl overflow-hidden my-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-purple-500/10">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-700 dark:text-purple-400">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground">Log Outward Return</h3>
                <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[11px] font-bold text-purple-800 dark:text-purple-300">
                  Buyer ➔ Bay Receiving (Reverse Logistics)
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Customer rejected produce upon delivery. Schedule pickup, quarantine in Bay QC, and issue Credit Note.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Reverse Flow Explainer */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 space-y-1">
            <div className="flex items-center justify-between font-bold text-purple-800 dark:text-purple-300">
              <span className="flex items-center gap-1.5">
                <RotateCcw className="size-3.5 text-purple-600" /> Customer Return & Reverse Logistics Flow
              </span>
              <span className="text-[10px] font-mono">Stage 7 · F22 / F23</span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              This records a sales return in <strong>Returns & Quarantine</strong> and schedules an <strong>Outward Return movement</strong> for the fleet driver to collect goods and crates from the client dock. Returned goods re-enter inspection quarantine.
            </p>
          </div>

          {/* Buyer & Dispatched Sales Order Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Buyer / Customer *
              </label>
              <select
                value={selectedBuyer}
                onChange={(e) => {
                  const b = e.target.value;
                  setSelectedBuyer(b);
                  const firstSo = salesOrders.find((s) => s["buyer"] === b);
                  if (firstSo) setSelectedSoId(firstSo.id);
                }}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              >
                {buyers.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">
                Dispatched Sales Order (SO) *
              </label>
              <select
                value={selectedSoId}
                onChange={(e) => setSelectedSoId(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
              >
                {buyerSalesOrders.map((so) => (
                  <option key={so.id} value={so.id}>
                    {so.id} · {so["buyer"]} ({so["qty"] || total(lines(so))} kg)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Return Reason */}
          <div>
            <label className="block font-semibold text-foreground mb-1">
              Primary Rejection Reason (Reported by Customer) *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "Quality issue", desc: "Overripe, bruised in transit" },
                { key: "Excess supply", desc: "Delivered over agreed quota" },
                { key: "Wrong item", desc: "Incorrect grade/item loaded" },
              ].map((r) => (
                <button
                  type="button"
                  key={r.key}
                  onClick={() => setPrimaryReason(r.key)}
                  className={cn(
                    "rounded-xl border p-2.5 text-left transition-all",
                    primaryReason === r.key
                      ? "border-purple-600 bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-1 ring-purple-600"
                      : "border-border hover:bg-muted text-muted-foreground"
                  )}
                >
                  <p className="font-bold">{r.key}</p>
                  <p className="text-[10px] opacity-80 mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Returned Produce Manifest */}
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/60 px-4 py-2 border-b flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-muted-foreground text-[11px]">
                Items Delivered on {currentSo?.id || "Sales Order"} & Returned Quantities
              </span>
              <span className="text-[10px] text-muted-foreground">
                Max cannot exceed original order
              </span>
            </div>

            <div className="divide-y p-2 space-y-2">
              {returnItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                  <div className="col-span-4">
                    <label className="block text-[10px] text-muted-foreground">Product</label>
                    <p className="font-bold text-foreground py-1">{item.p}</p>
                    <span className="text-[10px] text-muted-foreground">
                      Delivered: {item.maxQ} kg
                    </span>
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[10px] text-muted-foreground">
                      Returned KG (Max {item.maxQ})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={item.maxQ}
                      step="any"
                      value={item.q}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setReturnItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, q: val } : it))
                        );
                      }}
                      className={cn(
                        "w-full rounded border px-2 py-1.5 text-xs text-right font-mono font-bold",
                        item.q > item.maxQ
                          ? "border-destructive text-destructive bg-destructive/10"
                          : "bg-background"
                      )}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] text-muted-foreground">Unit Price</label>
                    <p className="font-mono text-muted-foreground py-1 text-right">₹{item.r}</p>
                  </div>

                  <div className="col-span-3 text-right">
                    <label className="block text-[10px] text-muted-foreground">Credit Amount</label>
                    <p className="font-mono font-bold text-foreground py-1">
                      ₹{Math.round(item.q * item.r).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-muted/40 px-4 py-2 border-t flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Total Customer Return:</span>
              <div className="flex items-center gap-4">
                <span className="font-mono text-purple-700 dark:text-purple-300 font-bold">
                  {totalReturnedKg} kg
                </span>
                <span className="text-muted-foreground">Credit Note Value:</span>
                <span className="font-mono font-bold text-foreground">
                  ₹{Math.round(totalVal).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Containers collected back from Buyer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Empty Crates Collected from Buyer
              </label>
              <input
                type="number"
                min="0"
                value={containerCount}
                onChange={(e) => setContainerCount(Number(e.target.value) || 0)}
                placeholder="e.g. 4"
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono font-bold text-right outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Receiving Bay Destination
              </label>
              <input
                type="text"
                readOnly
                value="Velaan Bay Receiving · QC Holding Bay"
                className="w-full rounded-lg border bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
              />
            </div>
          </div>

          {/* Reverse Pickup Logistics Assignment */}
          <div className="rounded-xl border p-3.5 bg-muted/20 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Truck className="size-3.5 text-primary" /> Reverse Pickup Fleet & Driver Allocation
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Transporter Fleet
                </label>
                <select
                  value={selectedTransporter}
                  onChange={(e) => handleSelectTransporter(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {transporters.map((t) => (
                    <option key={String(t["name"])} value={String(t["name"])}>
                      {String(t["name"])}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Vehicle Number *
                </label>
                <input
                  type="text"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  placeholder="e.g. TN 09 AB 1234"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Driver Mobile
                </label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-[11px] font-semibold text-foreground">
                Reverse Transport / Pickup Charge (₹)
              </span>
              <input
                type="number"
                min="0"
                value={charges}
                onChange={(e) => setCharges(Number(e.target.value) || 0)}
                className="w-28 rounded-lg border bg-background px-3 py-1.5 text-xs font-mono font-bold text-right outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between border-t px-6 py-4 bg-muted/30">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={() => {
              if (!currentSo) {
                toast.error("Please select a sales order to return from");
                return;
              }
              if (!vehicle.trim()) {
                toast.error("Please enter a vehicle number");
                return;
              }

              const activeItems = returnItems.filter((i) => i.q > 0);
              if (activeItems.length === 0) {
                toast.error("Please enter a positive return quantity for at least one item");
                return;
              }

              // Validate no item exceeds maxQ
              const invalidItem = activeItems.find((i) => i.q > i.maxQ);
              if (invalidItem) {
                toast.error(`${invalidItem.p}: returned quantity (${invalidItem.q} kg) exceeds original sale (${invalidItem.maxQ} kg)`);
                return;
              }

              let retId = "";
              try {
                retId = nextId("returns");
              } catch {
                const max = Math.max(1000, ...(data["returns"] || []).map((r) => Number(r.id.split("-")[1]) || 0));
                retId = `RDC-${max + 1}`;
              }

              let movId = "";
              try {
                movId = nextId("transport");
              } catch {
                const max = Math.max(1000, ...rows.map((r) => Number(r.id.split("-")[1]) || 0));
                movId = `MOV-${max + 1}`;
              }

              const returnRecord: Row = {
                id: retId,
                date: new Date().toISOString().slice(0, 10),
                sale: currentSo.id,
                buyer: selectedBuyer,
                item: JSON.stringify(activeItems.map((i) => ({ p: i.p, q: Number(i.q), r: Number(i.r) }))),
                qty: totalReturnedKg,
                reason: primaryReason,
                status: "Received",
                responsible: "Ravi Kumar",
              };

              const transportRecord: Row = {
                id: movId,
                date: new Date().toISOString().slice(0, 10),
                direction: "Outward Return",
                buyer: selectedBuyer,
                ref: retId,
                item: JSON.stringify(activeItems.map((i) => ({ p: i.p, q: Number(i.q), r: Number(i.r) }))),
                qty: totalReturnedKg,
                containerType: "Plastic crates (~20-25 kg)",
                containerCount,
                transporter: selectedTransporter,
                vehicle,
                driver,
                driverPhone,
                charges,
                status: "Scheduled",
                dc: `RET-DC-${retId.replace("RDC-", "")}`,
                responsible: "Ravi Kumar",
              };

              onSave(returnRecord, transportRecord);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs"
          >
            <Check className="size-3.5 mr-1.5" /> Log Return & Schedule Reverse Pickup
          </Button>
        </div>
      </div>
    </div>
  );
}

