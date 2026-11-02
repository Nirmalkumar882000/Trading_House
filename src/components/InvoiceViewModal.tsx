import { useState } from "react";
import { X, Printer, FileText, MessageCircle, CheckCircle2 } from "lucide-react";
import { fmtMoney, type Row } from "@/lib/modules";
import { invoiceReturnSummary, num, type InvoiceReturnSummary } from "@/lib/workflow";
import { Button } from "./ui/button";

export function invoiceWhatsAppText(invoice: Row, summary: InvoiceReturnSummary): string {
  const isProforma = invoice.status === "Draft";
  const paid = num(invoice["paid"]);
  const productText = summary.lines
    .map((line) =>
      line.returnKg > 0
        ? `• *${line.p}*: ${line.sentKg} kg sent − ${line.returnKg} kg returned = ${line.billedKg} kg @ ${fmtMoney(line.rate)}/kg = ${fmtMoney(line.amount)}`
        : `• *${line.p}*: ${line.billedKg} kg @ ${fmtMoney(line.rate)}/kg = ${fmtMoney(line.amount)}`,
    )
    .join("\n");
  return (
    `*Velaan Bay Trading House - ${isProforma ? "Proforma Invoice" : "Sales Invoice"}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*Invoice:* ${isProforma ? `PROF-${invoice.id}` : invoice.id}\n` +
    `*Buyer:* ${invoice["buyer"] || "—"}\n` +
    `*Date:* ${invoice["date"] || "—"}\n` +
    `*Sales Order / DC:* ${invoice["so"] || "—"} / ${invoice["dc"] || "—"}\n` +
    (invoice["grade"] === "Grade B" ? `*Grade:* Grade B (loose KG)\n` : "") +
    `\n` +
    `*Products:*\n${productText}\n\n` +
    (summary.returnKg > 0 ? `*Less buyer returns:* ${summary.returnKg} kg (${fmtMoney(summary.returnValue)})\n` : "") +
    `*Taxable:* ${fmtMoney(summary.taxable)}\n` +
    (summary.gst ? `*GST (${summary.gst}%):* ${fmtMoney(summary.tax)}\n` : "") +
    `*Amount payable:* ${fmtMoney(summary.total)}\n` +
    (paid ? `*Received:* ${fmtMoney(paid)}\n*Balance due:* ${fmtMoney(Math.max(0, summary.total - paid))}\n` : "") +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_Thank you for your business._`
  );
}

export function shareInvoiceOnWhatsApp(invoice: Row, summary: InvoiceReturnSummary, buyerPhone?: string) {
  const digits = String(buyerPhone || "").replace(/\D/g, "");
  const phone = digits.length === 10 ? `91${digits}` : digits;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(invoiceWhatsAppText(invoice, summary))}`, "_blank", "noopener,noreferrer");
}

