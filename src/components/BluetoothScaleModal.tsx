import { useState, useEffect } from "react";
import { Scale, Bluetooth, Check, RefreshCw, AlertTriangle, X, Radio, ChevronDown, PackageCheck } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type Row } from "@/lib/modules";
import { parseLines, total, round, num } from "@/lib/workflow";
import { EmployeeSelect } from "./EmployeeSelect";

interface BluetoothScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sentWeight: number;
  productName: string;
  sourceDc: string;
  receipts?: Row[];
  activeReceiptId?: string;
  onSelectReceipt?: (id: string) => void;
  itemJson?: string;
  onApplyWeight: (weight: number, reason: string, receiptId?: string, staff?: string) => void;
}

const REASON_OPTIONS = [
  "Moisture loss",
  "Spillage",
  "Scale variance",
  "Damaged in transit",
  "Normal transit loss",
  "—",
];

export function BluetoothScaleModal({
  isOpen,
  onClose,
  sentWeight,
  productName,
  sourceDc,
  receipts,
  activeReceiptId,
  onSelectReceipt,
  itemJson,
  onApplyWeight,
}: BluetoothScaleModalProps) {
  const [weight, setWeight] = useState<number>(sentWeight > 0 ? sentWeight : 100);
  const [tare, setTare] = useState<number>(0);
  const [isStable, setIsStable] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [scaleName, setScaleName] = useState<string>("Essae DS-215 (Simulated BLE)");
  const [unit, setUnit] = useState<"kg" | "g">("kg");
  const [customReason, setCustomReason] = useState<string>("Moisture loss");
  const [isUserChangedReason, setIsUserChangedReason] = useState<boolean>(false);
  const [staff, setStaff] = useState<string>("Priya S");

  // Synchronize weight with selected receipt whenever opened or changed
  useEffect(() => {
    if (isOpen) {
      const base = sentWeight > 0 ? sentWeight : 320;
      setWeight(base);
      setTare(0);
      setIsUserChangedReason(false);
      setIsStable(true);
    }
  }, [isOpen, sentWeight, sourceDc, activeReceiptId]);

  if (!isOpen) return null;

  const netWeight = Math.max(0, Math.round((weight - tare) * 1000) / 1000);
  const diffKg = Math.round((netWeight - sentWeight) * 1000) / 1000;
  const variancePct = sentWeight > 0 ? Math.round(((netWeight - sentWeight) / sentWeight) * 1000) / 10 : 0;
  const isHighVariance = Math.abs(variancePct) > 10;

  // Auto-suggest reason based on variance if user hasn't explicitly overridden it
  const defaultSuggestedReason = (() => {
    if (diffKg === 0) return "—";
    if (diffKg < 0) {
      if (Math.abs(variancePct) > 10) return "Spillage";
      if (Math.abs(variancePct) > 1.5) return "Moisture loss";
      return "Scale variance";
    }
    return "Scale variance";
  })();

  const currentReason = isUserChangedReason ? customReason : defaultSuggestedReason;

  // Real-time proportional allocation preview
  const parsedItems = itemJson ? parseLines(itemJson) : [];
  const allocatedItems = parsedItems.map((it, idx) => {
    const tot = total(parsedItems);
    if (tot <= 0) return { ...it, allocated: netWeight };
    if (parsedItems.length === 1) return { ...it, allocated: netWeight };
    const ratio = netWeight / tot;
    if (idx === parsedItems.length - 1) {
      const prior = parsedItems.slice(0, idx).reduce((s, p) => s + round(p.q * ratio), 0);
      return { ...it, allocated: round(netWeight - prior) };
    }
    return { ...it, allocated: round(it.q * ratio) };
  });

  const handleConnectBle = async () => {
    setIsConnecting(true);
    if (typeof navigator !== "undefined" && "bluetooth" in navigator) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nav = navigator as any;
        const device = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ["weight_scale", "generic_access", "battery_service"],
        });
        setScaleName(device.name || "Bluetooth Scale");
        setIsConnected(true);
        toast.success(`Connected to ${device.name || "Bluetooth Scale"}`);
      } catch (err: unknown) {
        console.warn("Bluetooth device request cancelled, fallback to active simulation", err);
        setIsConnected(true);
        setScaleName("Virtual SmartScale BLE-500kg");
        toast.info("Bluetooth adapter simulated with live calibration");
      }
    } else {
      setIsConnected(true);
      setScaleName("Virtual SmartScale BLE-500kg");
      toast.info("Web Bluetooth simulated (Standard browser mode)");
    }
    setIsConnecting(false);
  };

  const simulateWeight = (newVal: number) => {
    setIsStable(false);
    setTimeout(() => {
      setWeight(newVal);
      setIsStable(true);
    }, 200);
  };

  const handleApply = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      onApplyWeight(netWeight, currentReason, activeReceiptId, staff);
      toast.success(`Successfully applied ${netWeight} kg to ${activeReceiptId || sourceDc}`);
    } catch (err) {
      console.error("Error applying weight to receipt:", err);
      toast.error("Failed to apply weight. Check console for details.");
    } finally {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[95vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl border animate-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Scale className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Bluetooth Weighing Scale</h2>
              <p className="text-xs text-muted-foreground">F06 · Warehouse Receiving Bay Weigh-in</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Target Receipt Selector */}
        {receipts && receipts.length > 0 && (
          <div className="mt-3 rounded-xl border bg-muted/40 p-2.5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-foreground">Target Warehouse Receipt:</span>
              <span className="text-[11px] text-muted-foreground">{receipts.length} receipts available</span>
            </div>
            <select
              value={activeReceiptId || ""}
              onChange={(e) => onSelectReceipt?.(e.target.value)}
              className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-primary/20"
            >
              {receipts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} · DC: {String(r["dc"] || "—")} · Sent: {num(r["sent"])} kg ({linesLabel(r)})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Device Status Bar */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-emerald-500")} />
            <span className="font-medium text-foreground">{scaleName}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant={isConnected ? "outline" : "default"}
            className="h-7 text-xs"
            onClick={handleConnectBle}
            disabled={isConnecting}
          >
            <Bluetooth className="mr-1 size-3.5" />
            {isConnecting ? "Pairing…" : isConnected ? "Re-pair BLE" : "Connect Scale"}
          </Button>
        </div>

        {/* Digital LED Display */}
        <div className="mt-3 rounded-xl border bg-black p-5 text-center shadow-inner relative overflow-hidden">
          <div className="absolute top-2 left-3 flex items-center gap-2 text-[10px] tracking-wider font-mono text-emerald-500/70">
            <span>{isStable ? "● STABLE" : "○ UNSTABLE"}</span>
            <span>· NET</span>
            <span>· CH: 01</span>
          </div>
          <div className="absolute top-2 right-3 text-[10px] tracking-wider font-mono text-emerald-500/70">
            DC: {sourceDc || "DIRECT"}
          </div>

          <div className="my-3 font-mono font-bold tracking-tight text-emerald-400 text-5xl sm:text-6xl flex items-baseline justify-center gap-2">
            <span>{netWeight.toFixed(2)}</span>
            <span className="text-xl text-emerald-500/80 font-normal">{unit}</span>
          </div>

          <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400 border-t border-zinc-800 pt-2 px-1">
            <span>GROSS: {weight.toFixed(2)} {unit}</span>
            <span>TARE: {tare.toFixed(2)} {unit}</span>
            <span>ORIGIN: {sentWeight.toFixed(2)} {unit}</span>
          </div>
        </div>

        {/* Quick Calibration / Presets */}
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Quick Test Scenarios</p>
          <div className="grid grid-cols-4 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => simulateWeight(sentWeight)}
            >
              Exact ({sentWeight})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8 text-amber-600 font-medium"
              onClick={() => simulateWeight(Math.max(0, Math.round(sentWeight * 0.96875 * 10) / 10))}
            >
              310 kg (-3.1%)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8 text-destructive font-semibold"
              onClick={() => simulateWeight(Math.max(0, Math.round(sentWeight * 0.86 * 10) / 10))}
            >
              -14% Critical
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => simulateWeight(Math.round(sentWeight * 1.01 * 10) / 10)}
            >
              +1% Gain
            </Button>
          </div>
        </div>

        {/* Scale Controls: Tare, Zero, Manual Entry */}
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setTare(tare === 0 ? 5 : 0)}
          >
            {tare === 0 ? "Tare Crates (5kg)" : "Clear Tare"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => { setWeight(0); setTare(0); }}
          >
            Zero Scale
          </Button>
          <div className="flex-1 flex items-center border rounded-md px-2 py-1 bg-background text-xs">
            <span className="text-muted-foreground mr-1">Manual:</span>
            <input
              type="number"
              step="any"
              min="0"
              className="w-full bg-transparent outline-none text-right font-mono font-medium"
              value={weight || ""}
              onChange={(e) => setWeight(Number(e.target.value) || 0)}
              placeholder="0.0"
            />
          </div>
        </div>

        {/* Multi-product Proportional Breakdown */}
        {allocatedItems.length > 0 && (
          <div className="mt-3 rounded-xl border bg-muted/30 p-2.5 text-xs">
            <div className="flex items-center justify-between font-semibold text-foreground mb-1.5">
              <span className="flex items-center gap-1.5">
                <PackageCheck className="size-3.5 text-primary" /> Product Distribution (F06)
              </span>
              <span className="text-[11px] font-normal text-muted-foreground">Total: {netWeight} kg</span>
            </div>
            <div className="space-y-1">
              {allocatedItems.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-md bg-background/80 px-2.5 py-1 text-xs">
                  <span className="font-medium">{it.p}</span>
                  <div className="font-mono text-muted-foreground">
                    <span>Sent: {it.q} kg</span>
                    <span className="mx-1.5">→</span>
                    <span className="font-semibold text-foreground">{it.allocated} kg</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Receipt Staff Selector */}
        <div className="mt-3">
          <EmployeeSelect
            label="Receipt Staff / Weigh-in Operator"
            roleFilter="Receipt staff"
            value={staff}
            onChange={setStaff}
            placeholder="Select Receipt Staff"
          />
        </div>

        {/* Difference Reason Selector */}
        <div className="mt-3 rounded-xl border bg-card p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-foreground">Transit Difference Reason (F07):</label>
            <span className="text-[11px] text-muted-foreground">Mandatory for variance audit</span>
          </div>
          <select
            value={currentReason}
            onChange={(e) => {
              setCustomReason(e.target.value);
              setIsUserChangedReason(true);
            }}
            className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Weight Variance Analysis Box */}
        <div className={cn(
          "mt-3 rounded-xl p-3 text-xs border transition-colors",
          isHighVariance ? "bg-destructive/10 border-destructive/30 text-destructive" :
          diffKg === 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400" :
          "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
        )}>
          <div className="flex items-center gap-1.5 font-semibold">
            {isHighVariance ? <AlertTriangle className="size-4 text-destructive shrink-0" /> : <Radio className="size-4 shrink-0" />}
            <span>
              {diffKg === 0 ? "Weight matches Transport DC exactly" :
               `Weight Variance: ${diffKg > 0 ? "+" : ""}${diffKg} kg (${variancePct > 0 ? "+" : ""}${variancePct}%)`}
            </span>
          </div>
          <p className="mt-1 text-[11px] opacity-90">
            {isHighVariance
              ? "CRITICAL >10% VARIANCE: Under Process Flow F07, variance exceeding 10% requires supervisor notification and a mandatory logged reason before inventory posting."
              : Math.abs(variancePct) > 0
              ? `Discrepancy of ${Math.abs(diffKg)} kg is within operational limits. Reason "${currentReason}" will be posted to receipt voucher.`
              : "Origin sent weight and warehouse received weight are identical."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex items-center justify-between border-t pt-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="bg-primary text-primary-foreground font-semibold px-4 shadow-md hover:bg-primary/90"
          >
            <Check className="mr-1.5 size-4" /> Apply {netWeight} kg to Receipt
          </Button>
        </div>

      </div>
    </div>
  );
}

function linesLabel(r: Row): string {
  try {
    const it = parseLines(r["item"]);
    return it.map((l) => l.p).join(", ") || String(r["item"] || "Produce");
  } catch {
    return "Produce";
  }
}
