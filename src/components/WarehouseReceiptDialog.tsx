import { useState, useMemo, useEffect } from "react";
import {
  X,
  Check,
  Scale,
  Truck,
  Building2,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Plus,
  Trash2,
  RotateCcw,
  Calendar,
  User,
  FileText,
  Percent,
  Package,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  PRODUCT_CATALOG,
  WAREHOUSES,
  DEFAULT_WAREHOUSE,
  type ProductItem,
  type Row,
} from "@/lib/modules";
import { useStore } from "@/lib/store";
import {
  parseLines,
  lines,
  round,
  num,
  total,
  normalize,
  validateData,
  parseBuys,
  type ProductLine,
} from "@/lib/workflow";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export const CONTAINER_OPTIONS = [
  "Plastic crates",
  "Wooden boxes",
  "Gunny bags",
  "Carton boxes",
];

export const getDefaultContainer = (
  prodName: string,
  qty: number,
  fallbackType = "Plastic crates"
) => {
  const pLower = (prodName || "").toLowerCase();
  let type = fallbackType;
  if (pLower.includes("potato") || pLower.includes("onion")) {
    type = "Gunny bags";
  } else if (pLower.includes("apple") || pLower.includes("pomegranate")) {
    type = "Carton boxes";
  } else if (
    pLower.includes("tomato") ||
    pLower.includes("carrot") ||
    pLower.includes("cabbage") ||
    pLower.includes("beans")
  ) {
    type = "Plastic crates";
  }
  const count = Math.max(1, Math.round((qty || 25) / 25)) || 1;
  return { type, count };
};

interface GRNLine {
  p: string;
  sentQ: number;
  q: number;
  containerType: string;
  containerCount: number;
  packKg: number;
  packLabel: string;
  category?: string;
  reason: string;
}

const DIFFERENCE_REASONS = [
  "—",
  "Moisture loss",
  "Spillage",
  "Scale variance",
  "Damaged in transit",
];

const suggestedDifferenceReason = (sent: number, received: number) => {
  const difference = round(received - sent);
  if (difference === 0) return "—";
  if (difference > 0) return "Scale variance";
  return difference / (sent || 1) <= -0.1 ? "Spillage" : "Moisture loss";
};

interface WarehouseReceiptDialogProps {
  row: Row;
  onClose: () => void;
  onSave: (r: Row) => void;
  isNew: boolean;
}

