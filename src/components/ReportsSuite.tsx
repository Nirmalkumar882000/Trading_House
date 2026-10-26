import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3, Scale, ScanSearch, Boxes, IndianRupee, History, Download,
  Search, ArrowRight, AlertTriangle, CheckCircle2, TrendingUp, Layers, Wallet
} from "lucide-react";
import { Button } from "./ui/button";
import { useStore } from "@/lib/store";
import { stock, movements, lines, locations, total, num, round, type Category } from "@/lib/workflow";
import { fmtMoney, type ModuleDef } from "@/lib/modules";
import { cn } from "@/lib/utils";

type ReportTab = "stock" | "variance" | "qc" | "packing" | "pnl" | "audit";

const kg = (v: number) => `${v.toLocaleString("en-IN", { maximumFractionDigits: 3 })} kg`;

export function ReportsSuite({ mod }: { mod: ModuleDef }) {
  const { data, role } = useStore();
  const [tab, setTab] = useState<ReportTab>("stock");
  const [q, setQ] = useState<string>("");

  const balances = stock(data);
  const ledger = movements(data);
  const receipts = data["receipts"] ?? [];
  const qcRows = data["quality-check"] ?? [];
  const packRows = data["packing"] ?? [];
  const invoices = data["invoices"] ?? [];
  const trips = data["trips"] ?? [];
  const supplierPrices = data["supplier-prices"] ?? [];
  const expenses = data["expenses"] ?? [];
  const attendance = data["attendance"] ?? [];
  const audits = data["transaction-audit"] ?? [];

  // P&L Calculations
  const totalSalesRevenue = invoices.reduce((s, inv) => s + num(inv["total"]), 0);
  const totalPurchaseCost = supplierPrices.reduce((s, sp) => s + num(sp["amount"]), 0);
  const grossProfit = totalSalesRevenue - totalPurchaseCost;
  const totalSalaries = attendance.reduce((s, att) => s + num(att["payable"]), 0);
  const totalOverheads = expenses.reduce((s, exp) => s + num(exp["amount"]), 0);
  const totalOperatingCosts = totalSalaries + totalOverheads;
  const netProfit = grossProfit - totalOperatingCosts;
  const grossMarginPct = totalSalesRevenue > 0 ? Math.round((grossProfit / totalSalesRevenue) * 1000) / 10 : 0;

  // Filter handlers
  const shownReceipts = receipts.filter((r) =>
    !q || String(r["dc"] || "").toLowerCase().includes(q.toLowerCase()) ||
    String(r["item"] || "").toLowerCase().includes(q.toLowerCase()) ||
    String(r["reason"] || "").toLowerCase().includes(q.toLowerCase())
  );

  const shownQc = qcRows.filter((r) =>
    !q || String(r["grader"] || "").toLowerCase().includes(q.toLowerCase()) ||
    String(r["lot"] || "").toLowerCase().includes(q.toLowerCase()) ||
    String(r["item"] || "").toLowerCase().includes(q.toLowerCase())
  );

  const shownPack = packRows.filter((r) =>
    !q || String(r["packer"] || "").toLowerCase().includes(q.toLowerCase()) ||
    String(r["item"] || "").toLowerCase().includes(q.toLowerCase())
  );

  const shownAudits = audits.filter((r) =>
    !q || String(r["ref"] || "").toLowerCase().includes(q.toLowerCase()) ||
    String(r["action"] || "").toLowerCase().includes(q.toLowerCase()) ||
    String(r["person"] || "").toLowerCase().includes(q.toLowerCase())
  );

  const tabs: { key: ReportTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "stock", label: "Stock & Location Balances", icon: Layers },
    { key: "variance", label: "Receipt Weight Variance (>10%)", icon: Scale },
    { key: "qc", label: "QC Grader Yield & Performance", icon: ScanSearch },
    { key: "packing", label: "KG-to-Pack Conversion Efficiency", icon: Boxes },
    { key: "pnl", label: "Trading Profit & Loss Margins", icon: IndianRupee },
    { key: "audit", label: "Transaction Audit Trail", icon: History },
  ];

  const exportCurrentReport = () => {
    let rows: Record<string, unknown>[] = [];
    if (tab === "stock") rows = balances;
    else if (tab === "variance") rows = receipts;
    else if (tab === "qc") rows = qcRows;
    else if (tab === "packing") rows = packRows;
    else if (tab === "pnl") rows = [{ totalSalesRevenue, totalPurchaseCost, grossProfit, totalOperatingCosts, netProfit }];
    else rows = audits;

    if (!rows.length) return;
    const keys = Object.keys(rows[0] || {});
    const csv = [
      keys.join(","),
      ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replaceAll('"', '""')}"`).join(",")),
    ].join("\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `report-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Stage G · F28 Management Reporting</p>
          <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">Comprehensive Operational & Financial Reports</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Authorised operational reports: real-time stock balances across warehouse bays, transit moisture loss & variance analysis,
            two-stage QC yields, pack conversion metrics, and trading profit & loss.
          </p>
        </div>
        <Button variant="outline" onClick={exportCurrentReport} className="inline-flex items-center gap-2">
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border bg-card p-1.5 shadow-card overflow-x-auto">
        {tabs.map((t) => (
          <Button
            key={t.key}
            variant="ghost"
            onClick={() => { setTab(t.key); setQ(""); }}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5",
              tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </Button>
        ))}
      </div>

      {/* Search Input for filterable tabs */}
      {tab !== "pnl" && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            placeholder={`Search ${tab} records…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
      )}

      {/* TAB 1: Stock & Locations */}
      {tab === "stock" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(["Ungraded", "Grade A", "Grade B", "Remaining", "Packed", "Rejected"] as Category[]).map((c) => (
              <div key={c} className="rounded-xl border bg-card p-3.5 shadow-sm">
                <p className="text-xs text-muted-foreground font-semibold truncate">{c}</p>
                <p className="text-[11px] text-muted-foreground truncate">{locations[c]}</p>
                <p className={cn(
                  "mt-1 text-xl font-bold font-display",
                  c === "Rejected" ? "text-destructive" :
                  c === "Ungraded" ? "text-blue-600 dark:text-blue-400" : "text-primary"
                )}>
                  {kg(balances.filter((s) => s.category === c).reduce((sum, b) => sum + b.qty, 0))}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Stock Category</th>
                  <th className="px-4 py-3 text-left">Warehouse Bay Location</th>
                  <th className="px-4 py-3 text-right">Balance (KG)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {balances
                  .filter((b) => !q || b.product.toLowerCase().includes(q.toLowerCase()) || b.category.toLowerCase().includes(q.toLowerCase()))
                  .sort((a, b) => b.qty - a.qty)
                  .map((b) => (
                    <tr key={`${b.product}-${b.category}`} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold text-foreground">{b.product}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded-md px-2 py-0.5 text-xs font-medium",
                          b.category === "Grade A" ? "bg-emerald-500/10 text-emerald-600" :
                          b.category === "Grade B" ? "bg-blue-500/10 text-blue-600" :
                          b.category === "Rejected" ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"
                        )}>
                          {b.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{b.location}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-foreground">
                        {kg(b.qty)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Receipt Weight Variance */}
      {tab === "variance" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-amber-500/10 border-amber-500/20 p-4 text-xs text-amber-800 dark:text-amber-400 flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Weight Variance Threshold Rule (&gt;10%)</p>
              <p className="mt-0.5">
                Per Process Flow F07 and Customer Decision C06, whenever received weight differs from origin sent weight by more than 10%,
                the system strictly requires supervisor authorization and a recorded reason (e.g. Moisture loss, Transit damage, Spillage).
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Receipt ID</th>
                  <th className="px-4 py-3 text-left">Transport DC</th>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-right">Sent (KG)</th>
                  <th className="px-4 py-3 text-right">Received (KG)</th>
                  <th className="px-4 py-3 text-right">Difference</th>
                  <th className="px-4 py-3 text-left">Variance %</th>
                  <th className="px-4 py-3 text-left">Reason Logged</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shownReceipts.map((r) => {
                  const sent = num(r["sent"]);
                  const rec = num(r["received"]);
                  const diff = num(r["diff"]);
                  const pct = sent > 0 ? Math.round((diff / sent) * 1000) / 10 : 0;
                  const isHighVariance = Math.abs(pct) > 10;

                  return (
                    <tr key={r.id} className={cn("hover:bg-muted/30", isHighVariance && "bg-destructive/5")}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r["dc"]}</td>
                      <td className="px-4 py-3 font-medium">{lines(r).map((l) => l.p).join(", ")}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{kg(sent)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">{kg(rec)}</td>
                      <td className={cn("px-4 py-3 text-right font-mono tabular-nums font-bold", diff < 0 ? "text-destructive" : diff > 0 ? "text-primary" : "text-muted-foreground")}>
                        {diff > 0 ? `+${diff}` : diff} kg
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-bold",
                          isHighVariance ? "bg-destructive/15 text-destructive" :
                          diff !== 0 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
                        )}>
                          {pct > 0 ? `+${pct}%` : `${pct}%`}
                          {isHighVariance && " ⚠ (>10%)"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{r["reason"] || "—"}</td>
                      <td className="px-4 py-3 text-xs">{r.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: QC Grader Yield */}
      {tab === "qc" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">QC Ref</th>
                  <th className="px-4 py-3 text-left">Grader</th>
                  <th className="px-4 py-3 text-left">Lot Source</th>
                  <th className="px-4 py-3 text-right">Input (KG)</th>
                  <th className="px-4 py-3 text-right">Grade A Output</th>
                  <th className="px-4 py-3 text-right">Grade B Output</th>
                  <th className="px-4 py-3 text-right">Trash / Loss</th>
                  <th className="px-4 py-3 text-right">Grade A Yield %</th>
                  <th className="px-4 py-3 text-left">Reconciliation</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shownQc.map((r) => {
                  const input = num(r["input"]);
                  const gradeA = num(r["gradeA"]);
                  const gradeB = num(r["gradeB"]);
                  const trash = num(r["trash"]);
                  const yieldPct = input > 0 ? Math.round((gradeA / input) * 1000) / 10 : 0;
                  const totalOut = gradeA + gradeB + trash;
                  const isReconciled = Math.abs(input - totalOut) < 0.01 || r.status !== "Stage 2 done";

                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.id}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{r["grader"]}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r["lot"]}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{kg(input)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-emerald-600">{kg(gradeA)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-blue-600">{kg(gradeB)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-destructive">{kg(trash)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold">{yieldPct}%</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          isReconciled ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
                        )}>
                          <CheckCircle2 className="size-3" />
                          {r.status === "Stage 2 done" ? "100% Balanced" : "Stage 1 Active"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: KG-to-Pack Efficiency */}
      {tab === "packing" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Packing Job</th>
                  <th className="px-4 py-3 text-left">Packer</th>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Grade</th>
                  <th className="px-4 py-3 text-right">Pack Size</th>
                  <th className="px-4 py-3 text-right">Bags Packed</th>
                  <th className="px-4 py-3 text-right">Total Net (KG)</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shownPack.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.id}</td>
                    <td className="px-4 py-3 font-semibold">{r["packer"]}</td>
                    <td className="px-4 py-3 font-medium">{lines(r).map((l) => l.p).join(", ")}</td>
                    <td className="px-4 py-3 font-medium text-primary">{r["grade"]}</td>
                    <td className="px-4 py-3 text-right font-mono">{r["packSize"]} kg</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{r["packs"]} bags</td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-foreground">{kg(num(r["nominal"]))}</td>
                    <td className="px-4 py-3 text-xs">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Profit & Loss Margins */}
      {tab === "pnl" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Total Sales Revenue</p>
              <p className="mt-2 text-2xl font-bold font-display text-emerald-600">{fmtMoney(totalSalesRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">From {invoices.length} posted sales invoices</p>
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Total Procurement Cost</p>
              <p className="mt-2 text-2xl font-bold font-display text-amber-600">{fmtMoney(totalPurchaseCost)}</p>
              <p className="text-xs text-muted-foreground mt-1">From confirmed supplier prices</p>
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Gross Trading Margin</p>
              <p className={cn("mt-2 text-2xl font-bold font-display", grossProfit >= 0 ? "text-primary" : "text-destructive")}>
                {fmtMoney(grossProfit)} ({grossMarginPct}%)
              </p>
              <p className="text-xs text-muted-foreground mt-1">Sales revenue minus purchase cost</p>
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Net Operating Profit</p>
              <p className={cn("mt-2 text-2xl font-bold font-display", netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
                {fmtMoney(netProfit)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">After salaries ({fmtMoney(totalSalaries)}) + overheads ({fmtMoney(totalOverheads)})</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
            <h2 className="text-base font-semibold text-foreground">Operational Cost Breakdown</h2>
            <div className="space-y-3">
              {[
                ["Billed Sales Revenue", totalSalesRevenue, "text-emerald-600", "+"],
                ["Direct Wholesale Produce Cost", totalPurchaseCost, "text-amber-600", "-"],
                ["Gross Trading Margin", grossProfit, "font-bold text-foreground", "="],
                ["Employee Payroll (26-day basis)", totalSalaries, "text-destructive", "-"],
                ["Overhead Expenses (Rent, Fuel, Packaging)", totalOverheads, "text-destructive", "-"],
                ["Net Trading House Profit", netProfit, "font-bold text-emerald-600 text-lg", "="],
              ].map(([label, val, cl, sign]) => (
                <div key={label as string} className="flex justify-between items-center py-2 border-b last:border-b-0 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground w-4">{sign}</span>
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                  <span className={cn("font-mono font-semibold tabular-nums", cl)}>
                    {fmtMoney(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Transaction Audit Trail */}
      {tab === "audit" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Audit ID</th>
                  <th className="px-4 py-3 text-left">Record Reference</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">State Transition</th>
                  <th className="px-4 py-3 text-left">Timestamp</th>
                  <th className="px-4 py-3 text-left">Authorised Person</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shownAudits.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.id}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{a["ref"]}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "rounded px-2 py-0.5 text-xs font-medium",
                        a["action"] === "Created" ? "bg-emerald-500/10 text-emerald-600" :
                        a["action"] === "Updated" ? "bg-blue-500/10 text-blue-600" : "bg-destructive/10 text-destructive"
                      )}>
                        {a["action"]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">{a["beforeStatus"]} → {a["afterStatus"]}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a["date"]}</td>
                    <td className="px-4 py-3 text-xs font-medium">{a["person"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
