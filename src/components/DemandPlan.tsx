import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ITEMS, type ModuleDef, type Row } from "@/lib/modules";
import { useStore } from "@/lib/store";
import { parseLines, validateData } from "@/lib/workflow";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type ProductPlan = {
  product: string;
  demand: number;
  purchased: number;
  planned?: number;
  buyers: { buyer: string; qty: number; pos: string[] }[];
};

export function DemandPlan({ mod }: { mod: ModuleDef }) {
  const { data, upsert, nextId } = useStore();
  const navigate = useNavigate();

  const plans = useMemo<ProductPlan[]>(() => {
    const map = new Map<string, ProductPlan>();
    const get = (p: string) => {
      if (!map.has(p)) map.set(p, { product: p, demand: 0, purchased: 0, buyers: [] });
      return map.get(p) ?? { product:p, demand:0, purchased:0, buyers:[] };
    };

    // 1) Buyer demand: every PO line, per buyer, excluding rejected POs
    for (const po of data["purchase-orders"] ?? []) {
      if (po.status === "Rejected") continue;
      const lines = parseLines(po["item"]);
      const totalQ = lines.reduce((a, l) => a + (Number(l.q) || 0), 0);
      const extraKg = Number(po["extraKg"]) || 0;
      for (const l of lines) {
        const lineRatio = totalQ > 0 ? (Number(l.q) / totalQ) : (1 / Math.max(1, lines.length));
        const extraShare = extraKg > 0 ? Math.round(extraKg * lineRatio * 100) / 100 : 0;
        const qty = (l.q || (lines.length === 1 ? Number(po["qty"]) || 0 : totalQ ? 0 : Math.round((Number(po["qty"]) || 0) / lines.length))) + extraShare;
        const plan = get(l.p);
        plan.demand += qty;
        let b = plan.buyers.find((x) => x.buyer === po["buyer"]);
        if (!b) { b = { buyer: String(po["buyer"]), qty: 0, pos: [] }; plan.buyers.push(b); }
        b.qty += qty;
        b.pos.push(po.id);
      }
    }

    // 2) Market purchase so far: product quantities on market trips
    for (const t of data["trips"] ?? []) {
      if (t.status !== "Submitted") continue;
      const lines = parseLines(t["item"]);
      const totalQ = lines.reduce((a, l) => a + (Number(l.q) || 0), 0);
      for (const l of lines) {
        const qty = l.q || (lines.length === 1 ? Number(t["net"]) || 0 : totalQ ? 0 : 0);
        if (qty) get(l.p).purchased += qty;
      }
    }

    const known = ITEMS.filter((i) => map.has(i));
    const extra = [...map.keys()].filter((k) => !ITEMS.includes(k));
    return [...known, ...extra].flatMap((k) => { const plan = map.get(k); return plan ? [plan] : []; });
  }, [data]);

  const totalDemand = plans.reduce((a, p) => a + p.demand, 0);
  const totalPurchased = plans.reduce((a, p) => a + p.purchased, 0);

  const planTrip = (p: ProductPlan) => {
    const reserved = (data["trips"] ?? []).filter(t=>t.status !== "Submitted").reduce((s,t)=>s+parseLines(t["item"]).filter(l=>l.p===p.product).reduce((a,l)=>a+l.q,0),0);
    const balance = Math.max(0, p.demand - p.purchased - reserved);
    if (!balance) { toast.error(`${p.product} is fully purchased — no balance to buy.`); return; }
    const trip: Row = {
      id: nextId("trips"),
      status: "Draft",
      date: "2026-10-22",
      po: p.buyers[0]?.pos[0] ?? "",
      supplier: "",
      vehicle: "",
      driver: "",
      item: JSON.stringify([{ p: p.product, q: balance }]),
      units: 0,
      gross: 0,
      tare: 0,
      net: balance,
      rate: 0,
      amount: 0,
      transporter: "",
      responsible: "Ravi Kumar",
      signatures: "0",
    };
    const err = validateData({...data,trips:[...(data["trips"] ?? []),trip]});
    if (err) { toast.error(err); return; }
    upsert("trips", trip);
    toast.success(`${trip.id} created for ${balance.toLocaleString("en-IN")} kg ${p.product} — fill supplier, vehicle and weights.`);
    navigate({ to: "/m/$module", params: { module: "trips" } });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{mod.stage} · {mod.flows}</p>
        <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">{mod.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{mod.description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total buyer demand", value: totalDemand },
          { label: "Purchased in market", value: totalPurchased },
          { label: "Balance to buy", value: plans.reduce((a, p) => a + Math.max(0, p.demand - p.purchased), 0) },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-4 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-primary">{k.value.toLocaleString("en-IN")} kg</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Buyer-wise demand</th>
                <th className="px-4 py-3 text-right font-semibold">Total demand</th>
                <th className="px-4 py-3 text-right font-semibold">Purchased</th>
                <th className="px-4 py-3 text-right font-semibold">Balance to buy</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const reserved = (data["trips"] ?? []).filter(t=>t.status !== "Submitted").reduce((s,t)=>s+parseLines(t["item"]).filter(l=>l.p===p.product).reduce((a,l)=>a+l.q,0),0);
                const balance = Math.max(0, p.demand - p.purchased - reserved);
                const pct = p.demand ? Math.min(100, (p.purchased / p.demand) * 100) : 0;
                return (
                  <tr key={p.product} className="border-t">
                    <td className="px-4 py-3 font-semibold">{p.product}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {p.buyers.map((b) => (
                          <span key={b.buyer} title={b.pos.join(", ")} className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                            <Users className="size-3" /> {b.buyer} · {b.qty.toLocaleString("en-IN")} kg
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{p.demand.toLocaleString("en-IN")} kg</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <p>{p.purchased.toLocaleString("en-IN")} kg</p>
                      <div className="ml-auto mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full", balance ? "bg-warning" : "bg-success")} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular-nums font-semibold", balance ? "text-warning" : "text-success")}>
                      {balance ? `${balance.toLocaleString("en-IN")} kg` : reserved ? "Planned" : "Done"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        onClick={() => planTrip(p)}
                        disabled={!balance}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
                      >
                        <ShoppingCart className="size-3.5" /> Plan market trip
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!plans.length && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No buyer demand yet. Add purchase orders first.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
          <span>Submitted purchases only · draft quantities reserved</span>
          <Link to="/m/$module" params={{ module: "trips" }} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Go to market trips <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