export function WarehouseReceiptDialog({
  row,
  onClose,
  onSave,
  isNew,
}: WarehouseReceiptDialogProps) {
  const { data } = useStore();

  // Trips eligible for warehouse receipt (Submitted or Inward Transit)
  const trips = useMemo(() => {
    return (data["trips"] ?? []).filter(
      (t) => t.status === "Submitted" || t.id === row["dc"]
    );
  }, [data, row]);

  // Consignment & Header States
  const [dc, setDc] = useState<string>(String(row["dc"] || trips[0]?.id || ""));
  const [date, setDate] = useState<string>(
    String(row["date"] || new Date().toISOString().slice(0, 10))
  );
  const [warehouse, setWarehouse] = useState<string>(
    String(row["warehouse"] || DEFAULT_WAREHOUSE)
  );
  const [responsible, setResponsible] = useState<string>(
    String(row["responsible"] || "Ravi Kumar")
  );
  const [status, setStatus] = useState<string>(String(row["status"] || "Posted"));

  // Container Tracking States
  const [containerType, setContainerType] = useState<string>(
    String(row["containerType"] || "Plastic crates")
  );
  const [containerCount, setContainerCount] = useState<number>(
    num(row["containerCount"]) || 16
  );

  // Active Selected Trip
  const selectedTrip = useMemo(() => {
    return (data["trips"] ?? []).find((t) => t.id === dc);
  }, [data, dc]);

  // Transporter & Origin Details (Derived from Trip)
  const tripBuys = useMemo(() => {
    return selectedTrip?.["buys"] ? parseBuys(selectedTrip["buys"]) : [];
  }, [selectedTrip]);

  const supplier = useMemo(() => {
    if (selectedTrip?.["supplier"]) return String(selectedTrip["supplier"]);
    if (tripBuys.length > 0) {
      return [...new Set(tripBuys.map((b) => b.s).filter(Boolean))].join(", ");
    }
    return String(row["supplier"] || "Murugan Traders");
  }, [selectedTrip, tripBuys, row]);

  const tripDcNo = String(selectedTrip?.["dc"] || selectedTrip?.id || "—");

  // Initial Produce Lines initialization
  const [linesState, setLinesState] = useState<GRNLine[]>(() => {
    const rawParsed = parseLines(row["item"]);
    if (rawParsed.length > 0) {
      return rawParsed.map((l) => {
        const spec = PRODUCT_CATALOG.find(
          (p) => p.name.toLowerCase() === l.p.toLowerCase()
        );
        const line = l as ProductLine;
        const sentVal = line.sentQ !== undefined ? num(line.sentQ) : l.q;
        const def = getDefaultContainer(
          l.p,
          l.q,
          String(row["containerType"] || "Plastic crates")
        );
        return {
          p: l.p,
          sentQ: sentVal,
          q: l.q,
          containerType: line.containerType || def.type,
          containerCount:
            line.containerCount !== undefined
              ? num(line.containerCount)
              : def.count,
          packKg: spec?.packSizeKg || l.packKg || 0.5,
          packLabel: spec?.defaultPackSize || l.packLabel || "500 g",
          category: spec?.category || "Produce",
          reason: line.reason || (Math.abs(l.q - sentVal) > 0.001 ? String(row["reason"] || "—") : "—"),
        };
      });
    }

    if (selectedTrip) {
      const tripLines = lines(selectedTrip, "net");
      const tripBuysParsed = selectedTrip["buys"] ? parseBuys(selectedTrip["buys"]) : [];
      return tripLines.map((l) => {
        const spec = PRODUCT_CATALOG.find(
          (p) => p.name.toLowerCase() === l.p.toLowerCase()
        );
        const matchingBuy = tripBuysParsed.find(
          (b) => b.p.toLowerCase() === l.p.toLowerCase()
        );
        const def = getDefaultContainer(
          l.p,
          l.q,
          String(selectedTrip["containerType"] || "Plastic crates")
        );
        return {
          p: l.p,
          sentQ: l.q,
          q: l.q,
          containerType:
            matchingBuy?.ct || String(selectedTrip["containerType"] || def.type),
          containerCount: matchingBuy?.cc ? num(matchingBuy.cc) : def.count,
          packKg: spec?.packSizeKg || 0.5,
          packLabel: spec?.defaultPackSize || "500 g",
          category: spec?.category || "Produce",
          reason: "—",
        };
      });
    }

    return [];
  });

  // When Trip DC changes in New GRN, re-populate products and trip metadata
  const handleSelectTrip = (newDc: string) => {
    setDc(newDc);
    const trip = (data["trips"] ?? []).find((t) => t.id === newDc);
    if (trip) {
      if (trip["warehouse"]) {
        setWarehouse(String(trip["warehouse"]));
      }
      if (trip["containerType"]) {
        setContainerType(String(trip["containerType"]));
      }
      if (trip["containerCount"]) {
        setContainerCount(num(trip["containerCount"]));
      }

      const tripLines = lines(trip, "net");
      const tripBuysParsed = trip["buys"] ? parseBuys(trip["buys"]) : [];
      const mapped = tripLines.map((l) => {
        const spec = PRODUCT_CATALOG.find(
          (p) => p.name.toLowerCase() === l.p.toLowerCase()
        );
        const matchingBuy = tripBuysParsed.find(
          (b) => b.p.toLowerCase() === l.p.toLowerCase()
        );
        const def = getDefaultContainer(
          l.p,
          l.q,
          String(trip["containerType"] || "Plastic crates")
        );
        return {
          p: l.p,
          sentQ: l.q,
          q: l.q,
          containerType:
            matchingBuy?.ct || String(trip["containerType"] || def.type),
          containerCount: matchingBuy?.cc ? num(matchingBuy.cc) : def.count,
          packKg: spec?.packSizeKg || 0.5,
          packLabel: spec?.defaultPackSize || "500 g",
          category: spec?.category || "Produce",
          reason: "—",
        };
      });
      setLinesState(mapped);
      toast.success(`Loaded ${mapped.length} products from ${trip.id}`);
    }
  };

  // Add extra product from catalog if arrived on truck
  const [productToAdd, setProductToAdd] = useState("");
  const handleAddProduct = (prodName: string) => {
    if (!prodName) return;
    if (linesState.some((l) => l.p.toLowerCase() === prodName.toLowerCase())) {
      toast.error(`${prodName} is already on the receipt lines.`);
      return;
    }
    const spec = PRODUCT_CATALOG.find(
      (p) => p.name.toLowerCase() === prodName.toLowerCase()
    );
    const def = getDefaultContainer(prodName, 20, containerType);
    const newLine: GRNLine = {
      p: prodName,
      sentQ: 0,
      q: 20,
      containerType: def.type,
      containerCount: def.count,
      packKg: spec?.packSizeKg || 0.5,
      packLabel: spec?.defaultPackSize || "500 g",
      category: spec?.category || "Produce",
      reason: "—",
    };
    setLinesState((prev) => [...prev, newLine]);
    setProductToAdd("");
    toast.success(`Added ${prodName} to incoming receipt`);
  };

  // Remove a line
  const handleRemoveLine = (idx: number) => {
    if (linesState.length <= 1) {
      toast.error("Receipt must have at least one product line");
      return;
    }
    setLinesState((prev) => prev.filter((_, i) => i !== idx));
  };

  // Line-level container change handlers
  const handleLineContainerTypeChange = (idx: number, type: string) => {
    setLinesState((prev) => {
      const copy = [...prev];
      const line = copy[idx];
      if (line) copy[idx] = { ...line, containerType: type };
      return copy;
    });
  };

  const handleLineContainerCountChange = (idx: number, count: number) => {
    const safeCount = Math.max(0, Math.round(Number(count) || 0));
    setLinesState((prev) => {
      const copy = [...prev];
      const line = copy[idx];
      if (line) copy[idx] = { ...line, containerCount: safeCount };
      return copy;
    });
  };

  const handleLineReasonChange = (idx: number, lineReason: string) => {
    setLinesState((prev) => prev.map((line, index) => (
      index === idx ? { ...line, reason: lineReason } : line
    )));
  };

  // Aggregated Weight Calculations
  const totalSentKg = useMemo(() => {
    const sumSent = linesState.reduce((s, l) => s + l.sentQ, 0);
    return sumSent > 0 ? round(sumSent) : num(row["sent"]) || round(linesState.reduce((s, l) => s + l.q, 0));
  }, [linesState, row]);

  const totalReceivedKg = useMemo(() => {
    return round(linesState.reduce((s, l) => s + l.q, 0));
  }, [linesState]);

  const totalLineContainers = useMemo(() => {
    return linesState.reduce((sum, l) => sum + (num(l.containerCount) || 0), 0);
  }, [linesState]);

  // Breakdown of containers by type
  const containerTypeSummary = useMemo(() => {
    const breakdown: Record<string, number> = {};
    for (const l of linesState) {
      const t = l.containerType || containerType || "Plastic crates";
      breakdown[t] = (breakdown[t] || 0) + (num(l.containerCount) || 0);
    }
    return breakdown;
  }, [linesState, containerType]);

  // Keep total container count in sync when line counts change
  useEffect(() => {
    if (totalLineContainers > 0) {
      setContainerCount(totalLineContainers);
    }
  }, [totalLineContainers]);

  const diffKg = round(totalReceivedKg - totalSentKg);
  const diffPct = totalSentKg > 0 ? round(((totalReceivedKg - totalSentKg) / totalSentKg) * 1000) / 10 : 0;
  const isLoss = diffKg < 0;
  const isHighLoss = diffPct <= -10;

  // Adjust an individual line's Received KG
  const handleLineQtyChange = (index: number, newQty: number) => {
    const val = Math.max(0, round(newQty));
    setLinesState((prev) => {
      const copy = [...prev];
      const line = copy[index];
      if (line) {
        copy[index] = {
          ...line,
          q: val,
          reason: suggestedDifferenceReason(line.sentQ, val),
        };
      }
      return copy;
    });
  };

  // 1-Click Wastage / Proportional Auto-Distribution
  // When a wastage percentage (e.g. 10%) or custom received weight is applied:
  // Proportionally distributes across all product lines!
  const applyWastagePreset = (lossPct: number) => {
    if (totalSentKg <= 0) {
      toast.error("Origin sent weight must be greater than zero to calculate wastage.");
      return;
    }

    const scale = round(1 - lossPct / 100);
    const targetReceivedTotal = round(totalSentKg * scale);

    const reason = lossPct === 0 ? "—" : lossPct >= 10 ? "Spillage" : "Moisture loss";
    setLinesState((prev) =>
      prev.map((l) => {
        const base = l.sentQ > 0 ? l.sentQ : l.q;
        const received = round(base * scale);
        return {
          ...l,
          q: received,
          reason: suggestedDifferenceReason(base, received) === "—" ? "—" : reason,
        };
      })
    );

    if (lossPct === 0) {
      toast.success(`Restored 100% exact weight: ${totalSentKg} kg (0 kg variance)`);
    } else if (lossPct >= 10) {
      toast.warning(
        `Applied -${lossPct}% High Transit Wastage (-${round(totalSentKg - targetReceivedTotal)} kg) proportionally across ${linesState.length} products.`
      );
    } else {
      toast.info(
        `Applied -${lossPct}% Transit Loss (-${round(totalSentKg - targetReceivedTotal)} kg) proportionally across all lines.`
      );
    }
  };

  // Custom Bay Net Weighed KG input
  const handleTotalReceivedInput = (val: number) => {
    const target = Math.max(0, Number(val) || 0);
    if (totalSentKg <= 0 || target === totalReceivedKg) return;

    const scale = target / totalSentKg;
    setLinesState((prev) =>
      prev.map((l) => {
        const base = l.sentQ > 0 ? l.sentQ : l.q;
        const received = round(base * scale);
        return {
          ...l,
          q: received,
          reason: suggestedDifferenceReason(base, received),
        };
      })
    );
  };

  // Form submission & validation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!dc) {
      toast.error("Please select a Purchase Reference (Trip DC)");
      return;
    }

    if (!warehouse) {
      toast.error("Receiving Warehouse is required");
      return;
    }

    if (linesState.length === 0) {
      toast.error("Receipt must have at least one product line");
      return;
    }

    if (linesState.some((l) => l.q < 0)) {
      toast.error("Received quantities cannot be negative");
      return;
    }

    const lineWithMissingReason = linesState.find(
      (line) => round(line.q - line.sentQ) !== 0 && (!line.reason || line.reason === "—")
    );
    if (lineWithMissingReason) {
      toast.error(`Please select a Difference Reason for ${lineWithMissingReason.p}`);
      return;
    }

    const varianceReasons = [...new Set(
      linesState.filter((line) => round(line.q - line.sentQ) !== 0).map((line) => line.reason)
    )];
    const receiptReason = varianceReasons.length === 0
      ? "—"
      : varianceReasons.length === 1
        ? varianceReasons[0] || "—"
        : "Multiple reasons";

    const receiptPayload: Row = normalize("receipts", {
      ...row,
      id: row.id,
      date,
      status,
      dc,
      warehouse,
      supplier,
      sent: totalSentKg,
      received: totalReceivedKg,
      diff: diffKg,
      reason: receiptReason,
      containerType,
      containerCount: totalLineContainers > 0 ? totalLineContainers : containerCount,
      responsible,
      item: JSON.stringify(
        linesState.map((l) => ({
          p: l.p,
          q: l.q,
          sentQ: l.sentQ,
          containerType: l.containerType,
          containerCount: l.containerCount,
          packKg: l.packKg,
          packLabel: l.packLabel,
          reason: l.reason,
        }))
      ),
    });

    const err = validateData({
      ...data,
      receipts: (data["receipts"] || []).some((x) => x.id === receiptPayload.id)
        ? (data["receipts"] || []).map((x) =>
            x.id === receiptPayload.id ? receiptPayload : x
          )
        : [...(data["receipts"] || []), receiptPayload],
    });

    if (err) {
      toast.error(err);
      return;
    }

    onSave(receiptPayload);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-foreground/50 backdrop-blur-xs animate-in fade-in"
        onClick={onClose}
      />

      <form
        role="dialog"
        aria-modal="true"
        aria-label={`${isNew ? "New" : "Edit"} Warehouse receipts`}
        onSubmit={handleSubmit}
        className="relative my-auto w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-card shadow-2xl border animate-in zoom-in-95 overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b bg-hero px-5 py-4 text-primary-foreground shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/10 shadow-xs">
              <Scale className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs opacity-85">F06 · F07 · F08</span>
                <span className="rounded bg-white/20 px-2 py-0.5 font-mono text-xs font-bold">
                  {row.id}
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                  {status}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold">
                {isNew ? "New" : "Edit"} — Warehouse Receipt Note (GRN)
              </h2>
            </div>
          </div>
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg text-primary-foreground hover:bg-white/20"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* SECTION 1: CONSIGNMENT & TRIP DETAILS BOX */}
          <div className="rounded-xl border bg-muted/30 p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Truck className="size-4 text-primary" />
                <span>1. Inward Consignment & Warehouse Destination</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                Origin DC: <strong className="text-foreground">{tripDcNo}</strong>
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {/* Purchase Reference DC Select */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Purchase Reference (Trip DC) <span className="text-destructive">*</span>
                </label>
                <select
                  value={dc}
                  onChange={(e) => handleSelectTrip(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background px-2.5 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="">Select incoming trip</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} · {t["supplier"] || "Market"} · {num(t["net"])} kg
                    </option>
                  ))}
                </select>
              </div>

              {/* Receiving Warehouse Facility */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Building2 className="size-3 text-amber-600" />
                  Receiving Warehouse <span className="text-destructive">*</span>
                </label>
                <select
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background px-2.5 text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  {WAREHOUSES.map((wh) => (
                    <option key={wh} value={wh}>
                      {wh}
                    </option>
                  ))}
                </select>
              </div>

              {/* Arrival Date */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Arrival Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background px-2.5 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>

            {/* Inward Supplier & Origin DC Strip (Transport details removed) */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card border px-3 py-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">Supplier (Ledger):</span>
                <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">
                  {supplier}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">Purchase Delivery Challan:</span>
                <span className="font-mono font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
                  {tripDcNo}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">Receiving Manager:</span>
                <span className="font-medium text-foreground">{responsible}</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: CONSIGNMENT PRODUCTS & CONTAINER ALLOCATIONS */}
          <div className="rounded-xl border bg-card space-y-2.5 overflow-hidden shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/60 px-3.5 py-2.5 border-b">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-primary" />
                <span className="font-semibold text-foreground text-xs">
                  2. Consignment Products & Container Allocations ({linesState.length} Items)
                </span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                  {totalReceivedKg.toFixed(2)} kg Net Weighed
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {totalLineContainers} Boxes / Crates
                </span>
              </div>

              {/* Quick Add Produce dropdown */}
              <div className="flex items-center gap-1.5">
                <select
                  value={productToAdd}
                  onChange={(e) => handleAddProduct(e.target.value)}
                  className="h-7 rounded border bg-background px-2 text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">+ Add Extra Produce...</option>
                  {PRODUCT_CATALOG.filter(
                    (p) => !linesState.some((l) => l.p.toLowerCase() === p.name.toLowerCase())
                  ).map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Produce Table with Product-Based Container Boxes */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 px-3 w-8">#</th>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3 text-right">Sent KG (Supplier)</th>
                    <th className="py-2 px-3 text-right w-32">Received KG (Bay Net)</th>
                    <th className="py-2 px-3 text-center w-56">Containers (Type & Box Count)</th>
                    <th className="py-2 px-3 text-right">Difference</th>
                    <th className="py-2 px-3 text-center min-w-40">Difference Reason</th>
                    <th className="py-2 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {linesState.map((l, idx) => {
                    const lineDiff = round(l.q - l.sentQ);
                    const lineDiffPct = l.sentQ > 0 ? round(((l.q - l.sentQ) / l.sentQ) * 1000) / 10 : 0;

                    return (
                      <tr key={idx} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-3 font-mono text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-foreground">{l.p}</div>
                          {l.category && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              <span className="rounded bg-muted px-1.5 py-0.2">
                                {l.category}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-muted-foreground tabular-nums">
                          {l.sentQ.toFixed(2)} kg
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.q}
                            onChange={(e) => handleLineQtyChange(idx, Number(e.target.value))}
                            className="w-24 h-7 text-right rounded border bg-background px-1.5 font-mono font-bold text-foreground focus:ring-1 focus:ring-primary outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5 justify-center">
                            <input
                              type="number"
                              min="0"
                              value={l.containerCount}
                              onChange={(e) =>
                                handleLineContainerCountChange(idx, Number(e.target.value))
                              }
                              className="w-14 h-7 text-right rounded border bg-background px-1 font-mono font-bold text-foreground focus:ring-1 focus:ring-primary outline-none"
                              title="Container Box Count"
                            />
                            <select
                              value={l.containerType}
                              onChange={(e) =>
                                handleLineContainerTypeChange(idx, e.target.value)
                              }
                              className="h-7 text-[11px] rounded border bg-background px-1.5 font-medium text-foreground focus:ring-1 focus:ring-primary outline-none"
                              title="Container Type"
                            >
                              {CONTAINER_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          <span
                            className={cn(
                              "font-semibold",
                              lineDiff === 0
                                ? "text-muted-foreground"
                                : lineDiff < 0
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-blue-600"
                            )}
                          >
                            {lineDiff > 0 ? `+${lineDiff.toFixed(2)}` : lineDiff.toFixed(2)} kg
                            {l.sentQ > 0 && (
                              <span className="text-[10px] ml-1 opacity-80">
                                ({lineDiffPct}%)
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <select
                            aria-label={`${l.p} difference reason`}
                            value={l.reason}
                            onChange={(e) => handleLineReasonChange(idx, e.target.value)}
                            disabled={lineDiff === 0}
                            className="h-7 w-full min-w-36 rounded border bg-background px-1.5 text-[11px] font-medium text-foreground focus:ring-1 focus:ring-primary outline-none"
                          >
                            {DIFFERENCE_REASONS.map((option) => (
                              <option key={option} value={option}>
                                {option === "—" ? "— (No variance)" : option}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                            title="Remove produce"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t bg-muted/30 font-semibold text-xs">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3">
                      Total ({linesState.length} Products)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {totalSentKg.toFixed(2)} kg
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {totalReceivedKg.toFixed(2)} kg
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-foreground">
                      <span className="rounded bg-muted px-2 py-0.5">
                        {totalLineContainers} Boxes / Crates
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span
                        className={cn(
                          "font-bold",
                          diffKg === 0
                            ? "text-muted-foreground"
                            : isLoss
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-blue-600"
                        )}
                      >
                        {diffKg > 0 ? `+${diffKg.toFixed(2)}` : diffKg.toFixed(2)} kg
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* SECTION 3: WEIGHT RECONCILIATION & 10% WASTAGE TOLERANCE BOX */}
          <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-background p-3.5 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Scale className="size-4 text-emerald-600" />
                <span>3. Bay Weigh-in & 10% Transit Wastage Adjustment</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground">Calibrated Scale:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Essae DS-215 (Ready)
                </span>
              </div>
            </div>

            {/* 3 Prominent Weight KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Origin Sent */}
              <div className="rounded-xl border bg-card p-3 shadow-2xs">
                <div className="text-[11px] font-bold text-foreground flex items-center justify-between">
                  <span>1. Origin Sent</span>
                  <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">
                    Supplier Ledger
                  </span>
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-foreground">
                  {totalSentKg.toFixed(2)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">kg</span>
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
                  ✓ Credited on Supplier Ledger & Payable
                </div>
              </div>

              {/* Bay Weighed */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 shadow-2xs">
                <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Scale className="size-3.5 text-emerald-600" /> 2. Bay Net Weighed
                  </span>
                  <span className="text-[10px] rounded bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                    Next Process: QC
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalReceivedKg}
                    onChange={(e) => handleTotalReceivedInput(Number(e.target.value))}
                    className="w-full font-mono text-2xl font-bold bg-transparent text-emerald-700 dark:text-emerald-300 outline-none focus:ring-1 focus:ring-emerald-500/40 rounded px-1 -ml-1 border border-emerald-500/20"
                  />
                  <span className="text-xs font-semibold text-emerald-700/80">kg</span>
                </div>
                <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                  Transfers to Ungraded Stock for Stage F07 QC
                </div>
              </div>

              {/* Transit Variance */}
              <div
                className={cn(
                  "rounded-xl border p-3 shadow-2xs transition-colors",
                  diffKg === 0
                    ? "bg-muted/30 border-border"
                    : isHighLoss
                    ? "bg-destructive/10 border-destructive/30"
                    : isLoss
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-blue-500/10 border-blue-500/30"
                )}
              >
                <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                  <span>3. Transit Variance / Wastage</span>
                  <span className="font-mono font-bold">
                    {diffPct > 0 ? `+${diffPct}` : diffPct}%
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-1 font-mono text-2xl font-bold",
                    diffKg === 0
                      ? "text-foreground"
                      : isHighLoss
                      ? "text-destructive"
                      : isLoss
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-blue-600 dark:text-blue-400"
                  )}
                >
                  {diffKg > 0 ? `+${diffKg.toFixed(2)}` : diffKg.toFixed(2)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">kg</span>
                </div>
                <div className="text-[10px] font-medium mt-0.5 flex items-center gap-1">
                  {diffKg === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓ Zero variance (100% arrived)
                    </span>
                  ) : isHighLoss ? (
                    <span className="text-destructive font-bold flex items-center gap-0.5">
                      <AlertTriangle className="size-3" /> High Transit Loss (&gt;10%)
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      Normal transit moisture loss
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Wastage / 10% Preset Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Quick Tolerance Presets:
                </span>
                <button
                  type="button"
                  onClick={() => applyWastagePreset(0)}
                  className="rounded-md border bg-card px-2 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
                >
                  Exact (0%)
                </button>
                <button
                  type="button"
                  onClick={() => applyWastagePreset(2)}
                  className="rounded-md border bg-card px-2 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
                >
                  -2% Moisture
                </button>
                <button
                  type="button"
                  onClick={() => applyWastagePreset(5)}
                  className="rounded-md border bg-card px-2 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
                >
                  -5% Normal Loss
                </button>
                <button
                  type="button"
                  onClick={() => applyWastagePreset(10)}
                  className="rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold px-2.5 py-1 text-[11px] hover:bg-amber-500/20 transition-all flex items-center gap-1 shadow-2xs"
                >
                  <Percent className="size-3" />
                  -10% Transit Wastage
                </button>
              </div>

              <div className="text-[11px] text-muted-foreground">
                Select a reason on each product line with a transit variance.
              </div>
            </div>
          </div>

          {/* SECTION 4: CONTAINER DETAILS BOX ("container tails box") */}
          <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Boxes className="size-4 text-primary" />
                <span>4. Inward Container & Returnable Crates (F09)</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Auto-updates Supplier Container Ledger
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Primary Container Type
                </label>
                <select
                  value={containerType}
                  onChange={(e) => setContainerType(e.target.value)}
                  className="w-full h-8 rounded-lg border bg-background px-2.5 text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                >
                  {CONTAINER_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Containers Received Count (Total from Produce Lines)
                </label>
                <input
                  type="number"
                  min="0"
                  value={containerCount}
                  onChange={(e) => setContainerCount(Number(e.target.value) || 0)}
                  className="w-full h-8 rounded-lg border bg-background px-2.5 text-xs font-mono font-bold focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>

            {/* Product-based Container Box Allocation Details */}
            <div className="space-y-1.5 pt-1 border-t">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                <span>Product-wise Container Allocations:</span>
                <span className="font-mono text-[10px] text-primary font-bold">
                  {Object.entries(containerTypeSummary)
                    .map(([t, count]) => `${count} ${t}`)
                    .join(" · ")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {linesState.map((l, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md bg-card border px-2 py-1 text-[11px] font-medium text-foreground shadow-2xs"
                  >
                    <Boxes className="size-3 text-primary" />
                    <strong>{l.p}:</strong>{" "}
                    <span className="font-mono font-bold text-primary">
                      {l.containerCount}
                    </span>{" "}
                    <span className="text-muted-foreground text-[10px]">
                      {l.containerType}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-card border p-2 text-[11px] text-muted-foreground">
              <Boxes className="size-3.5 text-primary shrink-0 mt-0.5" />
              <span>
                Saving this GRN voucher will automatically create or update a returnable container record of{" "}
                <strong className="text-foreground font-mono">
                  {containerCount} {containerType}
                </strong>{" "}
                with supplier <strong className="text-foreground">{supplier}</strong> in Stage C Returnable Containers.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Status:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-7 rounded border bg-background px-2 text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="Posted">Posted (Receive into Bay)</option>
              <option value="Arrived">Arrived (Pre-check)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 px-4 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-9 px-5 text-xs font-semibold gap-1.5 shadow-sm"
            >
              <Check className="size-4" />
              Save & Post GRN ({totalReceivedKg.toFixed(2)} kg)
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
