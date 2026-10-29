import { useState, useMemo } from "react";
import { Package, Trash2, QrCode, Layers, Plus, X, CheckCircle2, AlertCircle, Sparkles, User, Boxes, Zap, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import type { ModuleDef, Row } from "@/lib/modules";
import { PRODUCT_CATALOG } from "@/lib/modules";
import { useStore } from "@/lib/store";
import { StatusBadge } from "./StatusBadge";
import { QrStickerModal } from "./QrStickerModal";
import { EmployeeSelect } from "./EmployeeSelect";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { lines, normalize, num, round, validateData, bagBreakdown, parseLines, type Data } from "@/lib/workflow";

export interface BagSizeOption {
  label: string;
  value: number; // in KG
  displayKg: string;
}

export const STANDARD_BAG_SIZES: BagSizeOption[] = [
  { label: "50 G", value: 0.05, displayKg: "0.05 kg" },
  { label: "100 G", value: 0.1, displayKg: "0.1 kg" },
  { label: "150 G", value: 0.15, displayKg: "0.15 kg" },
  { label: "200 G", value: 0.2, displayKg: "0.2 kg" },
  { label: "250 G", value: 0.25, displayKg: "0.25 kg" },
  { label: "300 G", value: 0.3, displayKg: "0.3 kg" },
  { label: "500 G", value: 0.5, displayKg: "0.5 kg" },
  { label: "1 KG", value: 1.0, displayKg: "1.0 kg" },
  { label: "2 KG", value: 2.0, displayKg: "2.0 kg" },
  { label: "5 KG", value: 5.0, displayKg: "5.0 kg" },
  { label: "10 KG", value: 10.0, displayKg: "10.0 kg" },
  { label: "25 KG", value: 25.0, displayKg: "25.0 kg" },
];

export function formatBagSize(sizeKg: number | string): string {
  const n = Number(sizeKg);
  if (Math.abs(n - 0.05) < 0.001) return "50 G (0.05 kg)";
  if (Math.abs(n - 0.1) < 0.001) return "100 G (0.1 kg)";
  if (Math.abs(n - 0.15) < 0.001) return "150 G (0.15 kg)";
  if (Math.abs(n - 0.2) < 0.001) return "200 G (0.2 kg)";
  if (Math.abs(n - 0.25) < 0.001) return "250 G (0.25 kg)";
  if (Math.abs(n - 0.3) < 0.001) return "300 G (0.3 kg)";
  if (Math.abs(n - 0.5) < 0.001) return "500 G (0.5 kg)";
  if (Math.abs(n - 1.0) < 0.001) return "1 KG (1.0 kg)";
  if (Math.abs(n - 2.0) < 0.001) return "2 KG";
  if (Math.abs(n - 5.0) < 0.001) return "5 KG";
  if (Math.abs(n - 10.0) < 0.001) return "10 KG";
  if (Math.abs(n - 25.0) < 0.001) return "25 KG";
  if (n < 1 && n > 0) return `${Math.round(n * 1000)} G (${n} kg)`;
  return `${n} kg`;
}

type Tab = { key: string; label: string; stage: "Stage 1" | "Stage 2" | "Reject"; grade: "Grade A" | "Grade B" | "Rejected" };
const TABS: Tab[] = [
  { key: "s1a", label: "Stage 1 · Grade A", stage: "Stage 1", grade: "Grade A" },
  { key: "s2a", label: "Stage 2 · Grade A", stage: "Stage 2", grade: "Grade A" },
  { key: "s2b", label: "Stage 2 · Grade B", stage: "Stage 2", grade: "Grade B" },
  { key: "rej", label: "Rejected", stage: "Reject", grade: "Rejected" },
];
const kg = (v: number) => `${v.toLocaleString("en-IN", { maximumFractionDigits: 3 })} kg`;

// KG graded per product for a tab, taken from the quality-check records.
function graded(data: Data, tab: Tab): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of data["quality-check"] ?? []) {
    if (r.status === "Assigned") continue;
    const done2 = r.status === "Stage 2 done";
    for (const l of lines(r, "input")) {
      const a = num(l.a), a2 = num(l.a2), b = num(l.b);
      const q =
        tab.key === "s1a" ? a
        : tab.key === "s2a" ? (done2 ? a2 : 0)
        : tab.key === "s2b" ? (done2 ? b : 0)
        : done2 ? round(l.q - a + num(l.ret) - a2 - b) : 0;
      if (q > 0) out.set(l.p, round((out.get(l.p) ?? 0) + q));
    }
  }
  return out;
}

interface SplitItem {
  size: number;
  qty: number;
  packs?: number;
  poId?: string;
  buyer?: string;
}

