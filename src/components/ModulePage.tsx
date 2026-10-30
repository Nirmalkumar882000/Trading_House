import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronDown, Pencil, Plus, Search, Trash2, X, Download, FileText, Scale, QrCode, Eye, MessageCircle, Package, RotateCcw, Clock, Boxes, Sparkles, CheckCircle2, BookOpen, Building2 } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, type Field, type ModuleDef, type Row, PRODUCT_CATALOG, getPackSpecOptions, totalPacketCount, DEFAULT_WAREHOUSE, WAREHOUSES } from "@/lib/modules";
import { useStore } from "@/lib/store";
import { canViewPrice, canEditPrice, maskPriceIfRestricted } from "@/lib/rbac";

function formatKgSpec(kg: number): string {
  if (kg === 0.25) return "0.25 kg";
  if (kg === 0.3) return "0.300 kg";
  if (kg === 0.5) return "0.500 kg";
  if (kg === 0.75) return "0.750 kg";
  if (kg < 1) return `${Math.round(kg * 1000) / 1000} kg`;
  return `${kg} kg`;
}
import { DeliveryChallanModal } from "./DeliveryChallanModal";
import { BluetoothScaleModal } from "./BluetoothScaleModal";
import { GoodsReceiptVoucherModal } from "./GoodsReceiptVoucherModal";
import { QrStickerModal } from "./QrStickerModal";
import { BuyerDemandModal } from "./BuyerDemandModal";
import { ReturnContainerModal } from "./ReturnContainerModal";
import { ContainerReturnChallanModal } from "./ContainerReturnChallanModal";
import { ProductCatalogModal } from "./ProductCatalogModal";
import { WarehouseReceiptDialog } from "./WarehouseReceiptDialog";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { outstandingDemand } from "@/lib/sourcing";
import { Button } from "./ui/button";
import { EmployeeSelect } from "./EmployeeSelect";
import { bagBreakdown, buysFromTrip, parseBuys, returnsAvailable, lines, normalize, num, parseLines, populate, referenceModule, stock, syncReceiptDownstream, total, validateData, round, type ProductLine } from "@/lib/workflow";
export { parseLines } from "@/lib/workflow";

function getCreateButtonLabel(slug: string, title: string): string {
  if (slug === "purchase-orders") return "New Demand";
  if (slug === "receipts") return "New GRN";
  if (slug === "containers") return "New Returnable";
  if (slug === "transport") return "New Movement";
  return `New ${(title.split(" ")[0] ?? "").replace(/s$/, "")}`;
}

