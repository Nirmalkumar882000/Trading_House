import { X, Printer, FileText } from "lucide-react";
import { fmtMoney, type Row } from "@/lib/modules";
import { num, parseLines } from "@/lib/workflow";
import { Button } from "./ui/button";

export function InvoiceViewModal({ invoice, onClose }: { invoice: Row; onClose: () => void }) {
  const lines = parseLines(invoice["item"]);
  const gstRate = num(invoice["gst"]);
  const taxable = num(invoice["taxable"]);
  const total = num(invoice["total"]) || Math.round(taxable * (1 + gstRate / 100));
  const taxAmount = Math.max(0, total - taxable);
  const paid = num(invoice["paid"]);

  return (
    <div className="invoice-print-root fixed inset-0 z-[70] grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .invoice-print-root, .invoice-print-root * { visibility: visible !important; }
          .invoice-print-root { position: absolute !important; inset: 0 !important; display: block !important; overflow: visible !important; background: white !important; padding: 0 !important; }
          .invoice-print-controls { display: none !important; }
          .invoice-document { width: 100% !important; max-width: none !important; border: 0 !important; box-shadow: none !important; }
        }
      `}</style>
      <section role="dialog" aria-modal="true" aria-label={`Proforma Invoice ${invoice.id}`} className="w-full max-w-3xl overflow-hidden rounded-2xl bg-card shadow-2xl">
        <header className="invoice-print-controls flex items-center justify-between border-b bg-hero px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2">
            <FileText className="size-5" />
            <div>
              <h2 className="font-semibold">Proforma Invoice {invoice.id}</h2>
              <p className="text-xs opacity-80">View or print this proforma invoice</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="text-foreground">
              <Printer className="mr-1.5 size-4" /> Print
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close proforma invoice">
              <X className="size-4" />
            </Button>
          </div>
        </header>
        <div className="max-h-[82vh] overflow-y-auto p-5 sm:p-8">
          <article className="invoice-document mx-auto max-w-2xl border bg-white p-6 text-zinc-900 shadow-sm sm:p-9">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-emerald-700 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Velaan Bay Trading House</p>
                <h1 className="mt-1 text-2xl font-bold">Proforma Invoice</h1>
                <p className="mt-1 text-xs text-zinc-500">Proforma invoice · Product sales</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-mono text-lg font-bold">{invoice.id}</p>
                <p className="text-zinc-600">Date: {String(invoice["date"] || "—")}</p>
                <p className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium">{invoice.status}</p>
              </div>
            </div>

            <div className="my-5 grid grid-cols-1 gap-4 rounded-lg bg-zinc-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-zinc-500">Bill to</p>
                <p className="mt-1 font-semibold">{String(invoice["buyer"] || "—")}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-zinc-500">References</p>
                <p className="mt-1">Sales Order: <span className="font-mono">{String(invoice["so"] || "—")}</span></p>
                <p>Sales DC: <span className="font-mono">{String(invoice["dc"] || "—")}</span></p>
              </div>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-300 text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-2">Product</th>
                  <th className="px-2 py-2 text-right">Qty (kg)</th>
                  <th className="px-2 py-2 text-right">Rate / kg</th>
                  <th className="py-2 pl-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const rate = num(line.saleRate) || num(invoice["rate"]);
                  return (
                    <tr key={line.p} className="border-b border-zinc-200">
                      <td className="py-3 pr-2">{line.p}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{line.q.toLocaleString("en-IN")}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{fmtMoney(rate)}</td>
                      <td className="py-3 pl-2 text-right tabular-nums">{fmtMoney(line.q * rate)}</td>
                    </tr>
                  );
                })}
                {!lines.length && (
                  <tr><td colSpan={4} className="py-6 text-center text-zinc-500">No product lines saved on this proforma invoice.</td></tr>
                )}
              </tbody>
            </table>

            <div className="ml-auto mt-5 w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between"><span>Taxable amount</span><span>{fmtMoney(taxable)}</span></div>
              <div className="flex justify-between"><span>GST ({gstRate}%)</span><span>{fmtMoney(taxAmount)}</span></div>
              <div className="flex justify-between border-t border-zinc-300 pt-2 text-base font-bold"><span>Proforma total</span><span>{fmtMoney(total)}</span></div>
              <div className="flex justify-between text-zinc-600"><span>Received</span><span>{fmtMoney(paid)}</span></div>
              <div className="flex justify-between font-semibold"><span>Balance due</span><span>{fmtMoney(Math.max(0, total - paid))}</span></div>
            </div>
            <p className="mt-10 border-t pt-4 text-center text-xs text-zinc-500">Thank you for your business.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
