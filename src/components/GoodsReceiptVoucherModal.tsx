import { useState } from "react";
import { FileText, Printer, Check, X, Scale, Truck, UserCheck, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { type Row } from "@/lib/modules";
import { parseLines, num } from "@/lib/workflow";
import { Link } from "@tanstack/react-router";

interface GoodsReceiptVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: Row;
  trip?: Row;
  onProceedToQc?: () => void;
}

export function GoodsReceiptVoucherModal({
  isOpen,
  onClose,
  receipt,
  trip,
  onProceedToQc,
}: GoodsReceiptVoucherModalProps) {
  const [isSigned, setIsSigned] = useState<boolean>(true);

  if (!isOpen || !receipt) return null;

  const grnNo = receipt.id;
  const dcNo = String(receipt["dc"] || "TRP-1001");
  const date = String(receipt["date"] || new Date().toISOString().split("T")[0]);
  const supervisor = String(receipt["person"] || receipt["responsible"] || "Ravi Kumar");
  const warehouse = String(receipt["warehouse"] || trip?.["warehouse"] || "Main Warehouse (Koyambedu)");
  const transporter = String(trip?.["transporter"] || "Chennai Fresh Logistics");
  const vehicle = String(trip?.["vehicle"] || "TN 09 AB 1234");
  const driver = String(trip?.["driver"] || "Raja");

  const sentKg = num(receipt["sent"]);
  const receivedKg = num(receipt["received"]);
  const diffKg = num(receipt["diff"]);
  const reason = String(receipt["reason"] || "—");
  const variancePct = sentKg > 0 ? Math.round(((receivedKg - sentKg) / sentKg) * 1000) / 10 : 0;
  const isLoss = diffKg < 0;

  const items = parseLines(receipt["item"]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl border animate-in zoom-in-95">
        
        {/* Header bar */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Goods Receipt Note (GRN)</h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  F06 · F07 Process Verified
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Warehouse Receiving Bay Weigh-in Voucher · Velaan Bay Trading House</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs">
              <Printer className="mr-1 size-3.5" /> Print
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="size-8">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Voucher Meta Info */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-muted/50 p-3 text-xs border">
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Receipt No</span>
            <span className="font-mono font-bold text-foreground text-sm">{grnNo}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Transport DC</span>
            <span className="font-mono font-semibold text-primary">{dcNo}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Arrival Date</span>
            <span className="font-medium text-foreground">{date}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Receiving Warehouse</span>
            <span className="font-semibold text-foreground truncate block" title={warehouse}>{warehouse}</span>
          </div>
        </div>

        {/* Transport & Driver Details */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/30 px-3.5 py-2 text-xs border text-muted-foreground">
          <div className="flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            <span>Transporter: <strong className="text-foreground">{transporter}</strong></span>
          </div>
          <div>
            <span>Vehicle: <strong className="font-mono text-foreground">{vehicle}</strong> · Driver: <strong className="text-foreground">{driver}</strong></span>
          </div>
        </div>

        {/* Weight Reconciliation Summary KPIs */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card p-3 shadow-xs">
            <div className="text-[11px] font-medium text-muted-foreground">Origin Sent (Purchased)</div>
            <div className="mt-1 font-mono text-2xl font-bold text-foreground">{sentKg.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">kg</span></div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Recorded on Transport DC</div>
          </div>
          <div className="rounded-xl border bg-card p-3 shadow-xs border-emerald-500/30 bg-emerald-500/5">
            <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <Scale className="size-3.5 text-emerald-600" /> Bay Net Weighed
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400">{receivedKg.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">kg</span></div>
            <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">Essae DS-215 Calibrated Scale</div>
          </div>
          <div className="rounded-xl border bg-card p-3 shadow-xs">
            <div className="text-[11px] font-medium text-muted-foreground">Transit Difference</div>
            <div className={`mt-1 font-mono text-2xl font-bold ${isLoss ? "text-amber-600 dark:text-amber-400" : diffKg > 0 ? "text-emerald-600" : "text-foreground"}`}>
              {diffKg > 0 ? `+${diffKg}` : diffKg} <span className="text-xs font-normal text-muted-foreground">kg</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
              {diffKg === 0 ? "Zero variance" : `${variancePct}% (${reason})`}
            </div>
          </div>
        </div>

        {/* Product Breakdown Table */}
        <div className="mt-4 overflow-hidden rounded-xl border">
          <div className="bg-muted/70 px-4 py-2 text-xs font-semibold text-foreground border-b flex justify-between items-center">
            <span>Product-Level Bay Weigh-in Breakdown</span>
            <span className="text-[11px] font-normal text-muted-foreground">Proportional Weight Distribution (F06)</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium text-right">Received KG</th>
                <th className="px-4 py-2 font-medium text-center">Difference Reason</th>
                <th className="px-4 py-2 font-medium text-right">Bay Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it, idx) => (
                <tr key={idx} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium text-foreground flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    {it.p}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground">
                    {it.q.toFixed(2)} kg
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {reason}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <ShieldCheck className="size-3.5" /> Ungraded Stock Posted
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signatures & Controls (F07 / F08) */}
        <div className="mt-4 grid grid-cols-2 gap-3 border rounded-xl p-3 text-xs bg-muted/10">
          <div className="flex items-start gap-2.5">
            <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
              <UserCheck className="size-4" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block uppercase font-medium">Receiving Supervisor</span>
              <span className="font-semibold text-foreground">{supervisor}</span>
              <span className="text-[10px] text-emerald-600 block flex items-center gap-1 mt-0.5">
                <Check className="size-3" /> Digitally Verified & Signed
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="size-8 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
              <Scale className="size-4" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block uppercase font-medium">Weighing Hardware</span>
              <span className="font-semibold text-foreground">Essae DS-215 (BLE Verified)</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">Tare: 0.00 kg · Calibrated</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-5 flex items-center justify-between border-t pt-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              asChild
              size="sm"
              className="bg-primary text-primary-foreground text-xs"
              onClick={onClose}
            >
              <Link to="/m/$module" params={{ module: "quality-check" }}>
                Proceed to Quality Check (F09) <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