export function PackingPage({ mod }: { mod: ModuleDef }) {
  const { data, upsert, remove, nextId } = useStore();
  const [tabKey, setTabKey] = useState(TABS[0]!.key);
  const [packer, setPacker] = useState("Senthil P");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [customSizeActive, setCustomSizeActive] = useState<Record<string, boolean>>({});
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [targetBuyers, setTargetBuyers] = useState<Record<string, string>>({});
  const [activeQrRow, setActiveQrRow] = useState<Row | null>(null);

  // Split Modal State
  const [splitProduct, setSplitProduct] = useState<string | null>(null);
  const [splitRemaining, setSplitRemaining] = useState<number>(0);
  const [splitTargetPo, setSplitTargetPo] = useState<string>("");
  const [splits, setSplits] = useState<SplitItem[]>([
    { size: 0.25, qty: 0 },
    { size: 0.5, qty: 0 },
  ]);

  const tab = TABS.find((t) => t.key === tabKey)!;
  const packRows = (data["packing"] ?? []).filter((r) => r["stage"] === tab.stage && r["grade"] === tab.grade);
  const packedOf = (p: string) => packRows.reduce((s, r) => s + (lines(r).find((l) => l.p === p)?.q ?? 0), 0);
  const products = [...graded(data, tab).entries()];
  const isReject = tab.stage === "Reject";

  // Buyer Allocations: Demand vs Actual based on Product Packaging (Requirements 22 & 23)
  const buyerAllocations = useMemo(() => {
    const pos = (data["purchase-orders"] ?? []).filter((r) => r.status !== "Rejected");
    const packingRecords = data["packing"] ?? [];

    const items: Array<{
      poId: string;
      buyer: string;
      product: string;
      packSizeLabel: string;
      packSizeKg: number;
      demandKg: number;
      demandPacks: number;
      actualPacks: number;
      actualKg: number;
      balanceKg: number;
      balancePacks: number;
    }> = [];

    for (const po of pos) {
      const buyer = String(po["buyer"] || "Direct Buyer");
      const poLines = parseLines(po["item"]);
      for (const l of poLines) {
        const spec =
          PRODUCT_CATALOG.find((p) => p.name.toLowerCase() === l.p.toLowerCase()) ||
          PRODUCT_CATALOG.find((p) => p.name.toLowerCase().includes(l.p.toLowerCase())) ||
          { defaultPackSize: "1 kg", packSizeKg: 1.0 };
        const packSizeKg = spec.packSizeKg > 0 ? spec.packSizeKg : 1.0;
        const demandPacks = Math.ceil(l.q / packSizeKg);

        // Find actual packed for this specific PO and buyer
        const productPacks = packingRecords.filter((pr) => {
          const matchPo = pr["po"] ? pr["po"] === po.id : pr["buyer"] === buyer;
          const prLines = lines(pr);
          return matchPo && prLines.some((x) => x.p.toLowerCase() === l.p.toLowerCase());
        });

        const actualKg = productPacks.reduce((sum, pr) => {
          const match = lines(pr).find((x) => x.p.toLowerCase() === l.p.toLowerCase());
          return sum + (match?.q || 0);
        }, 0);

        const actualPacks = productPacks.reduce((sum, pr) => {
          return sum + (num(pr["packs"]) || Math.ceil((num(lines(pr)[0]?.q) || 0) / (num(pr["packSize"]) || packSizeKg)));
        }, 0);

        const balanceKg = Math.max(0, round(l.q - actualKg));
        const balancePacks = Math.max(0, demandPacks - actualPacks);

        items.push({
          poId: po.id,
          buyer,
          product: l.p,
          packSizeLabel: spec.defaultPackSize,
          packSizeKg,
          demandKg: l.q,
          demandPacks,
          actualPacks,
          actualKg,
          balanceKg,
          balancePacks,
        });
      }
    }
    return items;
  }, [data]);

  // Same-product multi-buyer groupings for comparative visibility
  const multiBuyerGroups = useMemo(() => {
    const map = new Map<string, typeof buyerAllocations>();
    for (const item of buyerAllocations) {
      const key = item.product.toLowerCase();
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
    }
    return [...map.entries()].map(([_, items]) => ({
      product: items[0]!.product,
      totalDemandKg: items.reduce((s, i) => s + i.demandKg, 0),
      totalPackedKg: items.reduce((s, i) => s + i.actualKg, 0),
      totalBalanceKg: items.reduce((s, i) => s + i.balanceKg, 0),
      buyers: items,
    }));
  }, [buyerAllocations]);

  const pack = (product: string, remaining: number): void => {
    const q = qtys[product] === undefined || qtys[product] === "" ? remaining : Number(qtys[product]);
    const size = Number(sizes[product]);
    if (!packer.trim()) { toast.error("Select at least one assigned packer"); return; }
    if (!(size > 0)) { toast.error("Select or enter a bag size (e.g. 250 G, 500 G, 1 KG)"); return; }
    if (!(q > 0) || q > remaining + 0.001) { toast.error(`Pack quantity must be between 0 and ${remaining} kg`); return; }

    const targetPoId = targetBuyers[product] || "";
    const targetPo = targetPoId ? (data["purchase-orders"] ?? []).find((p) => p.id === targetPoId) : null;
    const buyerName = targetPo ? String(targetPo["buyer"] || "") : "";

    const breakdown = bagBreakdown(q, size);
    const row = normalize("packing", {
      id: nextId("packing"),
      status: "Packed",
      date: new Date().toISOString().slice(0, 10),
      po: targetPoId,
      buyer: buyerName,
      stage: tab.stage,
      grade: tab.grade,
      packer: packer.trim(),
      packSize: size,
      item: JSON.stringify([{ p: product, q }]),
    } as Row);

    const err = validateData({ ...data, packing: [...(data["packing"] ?? []), row] });
    if (err) { toast.error(err); return; }
    upsert("packing", row);
    setQtys((s) => ({ ...s, [product]: "" }));

    const sizeLabel = formatBagSize(size);
    if (targetPo && buyerName) {
      const matchAlloc = buyerAllocations.find(
        (b) => b.poId === targetPoId && b.product.toLowerCase() === product.toLowerCase()
      );
      const newBal = matchAlloc ? Math.max(0, round(matchAlloc.balanceKg - q)) : 0;
      
      const otherBuyers = buyerAllocations.filter(
        (b) => b.poId !== targetPoId && b.product.toLowerCase() === product.toLowerCase() && b.balanceKg > 0
      );
      const otherNote = otherBuyers.length
        ? ` · Note: ${otherBuyers[0]!.buyer} still has ${otherBuyers[0]!.balanceKg} kg pending balance.`
        : "";

      toast.success(
        `${row.id}: ${q} kg ${product} packed for ${buyerName} (${targetPoId})! Remaining balance for ${buyerName}: ${newBal} kg.${otherNote}`
      );
    } else {
      if (breakdown.partial > 0) {
        toast.success(`${row.id}: ${q} kg ${product} packed into ${breakdown.full} full bags (${sizeLabel}) + 1 partial bag (${breakdown.partial} kg)`);
      } else {
        toast.success(`${row.id}: ${q} kg ${product} packed into ${breakdown.full} bags (${sizeLabel})`);
      }
    }
  };

  const openSplitModal = (product: string, remaining: number, targetPoId: string = "") => {
    setSplitProduct(product);
    setSplitRemaining(remaining);
    setSplitTargetPo(targetPoId);

    // Find pending demands for this product
    const demands = buyerAllocations.filter(
      (b) => b.product.toLowerCase() === product.toLowerCase() && b.balanceKg > 0
    );
    const top = demands[0];

    if (top) {
      // Pre-fill top demand: 250 G - 25 packs (or actual balance)
      const topSize = top.packSizeKg > 0 ? top.packSizeKg : 0.25;
      const topPacks = top.balancePacks > 0 ? top.balancePacks : 25;
      const topQty = round(Math.min(remaining, topPacks * topSize));
      const actualPacks = topSize > 0 ? Math.ceil(topQty / topSize) : topPacks;
      const rem = Math.max(0, round(remaining - topQty));

      const linesArr: SplitItem[] = [
        {
          size: topSize,
          packs: actualPacks,
          qty: topQty,
          poId: top.poId,
          buyer: top.buyer,
        },
      ];

      if (rem > 0) {
        const next = demands[1];
        if (next) {
          const nextSize = next.packSizeKg > 0 ? next.packSizeKg : 0.5;
          const nextPacks = Math.min(next.balancePacks || 50, Math.ceil(rem / nextSize));
          const nextQty = round(Math.min(rem, nextPacks * nextSize));
          linesArr.push({
            size: nextSize,
            packs: nextPacks,
            qty: nextQty,
            poId: next.poId,
            buyer: next.buyer,
          });
        } else {
          const defSize = 0.5;
          const defPacks = Math.ceil(rem / defSize);
          linesArr.push({
            size: defSize,
            packs: defPacks,
            qty: rem,
            poId: "",
            buyer: "",
          });
        }
      }

      setSplits(linesArr);
      setSplitTargetPo(top.poId);
    } else {
      // Default: 250 G (25 packs = 6.25 kg) + remainder in 500 G
      const defSize = 0.25;
      const defPacks = Math.min(25, Math.max(1, Math.floor(remaining / defSize)));
      const defQty = round(defPacks * defSize);
      const rem = Math.max(0, round(remaining - defQty));
      const nextSize = 0.5;
      const nextPacks = nextSize > 0 ? Math.ceil(rem / nextSize) : 0;

      setSplits([
        { size: defSize, packs: defPacks, qty: defQty, poId: targetPoId },
        { size: nextSize, packs: nextPacks, qty: rem, poId: "" },
      ]);
    }
  };

  const handleApplySplit = () => {
    if (!splitProduct) return;
    const totalAllocated = splits.reduce((sum, s) => sum + num(s.qty), 0);
    if (totalAllocated <= 0) {
      toast.error("Enter quantities or bag counts for the package split");
      return;
    }
    if (totalAllocated > splitRemaining + 0.001) {
      toast.error(`Total allocated (${totalAllocated} kg) exceeds remaining graded stock (${splitRemaining} kg)`);
      return;
    }
    if (!packer.trim()) {
      toast.error("Select at least one assigned packer");
      return;
    }

    const validSplits = splits.filter((s) => s.qty > 0 && s.size > 0);
    if (!validSplits.length) {
      toast.error("Configure at least one valid bag size and quantity");
      return;
    }

    const targetPo = splitTargetPo ? (data["purchase-orders"] ?? []).find((p) => p.id === splitTargetPo) : null;
    const buyerName = targetPo ? String(targetPo["buyer"] || "") : "";

    let currentPacking = [...(data["packing"] ?? [])];
    const createdRows: Row[] = [];
    const dateStr = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < validSplits.length; i++) {
      const sp = validSplits[i]!;
      const maxIdNum = Math.max(1000, ...currentPacking.map((r) => Number(r.id.split("-")[1]) || 0));
      const newId = `PK-${maxIdNum + 1}`;
      const linePoId = sp.poId !== undefined && sp.poId !== "" ? sp.poId : splitTargetPo;
      const lineTargetPo = linePoId ? (data["purchase-orders"] ?? []).find((p) => p.id === linePoId) : null;
      const lineBuyerName = lineTargetPo
        ? String(lineTargetPo["buyer"] || "")
        : sp.buyer || (splitTargetPo && targetPo ? buyerName : "");
      const packsCount = sp.packs || (sp.size > 0 ? Math.ceil(sp.qty / sp.size) : 1);

      const row = normalize("packing", {
        id: newId,
        status: "Packed",
        date: dateStr,
        po: linePoId,
        buyer: lineBuyerName,
        stage: tab.stage,
        grade: tab.grade,
        packer: packer.trim(),
        packSize: sp.size,
        packs: packsCount,
        item: JSON.stringify([{ p: splitProduct, q: sp.qty }]),
      } as Row);

      currentPacking = [...currentPacking, row];
      createdRows.push(row);
    }

    const err = validateData({ ...data, packing: currentPacking });
    if (err) {
      toast.error(err);
      return;
    }

    // Persist all rows
    createdRows.forEach((r) => upsert("packing", r));
    setSplitProduct(null);
    setSplitTargetPo("");
    const allocLabel = buyerName ? ` for ${buyerName} (${splitTargetPo})` : "";
    toast.success(
      `Package Split Complete: Generated ${createdRows.length} packaging lots for ${splitProduct}${allocLabel} (${totalAllocated} kg total)!`
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{mod.stage} · {mod.flows}</p>
        <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">{mod.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Pack and split each product from the quality check output into retail & wholesale bag sizes (250 G, 500 G, 1 KG, 2 KG, 5 KG, etc.).
          Stage 1 Grade A, Stage 2 Grade A and Stage 2 Grade B are packed separately; rejected stock stays isolated.
        </p>
      </div>

      {/* Grade A Packing Needed Banner (Requirement 20) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Grade A Quality Produce · Packing Needed</h3>
            <p className="text-xs text-muted-foreground">
              QC First-Check Grade A produce is ready for packaging into retail packet sizes (500g, 1kg, 5kg) & same-day QR stickers.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
            Grade A · Ready for Packing
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        {TABS.map((t) => {
          const total = [...graded(data, t).values()].reduce((s, v) => s + v, 0);
          return (
            <button
              key={t.key}
              onClick={() => setTabKey(t.key)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                t.key === tabKey ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label} <span className="ml-1 text-xs font-semibold">({kg(total)})</span>
            </button>
          );
        })}
      </div>

      {!isReject && (
        <div className="max-w-md">
          <EmployeeSelect
            multiple
            label="Assigned Packer(s) (Multi-select)"
            roleFilter="Packer"
            value={packer}
            onChange={setPacker}
            placeholder="Select Packer(s)"
          />
        </div>
      )}

      {/* Main Allocation Table */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">{isReject ? "Rejected KG" : "Graded KG"}</th>
              {!isReject && (
                <>
                  <th className="px-4 py-3 text-left">Packed KG</th>
                  <th className="px-4 py-3 text-left">Remaining KG</th>
                  <th className="px-4 py-3 text-left min-w-[220px]">Target Buyer Demand</th>
                  <th className="px-4 py-3 text-left min-w-[240px]">Bag Size · Select / Presets</th>
                  <th className="px-4 py-3 text-left min-w-[140px]">Pack KG</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map(([p, g]) => {
              const packed = packedOf(p);
              const remaining = round(g - packed);
              const curSizeStr = sizes[p] ?? "";
              const curSize = Number(curSizeStr) || 0;
              const curQty = qtys[p] === undefined || qtys[p] === "" ? remaining : Number(qtys[p]);
              const breakdown = curSize > 0 && curQty > 0 ? bagBreakdown(curQty, curSize) : null;
              const isCustom = customSizeActive[p] || (curSizeStr && !STANDARD_BAG_SIZES.some((s) => String(s.value) === curSizeStr));

              const productSpec = PRODUCT_CATALOG.find(
                (c) => c.name.toLowerCase() === p.toLowerCase() || p.toLowerCase().includes(c.name.toLowerCase())
              );

              const demandsForP = buyerAllocations.filter(
                (b) => b.product.toLowerCase() === p.toLowerCase()
              );
              const selectedTargetPo = targetBuyers[p] || "";
              const activeDemand = demandsForP.find((d) => d.poId === selectedTargetPo);

              return (
                <tr key={p} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-foreground">{p}</p>
                    {productSpec && (
                      <span className="inline-flex items-center gap-1 mt-0.5 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Standard: <strong className="text-foreground">{productSpec.defaultPackSize}</strong>
                        {productSpec.category && <span className="opacity-75">· {productSpec.category}</span>}
                      </span>
                    )}

                    {/* Multi-buyer interactive demand & balance pills */}
                    {demandsForP.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Buyer Demands & Balances:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {demandsForP.map((d) => {
                            const isSelected = selectedTargetPo === d.poId;
                            const isFulfilled = d.balanceKg <= 0.001;
                            return (
                              <button
                                key={d.poId}
                                type="button"
                                onClick={() => {
                                  setTargetBuyers((prev) => ({ ...prev, [p]: d.poId }));
                                  if (d.balanceKg > 0) {
                                    setQtys((prev) => ({ ...prev, [p]: String(Math.min(remaining, d.balanceKg)) }));
                                  }
                                  setSizes((prev) => ({ ...prev, [p]: String(d.packSizeKg) }));
                                  setCustomSizeActive((prev) => ({ ...prev, [p]: false }));
                                }}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all text-left border cursor-pointer",
                                  isSelected
                                    ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/30"
                                    : isFulfilled
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:border-amber-500"
                                )}
                                title={`Click to target demand for ${d.buyer} (${d.poId})`}
                              >
                                <User className="size-3 shrink-0" />
                                <span className="font-semibold">{d.buyer} ({d.poId}):</span>
                                <span className="text-muted-foreground">{d.demandKg} kg</span>
                                <span className="opacity-50">·</span>
                                {isFulfilled ? (
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Packed (Bal: 0 kg) ✓</span>
                                ) : (
                                  <span>Packed {d.actualKg} kg · <strong className="text-amber-700 dark:text-amber-300">Bal: {d.balanceKg} kg</strong></span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{kg(g)}</td>
                  {!isReject && (
                    <>
                      <td className="px-4 py-3.5 text-muted-foreground">{kg(packed)}</td>
                      <td className="px-4 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        {kg(remaining)}
                      </td>

                      {/* Target Buyer Demand Selector */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <select
                            aria-label={`Select buyer demand for ${p}`}
                            value={selectedTargetPo}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTargetBuyers((prev) => ({ ...prev, [p]: val }));
                              const d = demandsForP.find((x) => x.poId === val);
                              if (d) {
                                if (d.balanceKg > 0) {
                                  setQtys((prev) => ({ ...prev, [p]: String(Math.min(remaining, d.balanceKg)) }));
                                }
                                setSizes((prev) => ({ ...prev, [p]: String(d.packSizeKg) }));
                                setCustomSizeActive((prev) => ({ ...prev, [p]: false }));
                              }
                            }}
                            className="h-8 w-full min-w-44 rounded-md border bg-background px-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">📦 General Sales Stock</option>
                            {demandsForP.map((d) => (
                              <option key={d.poId} value={d.poId}>
                                👤 {d.buyer} · {d.poId} (Bal: {d.balanceKg} kg / {d.demandKg} kg) {d.balanceKg <= 0.001 ? "✓ Fulfilled" : ""}
                              </option>
                            ))}
                          </select>
                          {activeDemand ? (
                            <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                              <span className="font-semibold text-primary">{activeDemand.buyer}:</span>
                              <span className="text-muted-foreground">{activeDemand.demandKg} kg total</span>
                              <span className="opacity-40">·</span>
                              {activeDemand.balanceKg <= 0.001 ? (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">0 kg bal (Fulfilled)</span>
                              ) : (
                                <span className="font-bold text-amber-600 dark:text-amber-400">Bal: {activeDemand.balanceKg} kg</span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">General warehouse stock</p>
                          )}
                        </div>
                      </td>

                      {/* Bag Size Selector with Presets */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <select
                              aria-label={`Select bag size for ${p}`}
                              value={isCustom ? "custom" : curSizeStr}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "custom") {
                                  setCustomSizeActive((prev) => ({ ...prev, [p]: true }));
                                  setSizes((prev) => ({ ...prev, [p]: "" }));
                                } else {
                                  setCustomSizeActive((prev) => ({ ...prev, [p]: false }));
                                  setSizes((prev) => ({ ...prev, [p]: val }));
                                }
                              }}
                              className="h-8 rounded-md border bg-background px-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="">Select bag size...</option>
                              {STANDARD_BAG_SIZES.map((opt) => (
                                <option key={opt.label} value={String(opt.value)}>
                                  {opt.label} ({opt.displayKg})
                                </option>
                              ))}
                              <option value="custom">Custom KG...</option>
                            </select>

                            {isCustom && (
                              <input
                                type="number"
                                step="any"
                                min={0.01}
                                placeholder="e.g. 0.75"
                                value={sizes[p] ?? ""}
                                onChange={(e) => setSizes((prev) => ({ ...prev, [p]: e.target.value }))}
                                className="h-8 w-20 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            )}
                          </div>

                          {/* Quick 1-click Preset Pills */}
                          <div className="flex flex-wrap gap-1">
                            {STANDARD_BAG_SIZES.slice(0, 8).map((opt) => {
                              const active = curSizeStr === String(opt.value);
                              return (
                                <button
                                  type="button"
                                  key={opt.label}
                                  onClick={() => {
                                    setCustomSizeActive((prev) => ({ ...prev, [p]: false }));
                                    setSizes((prev) => ({ ...prev, [p]: String(opt.value) }));
                                  }}
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all",
                                    active
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                                  )}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Live split preview */}
                          {breakdown && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold leading-tight">
                              ⚡ Split: {breakdown.full} {breakdown.full === 1 ? "bag" : "bags"}
                              {breakdown.partial > 0 ? ` + 1 partial (${breakdown.partial} kg)` : ""}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Pack Quantity */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <input
                            type="number"
                            step="any"
                            min={0}
                            max={remaining}
                            placeholder={String(remaining)}
                            value={qtys[p] ?? ""}
                            onChange={(e) => setQtys((s) => ({ ...s, [p]: e.target.value }))}
                            className="h-8 w-24 rounded-md border bg-background px-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <button
                            type="button"
                            onClick={() => setQtys((s) => ({ ...s, [p]: String(remaining) }))}
                            className="block text-[10px] text-primary hover:underline font-semibold"
                          >
                            All ({remaining} kg)
                          </button>
                        </div>
                      </td>

                      {/* Actions: Pack + Split Pack */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            disabled={remaining <= 0}
                            onClick={() => pack(p, remaining)}
                            className="h-8 gap-1 px-3 text-xs font-semibold shadow-sm"
                          >
                            <Package className="size-3.5" /> Pack
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={remaining <= 0}
                            onClick={() => openSplitModal(p, remaining, selectedTargetPo)}
                            className="h-8 gap-1 px-2.5 text-xs text-primary hover:bg-primary/10"
                            title="Split into multiple bag sizes at once (250 G, 500 G, 1 KG...)"
                          >
                            <Layers className="size-3.5" /> Split Pack
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!products.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {tab.stage === "Stage 2" || isReject
              ? "Nothing graded yet. Complete Stage 2 in Two-stage quality check."
              : "Nothing graded yet. Complete Stage 1 in Two-stage quality check."}
          </p>
        )}
      </div>

      {/* Packed Records Table */}
      {!isReject && packRows.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Packed Production Batches · {tab.label}</h2>
            <span className="text-xs text-muted-foreground">{packRows.length} lot(s) packed</span>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  {["Ref", "Product", "Allocated To", "Total KG", "Bag Size", "Bags Created", "Packer(s)", "Status", "Actions"].map(
                    (h) => (
                      <th key={h} className="px-4 py-3 text-left">{h}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {packRows.map((r) => {
                  const nominal = num(r["nominal"]);
                  const size = num(r["packSize"]);
                  const breakdown = size > 0 && nominal > 0 ? bagBreakdown(nominal, size) : null;
                  return (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{r.id}</td>
                      <td className="px-4 py-3 font-medium">{lines(r).map((l) => l.p).join(", ")}</td>
                      <td className="px-4 py-3">
                        {r["po"] ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            <User className="size-3" /> {r["buyer"] || "Buyer"} · {r["po"]}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            <Boxes className="size-3" /> General Stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{kg(nominal)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                          {formatBagSize(size)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span className="font-bold">{r["packs"]}</span>
                        {breakdown && breakdown.partial > 0 && (
                          <span className="ml-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                            ({breakdown.full} full + {breakdown.partial} kg partial)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {String(r["packer"] || "—")
                            .split(",")
                            .map((p) => p.trim())
                            .filter(Boolean)
                            .map((p) => (
                              <span
                                key={p}
                                className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                              >
                                {p}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} statuses={mod.statuses} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveQrRow(r)}
                            className="h-7 text-xs text-primary hover:bg-primary/10 inline-flex items-center gap-1"
                          >
                            <QrCode className="size-3.5" /> Sticker (BLE)
                          </Button>
                          <button
                            aria-label="Delete"
                            className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                            onClick={() => {
                              if (confirm(`Delete packing record ${r.id}?`)) {
                                remove("packing", r.id);
                                toast.success(`${r.id} deleted`);
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Buyer Allocation & Split Pack: Demand vs Actual (Requirements 22 & 23) */}
      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Buyer Allocation & Split Pack: Demand vs Actual</h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Product Packaging Specific
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare Buyer Demand Pack Count vs Actual Packed Bags based on standard product packaging (e.g. Tomato 500g, Onion 1kg, Potato 5kg).
            </p>
          </div>
        </div>

        {/* Multi-Buyer Same-Product Comparison Cards */}
        {multiBuyerGroups.length > 0 && (
          <div className="space-y-2.5 rounded-xl bg-muted/30 p-3.5 border">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Multi-Buyer Produce Demand & Balance Overview</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {multiBuyerGroups.map((group) => {
                const pct = group.totalDemandKg > 0 ? Math.min(100, Math.round((group.totalPackedKg / group.totalDemandKg) * 100)) : 0;
                return (
                  <div key={group.product} className="rounded-xl border bg-card p-3.5 space-y-3 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{group.product}</h4>
                        <p className="text-xs text-muted-foreground">
                          Demand: <strong>{group.totalDemandKg} kg</strong> · Packed: <strong className="text-emerald-600 dark:text-emerald-400">{group.totalPackedKg} kg</strong>
                          {group.totalBalanceKg > 0 ? (
                            <span className="ml-1 text-amber-600 dark:text-amber-400">· Pending Balance: <strong>{group.totalBalanceKg} kg</strong></span>
                          ) : (
                            <span className="ml-1 text-emerald-600 dark:text-emerald-400">· All Fulfilled ✓</span>
                          )}
                        </p>
                      </div>
                      <span className={cn("text-xs font-bold rounded-full px-2 py-0.5", pct >= 100 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300")}>
                        {pct}% Packed
                      </span>
                    </div>

                    {/* Buyer-by-buyer cards */}
                    <div className="space-y-1.5">
                      {group.buyers.map((b) => (
                        <div key={b.poId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2 text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <User className="size-3 text-primary" />
                              <span>{b.buyer}</span>
                              <span className="font-mono text-[11px] text-primary">({b.poId})</span>
                            </div>
                            <p className="text-muted-foreground text-[11px]">
                              Demand: <strong>{b.demandKg} kg</strong> ({b.demandPacks} pkts @ {b.packSizeLabel}) · Packed: <strong className="text-emerald-600 dark:text-emerald-400">{b.actualKg} kg</strong>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {b.balanceKg <= 0.001 ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="size-3" /> Fulfilled (0 kg bal)
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-md bg-amber-500/10 px-2 py-1 font-bold text-amber-700 dark:text-amber-400">
                                  Bal: {b.balanceKg} kg ({b.balancePacks} pkts)
                                </span>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => {
                                    setTabKey("s1a");
                                    setTargetBuyers((prev) => ({ ...prev, [b.product]: b.poId }));
                                    const gKg = graded(data, TABS[0]!).get(b.product) ?? 0;
                                    const packedKg = packedOf(b.product);
                                    const avail = Math.max(0, round(gKg - packedKg));
                                    setQtys((prev) => ({ ...prev, [b.product]: String(Math.min(avail, b.balanceKg)) }));
                                    setSizes((prev) => ({ ...prev, [b.product]: String(b.packSizeKg) }));
                                    setCustomSizeActive((prev) => ({ ...prev, [b.product]: false }));
                                    toast.info(`Target set to ${b.buyer} (${b.poId}) with ${Math.min(avail, b.balanceKg)} kg. Click "Pack" above.`);
                                  }}
                                  className="h-7 px-2 text-xs gap-1 font-semibold"
                                >
                                  <Zap className="size-3" /> Pack
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3.5 py-2.5 text-left">Buyer & PO</th>
                <th className="px-3.5 py-2.5 text-left">Product</th>
                <th className="px-3.5 py-2.5 text-left">Product Packaging</th>
                <th className="px-3.5 py-2.5 text-right">Demand (KG)</th>
                <th className="px-3.5 py-2.5 text-right">Demand Pack Count</th>
                <th className="px-3.5 py-2.5 text-right">Actual Packed Bags</th>
                <th className="px-3.5 py-2.5 text-right">Actual Packed KG</th>
                <th className="px-3.5 py-2.5 text-right">Balance Remaining</th>
                <th className="px-3.5 py-2.5 text-center">Fulfillment Status</th>
                <th className="px-3.5 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {buyerAllocations.map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/20">
                  <td className="px-3.5 py-3 font-medium">
                    <span className="block font-semibold text-foreground">{item.buyer}</span>
                    <span className="font-mono text-xs text-primary">{item.poId}</span>
                  </td>
                  <td className="px-3.5 py-3 font-semibold text-foreground">{item.product}</td>
                  <td className="px-3.5 py-3">
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {item.packSizeLabel} ({item.packSizeKg} kg)
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono tabular-nums">{item.demandKg} kg</td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold text-foreground tabular-nums">
                    {item.demandPacks} pkts
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {item.actualPacks} pkts
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono tabular-nums">{item.actualKg} kg</td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold tabular-nums">
                    {item.balanceKg <= 0.001 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                        0 kg
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                        {item.balanceKg} kg ({item.balancePacks} pkts)
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    {item.actualPacks >= item.demandPacks ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
                        <CheckCircle2 className="size-3" /> Fulfilled
                      </span>
                    ) : item.actualPacks > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-xs font-semibold">
                        Partial ({item.demandPacks - item.actualPacks} pkts short)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-medium">
                        Pending Packing
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.balanceKg > 0 && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setTabKey("s1a");
                            setTargetBuyers((prev) => ({ ...prev, [item.product]: item.poId }));
                            const gKg = graded(data, TABS[0]!).get(item.product) ?? 0;
                            const packedKg = packedOf(item.product);
                            const avail = Math.max(0, round(gKg - packedKg));
                            setQtys((prev) => ({ ...prev, [item.product]: String(Math.min(avail, item.balanceKg)) }));
                            setSizes((prev) => ({ ...prev, [item.product]: String(item.packSizeKg) }));
                            setCustomSizeActive((prev) => ({ ...prev, [item.product]: false }));
                            toast.info(`Target set to ${item.buyer} (${item.poId}). Ready to pack.`);
                          }}
                          className="h-7 text-xs gap-1 font-semibold"
                        >
                          <Zap className="size-3" /> Pack Demand
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSplitProduct(item.product);
                          setSplitRemaining(item.demandKg);
                          setSplitTargetPo(item.poId);
                          setSplits([{ size: item.packSizeKg, qty: item.demandKg }]);
                        }}
                        className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Layers className="size-3" /> Split Pack
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!buyerAllocations.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No active buyer purchase orders found. Raise demand in Buyer - Purchase Order first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Package Multi-Split Modal */}
      {splitProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">Package Split Allocator</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {tab.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Split <strong>{splitProduct}</strong> into multiple retail and wholesale bag sizes simultaneously.
                </p>
              </div>
              <button
                onClick={() => setSplitProduct(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Buyer Target & Top Demand Quick Fill */}
            {(() => {
              const productBuyerDemands = buyerAllocations.filter(
                (b) => b.product.toLowerCase() === splitProduct.toLowerCase() && b.balanceKg > 0
              );
              const topDemand = productBuyerDemands[0];
              const allocated = splits.reduce((sum, s) => sum + num(s.qty), 0);
              const unallocated = round(splitRemaining - allocated);
              const totalBags = splits.reduce((sum, s) => sum + (s.packs !== undefined ? s.packs : (s.size > 0 ? Math.ceil(num(s.qty) / s.size) : 0)), 0);
              const isOver = unallocated < -0.001;

              return (
                <div className="space-y-4">
                  {/* Top Buyer Demand Highlight Banner */}
                  {topDemand ? (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                            <Sparkles className="size-3.5 text-primary" />
                            <span>Top Buyer Demand: {topDemand.buyer} ({topDemand.poId})</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Pending Order: <b className="text-primary">{topDemand.packSizeLabel || "250 G"}</b> — <b className="text-foreground">{topDemand.balancePacks || 25} Packs</b> ({kg(topDemand.balanceKg)})
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={() => {
                            const sz = topDemand.packSizeKg > 0 ? topDemand.packSizeKg : 0.25;
                            const pCount = topDemand.balancePacks > 0 ? topDemand.balancePacks : 25;
                            const weight = round(pCount * sz);
                            const remKg = Math.max(0, round(splitRemaining - weight));
                            const newSplits: SplitItem[] = [
                              { size: sz, packs: pCount, qty: weight, poId: topDemand.poId, buyer: topDemand.buyer },
                            ];
                            if (remKg > 0) {
                              newSplits.push({
                                size: 0.5,
                                packs: Math.ceil(remKg / 0.5),
                                qty: remKg,
                                poId: "",
                                buyer: "",
                              });
                            }
                            setSplits(newSplits);
                            setSplitTargetPo(topDemand.poId);
                            toast.success(`Applied top demand: ${formatBagSize(sz)} × ${pCount} Packs (${weight} kg) for ${topDemand.buyer}`);
                          }}
                          className="h-7 text-xs font-semibold gap-1 bg-primary text-primary-foreground shadow-xs shrink-0"
                        >
                          <Zap className="size-3 fill-current" /> Fill Top Demand ({topDemand.packSizeLabel || "250 G"} - {topDemand.balancePacks || 25} Pack)
                        </Button>
                      </div>

                      {/* Other Pending Demands */}
                      {productBuyerDemands.length > 1 && (
                        <div className="flex flex-wrap items-center gap-1.5 border-t border-primary/10 pt-2 text-[11px]">
                          <span className="text-muted-foreground font-semibold">Other Demands:</span>
                          {productBuyerDemands.slice(1).map((b) => (
                            <button
                              key={b.poId}
                              type="button"
                              onClick={() => {
                                const sz = b.packSizeKg > 0 ? b.packSizeKg : 0.5;
                                const pCount = b.balancePacks > 0 ? b.balancePacks : 10;
                                const weight = round(pCount * sz);
                                setSplits((prev) => [
                                  ...prev,
                                  { size: sz, packs: pCount, qty: weight, poId: b.poId, buyer: b.buyer },
                                ]);
                                toast.success(`Added split line: ${b.buyer} (${formatBagSize(sz)} × ${pCount} packs)`);
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-background border px-2 py-0.5 font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                              <span>+ {b.buyer}: {b.packSizeLabel} ({b.balancePacks} pkts)</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground block">
                        Allocate Split Lots to Buyer Demand:
                      </label>
                      <select
                        value={splitTargetPo}
                        onChange={(e) => setSplitTargetPo(e.target.value)}
                        className="h-9 w-full rounded-md border bg-background px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">📦 General Sales Stock (Unassigned)</option>
                        {buyerAllocations
                          .filter((b) => b.product.toLowerCase() === splitProduct.toLowerCase())
                          .map((b) => (
                            <option key={b.poId} value={b.poId}>
                              👤 {b.buyer} · {b.poId} (Demand: {b.demandKg} kg · Bal: {b.balanceKg} kg)
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* Split Balance Summary Card */}
                  <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-3 text-center border">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground">Available to Split</p>
                      <p className="text-base font-bold text-foreground">{kg(splitRemaining)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground">Total Allocated</p>
                      <p className={cn("text-base font-bold", isOver ? "text-destructive" : "text-primary")}>
                        {kg(allocated)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground">Unallocated</p>
                      <p className={cn("text-base font-bold", isOver ? "text-destructive" : unallocated === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                        {kg(unallocated)}
                      </p>
                    </div>
                  </div>

                  {/* Split Lines Editor */}
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Package Split Lines ({splits.length} sizes) — Enter Bag Size & Pack Count
                      </p>
                      <span className="text-[10px] text-primary font-medium">
                        Direct bag count input (Auto-computes KG)
                      </span>
                    </div>

                    {splits.map((s, idx) => {
                      const linePacks = s.packs !== undefined ? s.packs : (s.size > 0 && s.qty > 0 ? Math.ceil(s.qty / s.size) : 0);
                      return (
                        <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border bg-background p-2.5 shadow-xs">
                          {/* Bag size selector */}
                          <div className="w-32">
                            <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Bag Size</label>
                            <select
                              value={String(s.size)}
                              onChange={(e) => {
                                const newSize = Number(e.target.value);
                                setSplits((prev) =>
                                  prev.map((item, i) => {
                                    if (i !== idx) return item;
                                    const currentPacks = item.packs !== undefined ? item.packs : (newSize > 0 ? Math.ceil(item.qty / newSize) : 0);
                                    return { ...item, size: newSize, qty: round(currentPacks * newSize) };
                                  })
                                );
                              }}
                              className="h-8 w-full rounded-md border bg-background px-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                            >
                              {STANDARD_BAG_SIZES.map((opt) => (
                                <option key={opt.label} value={String(opt.value)}>
                                  {opt.label} ({opt.displayKg})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Bag / Pack Count (PRIMARY INPUT) */}
                          <div className="w-28">
                            <label className="text-[10px] font-bold text-primary block mb-0.5">
                              Bag Count
                            </label>
                            <div className="inline-flex items-center gap-1 w-full">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={linePacks || ""}
                                placeholder="e.g. 25"
                                onChange={(e) => {
                                  const count = Math.max(0, Math.floor(Number(e.target.value)));
                                  setSplits((prev) =>
                                    prev.map((item, i) => {
                                      if (i !== idx) return item;
                                      return {
                                        ...item,
                                        packs: count,
                                        qty: round(count * item.size),
                                      };
                                    })
                                  );
                                }}
                                className="h-8 w-full rounded-md border bg-background px-2 font-mono font-bold text-xs text-primary outline-none focus:ring-1 focus:ring-primary"
                              />
                              <span className="text-[11px] text-muted-foreground font-semibold">pkts</span>
                            </div>
                          </div>

                          {/* Pack KG (Bidirectional) */}
                          <div className="w-24">
                            <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Pack KG</label>
                            <div className="inline-flex items-center gap-1 w-full">
                              <input
                                type="number"
                                step="any"
                                min={0}
                                value={s.qty || ""}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setSplits((prev) =>
                                    prev.map((item, i) => {
                                      if (i !== idx) return item;
                                      const calculatedPacks = item.size > 0 ? Math.ceil(val / item.size) : 0;
                                      return {
                                        ...item,
                                        qty: val,
                                        packs: calculatedPacks,
                                      };
                                    })
                                  );
                                }}
                                className="h-8 w-full rounded-md border bg-background px-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
                              />
                              <span className="text-[11px] text-muted-foreground">kg</span>
                            </div>
                          </div>

                          {/* Target Buyer Selector */}
                          <div className="flex-1 min-w-[130px]">
                            <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Allocated Buyer</label>
                            <select
                              value={s.poId || ""}
                              onChange={(e) => {
                                const poVal = e.target.value;
                                const poObj = (data["purchase-orders"] ?? []).find((p) => p.id === poVal);
                                setSplits((prev) =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? { ...item, poId: poVal, buyer: poObj ? String(poObj["buyer"] || "") : "" }
                                      : item
                                  )
                                );
                              }}
                              className="h-8 w-full rounded-md border bg-background px-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">📦 General Stock</option>
                              {buyerAllocations
                                .filter((b) => b.product.toLowerCase() === splitProduct.toLowerCase())
                                .map((b) => (
                                  <option key={b.poId} value={b.poId}>
                                    👤 {b.buyer} ({b.poId})
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Remove Split Line */}
                          {splits.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSplits((prev) => prev.filter((_, i) => i !== idx))}
                              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-3"
                              title="Remove split line"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextSize = 0.5;
                      const remainingKg = Math.max(0, unallocated);
                      const packsCount = nextSize > 0 ? Math.ceil(remainingKg / nextSize) : 0;
                      setSplits((prev) => [
                        ...prev,
                        { size: nextSize, packs: packsCount, qty: remainingKg, poId: "" },
                      ]);
                    }}
                    className="w-full text-xs gap-1 border-dashed"
                  >
                    <Plus className="size-3.5" /> Add Another Bag Size Split
                  </Button>

                  {/* Summary & Submission */}
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-xs">
                      <span className="text-muted-foreground">Total Output: </span>
                      <strong className="text-foreground">{totalBags} bags</strong>
                      <span className="text-muted-foreground ml-1">({kg(allocated)})</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSplitProduct(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={allocated <= 0 || isOver}
                        onClick={handleApplySplit}
                        className="gap-1 font-semibold"
                      >
                        <CheckCircle2 className="size-4" /> Confirm & Generate Split Packages
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* QR Sticker Modal */}
      {activeQrRow && (
        <QrStickerModal
          isOpen={true}
          onClose={() => setActiveQrRow(null)}
          product={lines(activeQrRow)[0]?.p || "Produce"}
          grade={String(activeQrRow["grade"] || "Grade A")}
          packSizeKg={num(activeQrRow["packSize"]) || 1.0}
          lotId={activeQrRow.id}
          packerName={String(activeQrRow["packer"] || "Senthil P")}
          shelfLifeDays={3}
        />
      )}
    </div>
  );
}
