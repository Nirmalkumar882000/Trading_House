import { X, MessageCircle, FileText, CheckCircle2, Package, Calendar, User } from "lucide-react";
import { Button } from "./ui/button";
import { type Row, PRODUCT_CATALOG } from "@/lib/modules";
import { parseLines } from "@/lib/workflow";
import { StatusBadge } from "./StatusBadge";

interface BuyerDemandModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: Row | null;
}

export function BuyerDemandModal({ isOpen, onClose, row }: BuyerDemandModalProps) {
  if (!isOpen || !row) return null;

  const lines = parseLines(row["item"]);
  const extraKg = Number(row["extraKg"]) || 0;
  const buyerName = String(row["buyer"] || "Direct Buyer");
  const poDate = String(row["date"] || "—");
  const deliveryDate = String(row["deliveryDate"] || "—");
  const baseQty = lines.reduce((s, l) => s + (Number(l.q) || 0), 0);
  const totalQty = Number(row["qty"]) || (baseQty + extraKg);

  // Calculate packet breakdown based on product catalog
  const breakdown = lines.map((l) => {
    const spec = PRODUCT_CATALOG.find((item) => item.name.toLowerCase() === l.p.toLowerCase()) ||
                 PRODUCT_CATALOG.find((item) => item.name.toLowerCase().includes(l.p.toLowerCase())) ||
                 { defaultPackSize: "1 kg", packSizeKg: 1.0, category: "Vegetables" };

    const packSizeKg = l.packKg ?? (spec.packSizeKg > 0 ? spec.packSizeKg : 1.0);
    const packSize = l.packLabel ?? spec.defaultPackSize;
    const packetCount = Math.ceil(l.q / packSizeKg);

    return {
      product: l.p,
      packSize,
      packSizeKg,
      packetCount,
      qtyKg: l.q,
      category: spec.category || "General",
    };
  });

  const totalPackets = breakdown.reduce((sum, item) => sum + item.packetCount, 0);

  // WhatsApp share link to Purchase Manager
  const handleWhatsAppShare = () => {
    const productSummary = breakdown
      .map((b) => `• *${b.product}*: ${b.packetCount} packets (${b.packSize}) = ${b.qtyKg} kg`)
      .join("\n");
    const extraSummary = extraKg > 0 ? `\n• *Extra Buyer Buffer Margin*: +${extraKg} kg (Base: ${baseQty} kg)` : "";

    const message = `*Velaan Portal - Buyer Purchase Order Demand*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*PO Number:* ${row.id}\n` +
      `*Buyer:* ${buyerName}\n` +
      `*PO Date:* ${poDate}\n` +
      `*Delivery Date:* ${deliveryDate}\n` +
      `*Status:* ${row.status}\n\n` +
      `*Demand in Packets & Count:*\n${productSummary}${extraSummary}\n\n` +
      `*Total Demand:* ${totalQty.toLocaleString("en-IN")} kg (${totalPackets.toLocaleString("en-IN")} pkts)\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Purchase Manager, please arrange market procurement and truck loading for this demand._`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-foreground/30 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl border animate-in zoom-in-95">
        <div className="flex items-start justify-between border-b pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                {row.id}
              </span>
              <StatusBadge status={row.status} statuses={["Received", "Accepted", "Converted", "Rejected"]} />
            </div>
            <h2 className="text-xl font-bold text-foreground">Buyer Demand Breakdown</h2>
            <p className="text-xs text-muted-foreground">Demand in Packets, Count, Product Name, Buyer Name & Date</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="size-4" />
          </Button>
        </div>

        {/* PO Highlights Banner */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-muted/40 p-3.5 border text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1">
              <User className="size-3" /> Buyer Name
            </span>
            <span className="font-semibold text-foreground text-sm mt-0.5 block">{buyerName}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1">
              <Calendar className="size-3" /> PO Date
            </span>
            <span className="font-semibold text-foreground text-sm mt-0.5 block">{poDate}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1">
              <Package className="size-3" /> Total Demand
            </span>
            <span className="font-semibold text-primary text-sm mt-0.5 block">
              {totalQty.toLocaleString("en-IN")} kg
              {extraKg > 0 && <span className="text-[11px] font-normal text-muted-foreground ml-1">(incl. +{extraKg} kg buffer)</span>}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1">
              <CheckCircle2 className="size-3" /> Packet Count
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 block">
              {totalPackets.toLocaleString("en-IN")} pkts
            </span>
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="mt-5 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Product Packet Breakdown
          </h3>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-3.5 py-2.5 text-left">Product Name</th>
                  <th className="px-3.5 py-2.5 text-left">Demand in Packet</th>
                  <th className="px-3.5 py-2.5 text-right">Pack Count</th>
                  <th className="px-3.5 py-2.5 text-right">Demand (KG)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {breakdown.map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="px-3.5 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-primary" />
                        <span>{item.product}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-muted-foreground">
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                        {item.packSize}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono font-semibold tabular-nums text-foreground">
                      {item.packetCount.toLocaleString("en-IN")} pkts
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono tabular-nums font-medium text-foreground">
                      {item.qtyKg.toLocaleString("en-IN")} kg
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-semibold text-xs border-t">
                {extraKg > 0 && (
                  <tr className="bg-amber-500/10 text-amber-900 dark:text-amber-200 border-t">
                    <td className="px-3.5 py-2 font-medium" colSpan={2}>
                      ➕ Extra Buyer Buffer / Margin
                    </td>
                    <td className="px-3.5 py-2 text-right font-mono text-muted-foreground">—</td>
                    <td className="px-3.5 py-2 text-right font-mono font-semibold text-amber-700 dark:text-amber-400">
                      +{extraKg.toLocaleString("en-IN")} kg
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="px-3.5 py-2.5" colSpan={2}>
                    Total Demand ({breakdown.length} products{extraKg > 0 ? ` + ${extraKg} kg extra` : ""})
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                    {totalPackets.toLocaleString("en-IN")} pkts
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-primary font-bold">
                    {totalQty.toLocaleString("en-IN")} kg
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* WhatsApp & Footer Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleWhatsAppShare}
            className="inline-flex items-center gap-2 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 font-semibold"
          >
            <MessageCircle className="size-4" /> Share with Purchase Manager (WhatsApp)
          </Button>

          <Button type="button" onClick={onClose} variant="ghost" className="border">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
