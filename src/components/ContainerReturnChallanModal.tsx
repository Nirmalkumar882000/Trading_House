import { useState } from "react";
import { FileText, Printer, Check, X, Shield, Truck, UserCheck, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { type Row } from "@/lib/modules";
import { num } from "@/lib/workflow";

interface ContainerReturnChallanModalProps {
  isOpen: boolean;
  onClose: () => void;
  container: Row;
}

export function ContainerReturnChallanModal({
  isOpen,
  onClose,
  container,
}: ContainerReturnChallanModalProps) {
  const [sig1, setSig1] = useState<boolean>(true);
  const [sig2, setSig2] = useState<boolean>(true);
  const [sig3, setSig3] = useState<boolean>(false);

  if (!isOpen || !container) return null;

  const challanNo = String(container["returnDc"] || `RDC-${container.id}`);
  const date = String(container["returnDate"] || container["date"] || new Date().toISOString().slice(0, 10));
  const supplier = String(container["party"] || "Supplier");
  const containerType = String(container["type"] || "Plastic crates");
  const totalReceived = num(container["out"]) || num(container["received"]) || 0;
  const returnedCount = num(container["back"]) || num(container["returned"]) || totalReceived;
  const shortCount = num(container["short"]) || 0;
  const balanceCount = num(container["balance"]) || 0;
  const vehicle = String(container["returnVehicle"] || container["vehicle"] || "TN 09 AB 1234");
  const driver = String(container["returnDriver"] || container["driver"] || "Raja");
  const receipt = String(container["receipt"] || container["receiptRef"] || "—");
  const tripDc = String(container["dc"] || "—");
  const remarks = String(container["remarks"] || "Empty crates returned in good condition");
  const supervisor = String(container["responsible"] || "Ravi Kumar");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl border animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Empty Container Return Delivery Challan
                </h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  F09 Return DC
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Returnable Crates & Boxes Outward Voucher · Velaan Bay Trading House
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs inline-flex items-center gap-1"
            >
              <Printer className="size-3.5" /> Print
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="size-8">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Challan Meta Details */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-muted/50 p-3 text-xs border">
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">
              Challan No
            </span>
            <span className="font-mono font-bold text-foreground text-sm">
              {challanNo}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">
              Supplier (Consignee)
            </span>
            <span className="font-semibold text-primary">{supplier}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">
              Return Date
            </span>
            <span className="font-medium text-foreground">{date}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">
              Container ID
            </span>
            <span className="font-mono font-semibold text-foreground">
              {container.id}
            </span>
          </div>
        </div>

        {/* Source References */}
        <div className="mt-3 flex flex-wrap items-center justify-between rounded-lg bg-background p-3 text-xs border gap-2">
          <div>
            <span className="text-muted-foreground">Source Warehouse Receipt: </span>
            <span className="font-mono font-bold text-foreground">{receipt}</span>
            {tripDc !== "—" && (
              <>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-muted-foreground">Purchase Trip DC: </span>
                <span className="font-mono font-bold text-foreground">{tripDc}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Truck className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">{vehicle}</span>
            <span className="text-muted-foreground">· Driver: {driver}</span>
          </div>
        </div>

        {/* Table of Returnable Containers */}
        <div className="mt-4 overflow-hidden rounded-xl border">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-muted-foreground uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Item Description</th>
                <th className="px-3 py-2 text-right">Received Count</th>
                <th className="px-3 py-2 text-right">Returned Count</th>
                <th className="px-3 py-2 text-right">Damaged / Short</th>
                <th className="px-3 py-2 text-right">Remaining Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="hover:bg-muted/20">
                <td className="px-3 py-2.5 font-medium">
                  {containerType} (Returnable Empty Containers)
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                  {totalReceived}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {returnedCount}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-amber-600 dark:text-amber-400">
                  {shortCount}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground">
                  {balanceCount}
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-muted/40 font-semibold border-t">
              <tr>
                <td className="px-3 py-2 text-left">Total Crates Dispatched</td>
                <td className="px-3 py-2 text-right">{totalReceived}</td>
                <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">
                  {returnedCount}
                </td>
                <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">
                  {shortCount}
                </td>
                <td className="px-3 py-2 text-right">{balanceCount}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remarks */}
        {remarks && (
          <div className="mt-3 rounded-lg border bg-muted/20 p-2.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Remarks: </span>
            {remarks}
          </div>
        )}

        {/* 3-Party Signatures / Verification */}
        <div className="mt-5 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Signatures & Chain of Custody
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Warehouse Despatch */}
            <div
              onClick={() => setSig1(!sig1)}
              className={`cursor-pointer rounded-xl border p-3 text-center transition-all ${
                sig1
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : "border-dashed text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <div className="mx-auto mb-1 flex size-7 items-center justify-center rounded-full bg-emerald-500/10">
                {sig1 ? <CheckCircle2 className="size-4" /> : <UserCheck className="size-4" />}
              </div>
              <p className="text-[11px] font-bold">1. Warehouse Dispatch</p>
              <p className="text-[10px] mt-0.5 opacity-80">{supervisor}</p>
              <span className="text-[9px] block mt-1 font-mono uppercase">
                {sig1 ? "Verified ✓" : "Click to sign"}
              </span>
            </div>

            {/* 2. Transport Carrier */}
            <div
              onClick={() => setSig2(!sig2)}
              className={`cursor-pointer rounded-xl border p-3 text-center transition-all ${
                sig2
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : "border-dashed text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <div className="mx-auto mb-1 flex size-7 items-center justify-center rounded-full bg-emerald-500/10">
                {sig2 ? <CheckCircle2 className="size-4" /> : <Truck className="size-4" />}
              </div>
              <p className="text-[11px] font-bold">2. Carrier / Driver</p>
              <p className="text-[10px] mt-0.5 opacity-80">{driver}</p>
              <span className="text-[9px] block mt-1 font-mono uppercase">
                {sig2 ? "Verified ✓" : "Click to sign"}
              </span>
            </div>

            {/* 3. Supplier Receipt */}
            <div
              onClick={() => {
                setSig3(!sig3);
                toast.success(
                  sig3
                    ? "Supplier signature removed"
                    : "Supplier receiver acknowledgment signed!"
                );
              }}
              className={`cursor-pointer rounded-xl border p-3 text-center transition-all ${
                sig3
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : "border-dashed text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <div className="mx-auto mb-1 flex size-7 items-center justify-center rounded-full bg-emerald-500/10">
                {sig3 ? <CheckCircle2 className="size-4" /> : <Shield className="size-4" />}
              </div>
              <p className="text-[11px] font-bold">3. Supplier Receiver</p>
              <p className="text-[10px] mt-0.5 opacity-80">{supplier}</p>
              <span className="text-[9px] block mt-1 font-mono uppercase">
                {sig3 ? "Acknowledged ✓" : "Click to acknowledge"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <p>This voucher certifies the physical handover of returnable containers.</p>
          <Button variant="default" size="sm" onClick={onClose} className="bg-primary text-xs font-semibold">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
