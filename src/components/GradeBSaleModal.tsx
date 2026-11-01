import { useState } from "react";
import { X, ShoppingCart } from "lucide-react";
import { fmtMoney, type Row } from "@/lib/modules";
import { num, parseLines, round, type ProductLine } from "@/lib/workflow";
import { Button } from "./ui/button";

// Grade B buyer orders skip packing: confirm loose KG (capped to Grade B stock) and ₹/KG, then create the sale and proforma invoice.
export function GradeBSaleModal({
  po,
  draftSale,
  available,
  onConfirm,
  onClose,
}: {
  po: Row;
  draftSale: Row;
  available: (product: string) => number;
  onConfirm: (lines: ProductLine[]) => void;
  onClose: () => void;
}) {
  const demand = parseLines(po["item"]);
  const [lines, setLines] = useState<ProductLine[]>(() =>
    demand.map((line) => {
      const drafted = parseLines(draftSale["item"]).find((entry) => entry.p === line.p);
      return { p: line.p, q: drafted?.q ?? 0, saleRate: num(drafted?.saleRate) };
    }),
  );
  const update = (product: string, patch: Partial<ProductLine>) =>
    setLines((current) => current.map((line) => (line.p === product ? { ...line, ...patch } : line)));
  const selling = lines.filter((line) => line.q > 0);
  const totalKg = round(selling.reduce((sum, line) => sum + line.q, 0));
  const totalValue = Math.round(selling.reduce((sum, line) => sum + line.q * num(line.saleRate), 0));
  const problem = !selling.length
    ? "No Grade B stock is available for this order."
    : selling.find((line) => line.q > available(line.p) + 0.001)
      ? "Sale KG cannot exceed Grade B stock."
      : selling.find((line) => num(line.saleRate) <= 0)
        ? "Enter a selling price for every product."
        : null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-label={`Grade B sale for ${po.id}`} className="w-full max-w-2xl overflow-hidden rounded-2xl bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b bg-hero px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-5" />
            <div>
              <h2 className="font-semibold">New Sale · Grade B · {po.id}</h2>
              <p className="text-xs opacity-80">{String(po["buyer"] || "")} · sold loose in KG directly from Grade B inventory (no packing)</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close Grade B sale">
            <X className="size-4" />
          </Button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Product</th>
                <th className="px-2 py-2 text-right">Demand</th>
                <th className="px-2 py-2 text-right">Grade B stock</th>
                <th className="px-2 py-2 text-right">Sale KG</th>
                <th className="px-2 py-2 text-right">₹ / KG</th>
                <th className="py-2 pl-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((line) => {
                const stockKg = available(line.p);
                const demandKg = demand.find((entry) => entry.p === line.p)?.q ?? 0;
                return (
                  <tr key={line.p}>
                    <td className="py-2 pr-2 font-medium">{line.p}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{demandKg} kg</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-semibold ${stockKg >= demandKg ? "text-blue-600" : "text-amber-600"}`}>{stockKg} kg</td>
                    <td className="px-2 py-2 text-right">
                      <input
                        aria-label={`${line.p} sale KG`}
                        type="number"
                        min="0"
                        step="any"
                        value={line.q || ""}
                        placeholder="0"
                        onChange={(event) => update(line.p, { q: Math.max(0, Number(event.target.value) || 0) })}
                        className="w-20 rounded-lg border bg-background px-2 py-1 text-right text-xs font-semibold tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        aria-label={`${line.p} selling price per KG`}
                        type="number"
                        min="0"
                        step="any"
                        value={line.saleRate || ""}
                        placeholder="0"
                        onChange={(event) => update(line.p, { saleRate: Math.max(0, Number(event.target.value) || 0) })}
                        className="w-20 rounded-lg border bg-background px-2 py-1 text-right text-xs font-semibold text-emerald-600 tabular-nums"
                      />
                    </td>
                    <td className="py-2 pl-2 text-right font-mono text-xs tabular-nums">{fmtMoney(Math.round(line.q * num(line.saleRate)))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 font-semibold">
              <tr>
                <td className="py-2" colSpan={3}>Total</td>
                <td className="px-2 py-2 text-right tabular-nums">{totalKg} kg</td>
                <td />
                <td className="py-2 pl-2 text-right font-mono tabular-nums text-primary">{fmtMoney(totalValue)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Creates a confirmed sales order and a proforma invoice. Grade B stock is deducted when the sale is dispatched.
          </p>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <span className="text-xs font-medium text-destructive">{problem}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="button" size="sm" disabled={!!problem} onClick={() => onConfirm(selling)}>
              Create Sale & Invoice
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