type Line = ProductLine;
const fmt = (f: Field, v: unknown, role: string) => {
  if (v === undefined || v === "") return "—";
  if ((f.money || f.key === "rate" || f.key === "amount" || f.key === "payable") && !canViewPrice(role as any)) {
    return "•••• (Restricted)";
  }
  if (f.type === "buys") {
    if (!canViewPrice(role as any)) {
      return parseBuys(v).map((b) => `${b.s}: ${b.p} ${b.q} kg`).join(" · ") || "—";
    }
    return parseBuys(v).map((b) => `${b.s}: ${b.p} ${b.q} kg @ ${fmtMoney(b.r)}`).join(" · ") || "—";
  }
  if (f.type === "products") return parseLines(v).map((l) => (l.q ? `${l.p} (${l.q})` : l.p)).join(", ") || "—";
  if (f.key === "extraKg") {
    const val = Number(v) || 0;
    return val > 0 ? (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
        +{val.toLocaleString("en-IN")} kg
      </span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }
  if (f.money) return fmtMoney(v);
  if (f.type === "number") return `${Number(v).toLocaleString("en-IN")}${f.suffix ? " " + f.suffix : ""}`;
  return String(v);
};

export function ModulePage({ mod }: { mod: ModuleDef }) {
  const { data, role, upsert, remove, nextId, clearModule, catalog } = useStore();
  const [catalogOpen, setCatalogOpen] = useState(false);

  const rows = useMemo(() => {
    const baseRows = data[mod.slug] ?? [];
    if (mod.slug === "suppliers") {
      const trips = data["trips"] ?? [];
      const prices = data["supplier-prices"] ?? [];
      const payments = data["supplier-payments"] ?? [];

      return baseRows.map((s) => {
        const name = String(s["name"] || "");
        let purchases = 0;
        for (const t of trips) {
          if (t["buys"]) {
            for (const b of parseBuys(t["buys"])) {
              if (b.s === name) {
                purchases += (b.q || 0) * (b.r || 0);
              }
            }
          }
        }
        for (const p of prices) {
          if (p["supplier"] === name && p.status === "Confirmed") {
            purchases += (Number(p["qty"]) || 0) * (Number(p["rate"]) || 0);
          }
        }
        let totalPaid = 0;
        for (const pay of payments) {
          if (pay["supplier"] === name) {
            totalPaid += Number(pay["amount"]) || 0;
          }
        }
        const payable = Math.max(0, purchases - totalPaid);
        return { ...s, payable };
      });
    }
    if (mod.slug === "buyers") {
      const invoices = data["invoices"] ?? [];
      const payments = data["buyer-payments"] ?? [];
      const creditNotes = data["credit-notes"] ?? [];

      return baseRows.map((b) => {
        const name = String(b["name"] || "");
        let billed = 0;
        for (const inv of invoices) {
          if (inv["buyer"] === name) {
            billed += Number(inv["total"]) || 0;
          }
        }
        let collections = 0;
        for (const pmt of payments) {
          if (pmt["buyer"] === name) {
            collections += Number(pmt["amount"]) || 0;
          }
        }
        let credits = 0;
        for (const cn of creditNotes) {
          if (cn["buyer"] === name) {
            credits += Number(cn["amount"]) || 0;
          }
        }
        const receivable = Math.max(0, billed - collections - credits);
        return { ...b, receivable };
      });
    }
    return baseRows;
  }, [data, mod.slug]);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [editing, setEditing] = useState<Row | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [challanRow, setChallanRow] = useState<Row | null>(null);
  const [scaleReceiptRow, setScaleReceiptRow] = useState<Row | null>(null);
  const [voucherReceiptRow, setVoucherReceiptRow] = useState<Row | null>(null);
  const [qrPackRow, setQrPackRow] = useState<Row | null>(null);
  const [demandRow, setDemandRow] = useState<Row | null>(null);
  const [returnContainerRow, setReturnContainerRow] = useState<Row | null>(null);
  const [returnChallanRow, setReturnChallanRow] = useState<Row | null>(null);
  const view = rows.find((r) => r.id === viewId) ?? null;
  const cols = useMemo(() => {
    const base = mod.fields.filter((f) => f.list);
    if (mod.slug !== "purchase-orders") return base;
    const itemIdx = base.findIndex((f) => f.key === "item");
    const packetsCol: Field = { key: "__packets", label: "Packet", type: "number" };
    return itemIdx === -1 ? [...base, packetsCol] : [...base.slice(0, itemIdx + 1), packetsCol, ...base.slice(itemIdx + 1)];
  }, [mod]);

  const sendWhatsAppDemand = (r: Row) => {
    const ls = parseLines(r["item"]);
    const extraKg = Number(r["extraKg"]) || 0;
    const baseQty = ls.reduce((s, l) => s + (Number(l.q) || 0), 0);
    const bText = ls
      .map((l) => {
        const spec =
          PRODUCT_CATALOG.find((item) => item.name.toLowerCase() === l.p.toLowerCase()) ||
          PRODUCT_CATALOG.find((item) => item.name.toLowerCase().includes(l.p.toLowerCase())) ||
          { defaultPackSize: "1 kg", packSizeKg: 1.0 };
        const pkts = Math.ceil(l.q / (spec.packSizeKg || 1));
        return `• *${l.p}*: ${pkts} pkts (${spec.defaultPackSize}) = ${l.q} kg`;
      })
      .join("\n");

    const extraSummary = extraKg > 0 ? `\n• *Extra Buyer Buffer / Margin*: +${extraKg} kg (Base: ${baseQty} kg)` : "";

    const msg =
      `*Velaan Portal - Buyer Purchase Order Demand*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*PO Number:* ${r.id}\n` +
      `*Buyer:* ${r["buyer"]}\n` +
      `*Date:* ${r["date"]}\n` +
      `*Delivery Date:* ${r["deliveryDate"] || "Prompt"}\n` +
      `*Status:* ${r.status}\n\n` +
      `*Demand in Packets & Count:*\n${bText}${extraSummary}\n\n` +
      `*Total Demand:* ${r["qty"]} kg\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Purchase Manager, please arrange market procurement and truck loading._`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filter === "All" || r.status === filter) &&
          (!q || Object.values(r).some((v) => String(v).toLowerCase().includes(q.toLowerCase()))),
      ),
    [rows, q, filter],
  );

  const save = (r: Row) => {
    const full = normalize(mod.slug, { ...r, ...(mod.compute?.(r) ?? {}) } as Row);
    const err = mod.validate?.(full) || validateData({ ...data, [mod.slug]: rows.some(x => x.id === full.id) ? rows.map(x => x.id === full.id ? full : x) : [...rows, full] });
    if (err) { toast.error(err); return; }
    const isNew = !rows.some((x) => x.id === full.id);
    upsert(mod.slug, full);
    setEditing(null);
    toast.success(`${full.id} ${isNew ? "created" : "updated"}`);
  };

  const advance = (r: Row) => {
    if (mod.slug === "containers" && r.status === "With us") {
      setReturnContainerRow(r);
      return;
    }
    const i = mod.statuses.indexOf(r.status);
    const next = mod.statuses[i + 1];
    if (!next) return;
    const withReturns = mod.slug === "quality-check" && next === "Stage 2 done"
      ? { ...r, item: JSON.stringify(parseLines(r["item"]).map((l) => ({ ...l, ret: returnsAvailable(data, l.p, r.id) }))) }
      : r;
    const full = normalize(mod.slug, { ...withReturns, status: next } as Row);
    const err = mod.validate?.(full) || validateData({ ...data, [mod.slug]: rows.some(x => x.id === full.id) ? rows.map(x => x.id === full.id ? full : x) : [...rows, full] });
    if (err) { toast.error(err); return; }
    upsert(mod.slug, full);
    toast.success(`${r.id} moved to “${next}”`);
  };

  const blank = (): Row => {
    const today = new Date().toISOString().slice(0, 10);
    const r: Row = { id: nextId(mod.slug), status: mod.statuses[0] ?? "" };
    mod.fields.forEach((f) => (r[f.key] = f.type === "products" || f.type === "buys" ? "[]" : f.type === "number" ? 0 : f.type === "date" ? today : (f.options?.[0] ?? (f.key === "responsible" ? "Ravi Kumar" : ""))));
    return r;
  };

  const exportCsv = () => {
    const head = ["id", ...mod.fields.map((f) => f.key), "status"];
    const csv = [head.join(","), ...filtered.map((r) => head.map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${mod.slug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">{mod.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{mod.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mod.slug === "purchase-orders" && (
            <Button
              variant="outline"
              onClick={() => setCatalogOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-card px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted shadow-2xs"
            >
              <BookOpen className="size-4 text-primary" /> Add Catalog
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
            <Download className="size-4" /> Export
          </Button>
          <Button variant="ghost" onClick={() => setEditing(blank())} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90">
            <Plus className="size-4" /> {getCreateButtonLabel(mod.slug, mod.title)}
          </Button>
        </div>
      </div>

      {/* status pipeline */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${mod.statuses.length}, minmax(0,1fr))` }}>
        {mod.statuses.map((s) => {
          const count = rows.filter((r) => r.status === s).length;
          return (
            <Button
              variant="ghost"
              key={s}
              onClick={() => setFilter(filter === s ? "All" : s)}
              className={cn(
                "relative block h-auto min-h-20 whitespace-normal rounded-lg border bg-card p-3 text-left text-foreground shadow-card transition-all hover:-translate-y-0.5",
                filter === s && "border-primary ring-2 ring-primary/20",
              )}
            >
              <p className="truncate text-xs font-semibold text-muted-foreground">{s}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-primary">{count}</p>
            </Button>
          );
        })}
      </div>

      {/* Buyer Purchase Order Commodity Catalog Banner */}
      {mod.slug === "purchase-orders" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-background p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
              <BookOpen className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  Buyer Commodity Catalog & Pack Sizes
                </h3>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                  {catalog.length} Commodities Configured
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage produce specifications (kg / piece / range) & categories used across Buyer Purchase Orders.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setCatalogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Plus className="size-3.5" /> Add to Catalog
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCatalogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Eye className="size-3.5" /> View Catalog Details
            </Button>
          </div>
        </div>
      )}

      {/* Sales Order & Warehouse Inventory Fulfillment Pipeline Banner */}
      {mod.slug === "sales-orders" && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-background p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                <Boxes className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Sales Order ➔ Warehouse Stock Deduction Process
                </h3>
                <p className="text-xs text-muted-foreground">
                  Packed produce in Dispatch Bay is allocated for buyer demand. Marking orders as <strong>Dispatched</strong> or <strong>Closed</strong> automatically deducts stock from warehouse inventory to Buyer (<code className="text-primary font-semibold">Packed ➔ Buyer</code>).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/m/$module"
                params={{ module: "packing" }}
                className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                <Package className="size-3" /> Allocation & Packing
              </Link>
              <Link
                to="/m/$module"
                params={{ module: "inventory" }}
                className="inline-flex items-center gap-1 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                <Boxes className="size-3" /> View Stock
              </Link>
            </div>
          </div>

          {/* Quick Stock Deduction Metrics */}
          {(() => {
            const deductedKg = rows
              .filter((r) => ["Dispatched", "Closed"].includes(r.status))
              .reduce((s, r) => s + (Number(r["qty"]) || total(lines(r))), 0);
            const reservedKg = rows
              .filter((r) => r.status === "Confirmed")
              .reduce((s, r) => s + (Number(r["qty"]) || total(lines(r))), 0);
            const openKg = rows
              .filter((r) => r.status === "Open")
              .reduce((s, r) => s + (Number(r["qty"]) || total(lines(r))), 0);
            const packedAvailableKg = stock(data)
              .filter((s) => s.category === "Packed")
              .reduce((s, x) => s + x.qty, 0);

            return (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border bg-card p-2.5 shadow-2xs">
                  <p className="text-[11px] font-medium text-muted-foreground">Deducted from Stock</p>
                  <p className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {deductedKg.toLocaleString("en-IN")} kg
                  </p>
                  <p className="text-[10px] text-muted-foreground">Dispatched & Closed</p>
                </div>
                <div className="rounded-xl border bg-card p-2.5 shadow-2xs">
                  <p className="text-[11px] font-medium text-muted-foreground">Held in Dispatch Bay</p>
                  <p className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                    {reservedKg.toLocaleString("en-IN")} kg
                  </p>
                  <p className="text-[10px] text-muted-foreground">Confirmed Orders</p>
                </div>
                <div className="rounded-xl border bg-card p-2.5 shadow-2xs">
                  <p className="text-[11px] font-medium text-muted-foreground">Demand Logged</p>
                  <p className="font-mono text-base font-bold text-foreground">
                    {openKg.toLocaleString("en-IN")} kg
                  </p>
                  <p className="text-[10px] text-muted-foreground">Open Orders</p>
                </div>
                <div className="rounded-xl border bg-card p-2.5 shadow-2xs">
                  <p className="text-[11px] font-medium text-muted-foreground">On-Hand Packed Stock</p>
                  <p className="font-mono text-base font-bold text-primary">
                    {packedAvailableKg.toLocaleString("en-IN")} kg
                  </p>
                  <p className="text-[10px] text-muted-foreground">Available in Dispatch Bay</p>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search records…" className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {["All", ...mod.statuses].map((s) => (
              <Button variant="ghost" key={s} onClick={() => setFilter(s)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium", filter === s ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")}>
                {s}
              </Button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">ID</th>
                {cols.map((c) => <th key={c.key} className={cn("px-4 py-3 font-semibold", c.type === "number" && "text-right")}>{c.label}</th>)}
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => setViewId(r.id)} className="cursor-pointer border-t transition-colors hover:bg-primary-soft/50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.id}</td>
                  {cols.map((c) => (
                  <td key={c.key} className={cn("whitespace-nowrap px-4 py-3", c.type === "number" && "text-right tabular-nums")}>
                    {c.key === "warehouse" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        <Building2 className="size-3 text-amber-600 dark:text-amber-400" />
                        {String(r[c.key] || DEFAULT_WAREHOUSE)}
                      </span>
                    ) : c.key === "__packets" ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {totalPacketCount(r).toLocaleString("en-IN")} pkts
                      </span>
                    ) : c.type === "products" ? (
                      <ProductChips v={r[c.key]} />
                    ) : (
                      fmt(c, r[c.key], role)
                    )}
                  </td>
                ))}
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} statuses={mod.statuses} />
                    {mod.slug === "sales-orders" && (
                      <div className="mt-1">
                        {["Dispatched", "Closed"].includes(r.status) ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                            <CheckCircle2 className="size-3" /> Stock Deducted (-{Number(r.qty || 0)} kg)
                          </span>
                        ) : r.status === "Confirmed" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                            <Clock className="size-3" /> Held in Dispatch Bay ({Number(r.qty || 0)} kg)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Demand Logged ({Number(r.qty || 0)} kg)
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {mod.slug === "purchase-orders" && (
                        <>
                          <Button
                            variant="ghost"
                            title="View Demand Details (Packets, Count, Product, Buyer, Date)"
                            onClick={() => setDemandRow(r)}
                            className="rounded-md p-1.5 text-primary hover:bg-primary-soft"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            title="Share PO with Purchase Manager via WhatsApp"
                            onClick={() => sendWhatsAppDemand(r)}
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10"
                          >
                            <MessageCircle className="size-4" />
                          </Button>
                        </>
                      )}
                      {(mod.slug === "trips" || mod.slug === "transport") && (
                        <Button variant="ghost" title="View Transport Delivery Challan (F04)" onClick={() => setChallanRow(r)} className="rounded-md p-1.5 text-primary hover:bg-primary-soft">
                          <FileText className="size-4" />
                        </Button>
                      )}
                      {mod.slug === "dispatch" && (
                        <Button variant="ghost" title="View Sales Delivery Challan (F19)" onClick={() => setChallanRow(r)} className="rounded-md p-1.5 text-primary hover:bg-primary-soft">
                          <FileText className="size-4" />
                        </Button>
                      )}
                      {mod.slug === "receipts" && (
                        <>
                          <Button
                            variant="ghost"
                            title="Bluetooth Scale Weigh-in (F06)"
                            onClick={() => setScaleReceiptRow(r)}
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10"
                          >
                            <Scale className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            title="View Goods Receipt Note / Voucher (F06/F07)"
                            onClick={() => setVoucherReceiptRow(r)}
                            className="rounded-md p-1.5 text-primary hover:bg-primary-soft"
                          >
                            <FileText className="size-4" />
                          </Button>
                        </>
                      )}
                      {mod.slug === "packing" && (
                        <Button variant="ghost" title="Print QR Sticker (F15)" onClick={() => setQrPackRow(r)} className="rounded-md p-1.5 text-indigo-600 hover:bg-indigo-500/10">
                          <QrCode className="size-4" />
                        </Button>
                      )}
                      {mod.slug === "containers" && (
                        <>
                          <Button
                            variant="ghost"
                            title="Process Container Return (F09)"
                            onClick={() => setReturnContainerRow(r)}
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10"
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                          {(num(r["back"]) > 0 || r.status === "Returned") && (
                            <Button
                              variant="ghost"
                              title="View Return Delivery Challan / Voucher (F09)"
                              onClick={() => setReturnChallanRow(r)}
                              className="rounded-md p-1.5 text-primary hover:bg-primary-soft"
                            >
                              <FileText className="size-4" />
                            </Button>
                          )}
                        </>
                      )}
                      {r.status !== mod.statuses.at(-1) && (
                        <Button variant="ghost" title="Move to next step" onClick={() => advance(r)} className="rounded-md p-1.5 text-success hover:bg-success-soft"><ArrowRight className="size-4" /></Button>
                      )}
                      <Button variant="ghost" title="Edit" onClick={() => setEditing(r)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="size-4" /></Button>
                      <Button variant="ghost" title="Delete" onClick={() => { if (confirm(`Delete ${r.id}?`)) { const err = validateData({ ...data, [mod.slug]: rows.filter(x => x.id !== r.id) }); if (err) { toast.error(err); return; } remove(mod.slug, r.id); toast(`${r.id} deleted`); } }} className="rounded-md p-1.5 text-destructive hover:bg-danger-soft"><Trash2 className="size-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={cols.length + 3} className="px-4 py-14 text-center">
                    <p className="text-base font-semibold text-foreground">No records in {mod.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ready for real-time operational data entry. Click below to add your first record.</p>
                    <Button
                      variant="default"
                      onClick={() => setEditing(blank())}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
                    >
                      <Plus className="size-3.5" /> Add First {getCreateButtonLabel(mod.slug, mod.title).replace(/^New /, "")}
                    </Button>
                  </td>
                </tr>
              ) : !filtered.length ? (
                <tr><td colSpan={cols.length + 3} className="px-4 py-12 text-center text-muted-foreground">No records match the current filter.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">Showing {filtered.length} of {rows.length} records</div>
      </div>

      {editing && (
        mod.slug === "receipts" ? (
          <WarehouseReceiptDialog
            row={editing}
            onClose={() => setEditing(null)}
            onSave={save}
            isNew={!rows.some((x) => x.id === editing.id)}
          />
        ) : (
          <FormDialog
            mod={mod}
            row={editing}
            onClose={() => setEditing(null)}
            onSave={save}
            isNew={!rows.some((x) => x.id === editing.id)}
          />
        )
      )}
      {view && (
        <DetailPanel
          mod={mod}
          row={view}
          onClose={() => setViewId(null)}
          onEdit={() => setEditing(view)}
          onAdvance={() => advance(view)}
          onScale={() => setScaleReceiptRow(view)}
          onVoucher={() => setVoucherReceiptRow(view)}
          onDemand={() => setDemandRow(view)}
          onWhatsApp={() => sendWhatsAppDemand(view)}
          onReturnContainer={() => setReturnContainerRow(view)}
          onReturnChallan={() => setReturnChallanRow(view)}
        />
      )}

      {challanRow && (
        <DeliveryChallanModal
          isOpen={true}
          onClose={() => setChallanRow(null)}
          type={mod.slug === "dispatch" ? "sales" : "transport"}
          record={challanRow}
          onSignaturesUpdated={(count) => {
            const updated = normalize(mod.slug, { ...challanRow, signatures: String(count) });
            upsert(mod.slug, updated);
          }}
        />
      )}
      {scaleReceiptRow && (
        <BluetoothScaleModal
          isOpen={true}
          onClose={() => setScaleReceiptRow(null)}
          sentWeight={num(scaleReceiptRow["sent"])}
          productName={lines(scaleReceiptRow).map((l) => l.p).join(", ") || String(scaleReceiptRow["item"] || "Produce")}
          sourceDc={String(scaleReceiptRow["dc"] || scaleReceiptRow.id)}
          receipts={rows}
          activeReceiptId={scaleReceiptRow.id}
          onSelectReceipt={(id) => {
            const nextRow = rows.find((x) => x.id === id);
            if (nextRow) setScaleReceiptRow(nextRow);
          }}
          itemJson={String(scaleReceiptRow["item"] || "")}
          onApplyWeight={(wt, rsn, targetId, staff) => {
            const target = (targetId ? rows.find(x => x.id === targetId) : null) || scaleReceiptRow;
            if (!target) return;
            const diff = round(wt - num(target["sent"]));
            const reason = rsn || (diff !== 0 ? (Math.abs(diff / (num(target["sent"]) || 1)) > 0.1 ? "Spillage" : "Moisture loss") : "—");
            const updated = normalize(mod.slug, {
              ...target,
              received: wt,
              diff,
              reason,
              staff: staff || target["staff"] || "Priya S",
              responsible: staff || target["responsible"] || "Priya S",
              status: "Posted",
            });
            upsert(mod.slug, updated);

            // Synchronize downstream Quality Check (F09) to avoid negative stock or input > received
            const synced = syncReceiptDownstream(data, updated);
            if (synced["quality-check"] && synced["quality-check"] !== data["quality-check"]) {
              synced["quality-check"].forEach((qc) => {
                if (qc["lot"] === updated.id) {
                  upsert("quality-check", qc);
                }
              });
            }

            setScaleReceiptRow(null);
            setVoucherReceiptRow(updated);
            toast.success(`Weight updated for ${updated.id}: ${wt} kg received (${diff > 0 ? "+" : ""}${diff} kg difference). Goods Receipt Note generated!`);
          }}
        />
      )}
      {voucherReceiptRow && (
        <GoodsReceiptVoucherModal
          isOpen={true}
          onClose={() => setVoucherReceiptRow(null)}
          receipt={voucherReceiptRow}
          trip={(data["trips"] ?? []).find((t) => t.id === voucherReceiptRow["dc"])}
        />
      )}
      {qrPackRow && (
        <QrStickerModal
          isOpen={true}
          onClose={() => setQrPackRow(null)}
          product={lines(qrPackRow)[0]?.p || "Produce"}
          grade={String(qrPackRow["grade"] || "Grade A")}
          packSizeKg={num(qrPackRow["packSize"]) || 1.0}
          lotId={qrPackRow.id}
          packerName={String(qrPackRow["packer"] || "Senthil P")}
          shelfLifeDays={3}
        />
      )}
      {demandRow && (
        <BuyerDemandModal
          isOpen={true}
          onClose={() => setDemandRow(null)}
          row={demandRow}
        />
      )}
      {returnContainerRow && (
        <ReturnContainerModal
          isOpen={true}
          onClose={() => setReturnContainerRow(null)}
          container={returnContainerRow}
          onReturnSaved={(updated, openChallan) => {
            upsert("containers", updated);
            if (openChallan) {
              setReturnChallanRow(updated);
            }
          }}
        />
      )}
      {returnChallanRow && (
        <ContainerReturnChallanModal
          isOpen={true}
          onClose={() => setReturnChallanRow(null)}
          container={returnChallanRow}
        />
      )}
      {catalogOpen && (
        <ProductCatalogModal
          isOpen={catalogOpen}
          onClose={() => setCatalogOpen(false)}
        />
      )}
    </div>
  );
}

function FormDialog({ mod, row, onClose, onSave, isNew }: { mod: ModuleDef; row: Row; onClose: () => void; onSave: (r: Row) => void; isNew: boolean }) {
  const { data, role } = useStore();
  const priceEditable = canEditPrice(role as any);
  const [form, setForm] = useState<Row>(() => {
    // A new trip's template carries buys as an empty "[]" string, so check the parsed lines, not the raw value.
    if (mod.slug !== "trips" || (row["buys"] && parseBuys(row["buys"]).length > 0)) return row;
    // New trip: pre-fill one line for every demand product, with KG = buyer demand (same figure shown in the chips).
    const initialBuys = isNew
      ? outstandingDemand(data).map((d) => ({ s: "", p: d.product, q: d.outstanding, r: 0 }))
      : buysFromTrip(row);
    return { ...row, buys: JSON.stringify(initialBuys) };
  });
  const live = normalize(mod.slug, { ...form, ...(mod.compute?.(form) ?? {}) } as Row);
  const need = useMemo(() => {
    if (mod.slug !== "trips") return {};
    const others = { ...data, trips: (data["trips"] ?? []).filter((t) => t.id !== row.id) };
    return Object.fromEntries(outstandingDemand(others).map((d) => [d.product, { demand: d.outstanding, buy: d.buy }]));
  }, [data, mod.slug, row.id]);
  const signaturesMissing = mod.slug === "trips" && live.status === "Submitted" && num(live["signatures"]) < 3;
  const set = (k: string, v: string | number) => setForm((f) => {
    if (mod.slug === "quality-check" && k === "status" && v === "Stage 2 done") {
      const ls = parseLines(f["item"]).map((l) => ({ ...l, ret: returnsAvailable(data, l.p, f.id) }));
      return { ...f, status: "Stage 2 done", item: JSON.stringify(ls) };
    }
    if (mod.slug === "supplier-prices" && k === "rate") {
      const newRate = Number(v) || 0;
      const currentLines = parseLines(f["item"]);
      const allZero = currentLines.every((l) => !l.r || l.r === 0);
      if (allZero && currentLines.length > 0) {
        const updatedLines = currentLines.map((l) => ({ ...l, r: newRate }));
        const totQty = updatedLines.reduce((s, l) => s + l.q, 0);
        const totAmt = updatedLines.reduce((s, l) => s + l.q * newRate, 0);
        return {
          ...f,
          rate: newRate,
          item: JSON.stringify(updatedLines),
          qty: totQty || f.qty,
          amount: Math.round(totAmt),
        };
      }
    }
    if (mod.slug === "purchase-orders" && k === "extraKg") {
      const extra = Number(v) || 0;
      const ls = parseLines(f["item"]);
      const baseQty = ls.reduce((s, l) => s + (Number(l.q) || 0), 0);
      return {
        ...f,
        extraKg: extra,
        qty: round(baseQty + extra),
      };
    }
    if (k === "sourceType" || k === "direction") return { ...f, [k]: v, lot: "", ref: "", item: "[]" };
    return referenceModule(mod.slug, k, f) ? populate(mod.slug, k, String(v), f, data) : { ...f, [k]: v };
  });
  const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:bg-muted disabled:text-muted-foreground";

  const hasWideEditor = mod.fields.some((f) => f.type === "products" || f.type === "buys");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <form role="dialog" aria-modal="true" aria-label={`${isNew ? "New" : "Edit"} ${mod.title}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (signaturesMissing) {
            e.currentTarget.querySelector<HTMLSelectElement>('#field-signatures')?.focus();
            return;
          }
          const missing = mod.fields.find((f) => f.required && !String(live[f.key] ?? "").trim());
          if (missing) { toast.error(`${missing.label} is required`); return; }
          onSave(live);
        }}
        className={cn(
          "relative max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-card shadow-card animate-in zoom-in-95",
          hasWideEditor ? "max-w-4xl xl:max-w-5xl" : "max-w-2xl"
        )}
      >
        <div className="flex items-start justify-between border-b bg-hero p-5 text-primary-foreground">
          <div>
            <p className="text-xs opacity-80">{mod.flows} · {form.id}</p>
            <h2 className="text-lg font-semibold">{isNew ? "New" : "Edit"} — {mod.title}</h2>
          </div>
          <Button variant="ghost" type="button" onClick={onClose} aria-label="Close"><X className="size-5" /></Button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {mod.fields
            .filter(f => !(mod.slug === "purchase-orders" && (f.key === "extraKg" || f.key === "qty")))
            .filter(f => !(mod.slug === "trips" && (f.key === "supplier" || f.key === "rate")))
            .map((f) => (
            <div key={f.key} className={cn("space-y-1.5", (f.type === "textarea" || f.type === "products" || f.type === "buys") && "sm:col-span-2")}>
              <label htmlFor={`field-${f.key}`} className="text-xs font-semibold text-muted-foreground">
                {f.label}{f.required && <span className="text-destructive"> *</span>}{f.suffix && ` (${f.suffix})`}{!priceEditable && (f.money || f.key === "rate" || f.key === "price") && " · Back office only"}
              </label>
              {f.key === "grader" || f.key === "packer" ? (
                <EmployeeSelect
                  multiple
                  roleFilter={f.key === "grader" ? "QC grader" : "Packer"}
                  value={String(live[f.key] ?? "")}
                  onChange={(v) => set(f.key, v)}
                  placeholder={`Select ${f.label}(s)`}
                />
              ) : f.type === "buys" ? (
                <BuysEditor need={need} products={f.options ?? []} suppliers={(data["suppliers"] ?? []).filter((x) => x.status !== "Inactive" && x.status !== "Rejected").map((x) => String(x["name"] ?? "")).filter(Boolean)} value={live[f.key]} onChange={(v) => set(f.key, v)} priceEditable={priceEditable} />
              ) : f.type === "products" ? (
                <>
                  <ProductPicker
                    options={f.options ?? []}
                    value={live[f.key]}
                    onChange={(v) => {
                      if (mod.slug === "supplier-prices") {
                        const ls = parseLines(v);
                        const totQty = ls.reduce((s, l) => s + (Number(l.q) || 0), 0);
                        const totAmt = ls.reduce((s, l) => s + (Number(l.q) || 0) * (Number(l.r) || 0), 0);
                        const hasLineRates = ls.some((l) => (Number(l.r) || 0) > 0);
                        const avgRate = totQty > 0 ? (hasLineRates ? Math.round((totAmt / totQty) * 100) / 100 : Number(live["rate"]) || 0) : Number(live["rate"]) || 0;
                        setForm((prev) => ({
                          ...prev,
                          [f.key]: v,
                          qty: totQty,
                          amount: Math.round(hasLineRates ? totAmt : totQty * (Number(prev["rate"]) || 0)),
                          rate: avgRate,
                        }));
                      } else if (mod.slug === "receipts") {
                        const ls = parseLines(v);
                        const totQty = ls.reduce((s, l) => s + (Number(l.q) || 0), 0);
                        setForm((prev) => ({
                          ...prev,
                          [f.key]: v,
                          received: totQty,
                          qty: totQty,
                          diff: round(totQty - num(prev["sent"])),
                        }));
                      } else if (mod.slug === "purchase-orders") {
                        const ls = parseLines(v);
                        const totQty = ls.reduce((s, l) => s + (Number(l.q) || 0), 0);
                        const extra = Number(form["extraKg"] ?? live["extraKg"]) || 0;
                        setForm((prev) => ({
                          ...prev,
                          [f.key]: v,
                          qty: round(totQty + extra),
                        }));
                      } else {
                        set(f.key, v);
                      }
                    }}
                    grading={mod.slug === "quality-check"}
                    stage2={live.status === "Stage 2 done"}
                    returnsAvail={(p) => returnsAvailable(data, p, form.id)}
                    pricing={mod.slug === "supplier-prices"}
                    defaultRate={Number(live["rate"]) || 0}
                    priceEditable={priceEditable}
                  />
                  {mod.slug === "purchase-orders" && (
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-xs shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">🎯 Total Buyer Demand:</span>
                        <span className="rounded-lg bg-primary px-2.5 py-1 font-mono text-xs font-bold text-primary-foreground shadow-xs">
                          {Number(live["qty"] || 0).toLocaleString("en-IN")} kg
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : f.type === "select" ? (
                <>
                  <select id={`field-${f.key}`} disabled={f.readOnly} className={input} aria-invalid={f.key === "signatures" && signaturesMissing ? true : undefined} aria-describedby={f.key === "signatures" && signaturesMissing ? "signatures-error" : undefined} value={String(live[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                    <option value="">Select {f.label}</option>
                    {(referenceModule(mod.slug, f.key, form) ? (data[referenceModule(mod.slug, f.key, form) ?? ""] ?? []).filter(r => {
                      if (mod.slug === "receipts") return r.status === "Submitted";
                      if (mod.slug === "quality-check") return form["sourceType"] === "Return" ? ["Received", "Sent to QC"].includes(r.status) : r.status === "Posted";
                      if (mod.slug === "returns") return ["Dispatched", "Closed"].includes(r.status);
                      if (mod.slug === "sales-orders" && f.key === "po") return r["buyer"] === form["buyer"] && r.status !== "Rejected";
                      return r.status !== "Rejected" && r.status !== "Inactive";
                    }).map(r => ({ value: ["buyer", "supplier", "transporter"].includes(f.key) ? String(r["name"]) : r.id, label: `${mod.slug === "receipts" && f.key === "dc" ? (data["transport"] ?? []).find((t) => t["ref"] === r.id)?.id ?? r.id : r.id} · ${r["name"] || r["buyer"] || r["supplier"] || r["lot"] || r.status}` })) : (f.options ?? []).map(o => ({ value:o, label:o }))).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {mod.slug === "sales-orders" && f.key === "po" && live["po"] && (() => {
                    const currentPacked = stock(data).filter(s => s.category === "Packed");
                    const poRef = (data["purchase-orders"] ?? []).find(x => x.id === live["po"]);
                    const poLines = poRef ? lines(poRef) : [];
                    const availKg = poLines.reduce((sum, l) => sum + (currentPacked.find(p => p.product.toLowerCase() === l.p.toLowerCase())?.qty || 0), 0);
                    const poTotalKg = poLines.reduce((sum, l) => sum + l.q, 0);
                    return (
                      <div className="mt-2 rounded-xl border border-primary/20 bg-muted/40 p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <Boxes className="size-3.5 text-primary" /> Packed Stock in Dispatch Bay:
                          </span>
                          <span className={cn("font-bold font-mono px-2 py-0.5 rounded text-xs", availKg > 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>
                            {availKg} kg of {poTotalKg} kg ready
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {availKg > 0
                            ? "Packed retail produce is in Dispatch Bay. Saving in Dispatched or Closed status will automatically lessen warehouse inventory."
                            : "⚠️ No packed produce found in Dispatch Bay yet for this order. Pack produce in Allocation & Packing first."}
                        </p>
                      </div>
                    );
                  })()}
                </>
              ) : f.type === "textarea" ? (
                <textarea id={`field-${f.key}`} rows={f.readOnly ? 5 : 3} disabled={f.readOnly} className={input} value={String(live[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <input
                  id={`field-${f.key}`}
                  min={f.type === "number" ? 0 : undefined}
                  className={input}
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  step="any"
                  disabled={f.readOnly || (!priceEditable && (f.money || f.key === "rate" || f.key === "price" || f.key === "amount"))}
                  title={!priceEditable && (f.money || f.key === "rate" || f.key === "price" || f.key === "amount") ? "Prices are entered by back office only" : undefined}
                  value={String(live[f.key] ?? "")}
                  onChange={(e) => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                />
              )}
              {f.key === "signatures" && signaturesMissing && <p id="signatures-error" role="alert" className="text-xs text-destructive">{num(live["signatures"])} of 3 signatures collected. Select 3 once supplier, driver and loader have signed, or keep the purchase in Draft, Loading or Signed status.</p>}
            </div>
          ))}
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Status</span>
            <select aria-label="Status" className={input} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {mod.statuses.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
        {mod.slug === "sales-orders" && (
          <div className="px-5 pb-4">
            <div className="rounded-xl border bg-primary/5 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" /> Warehouse Inventory Impact:
                </span>
                <span className="font-mono text-xs font-semibold text-primary">
                  Packed (Dispatch Bay) ➔ Buyer
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                When status is set to <strong>Dispatched</strong> or <strong>Closed</strong>, the sale quantity ({Number(live["qty"] || 0)} kg) will automatically be deducted from warehouse inventory.
              </p>
            </div>
          </div>
        )}
        {mod.slug === "packing" && <div className="px-5 pb-5"><BagSummary row={live} /></div>}
        {mod.slug === "packing" && <div className="px-5 pb-5 text-xs text-muted-foreground">{stock(data).filter(s => s.category === live["grade"]).map(s => `${s.product}: ${s.qty} kg available`).join(" · ")}</div>}
        <div className="flex justify-end gap-2 border-t bg-muted/40 p-4">
          <Button variant="ghost" type="button" onClick={onClose} className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</Button>
          <Button variant="ghost" type="submit" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><Check className="size-4" /> Save</Button>
        </div>
      </form>
    </div>
  );
}

function DetailPanel({
  mod,
  row,
  onClose,
  onEdit,
  onAdvance,
  onScale,
  onVoucher,
  onDemand,
  onWhatsApp,
  onReturnContainer,
  onReturnChallan,
}: {
  mod: ModuleDef;
  row: Row;
  onClose: () => void;
  onEdit: () => void;
  onAdvance: () => void;
  onScale?: () => void;
  onVoucher?: () => void;
  onDemand?: () => void;
  onWhatsApp?: () => void;
  onReturnContainer?: () => void;
  onReturnChallan?: () => void;
}) {
  const { role } = useStore();
  const idx = mod.statuses.indexOf(row.status);
  const next = mod.statuses[idx + 1];

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-card shadow-card animate-in slide-in-from-right">
        <div className="bg-hero p-6 text-primary-foreground">
          <div className="flex items-start justify-between">
            <p className="font-mono text-sm opacity-80">{row.id}</p>
            <Button variant="ghost" onClick={onClose} aria-label="Close"><X className="size-5" /></Button>
          </div>
          <h2 className="mt-1 text-xl font-semibold">{String(row[mod.fields[0]?.key ?? "id"] ?? mod.title)}</h2>
          <p className="text-sm opacity-80">{mod.title}</p>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflow</p>
            <ol className="space-y-0">
              {mod.statuses.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={cn("grid size-6 place-items-center rounded-full border-2 text-[10px] font-bold", i < idx ? "border-success bg-success text-primary-foreground" : i === idx ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground")}>
                      {i < idx ? <Check className="size-3" /> : i + 1}
                    </span>
                    {i < mod.statuses.length - 1 && <span className={cn("h-5 w-0.5", i < idx ? "bg-success" : "bg-border")} />}
                  </div>
                  <p className={cn("pt-0.5 text-sm", i === idx ? "font-semibold" : "text-muted-foreground")}>{s}</p>
                </li>
              ))}
            </ol>
          </div>
          {mod.slug === "packing" && <BagSummary row={row} />}
          {mod.slug === "supplier-prices" && <SupplierPricesSummary row={row} />}
          {mod.slug === "sales-orders" && (
            <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Boxes className="size-4 text-primary" /> Inventory Stock Impact
                </span>
                {["Dispatched", "Closed"].includes(row.status) ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" /> Deducted from Stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                    <Clock className="size-3.5" /> Held in Dispatch Bay
                  </span>
                )}
              </div>
              <div className="space-y-1 text-muted-foreground text-[11px] border-t pt-2">
                <div className="flex justify-between">
                  <span>Stock Movement:</span>
                  <strong className="text-foreground">Dispatch Bay (Packed) ➔ Buyer ({String(row["buyer"])})</strong>
                </div>
                <div className="flex justify-between">
                  <span>Quantity Deducted:</span>
                  <strong className="font-mono text-foreground font-bold">-{Number(row["qty"] || 0)} kg</strong>
                </div>
                <p className="pt-1 text-[10px] italic">
                  {["Dispatched", "Closed"].includes(row.status)
                    ? "This order has departed the facility. Stock was subtracted from warehouse on-hand inventory."
                    : "Advancing status to Dispatched will automatically lessen warehouse packed stock to Buyer."}
                </p>
              </div>
            </div>
          )}
          <dl className="divide-y rounded-xl border">
            {mod.fields.map((f) => (
              <div key={f.key} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="text-right font-medium">{f.type === "products" ? <div className="flex flex-wrap justify-end gap-1"><ProductChips v={row[f.key]} all /></div> : fmt(f, row[f.key], role)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col gap-2 border-t p-4">
          {mod.slug === "purchase-orders" && (
            <div className="grid grid-cols-2 gap-2 mb-1">
              <Button
                type="button"
                variant="outline"
                onClick={onDemand}
                className="rounded-lg border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-xs font-semibold py-2"
              >
                <Eye className="mr-1.5 size-3.5" /> Demand Breakdown
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onWhatsApp}
                className="rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-semibold py-2"
              >
                <MessageCircle className="mr-1.5 size-3.5" /> WhatsApp PM
              </Button>
            </div>
          )}
          {mod.slug === "receipts" && (
            <div className="grid grid-cols-2 gap-2 mb-1">
              <Button
                type="button"
                variant="outline"
                onClick={onScale}
                className="rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-semibold py-2"
              >
                <Scale className="mr-1.5 size-3.5" /> Bay Scale (F06)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onVoucher}
                className="rounded-lg border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-xs font-semibold py-2"
              >
                <FileText className="mr-1.5 size-3.5" /> GRN Voucher (F07)
              </Button>
            </div>
          )}
          {mod.slug === "containers" && (
            <div className="grid grid-cols-2 gap-2 mb-1">
              <Button
                type="button"
                variant="outline"
                onClick={onReturnContainer}
                className="rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-semibold py-2"
              >
                <RotateCcw className="mr-1.5 size-3.5" /> Return to Supplier
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onReturnChallan}
                className="rounded-lg border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-xs font-semibold py-2"
              >
                <FileText className="mr-1.5 size-3.5" /> Return DC (F09)
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onEdit} className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Edit</Button>
            {next && <Button variant="ghost" onClick={onAdvance} className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Move to “{next}”</Button>}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ProductChips({ v, all }: { v: unknown; all?: boolean }) {
  const lines = parseLines(v);
  if (!lines.length) return <span className="text-muted-foreground">—</span>;
  const shown = all ? lines : lines.slice(0, 2);
  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((l) => (
        <span key={l.p} className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
          {l.p}
          {l.q ? ` · ${l.q} kg` : ""}
          {l.r !== undefined && l.r > 0 ? ` @ ₹${l.r}` : ""}
        </span>
      ))}
      {!all && lines.length > 2 && <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">+{lines.length - 2}</span>}
    </span>
  );
}

function ProductPicker({
  options,
  value,
  onChange,
  grading,
  stage2,
  returnsAvail,
  pricing,
  defaultRate = 0,
  priceEditable = true,
}: {
  options: string[];
  value: unknown;
  onChange: (v: string) => void;
  grading?: boolean;
  stage2?: boolean;
  returnsAvail?: (p: string) => number;
  pricing?: boolean;
  defaultRate?: number;
  priceEditable?: boolean;
}) {
  const { catalog } = useStore();
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const allOptions = useMemo(() => Array.from(new Set([...options, ...catalog.map((c) => c.name)])), [options, catalog]);

  const [filterQuery, setFilterQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedPackSize, setSelectedPackSize] = useState<string>("All");
  const lines = parseLines(value);
  const emit = (ls: Line[]) => onChange(JSON.stringify(ls));
  const toggle = (p: string) => {
    const spec = catalog.find((item) => item.name === p) || PRODUCT_CATALOG.find((item) => item.name === p);
    const defaultPackSizeKg = spec?.packSizeKg && spec.packSizeKg > 0 ? spec.packSizeKg : 1.0;
    const defaultPackLabel = spec?.defaultPackSize ?? (defaultPackSizeKg < 1 ? `${Math.round(defaultPackSizeKg * 1000)} g` : `${defaultPackSizeKg} kg`);
    emit(
      lines.some((l) => l.p === p)
        ? lines.filter((l) => l.p !== p)
        : [...lines, { p, q: defaultPackSizeKg, packKg: defaultPackSizeKg, packLabel: defaultPackLabel, ...(pricing ? { r: defaultRate || 0 } : {}) }]
    );
  };
  const totalQty = lines.reduce((a, l) => a + (Number(l.q) || 0), 0);
  const totalAmount = pricing
    ? lines.reduce((a, l) => a + (Number(l.q) || 0) * (Number(l.r) || 0), 0)
    : 0;
  const weightedAvgRate = totalQty > 0 ? Math.round((totalAmount / totalQty) * 100) / 100 : defaultRate;

  // Calculate total packets across selected products
  const totalPackets = lines.reduce((sum, l) => {
    const spec = catalog.find((item) => item.name === l.p) || PRODUCT_CATALOG.find((item) => item.name === l.p);
    const packKg = l.packKg ?? (spec?.packSizeKg && spec.packSizeKg > 0 ? spec.packSizeKg : 1.0);
    return sum + (Number(l.q) || 0) / packKg;
  }, 0);

  const isAllPiece = lines.length > 0 && lines.every((l) => {
    const spec = catalog.find((item) => item.name === l.p) || PRODUCT_CATALOG.find((item) => item.name === l.p);
    const lbl = l.packLabel || spec?.defaultPackSize || "";
    return lbl.toLowerCase().includes("pc");
  });
  const countUnit = isAllPiece ? "pcs" : "pkts";

  // Derive distinct categories from options matching catalog
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allOptions.forEach((o) => {
      const spec = catalog.find((item) => item.name === o) || PRODUCT_CATALOG.find((item) => item.name === o);
      if (spec?.category) cats.add(spec.category);
    });
    return ["All", ...Array.from(cats)];
  }, [allOptions, catalog]);

  const PACK_SIZES = ["All", "150 g", "250 g", "300 g", "500 g", "750 g", "1 kg", "1 pc"];

  const shownOptions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return allOptions.filter((o) => {
      const spec = catalog.find((item) => item.name === o) || PRODUCT_CATALOG.find((item) => item.name === o);
      const matchesCategory =
        selectedCategory === "All" || spec?.category === selectedCategory;
      const matchesPackSize =
        selectedPackSize === "All" ||
        (spec?.defaultPackSize && spec.defaultPackSize.toLowerCase().includes(selectedPackSize.toLowerCase())) ||
        (selectedPackSize === "300 g" && spec?.defaultPackSize?.includes("300")) ||
        (selectedPackSize === "750 g" && spec?.defaultPackSize?.includes("750"));
      const matchesQuery =
        !q ||
        o.toLowerCase().includes(q) ||
        (spec?.category && spec.category.toLowerCase().includes(q)) ||
        (spec?.defaultPackSize && spec.defaultPackSize.toLowerCase().includes(q));
      return matchesCategory && matchesPackSize && matchesQuery;
    });
  }, [allOptions, catalog, selectedCategory, selectedPackSize, filterQuery]);

  return (
    <div className="space-y-3 rounded-2xl border bg-muted/20 p-3.5">
      {pricing && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-800 dark:text-emerald-300">
          <span className="font-semibold">💡 Individual Product Pricing</span>
          <span>Set distinct ₹/KG rate for each product. Total amount and weighted average rate are calculated per product line.</span>
        </div>
      )}

      {/* Side-by-Side Product Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        
        {/* LEFT PANE: All Products Sidebar / Catalog (5 columns) */}
        <div className="lg:col-span-5 flex flex-col rounded-xl border border-border/80 bg-card p-3 shadow-xs h-[450px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Product Catalog</h4>
              <p className="text-[11px] text-muted-foreground">{allOptions.length} items available</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCatalogPickerOpen(true)}
                className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md inline-flex items-center gap-1 border-primary/30"
              >
                <Plus className="size-2.5" /> Add to Catalog
              </Button>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                {lines.length} added
              </span>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative mt-2.5">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search (Amaranth, 250g, Keerai, Tomato)..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full rounded-lg border bg-background py-1.5 pl-8 pr-7 text-xs outline-none focus:ring-2 focus:ring-primary/20"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery("")}
                className="absolute right-2.5 top-2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Pack Size Quick Filter Chips (250 g, 500 g, 1 kg, etc.) */}
          <div className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none border-b border-border/40">
            <span className="text-[10px] font-semibold text-muted-foreground shrink-0 pr-1">Size:</span>
            {PACK_SIZES.map((sz) => {
              const active = selectedPackSize === sz;
              return (
                <button
                  type="button"
                  key={sz}
                  onClick={() => setSelectedPackSize(sz)}
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                    active
                      ? "bg-[#f59e0b] text-slate-950 font-bold shadow-xs"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {sz}
                </button>
              );
            })}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                    active
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Scrollable Product Items List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 pt-1 scrollbar-thin">
            {shownOptions.map((o) => {
              const isSelected = lines.some((l) => l.p === o);
              const spec = PRODUCT_CATALOG.find((item) => item.name === o);
              const packSizeLabel = spec?.defaultPackSize ?? "1 kg";
              const packSizeKg = spec?.packSizeKg ?? 1.0;
              return (
                <div
                  key={o}
                  onClick={() => toggle(o)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-2 text-xs transition-all cursor-pointer group",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-border/60 bg-background/60 hover:border-primary/50 hover:bg-muted/40 text-foreground"
                  )}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-semibold text-xs leading-snug truncate">{o}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                      {spec?.category && (
                        <span className="rounded bg-muted px-1.5 py-0.2 font-medium text-muted-foreground">{spec.category}</span>
                      )}
                      <span className="rounded bg-primary/10 px-1.5 py-0.2 font-semibold text-primary">
                        · {packSizeLabel.toLowerCase().includes("pc") ? packSizeLabel : `${packSizeLabel} (${packSizeKg} kg)`}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-xs">
                        <Check className="size-3" /> Added
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground group-hover:border-primary group-hover:text-primary transition-colors">
                        <Plus className="size-3" /> Add
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {!shownOptions.length && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No products match "{filterQuery}".
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Selected Products Table & Quantities (7 columns) */}
        <div className="lg:col-span-7 flex flex-col rounded-xl border border-border/80 bg-card p-3 shadow-xs h-[450px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Selected Products</h4>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {lines.length} {lines.length === 1 ? "item" : "items"}
              </span>
            </div>
            {lines.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground tabular-nums">
                  {Math.round(totalPackets * 10) / 10} {countUnit} · {totalQty.toLocaleString("en-IN")} kg
                </span>
                <button
                  type="button"
                  onClick={() => emit([])}
                  className="text-[10px] text-destructive hover:underline font-medium cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Table or Empty State */}
          {lines.length > 0 ? (
            <div className="flex-1 overflow-y-auto overflow-x-auto rounded-lg border border-border/60 bg-background/50 mt-2 scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-xs text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2.5 py-2">#</th>
                    <th className="px-2.5 py-2 min-w-[200px]">Product & Pack Spec</th>
                    <th className="px-2.5 py-2 text-right">Packets / Count</th>
                    <th className="px-2.5 py-2 text-right">{grading ? "Input KG" : "Total KG"}</th>
                    {pricing && (
                      <>
                        <th className="px-2.5 py-2 text-right">Rate · ₹/KG</th>
                        <th className="px-2.5 py-2 text-right">Amount · ₹</th>
                      </>
                    )}
                    {grading && (
                      <>
                        <th className="px-2.5 py-2">First A</th>
                        <th className="px-2.5 py-2">Remaining</th>
                        {stage2 && (
                          <>
                            <th className="px-2.5 py-2">+ Returns KG</th>
                            <th className="px-2.5 py-2">Second A</th>
                            <th className="px-2.5 py-2">Grade B</th>
                            <th className="px-2.5 py-2">Rejected</th>
                          </>
                        )}
                      </>
                    )}
                    <th className="w-8 px-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {lines.map((l, i) => {
                    const lineAmt = (Number(l.q) || 0) * (Number(l.r) || 0);
                    const spec = PRODUCT_CATALOG.find((item) => item.name === l.p);
                    const packKg = l.packKg ?? (spec?.packSizeKg && spec.packSizeKg > 0 ? spec.packSizeKg : 1.0);
                    const packLabel = l.packLabel ?? (spec?.defaultPackSize ?? (packKg < 1 ? `${Math.round(packKg * 1000)} g` : `${packKg} kg`));
                    const isPcs = packLabel.includes("pc");
                    const currentPkts = l.q > 0 ? Math.round((Number(l.q) / packKg) * 100) / 100 : "";
                    const packOptions = getPackSpecOptions(spec, l.packKg, l.packLabel);

                    const onPackSpecChange = (newKg: number) => {
                      const chosen = packOptions.find((opt) => Math.abs(opt.kg - newKg) < 0.001);
                      const newLabel = chosen?.label ?? (newKg < 1 ? `${Math.round(newKg * 1000)} g` : `${newKg} kg`);
                      const pktsCount = currentPkts !== "" && Number(currentPkts) > 0 ? Number(currentPkts) : 1;
                      const updatedKg = Math.round(pktsCount * newKg * 1000) / 1000;
                      emit(
                        lines.map((x) =>
                          x.p === l.p
                            ? {
                                ...x,
                                q: updatedKg,
                                packKg: newKg,
                                packLabel: newLabel,
                              }
                            : x
                        )
                      );
                    };

                    return (
                      <tr key={l.p} className="hover:bg-muted/30 transition-colors">
                        <td className="px-2.5 py-2 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-2.5 py-2">
                          <span className="font-semibold text-xs text-foreground block">{l.p}</span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                            {spec?.category && (
                              <span className="text-muted-foreground shrink-0">{spec.category} ·</span>
                            )}
                            <div className="relative inline-flex items-center">
                              <select
                                aria-label={`${l.p} pack specification`}
                                value={packKg}
                                onChange={(e) => onPackSpecChange(Number(e.target.value))}
                                className="appearance-none rounded-md border border-primary/40 bg-primary/10 pl-2 pr-6 py-0.5 text-[10px] font-bold text-primary cursor-pointer hover:bg-primary/20 hover:border-primary/60 transition-colors focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs whitespace-nowrap"
                              >
                                {packOptions.map((opt) => (
                                  <option
                                    key={`${opt.label}-${opt.kg}`}
                                    value={opt.kg}
                                    className="bg-card text-foreground font-medium text-xs py-1"
                                  >
                                    {opt.label.toLowerCase().includes("pc") ? opt.label : `${opt.label} (${formatKgSpec(opt.kg)})`}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-primary opacity-70" />
                            </div>
                          </div>
                        </td>

                        {/* Packets / Count Input (Automatically calculates KG based on 250g / pack size) */}
                        <td className="px-2.5 py-2 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <input
                              aria-label={`${l.p} packets count`}
                              min="0"
                              type="number"
                              step="any"
                              value={currentPkts}
                              placeholder="0"
                              onChange={(e) => {
                                const count = e.target.value === "" ? 0 : Number(e.target.value);
                                const newKg = Math.round(count * packKg * 1000) / 1000;
                                emit(lines.map((x) => (x.p === l.p ? { ...x, q: newKg } : x)));
                              }}
                              className="w-16 rounded-lg border bg-background px-2 py-1 text-right text-xs font-semibold tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                            />
                            <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                              {isPcs ? "pcs" : "pkts"}
                            </span>
                          </div>
                        </td>

                        {/* Total KG Input (Direct KG input, automatically reflects in packets count) */}
                        <td className="px-2.5 py-2 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <input
                              aria-label={`${l.p} quantity KG`}
                              min="0"
                              type="number"
                              step="any"
                              value={l.q || ""}
                              placeholder="0"
                              onChange={(e) => {
                                const val = e.target.value === "" ? 0 : Number(e.target.value);
                                emit(lines.map((x) => (x.p === l.p ? { ...x, q: val } : x)));
                              }}
                              className="w-20 rounded-lg border bg-background px-2 py-1 text-right text-xs font-semibold tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                            />
                            <span className="text-[10px] text-muted-foreground font-medium shrink-0">kg</span>
                          </div>
                        </td>

                        {pricing && (
                          <>
                            <td className="px-2.5 py-2 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                <span className="text-xs text-muted-foreground">₹</span>
                                <input
                                  aria-label={`${l.p} rate per KG`}
                                  min="0"
                                  type="number"
                                  step="any"
                                  disabled={!priceEditable}
                                  title={!priceEditable ? "Rate is entered by back office only" : undefined}
                                  value={l.r !== undefined && l.r !== null ? l.r : ""}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                                    emit(lines.map((x) => (x.p === l.p ? { ...x, r: val } : x)));
                                  }}
                                  className="w-20 rounded-lg border bg-background px-2 py-1 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400 outline-none focus:border-primary disabled:bg-muted disabled:text-muted-foreground"
                                />
                              </div>
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                              ₹{Math.round(lineAmt).toLocaleString("en-IN")}
                            </td>
                          </>
                        )}
                        {grading && (
                          <>
                            <td className="p-2">
                              <input
                                aria-label={`${l.p} first Grade A KG`}
                                min="0"
                                type="number"
                                className="w-18 rounded-md border bg-background px-2 py-1 text-xs"
                                value={l.a || ""}
                                onChange={(e) =>
                                  emit(lines.map((x) => (x.p === l.p ? { ...x, a: Number(e.target.value) } : x)))
                                }
                              />
                            </td>
                            <td className="p-2 tabular-nums text-xs">{Math.max(0, l.q - num(l.a))}</td>
                            {stage2 && (
                              <td className="p-2">
                                <input
                                  aria-label={`${l.p} returned KG added`}
                                  min="0"
                                  type="number"
                                  className="w-18 rounded-md border bg-background px-2 py-1 text-xs"
                                  value={l.ret || ""}
                                  placeholder={String(returnsAvail?.(l.p) ?? 0)}
                                  onChange={(e) =>
                                    emit(lines.map((x) => (x.p === l.p ? { ...x, ret: Number(e.target.value) } : x)))
                                  }
                                />
                              </td>
                            )}
                            {stage2 && (
                              <>
                                {(["a2", "b"] as const).map((k) => (
                                  <td key={k} className="p-2">
                                    <input
                                      aria-label={`${l.p} ${k === "a2" ? "second Grade A" : "Grade B"} KG`}
                                      min="0"
                                      type="number"
                                      className="w-18 rounded-md border bg-background px-2 py-1 text-xs"
                                      value={l[k] || ""}
                                      onChange={(e) =>
                                        emit(lines.map((x) => (x.p === l.p ? { ...x, [k]: Number(e.target.value) } : x)))
                                      }
                                    />
                                  </td>
                                ))}
                                <td className="p-2 tabular-nums text-xs">
                                  {Math.max(0, l.q - num(l.a) + num(l.ret) - num(l.a2) - num(l.b))}
                                </td>
                              </>
                            )}
                          </>
                        )}
                        <td className="px-2 text-right">
                          <button
                            type="button"
                            onClick={() => toggle(l.p)}
                            aria-label={`Remove ${l.p}`}
                            className="rounded-md p-1 text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                          >
                            <X className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-muted/90 backdrop-blur-xs border-t text-xs font-semibold">
                  <tr>
                    <td className="px-2.5 py-2" colSpan={2}>
                      {lines.length} {lines.length === 1 ? "product" : "products"}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground font-medium">
                      {Math.round(totalPackets * 10) / 10} {countUnit}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-foreground">
                      {totalQty.toLocaleString("en-IN")} kg
                    </td>
                    {pricing && (
                      <>
                        <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground">
                          Avg ₹{weightedAvgRate.toLocaleString("en-IN", { maximumFractionDigits: 2 })}/kg
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono text-sm font-bold tabular-nums text-primary">
                          ₹{Math.round(totalAmount).toLocaleString("en-IN")}
                        </td>
                      </>
                    )}
                    {grading && <td colSpan={stage2 ? 6 : 2} />}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center p-6 border border-dashed rounded-xl border-border/70 bg-muted/15 mt-2">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2.5">
                <Package className="size-6 stroke-[1.8]" />
              </div>
              <p className="font-semibold text-xs text-foreground">No Products Selected</p>
              <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                Click products from the catalog on the left to add items and enter packets or kilograms.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const staples = ["Tomato", "Onion", "Potato"];
                    const toAdd = staples.filter((s) => !lines.some((l) => l.p === s));
                    emit([
                      ...lines,
                      ...toAdd.map((p) => {
                        const spec = PRODUCT_CATALOG.find((item) => item.name === p);
                        const defaultKg = spec?.packSizeKg || 1;
                        const defaultLabel = spec?.defaultPackSize ?? `${defaultKg} kg`;
                        return { p, q: defaultKg, packKg: defaultKg, packLabel: defaultLabel, ...(pricing ? { r: defaultRate || 0 } : {}) };
                      }),
                    ]);
                  }}
                  className="text-[11px] h-7 gap-1 rounded-lg border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <Plus className="size-3" /> Quick Add Common (Tomato, Onion, Potato)
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {catalogPickerOpen && (
        <ProductCatalogModal
          isOpen={catalogPickerOpen}
          onClose={() => setCatalogPickerOpen(false)}
        />
      )}
    </div>
  );
}

function SupplierPricesSummary({ row }: { row: Row }) {
  const ls = parseLines(row["item"]);
  if (!ls.length) return null;
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Individual Product Pricing Breakdown
      </p>
      <div className="overflow-hidden rounded-lg border bg-card text-xs">
        <table className="w-full">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2.5 py-1.5 text-left font-medium">Product</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Qty (kg)</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Rate / kg</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ls.map((l) => {
              const r = l.r ?? num(row["rate"]);
              const amt = l.q * r;
              return (
                <tr key={l.p}>
                  <td className="px-2.5 py-1.5 font-medium">
                    <span>{l.p}</span>
                    {l.packLabel && (
                      <span className="ml-1.5 inline-block text-[10px] font-normal text-muted-foreground">
                        ({l.packLabel})
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{l.q}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">₹{r}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono tabular-nums font-semibold">
                    ₹{Math.round(amt).toLocaleString("en-IN")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/40 font-semibold">
            <tr>
              <td className="px-2.5 py-1.5">{ls.length} products</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums">{num(row["qty"])} kg</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">Avg ₹{num(row["rate"])}</td>
              <td className="px-2.5 py-1.5 text-right font-mono text-primary tabular-nums">
                ₹{Math.round(num(row["amount"])).toLocaleString("en-IN")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function BagSummary({ row }: { row: Row }) {
 return <div className="space-y-2 border-t pt-3">{lines(row).map(l => { const b=bagBreakdown(l.q,num(row["packSize"])); return <p key={l.p} className="text-sm"><strong>{l.p}</strong> · {b.full} full bags{b.partial > 0 ? ` + ${b.partial} kg partial bag · ${b.opened} opened bag` : ""} · {l.q} kg actual</p>; })}</div>;
}

function BuysEditor({ products, suppliers, value, onChange, need, priceEditable = true }: { products: string[]; suppliers: string[]; value: unknown; onChange: (v: string) => void; need: Record<string, { demand: number; buy: number }>; priceEditable?: boolean }) {
  const buys = parseBuys(value);
  const emit = (b: typeof buys) => onChange(JSON.stringify(b));
  const patch = (i: number, p: Partial<(typeof buys)[number]>) => emit(buys.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const cell = "w-full rounded-md border bg-background px-2 py-1 text-sm";
  const planned = (p: string, skip = -1) => buys.reduce((a, b, j) => a + (j !== skip && b.p === p ? Number(b.q || 0) : 0), 0);
  const left = (p: string, skip = -1) => Math.max(0, Math.round(((need[p]?.buy ?? 0) - planned(p, skip)) * 100) / 100);
  const needed = Object.entries(need);
  const kgTotal = Math.round(buys.reduce((a, b) => a + Number(b.q || 0), 0) * 100) / 100;
  const containerTotal = buys.reduce((a, b) => a + (b.cc || 0), 0);
  const CONTAINER_TYPES = ["Plastic crates", "Wooden boxes", "Gunny bags", "Carton boxes"];
  const amount = buys.reduce((a, b) => a + b.q * b.r, 0);
  const avgRate = kgTotal > 0 ? Math.round((amount / kgTotal) * 100) / 100 : 0;
  const commonSupplier = buys.length > 0 && buys.every((b) => b.s === buys[0].s && b.s) ? buys[0].s : (buys.find(b => b.s)?.s || suppliers[0] || "");

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
      {!suppliers.length && <p className="text-xs text-destructive">Add suppliers in the Suppliers module first.</p>}

      {/* Common Supplier Selector */}
      {suppliers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border bg-card p-2.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Common Supplier:</span>
            <select
              aria-label="Common Supplier"
              className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
              value={commonSupplier}
              onChange={(e) => {
                const s = e.target.value;
                emit(buys.map((b) => ({ ...b, s })));
              }}
            >
              <option value="">Select Common Supplier</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              (Sets supplier for all purchase lines)
            </span>
          </div>
          {commonSupplier && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => emit(buys.map((b) => ({ ...b, s: commonSupplier })))}
              className="h-7 text-[11px] px-2 text-primary hover:bg-primary/10"
            >
              Apply to all lines
            </Button>
          )}
        </div>
      )}

      {buys.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Supplier</th>
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2">KG</th>
                <th className="px-2 py-2">Price / KG</th>
                <th className="px-2 py-2">Container</th>
                <th className="px-2 py-2">Container Qty</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {buys.map((b, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1.5">
                    <select
                      aria-label="Supplier"
                      className={cell}
                      value={b.s || commonSupplier}
                      onChange={(e) => patch(i, { s: e.target.value })}
                    >
                      <option value="">Select</option>
                      {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <select
                      aria-label="Product"
                      className={cell}
                      value={b.p}
                      onChange={(e) => patch(i, { p: e.target.value, ...(b.q ? {} : { q: left(e.target.value, i) }) })}
                    >
                      <option value="">Select</option>
                      {products.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {b.p && need[b.p] && <p className="mt-0.5 text-[10px] text-muted-foreground">Demand {need[b.p]!.demand} kg</p>}
                  </td>
                  <td className="p-1.5">
                    <input
                      aria-label="KG"
                      type="number"
                      min="0"
                      step="any"
                      className={cn(cell, "w-20")}
                      value={b.q || ""}
                      onChange={(e) => patch(i, { q: Number(e.target.value) })}
                      placeholder="0"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      aria-label="Price per KG"
                      type="number"
                      min="0"
                      step="any"
                      disabled={!priceEditable}
                      title={!priceEditable ? "Purchase price entered by back office only" : undefined}
                      className={cn(cell, "w-20 disabled:bg-muted disabled:text-muted-foreground")}
                      value={b.r || ""}
                      onChange={(e) => patch(i, { r: Number(e.target.value) })}
                      placeholder="0"
                    />
                  </td>
                  <td className="p-1.5">
                    <select
                      aria-label="Container type"
                      className={cell}
                      value={b.ct || ""}
                      onChange={(e) => patch(i, { ct: e.target.value })}
                    >
                      <option value="">Select</option>
                      {CONTAINER_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <input
                      aria-label="Container Qty"
                      type="number"
                      min="0"
                      step="1"
                      className={cn(cell, "w-20")}
                      value={b.cc || ""}
                      onChange={(e) => patch(i, { cc: Number(e.target.value) })}
                      placeholder="0"
                    />
                  </td>
                  <td className="p-1.5 text-right tabular-nums">{fmtMoney(b.q * b.r)}</td>
                  <td className="p-1.5 text-right">
                    <Button
                      variant="ghost"
                      type="button"
                      aria-label="Remove line"
                      onClick={() => emit(buys.filter((_, j) => j !== i))}
                      className="rounded p-1 text-destructive hover:bg-danger-soft"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 text-xs font-semibold">
                <td className="px-2 py-2" colSpan={2}>{buys.length} lines</td>
                <td className="px-2 py-2 tabular-nums">{kgTotal.toLocaleString("en-IN")}</td>
                <td className="px-2 py-2 tabular-nums font-semibold text-primary">{avgRate > 0 ? fmtMoney(avgRate) : "—"}</td>
                <td />
                <td className="px-2 py-2 tabular-nums">{containerTotal.toLocaleString("en-IN")}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(amount)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <Button
        variant="ghost"
        type="button"
        onClick={() => emit([...buys, { s: commonSupplier || suppliers[0] || "", p: "", q: 0, r: 0 }])}
        className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
      >
        <Plus className="size-3" /> Add purchase line
      </Button>
    </div>
  );
}
