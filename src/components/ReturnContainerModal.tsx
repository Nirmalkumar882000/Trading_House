import { useState } from "react";
import { RotateCcw, X, Check, Truck, User, Calendar, FileText, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { type Row } from "@/lib/modules";
import { num, round } from "@/lib/workflow";

interface ReturnContainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  container: Row;
  onReturnSaved: (updatedContainer: Row, openChallan?: boolean) => void;
}

export function ReturnContainerModal({
  isOpen,
  onClose,
  container,
  onReturnSaved,
}: ReturnContainerModalProps) {
  if (!isOpen || !container) return null;

  const totalReceived = num(container["out"]) || num(container["received"]) || 0;
  const alreadyReturned = num(container["back"]) || num(container["returned"]) || 0;
  const currentShort = num(container["short"]) || 0;
  const currentBalance = Math.max(0, totalReceived - alreadyReturned - currentShort);

  const [returnQty, setReturnQty] = useState<number>(currentBalance);
  const [shortQty, setShortQty] = useState<number>(0);
  const [returnDate, setReturnDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [returnDc, setReturnDc] = useState<string>(
    String(container["returnDc"] || `RDC-${container.id}`)
  );
  const [vehicle, setVehicle] = useState<string>(
    String(container["vehicle"] || container["returnVehicle"] || "TN 09 AB 1234")
  );
  const [driver, setDriver] = useState<string>(
    String(container["driver"] || container["returnDriver"] || "Raja")
  );
  const [remarks, setRemarks] = useState<string>(
    String(container["remarks"] || `Empty ${String(container["type"] || "crates").toLowerCase()} returned to supplier`)
  );
  const [generateChallan, setGenerateChallan] = useState<boolean>(true);

  const containerType = String(container["type"] || "Plastic crates");
  const supplier = String(container["party"] || "Supplier");
  const sourceReceipt = String(container["receipt"] || container["receiptRef"] || "—");
  const sourceDc = String(container["dc"] || "—");

  const newTotalReturned = alreadyReturned + returnQty;
  const newTotalShort = currentShort + shortQty;
  const remainingBalance = Math.max(0, totalReceived - newTotalReturned - newTotalShort);
  const newStatus =
    remainingBalance === 0
      ? newTotalShort > 0
        ? "Short"
        : "Returned"
      : "With us";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (returnQty < 0 || shortQty < 0) {
      toast.error("Quantities cannot be negative");
      return;
    }
    if (returnQty === 0 && shortQty === 0) {
      toast.error("Please enter a return or short quantity greater than 0");
      return;
    }
    if (returnQty + shortQty > currentBalance) {
      toast.error(
        `Returned + Short (${returnQty + shortQty}) exceeds current balance with us (${currentBalance} crates)`
      );
      return;
    }

    const updatedRow: Row = {
      ...container,
      out: totalReceived,
      back: newTotalReturned,
      short: newTotalShort,
      balance: remainingBalance,
      status: newStatus,
      returnDate,
      returnDc,
      returnVehicle: vehicle,
      returnDriver: driver,
      remarks,
    };

    onReturnSaved(updatedRow, generateChallan);
    toast.success(
      `Returned ${returnQty} ${containerType} to ${supplier}. Balance: ${remainingBalance}`
    );
    onClose();
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
        className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card shadow-2xl border animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b bg-hero p-5 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider opacity-80">
                F09 · Returnable Container Tracking
              </p>
              <h2 className="text-lg font-semibold">
                Return Containers to Supplier
              </h2>
            </div>
          </div>
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            className="text-primary-foreground hover:bg-white/10"
            aria-label="Close"
          >
            <X className="size-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Container Metadata Overview */}
          <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <div>
                <span className="font-mono text-xs font-bold text-primary">
                  {container.id}
                </span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="font-semibold text-foreground text-sm">
                  {containerType}
                </span>
              </div>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Supplier: {supplier}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="rounded-lg bg-background p-2 border">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Total Received
                </p>
                <p className="text-lg font-bold text-foreground">
                  {totalReceived}
                </p>
              </div>
              <div className="rounded-lg bg-background p-2 border">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Already Returned
                </p>
                <p className="text-lg font-bold text-muted-foreground">
                  {alreadyReturned}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2 border border-emerald-500/30">
                <p className="text-[10px] uppercase font-semibold text-emerald-800 dark:text-emerald-400">
                  Balance With Us
                </p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {currentBalance}
                </p>
              </div>
            </div>

            {(sourceReceipt !== "—" || sourceDc !== "—") && (
              <p className="text-[11px] text-muted-foreground pt-1">
                Source Reference:{" "}
                <span className="font-mono text-foreground">{sourceReceipt}</span>
                {sourceDc !== "—" && (
                  <>
                    {" "}
                    (Purchase DC:{" "}
                    <span className="font-mono text-foreground">{sourceDc}</span>)
                  </>
                )}
              </p>
            )}
          </div>

          {/* Return inputs */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="return-qty"
                  className="text-xs font-semibold text-foreground"
                >
                  Quantity to Return Now (Crates / Bags) *
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setReturnQty(currentBalance)}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Return All ({currentBalance})
                  </button>
                  {currentBalance > 1 && (
                    <>
                      <span className="text-muted-foreground text-[11px]">·</span>
                      <button
                        type="button"
                        onClick={() => setReturnQty(Math.floor(currentBalance / 2))}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Half ({Math.floor(currentBalance / 2)})
                      </button>
                    </>
                  )}
                </div>
              </div>
              <input
                id="return-qty"
                type="number"
                min={0}
                max={currentBalance}
                value={returnQty}
                onChange={(e) => setReturnQty(Number(e.target.value) || 0)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                required
              />
            </div>

            <div>
              <label
                htmlFor="short-qty"
                className="text-xs font-semibold text-foreground block mb-1.5"
              >
                Damaged / Lost / Shortage (Optional)
              </label>
              <input
                id="short-qty"
                type="number"
                min={0}
                max={currentBalance - returnQty}
                value={shortQty}
                onChange={(e) => setShortQty(Number(e.target.value) || 0)}
                placeholder="0 (crates damaged or broken in warehouse)"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter damaged or lost crates to reconcile shortage per F09 controls.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="return-date"
                  className="text-xs font-semibold text-muted-foreground block mb-1.5"
                >
                  Return Date *
                </label>
                <input
                  id="return-date"
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="return-dc"
                  className="text-xs font-semibold text-muted-foreground block mb-1.5"
                >
                  Return Delivery Challan No
                </label>
                <input
                  id="return-dc"
                  type="text"
                  value={returnDc}
                  onChange={(e) => setReturnDc(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="vehicle-no"
                  className="text-xs font-semibold text-muted-foreground block mb-1.5"
                >
                  Return Vehicle Number
                </label>
                <input
                  id="vehicle-no"
                  type="text"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  placeholder="TN 09 AB 1234"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
              </div>

              <div>
                <label
                  htmlFor="driver-name"
                  className="text-xs font-semibold text-muted-foreground block mb-1.5"
                >
                  Driver / Handed to
                </label>
                <input
                  id="driver-name"
                  type="text"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  placeholder="Driver or supplier rep"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="remarks"
                className="text-xs font-semibold text-muted-foreground block mb-1.5"
              >
                Return Notes / Remarks
              </label>
              <input
                id="remarks"
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
            </div>
          </div>

          {/* Balance Reconciled Preview */}
          <div className="rounded-xl border bg-primary-soft/40 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Updated Status:{" "}
                  <span
                    className={`font-bold ${
                      newStatus === "Returned"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : newStatus === "Short"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-primary"
                    }`}
                  >
                    {newStatus}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Remaining balance after return:{" "}
                  <span className="font-bold text-foreground">
                    {remainingBalance} crates
                  </span>
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={generateChallan}
                onChange={(e) => setGenerateChallan(e.target.checked)}
                className="rounded border-primary text-primary focus:ring-primary/20"
              />
              View Return DC
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              className="text-sm"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              type="submit"
              className="inline-flex items-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm"
            >
              <Check className="size-4" /> Confirm Return & Update Balance
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