export function InvoiceViewModal({
  invoice,
  deliveries = [],
  returns = [],
  buyerPhone,
  onCreateInvoice,
  onClose,
}: {
  invoice: Row;
  deliveries?: Row[];
  /** Return DCs raised against the invoice's sales order (deducted like delivery rejects). */
  returns?: Row[];
  buyerPhone?: string | undefined;
  onCreateInvoice?: ((invoice: Row) => void) | undefined;
  onClose: () => void;
}) {
  const pendingReturns = invoiceReturnSummary(invoice, deliveries, true, returns);
  const hasPendingReturns = !pendingReturns.applied && pendingReturns.returnKg > 0;
  const [deductReturns, setDeductReturns] = useState(true);
  const summary = invoiceReturnSummary(invoice, deliveries, deductReturns, returns);
  const showReturns = summary.returnKg > 0;
  const paid = num(invoice["paid"]);
  const isProforma = invoice.status === "Draft";
  const title = isProforma ? "Proforma Invoice" : "Sales Invoice";
  const displayId = isProforma ? `PROF-${invoice.id}` : invoice.id;
  const canCreate = onCreateInvoice && (isProforma || hasPendingReturns);

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
      <section role="dialog" aria-modal="true" aria-label={`${title} ${displayId}`} className="w-full max-w-3xl overflow-hidden rounded-2xl bg-card shadow-2xl">
        <header className="invoice-print-controls flex flex-wrap items-center justify-between gap-2 border-b bg-hero px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2">
            <FileText className="size-5" />
            <div>
              <h2 className="font-semibold">{title} {displayId}</h2>
              <p className="text-xs opacity-80">View, share or print this invoice</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <Button
                type="button"
                size="sm"
                className="bg-amber-500 text-white hover:bg-amber-600"
                onClick={() => onCreateInvoice(deductReturns ? invoice : { ...invoice, returnsApplied: "yes" })}
              >
                <CheckCircle2 className="mr-1.5 size-4" /> {isProforma ? "Create Invoice" : "Apply return deduction"}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => shareInvoiceOnWhatsApp(invoice, summary, buyerPhone)} className="text-emerald-700">
              <MessageCircle className="mr-1.5 size-4" /> WhatsApp
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="text-foreground">
              <Printer className="mr-1.5 size-4" /> Print
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close invoice">
              <X className="size-4" />
            </Button>
          </div>
        </header>
        {hasPendingReturns && (
          <label className="invoice-print-controls flex cursor-pointer items-center gap-2 border-b bg-amber-500/10 px-5 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <input type="checkbox" checked={deductReturns} onChange={(event) => setDeductReturns(event.target.checked)} className="size-4 accent-amber-600" />
            Deduct buyer return KG ({pendingReturns.returnKg} kg · {fmtMoney(pendingReturns.returnValue)}) recorded on delivery for {String(invoice["dc"] || "this Sales DC")}
          </label>
        )}
        <div className="max-h-[78vh] overflow-y-auto p-5 sm:p-8">
          <article className="invoice-document mx-auto max-w-2xl border bg-white p-6 text-zinc-900 shadow-sm sm:p-9">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-emerald-700 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Velaan Bay Trading House</p>
                <h1 className="mt-1 text-2xl font-bold">{title}</h1>
                <p className="mt-1 text-xs text-zinc-500">{title} · {invoice["grade"] === "Grade B" ? "Grade B produce (loose KG)" : "Product sales"}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-mono text-lg font-bold">{displayId}</p>
                <p className="text-zinc-600">Date: {String(invoice["date"] || "—")}</p>
                <p className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium">{invoice.status}</p>
              </div>
            </div>

            <div className="my-5 grid grid-cols-1 gap-4 rounded-lg bg-zinc-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-zinc-500">Bill to</p>
                <p className="mt-1 font-semibold">{String(invoice["buyer"] || "—")}</p>
                {buyerPhone && <p className="text-zinc-600">Phone: {buyerPhone}</p>}
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
                  {showReturns && <th className="px-2 py-2 text-right">Sent (kg)</th>}
                  {showReturns && <th className="px-2 py-2 text-right">Return (kg)</th>}
                  <th className="px-2 py-2 text-right">{showReturns ? "Billed (kg)" : "Qty (kg)"}</th>
                  <th className="px-2 py-2 text-right">Rate / kg</th>
                  <th className="py-2 pl-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.lines.map((line) => (
                  <tr key={line.p} className="border-b border-zinc-200">
                    <td className="py-3 pr-2">{line.p}</td>
                    {showReturns && <td className="px-2 py-3 text-right tabular-nums">{line.sentKg.toLocaleString("en-IN")}</td>}
                    {showReturns && <td className="px-2 py-3 text-right tabular-nums text-red-600">{line.returnKg ? `− ${line.returnKg.toLocaleString("en-IN")}` : "—"}</td>}
                    <td className="px-2 py-3 text-right font-medium tabular-nums">{line.billedKg.toLocaleString("en-IN")}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{fmtMoney(line.rate)}</td>
                    <td className="py-3 pl-2 text-right tabular-nums">{fmtMoney(line.amount)}</td>
                  </tr>
                ))}
                {!summary.lines.length && (
                  <tr><td colSpan={6} className="py-6 text-center text-zinc-500">No product lines saved on this invoice.</td></tr>
                )}
              </tbody>
            </table>

            <div className="ml-auto mt-5 w-full max-w-xs space-y-2 text-sm">
              {showReturns && (
                <>
                  <div className="flex justify-between"><span>Gross (sent)</span><span>{fmtMoney(summary.gross)}</span></div>
                  <div className="flex justify-between text-red-600"><span>Less returns ({summary.returnKg} kg)</span><span>− {fmtMoney(summary.returnValue)}</span></div>
                </>
              )}
              <div className="flex justify-between"><span>Taxable amount</span><span>{fmtMoney(summary.taxable)}</span></div>
              <div className="flex justify-between"><span>GST ({summary.gst}%)</span><span>{fmtMoney(summary.tax)}</span></div>
              <div className="flex justify-between border-t border-zinc-300 pt-2 text-base font-bold"><span>Amount payable by buyer</span><span>{fmtMoney(summary.total)}</span></div>
              <div className="flex justify-between text-zinc-600"><span>Received</span><span>{fmtMoney(paid)}</span></div>
              <div className="flex justify-between font-semibold"><span>Balance due</span><span>{fmtMoney(Math.max(0, summary.total - paid))}</span></div>
            </div>
            <p className="mt-10 border-t pt-4 text-center text-xs text-zinc-500">Thank you for your business.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
