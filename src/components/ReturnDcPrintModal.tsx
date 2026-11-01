import { X, Printer, RotateCcw } from "lucide-react";
import { type Row } from "@/lib/modules";
import { num, parseLines } from "@/lib/workflow";
import { Button } from "./ui/button";

// Printable outward Return DC raised from buyer rejects on a delivery.
export function ReturnDcPrintModal({ returnDc, delivery, dispatch, onClose }: { returnDc: Row; delivery?: Row | undefined; dispatch?: Row | undefined; onClose: () => void }) {
  const lines = parseLines(returnDc["item"]);
  const totalKg = lines.reduce((sum, line) => sum + num(line.q), 0);
  const totalBox = lines.reduce((sum, line) => sum + num(line.box), 0);

  return (
    <div className="return-dc-print-root fixed inset-0 z-[70] grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .return-dc-print-root, .return-dc-print-root * { visibility: visible !important; }
          .return-dc-print-root { position: absolute !important; inset: 0 !important; display: block !important; overflow: visible !important; background: white !important; padding: 0 !important; }
          .return-dc-print-controls { display: none !important; }
          .return-dc-document { width: 100% !important; max-width: none !important; border: 0 !important; box-shadow: none !important; }
        }
      `}</style>
      <section role="dialog" aria-modal="true" aria-label={`Return DC ${returnDc.id}`} className="w-full max-w-3xl overflow-hidden rounded-2xl bg-card shadow-2xl">
        <header className="return-dc-print-controls flex items-center justify-between border-b bg-hero px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2">
            <RotateCcw className="size-5" />
            <div>
              <h2 className="font-semibold">Return DC {returnDc.id}</h2>
              <p className="text-xs opacity-80">View or print this buyer return delivery challan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="text-foreground">
              <Printer className="mr-1.5 size-4" /> Print
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close return DC">
              <X className="size-4" />
            </Button>
          </div>
        </header>
        <div className="max-h-[82vh] overflow-y-auto p-5 sm:p-8">
          <article className="return-dc-document mx-auto max-w-2xl border bg-white p-6 text-zinc-900 shadow-sm sm:p-9">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-emerald-700 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Velaan Bay Trading House</p>
                <h1 className="mt-1 text-2xl font-bold">Buyer Return Delivery Challan</h1>
                <p className="mt-1 text-xs text-zinc-500">Udumalaipet Wholesale Complex, Tiruppur Dist · GSTIN: 33AAACV9876K1Z2</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-mono text-lg font-bold">{returnDc.id}</p>
                <p className="text-zinc-600">Date: {String(returnDc["date"] || "—")}</p>
                <p className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium">{returnDc.status}</p>
              </div>
            </div>

            <div className="my-5 grid grid-cols-1 gap-4 rounded-lg bg-zinc-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-zinc-500">Returned by (Buyer)</p>
                <p className="mt-1 font-semibold">{String(returnDc["buyer"] || delivery?.["buyer"] || "—")}</p>
                <p className="mt-2 text-xs font-semibold uppercase text-zinc-500">Return to</p>
                <p className="mt-1">{String(returnDc["warehouse"] || dispatch?.["warehouse"] || "—")}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-zinc-500">References</p>
                <p className="mt-1">Sales Order: <span className="font-mono">{String(returnDc["sale"] || dispatch?.["so"] || "—")}</span></p>
                <p>Sales DC: <span className="font-mono">{String(returnDc["salesDc"] || delivery?.["dc"] || "—")}</span></p>
                <p>Delivery: <span className="font-mono">{String(returnDc["delivery"] || delivery?.id || "—")}</span></p>
                <p>Reason: {String(returnDc["reason"] || "—")}</p>
              </div>
            </div>

            {dispatch && (
              <div className="mb-5 grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-xs font-semibold uppercase text-zinc-500">Transporter</p><p className="mt-1">{String(dispatch["transporter"] || "—")}</p></div>
                <div><p className="text-xs font-semibold uppercase text-zinc-500">Vehicle</p><p className="mt-1 font-mono">{String(dispatch["vehicle"] || "—")}</p></div>
                <div><p className="text-xs font-semibold uppercase text-zinc-500">Driver</p><p className="mt-1">{String(dispatch["driver"] || "—")}</p></div>
              </div>
            )}

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-300 text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-2">#</th>
                  <th className="px-2 py-2">Product</th>
                  <th className="px-2 py-2 text-right">Rejected boxes</th>
                  <th className="py-2 pl-2 text-right">Rejected qty (kg)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.p} className="border-b border-zinc-200">
                    <td className="py-3 pr-2 text-zinc-500">{index + 1}</td>
                    <td className="px-2 py-3">{line.p}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{num(line.box) || "—"}</td>
                    <td className="py-3 pl-2 text-right tabular-nums">{num(line.q).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                {!lines.length && (
                  <tr><td colSpan={4} className="py-6 text-center text-zinc-500">No rejected products on this return DC.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-900 font-bold">
                  <td colSpan={2} className="py-2 pr-2">Total returned</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totalBox || "—"}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{totalKg.toLocaleString("en-IN")} kg</td>
                </tr>
              </tfoot>
            </table>

            {delivery?.["remarks"] && (
              <p className="mt-4 text-sm text-zinc-600"><span className="font-semibold">Remarks:</span> {String(delivery["remarks"])}</p>
            )}

            <div className="mt-12 grid grid-cols-3 gap-6 text-center text-xs text-zinc-600">
              <div className="border-t border-zinc-400 pt-2">Buyer signature</div>
              <div className="border-t border-zinc-400 pt-2">Driver signature</div>
              <div className="border-t border-zinc-400 pt-2">Warehouse receiving</div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
