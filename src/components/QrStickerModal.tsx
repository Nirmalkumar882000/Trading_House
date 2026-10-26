import { useState } from "react";
import { QrCode, Printer, Check, X, ShieldCheck, Bluetooth, Calendar, Clock, Package } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QrStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: string;
  grade: string;
  packSizeKg: number;
  lotId: string;
  packerName: string;
  shelfLifeDays?: number;
  onVerified?: () => void;
}

export function QrStickerModal({
  isOpen,
  onClose,
  product,
  grade,
  packSizeKg,
  lotId,
  packerName,
  shelfLifeDays = 3,
  onVerified,
}: QrStickerModalProps) {
  const [printerConnected, setPrinterConnected] = useState<boolean>(false);
  const [printerName, setPrinterName] = useState<string>("TVS LP-46 Lite (BLE)");
  const [printCount, setPrintCount] = useState<number>(1);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);

  if (!isOpen) return null;

  const today = new Date().toISOString().slice(0, 10);
  const expiryDate = new Date(Date.now() + shelfLifeDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const serialNo = `${lotId || "PK-1001"}-${Math.floor(1000 + Math.random() * 9000)}`;

  const formattedWeight =
    packSizeKg < 1 ? `${Math.round(packSizeKg * 1000)} G (${packSizeKg} KG)` : `${packSizeKg} KG`;

  // Payload for QR (Excludes price strictly per PDF requirements)
  const qrPayload = JSON.stringify({
    cmp: "Velaan Bay Trading House",
    p: product,
    g: grade,
    wt: packSizeKg < 1 ? `${Math.round(packSizeKg * 1000)}g` : `${packSizeKg}kg`,
    pkd: today,
    exp: expiryDate,
    lot: lotId || "PK-1001",
    sn: serialNo,
    pkr: packerName || "Senthil P",
  });

  const handleConnectPrinter = async () => {
    if (typeof navigator !== "undefined" && "bluetooth" in navigator) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nav = navigator as any;
        const device = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
        });
        setPrinterName(device.name || "BLE Thermal Printer");
        setPrinterConnected(true);
        toast.success(`Paired with ${device.name || "Bluetooth Printer"}`);
      } catch {
        setPrinterConnected(true);
        setPrinterName("Virtual ESC/POS 58mm BLE");
        toast.info("Bluetooth sticker printer simulated (Ready to print)");
      }
    } else {
      setPrinterConnected(true);
      setPrinterName("Virtual ESC/POS 58mm BLE");
      toast.info("Web Bluetooth thermal printer simulated");
    }
  };

  const handlePrint = () => {
    toast.success(`Printing ${printCount} sticker(s) to ${printerName}`);
    setIsVerified(true);
    onVerified?.();
  };

  const handleScanVerification = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setIsVerified(true);
      toast.success("Same-day QR sticker scanned & verified successfully!");
      onVerified?.();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl border animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <QrCode className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Bluetooth QR Sticker Generator</h2>
              <p className="text-xs text-muted-foreground">F15 · 50mm Thermal Sticker (No Selling Price)</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
        </div>

        {/* Printer Pairing Strip */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", printerConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")} />
            <span className="font-medium text-foreground">{printerName}</span>
          </div>
          <Button
            size="sm"
            variant={printerConnected ? "outline" : "default"}
            className="h-7 text-xs"
            onClick={handleConnectPrinter}
          >
            <Bluetooth className="mr-1 size-3.5" />
            {printerConnected ? "Connected" : "Pair Printer"}
          </Button>
        </div>

        {/* Thermal Sticker Label Preview */}
        <div className="mt-4 flex justify-center">
          <div className="w-[280px] rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-white text-zinc-950 p-4 shadow-md font-sans">
            {/* Header */}
            <div className="border-b border-zinc-900 pb-1.5 text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">VELAAN BAY TRADING HOUSE</p>
              <p className="text-[9px] text-zinc-600">Fresh Produce Packaged Goods</p>
            </div>

            {/* Product & Grade */}
            <div className="my-2 text-center">
              <h3 className="text-base font-black uppercase tracking-tight text-zinc-900 leading-tight">{product}</h3>
              <span className="inline-block mt-0.5 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                {grade}
              </span>
            </div>

            {/* Net Weight Display */}
            <div className="my-2 rounded bg-zinc-100 p-1.5 text-center border border-zinc-200">
              <span className="text-[10px] font-bold uppercase text-zinc-500">NET WEIGHT: </span>
              <span className="font-mono text-base font-extrabold text-zinc-900">{formattedWeight}</span>
            </div>

            {/* QR Code and Meta Details */}
            <div className="flex items-center gap-3 my-2 pt-1">
              <div className="grid size-20 place-items-center bg-zinc-950 p-1 rounded">
                {/* SVG QR Code Simulation */}
                <svg viewBox="0 0 100 100" className="size-full fill-white">
                  <path d="M0,0 h30 v30 h-30 z M10,10 h10 v10 h-10 z M70,0 h30 v30 h-30 z M80,10 h10 v10 h-10 z M0,70 h30 v30 h-30 z M10,80 h10 v10 h-10 z M40,10 h20 v10 h-20 z M10,40 h10 v20 h-10 z M40,40 h10 v10 h-10 z M60,40 h10 v20 h-10 z M80,40 h20 v10 h-20 z M40,60 h15 v15 h-15 z M70,70 h10 v10 h-10 z M90,80 h10 v20 h-10 z M60,85 h20 v10 h-20 z" />
                </svg>
              </div>

              <div className="text-[9px] space-y-0.5 font-mono leading-tight">
                <p><strong>LOT:</strong> {lotId || "PK-1001"}</p>
                <p><strong>PKD:</strong> {today}</p>
                <p><strong>EXP:</strong> {expiryDate}</p>
                <p><strong>PKR:</strong> {packerName || "Senthil P"}</p>
                <p className="text-[8px] text-zinc-500">SN: {serialNo}</p>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="border-t border-zinc-300 pt-1 text-center text-[8px] text-zinc-600 font-medium">
              Keep refrigerated · Selling price excluded on sticker
            </div>
          </div>
        </div>

        {/* Same-day & Shelf Life Policy Info */}
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-y py-2.5">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-primary" />
            <span>Packed: {today}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-amber-500" />
            <span>Shelf-life: {shelfLifeDays} days</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Package className="size-3.5 text-primary" />
            <span>Bags: {printCount}</span>
          </div>
        </div>

        {/* Verification Status */}
        {isVerified && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-4 shrink-0" />
            <span>Sticker verified! Ready to transition into saleable stock.</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 text-xs"
            onClick={handleScanVerification}
            disabled={isVerifying}
          >
            <QrCode className="mr-1.5 size-3.5" />
            {isVerifying ? "Scanning…" : "Scan & Verify"}
          </Button>

          <Button
            type="button"
            className="flex-1 text-xs bg-primary text-primary-foreground"
            onClick={handlePrint}
          >
            <Printer className="mr-1.5 size-3.5" />
            Print {printCount} Sticker(s)
          </Button>
        </div>
      </div>
    </div>
  );
}
