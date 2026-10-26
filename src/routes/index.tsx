import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Boxes, IndianRupee, PackageCheck, Truck, AlertTriangle } from "lucide-react";
import { MODULES, STAGES, fmtMoney } from "@/lib/modules";
import { stock } from "@/lib/workflow";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Velaan Portal - Trading House" },
      { name: "description", content: "Trading House operations dashboard: market trips, receipts, QC, packing, sales and money." },
      { property: "og:title", content: "Velaan Portal - Trading House" },
      { property: "og:description", content: "End-to-end Trading House flow from market trip to buyer payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const sum = (rows: readonly object[], k: string) => rows.reduce((a, r) => a + (Number((r as Record<string, unknown>)[k]) || 0), 0);

function Dashboard() {
  const { data } = useStore();
  const get = (k: string) => data[k] ?? [];
  const qc = get("quality-check");
  const balances = stock(data);
  const inv = get("invoices");
  const kpis = [
    { label: "Goods received today", value: `${sum(get("receipts"), "received").toLocaleString("en-IN")} kg`, icon: Boxes, to: "receipts" },
    { label: "Saleable Grade A stock", value: `${balances.filter(s=>s.category === "Grade A").reduce((a,s)=>a+s.qty,0)} kg`, icon: PackageCheck, to: "inventory" },
    { label: "Sales invoiced", value: fmtMoney(sum(inv, "total")), icon: IndianRupee, to: "invoices" },
    { label: "Trips in progress", value: String(get("trips").filter((t) => t.status !== "Submitted").length + get("dispatch").filter((t) => t.status !== "Delivered").length), icon: Truck, to: "trips" },
  ];
  const receivable = sum(inv, "total") - sum(inv, "paid");
  const payable = sum(get("suppliers"), "payable");
  const expenses = sum(get("expenses"), "amount") + sum(get("attendance"), "payable");
  const qcBars = [
    { k: "Grade A", v: sum(qc, "gradeA"), c: "bg-chart-1" },
    { k: "Grade B", v: sum(qc, "gradeB"), c: "bg-chart-2" },
    { k: "Rejected", v: sum(qc, "trash"), c: "bg-chart-4" },
  ];
  const qcTotal = Math.max(1, qcBars.reduce((a, b) => a + b.v, 0));
  const pending = MODULES.map((m) => ({ m, c: get(m.slug).filter((r) => r.status === m.statuses[0]).length })).filter((x) => x.c > 0).slice(0, 6);
  const supplierNotes = get("vendor-offers").slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-hero p-6 text-primary-foreground shadow-card lg:p-8">
        <p className="text-sm opacity-80">Velaan Bay · Operations</p>
        <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">Velaan Portal - Trading House</h1>
        <p className="mt-2 max-w-xl text-sm opacity-85">Live stock, quality grading, exact-KG sales, and inspected returns.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <Link key={k.label} to="/m/$module" params={{ module: k.to }} className="group rounded-xl bg-primary-foreground/10 p-4 backdrop-blur transition hover:bg-primary-foreground/20">
              <k.icon className="size-5 opacity-80" />
              <p className="mt-3 font-display text-2xl font-semibold">{k.value}</p>
              <p className="flex items-center justify-between text-xs opacity-80">{k.label}<ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-100" /></p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="font-semibold">Money position</h2>
          <div className="mt-4 space-y-3">
            {[["Buyer receivable", receivable, "text-info"], ["Supplier payable", payable, "text-warning"], ["Salary + overheads", expenses, "text-destructive"]].map(([l, v, c]) => (
              <div key={l as string} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5">
                <span className="text-sm text-muted-foreground">{l}</span>
                <span className={`font-display font-semibold ${c}`}>{fmtMoney(v)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="font-semibold">QC outcome (kg)</h2>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
            {qcBars.map((b) => <div key={b.k} className={b.c} style={{ width: `${(b.v / qcTotal) * 100}%` }} />)}
          </div>
          <div className="mt-4 space-y-2">
            {qcBars.map((b) => (
              <div key={b.k} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${b.c}`} />{b.k}</span>
                <span className="tabular-nums font-medium">{b.v.toLocaleString("en-IN")} kg</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 text-warning" /> Waiting for action
            </h2>
            <Link to="/m/$module" params={{ module: "vendor-offers" }} className="text-xs text-primary font-medium hover:underline">
              Supplier notes
            </Link>
          </div>
          <ul className="mt-3 divide-y">
            {pending.map(({ m, c }) => (
              <li key={m.slug}>
                <Link to="/m/$module" params={{ module: m.slug }} className="flex items-center justify-between py-2 text-sm hover:text-primary">
                  <span>{m.title} <span className="text-muted-foreground">· {m.statuses[0]}</span></span>
                  <span className="rounded-full bg-warning-soft px-2 text-xs font-semibold text-warning">{c}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Supplier Notes section */}
      <section className="rounded-2xl border bg-card p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Supplier notes & mandi arrival offers</h2>
            <p className="text-xs text-muted-foreground">Latest market availability, price quotes, and arrival notes from wholesale suppliers.</p>
          </div>
          <Link
            to="/m/$module"
            params={{ module: "vendor-offers" }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            All supplier notes <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {supplierNotes.map((n, idx) => (
            <div key={n.id || idx} className="rounded-xl border bg-muted/30 p-3.5 hover:bg-card transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">{String(n["vendor"] || "Supplier")}</span>
                <span className="text-[11px] text-muted-foreground font-mono">{String(n["date"] || "Today")}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {String(n["notes"] || "")}
              </p>
            </div>
          ))}
          {!supplierNotes.length && (
            <p className="text-xs text-muted-foreground col-span-3 py-2">No supplier notes recorded yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-foreground text-lg">Step-by-Step Operations Flow</h2>
            <p className="text-xs text-muted-foreground">Standard operating process flow from buyer demand to supplier settlement and analytics.</p>
          </div>
          <Link
            to="/m/$module"
            params={{ module: "flow-map" }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            Full F01–F28 Process Map <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { step: "Step 1", title: "Masters & Setup", desc: "Partners, profiles, transporters & employees", slug: "suppliers", count: get("suppliers").length + get("buyers").length },
            { step: "Step 2", title: "Buyer - Purchase Order", desc: "Customer purchase orders & consolidation", slug: "purchase-orders", count: get("purchase-orders").length },
            { step: "Step 3", title: "Sourcing & Purchase", desc: "Mandi purchases & daily supplier price board", slug: "trips", count: get("trips").length },
            { step: "Step 4", title: "Inward & Logistics", desc: "Bluetooth scale receipts, crates & transport", slug: "receipts", count: get("receipts").length },
            { step: "Step 5", title: "Quality Check", desc: "Stage 1 & Stage 2 grading and returns triage", slug: "quality-check", count: get("quality-check").length },
            { step: "Step 6", title: "Allocation & Packing", desc: "FIFO allocation, pack sizing & QR sticker tags", slug: "packing", count: get("packing").length },
            { step: "Step 7", title: "Sales & Delivery", desc: "Dispatches, buyer deliveries & return quarantine", slug: "sales-orders", count: get("sales-orders").length },
            { step: "Step 8", title: "Billing & Ledgers", desc: "B2B/B2C invoices, buyer receipts & AP/AR ledgers", slug: "invoices", count: get("invoices").length },
            { step: "Step 9", title: "Inventory & Reports", desc: "6 warehouse locations, stock movements & P&L", slug: "inventory", count: balances.length },
          ].map((item) => (
            <Link
              key={item.step}
              to="/m/$module"
              params={{ module: item.slug }}
              className="group rounded-xl border bg-muted/30 p-3.5 transition-all hover:border-primary hover:bg-card hover:shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                  {item.step}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {item.count} {item.count === 1 ? "record" : "records"}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                {item.title}
                <ArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
