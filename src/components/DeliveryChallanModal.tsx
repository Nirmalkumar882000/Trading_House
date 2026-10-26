import { useState } from "react";
import { FileText, Printer, Check, X, Shield, Truck, UserCheck, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { fmtMoney, type Row } from "@/lib/modules";
import { parseLines, parseBuys } from "@/lib/workflow";

interface DeliveryChallanModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "transport" | "sales";
  record: Row;
  onSignaturesUpdated?: (count: number) => void;
}

export function DeliveryChallanModal({
  isOpen,
  onClose,
  type,
  record,
  onSignaturesUpdated,
}: DeliveryChallanModalProps) {
  const [sig1, setSig1] = useState<boolean>(Number(record["signatures"] ?? 0) >= 1);
  const [sig2, setSig2] = useState<boolean>(Number(record["signatures"] ?? 0) >= 2);
  const [sig3, setSig3] = useState<boolean>(Number(record["signatures"] ?? 0) >= 3);

  if (!isOpen) return null;

  const isTransport = type === "transport";
  const challanNo = isTransport ? `TDC-${record.id}` : `SDC-${record.id}`;
  const date = String(record["date"] || "2026-10-22");
  const vehicle = String(record["vehicle"] || "TN 09 AB 1234");
  const driver = String(record["driver"] || "Raja");
  const transporter = String(record["transporter"] || "Chennai Fresh Logistics");

  const buys = isTransport && record["buys"] ? parseBuys(record["buys"]) : [];
  const lines = parseLines(record["item"]);

  const countSigs = (s1: boolean, s2: boolean, s3: boolean) => (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);
  const currentSigCount = countSigs(sig1, sig2, sig3);

  const toggleSig = (slot: 1 | 2 | 3) => {
    let next1 = sig1, next2 = sig2, next3 = sig3;
    if (slot === 1) next1 = !sig1;
    if (slot === 2) next2 = !sig2;
    if (slot === 3) next3 = !sig3;
    setSig1(next1);
    setSig2(next2);
    setSig3(next3);
    const total = countSigs(next1, next2, next3);
    onSignaturesUpdated?.(total);
    toast.success(`Signatures updated: ${total} of 3 collected`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl border animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {isTransport ? "Transport Delivery Challan (F04)" : "Sales Delivery Challan (F19)"}
              </h2>
              <p className="text-xs text-muted-foreground">{challanNo} · FleetMate Official Document</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
        </div>

        {/* Official Document Sheet */}
        <div className="mt-4 rounded-xl border bg-white text-zinc-950 p-6 shadow-sm font-sans space-y-5">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-zinc-200 pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-800">VELAAN BAY TRADING HOUSE</p>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">
                {isTransport ? "MARKET TRANSPORT DELIVERY CHALLAN" : "OUTWARD SALES DELIVERY CHALLAN"}
              </h1>
              <p className="text-xs text-zinc-500">Koyambedu Wholesale Complex, Chennai · GSTIN: 33AAACV9876K1Z2</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-mono font-bold text-sm text-zinc-900">{challanNo}</p>
              <p className="text-zinc-500">Date: {date}</p>
              <span className="inline-block mt-1 rounded bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">
                Status: {record.status}
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs border-b border-zinc-200 pb-4">
            <div>
              <p className="font-bold text-zinc-700 uppercase tracking-wide text-[10px]">
                {isTransport ? "Origin & Supplier" : "Buyer & Destination"}
              </p>
              <p className="font-semibold text-sm text-zinc-900">
                {isTransport ? (record["supplier"] || "Various Market Suppliers") : record["buyer"]}
              </p>
              <p className="text-zinc-600">
                {isTransport ? "Koyambedu Market Yard" : "Retail Store / Warehouse Dispatch"}
              </p>
              <p className="text-zinc-500 font-mono mt-0.5">
                Ref: {String(record["po"] || record["so"] || record.id)}
              </p>
            </div>
            <div>
              <p className="font-bold text-zinc-700 uppercase tracking-wide text-[10px]">Transport & FleetMate Trip</p>
              <p className="font-semibold text-sm text-zinc-900">{transporter}</p>
              <p className="text-zinc-600">Vehicle: <span className="font-mono font-bold">{vehicle}</span></p>
              <p className="text-zinc-600">Driver: {driver} ({String(record["driverPhone"] || "98400 12345")})</p>
            </div>
          </div>

          {/* Itemized Table */}
          <div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-zinc-900 bg-zinc-100 text-zinc-700">
                  <th className="py-2 px-2 font-bold">#</th>
                  <th className="py-2 px-2 font-bold">Product Item</th>
                  {isTransport && <th className="py-2 px-2 font-bold">Supplier</th>}
                  <th className="py-2 px-2 font-bold text-right">Units / Crates</th>
                  <th className="py-2 px-2 font-bold text-right">Net Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {buys.length > 0 ? (
                  buys.map((b, i) => (
                    <tr key={i}>
                      <td className="py-2 px-2 text-zinc-500">{i + 1}</td>
                      <td className="py-2 px-2 font-medium text-zinc-900">{b.p}</td>
                      <td className="py-2 px-2 text-zinc-600">{b.s}</td>
                      <td className="py-2 px-2 text-right">{Math.ceil(b.q / 25)} crates</td>
                      <td className="py-2 px-2 text-right font-mono font-semibold">{b.q} kg</td>
                    </tr>
                  ))
                ) : lines.length > 0 ? (
                  lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-2 px-2 text-zinc-500">{i + 1}</td>
                      <td className="py-2 px-2 font-medium text-zinc-900">{l.p}</td>
                      {isTransport && <td className="py-2 px-2 text-zinc-600">{String(record["supplier"] || "—")}</td>}
                      <td className="py-2 px-2 text-right">{Math.ceil(l.q / 25)} units</td>
                      <td className="py-2 px-2 text-right font-mono font-semibold">{l.q} kg</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-zinc-500">General Cargo</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-900 font-bold bg-zinc-50">
                  <td colSpan={isTransport ? 3 : 2} className="py-2 px-2">Total Consignment</td>
                  <td className="py-2 px-2 text-right">{record["units"] ? `${record["units"]} units` : "—"}</td>
                  <td className="py-2 px-2 text-right font-mono">{String(record["net"] || record["qty"] || 0)} kg</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Signatures Section */}
          <div className="pt-2">
            <p className="font-bold text-[11px] uppercase tracking-wider text-zinc-700 mb-2">
              Mandatory Signatures Required (3 Signatures Check)
            </p>
            <div className="grid grid-cols-3 gap-3">
              {/* Signature 1 */}
              <div
                onClick={() => toggleSig(1)}
                className={`cursor-pointer rounded-lg border-2 p-3 text-center transition-all ${
                  sig1 ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-dashed border-zinc-300 bg-zinc-50"
                }`}
              >
                <div className="flex justify-center mb-1">
                  {sig1 ? <CheckCircle2 className="size-5 text-emerald-600" /> : <UserCheck className="size-5 text-zinc-400" />}
                </div>
                <p className="font-semibold text-xs">{isTransport ? "Supplier Signature" : "Buyer Receiving"}</p>
                <p className="text-[10px] text-zinc-500">{sig1 ? "Signed digitally" : "Click to Sign"}</p>
              </div>

              {/* Signature 2 */}
              <div
                onClick={() => toggleSig(2)}
                className={`cursor-pointer rounded-lg border-2 p-3 text-center transition-all ${
                  sig2 ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-dashed border-zinc-300 bg-zinc-50"
                }`}
              >
                <div className="flex justify-center mb-1">
                  {sig2 ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Truck className="size-5 text-zinc-400" />}
                </div>
                <p className="font-semibold text-xs">Driver Handover</p>
                <p className="text-[10px] text-zinc-500">{sig2 ? "Signed digitally" : "Click to Sign"}</p>
              </div>

              {/* Signature 3 */}
              <div
                onClick={() => toggleSig(3)}
                className={`cursor-pointer rounded-lg border-2 p-3 text-center transition-all ${
                  sig3 ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-dashed border-zinc-300 bg-zinc-50"
                }`}
              >
                <div className="flex justify-center mb-1">
                  {sig3 ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Shield className="size-5 text-zinc-400" />}
                </div>
                <p className="font-semibold text-xs">{isTransport ? "Market Loader / Agent" : "Dispatch Supervisor"}</p>
                <p className="text-[10px] text-zinc-500">{sig3 ? "Signed digitally" : "Click to Sign"}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-zinc-600">
              <span>Collected: <strong className="text-zinc-900">{currentSigCount} of 3</strong> signatures</span>
              {currentSigCount === 3 ? (
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <Check className="size-3.5" /> Ready for trip submission
                </span>
              ) : (
                <span className="text-amber-600 font-medium">All 3 signatures required before trip submission</span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-5 flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" onClick={handlePrint} className="bg-primary text-primary-foreground">
            <Printer className="mr-1.5 size-4" /> Print Delivery Challan
          </Button>
        </div>
      </div>
    </div>
  );
}
