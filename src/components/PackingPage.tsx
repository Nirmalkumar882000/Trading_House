import { useState, useMemo } from "react";
import {
  Package,
  Trash2,
  QrCode,
  Layers,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  User,
  Boxes,
  Zap,
  ArrowRight,
  Check,
  Search,
  SlidersHorizontal,
  BarChart3,
  Calendar,
  CheckSquare,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import type { ModuleDef, Row } from "@/lib/modules";
import { PRODUCT_CATALOG } from "@/lib/modules";
import { useStore } from "@/lib/store";
import { StatusBadge } from "./StatusBadge";
import { QrStickerModal } from "./QrStickerModal";
import { EmployeeSelect } from "./EmployeeSelect";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import {
  lines,
  normalize,
  num,
  round,
  validateData,
  bagBreakdown,
  parseLines,
  type Data,
} from "@/lib/workflow";

export interface BagSizeOption {
  label: string;
  grams: number;
  value: number; // in KG
  displayKg: string;
}

export const STANDARD_BAG_SIZES: BagSizeOption[] = [
  { label: "50 G", grams: 50, value: 0.05, displayKg: "50 Grams (0.05 kg)" },
  { label: "100 G", grams: 100, value: 0.1, displayKg: "100 Grams (0.1 kg)" },
  { label: "150 G", grams: 150, value: 0.15, displayKg: "150 Grams (0.15 kg)" },
  { label: "200 G", grams: 200, value: 0.2, displayKg: "200 Grams (0.2 kg)" },
  { label: "250 G", grams: 250, value: 0.25, displayKg: "250 Grams (0.25 kg)" },
  { label: "300 G", grams: 300, value: 0.3, displayKg: "300 Grams (0.3 kg)" },
  { label: "500 G", grams: 500, value: 0.5, displayKg: "500 Grams (0.5 kg)" },
  { label: "1 KG", grams: 1000, value: 1.0, displayKg: "1,000 Grams (1.0 kg)" },
  { label: "2 KG", grams: 2000, value: 2.0, displayKg: "2,000 Grams (2.0 kg)" },
  { label: "5 KG", grams: 5000, value: 5.0, displayKg: "5,000 Grams (5.0 kg)" },
  { label: "10 KG", grams: 10000, value: 10.0, displayKg: "10,000 Grams (10.0 kg)" },
  { label: "25 KG", grams: 25000, value: 25.0, displayKg: "25,000 Grams (25.0 kg)" },
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
  if (Math.abs(n - 1.0) < 0.001) return "1 KG (1,000 g)";
  if (Math.abs(n - 2.0) < 0.001) return "2 KG (2,000 g)";
  if (Math.abs(n - 5.0) < 0.001) return "5 KG (5,000 g)";
  if (Math.abs(n - 10.0) < 0.001) return "10 KG";
  if (Math.abs(n - 25.0) < 0.001) return "25 KG";
  if (n < 1 && n > 0) return `${Math.round(n * 1000)} G (${n} kg)`;
  return `${n} kg`;
}

export function formatGramsLabel(sizeKg: number | string): string {
  const n = Number(sizeKg);
  if (n <= 0) return "0 g";
  if (n < 1) return `${Math.round(n * 1000)}g`;
  return `${n}kg (${Math.round(n * 1000)}g)`;
}

function getProduceEmoji(product: string): string {
  const p = product.toLowerCase();
  if (p.includes("tomato")) return "🍅";
  if (p.includes("onion")) return "🧅";
  if (p.includes("potato")) return "🥔";
  if (p.includes("carrot")) return "🥕";
  if (p.includes("chilli") || p.includes("chili")) return "🌶️";
  if (p.includes("corn")) return "🌽";
  if (p.includes("coconut")) return "🥥";
  if (p.includes("banana")) return "🍌";
  if (p.includes("lemon")) return "🍋";
  if (p.includes("garlic")) return "🧄";
  if (
    p.includes("cabbage") ||
    p.includes("cauliflower") ||
    p.includes("broccoli") ||
    p.includes("spinach") ||
    p.includes("palak") ||
    p.includes("greens") ||
    p.includes("coriander") ||
    p.includes("mint") ||
    p.includes("methi")
  ) {
    return "🥬";
  }
  if (
    p.includes("cucumber") ||
    p.includes("gourd") ||
    p.includes("beans") ||
    p.includes("lady finger") ||
    p.includes("okra") ||
    p.includes("brinjal") ||
    p.includes("eggplant")
  ) {
    return "🥒";
  }
  return "🌱";
}

type Tab = {
  key: string;
  label: string;
  stage: "Stage 1" | "Stage 2" | "Reject";
  grade: "Grade A" | "Grade B" | "Rejected";
};

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
      const a = num(l.a),
        a2 = num(l.a2),
        b = num(l.b);
      const q =
        tab.key === "s1a"
          ? a
          : tab.key === "s2a"
          ? done2
            ? a2
            : 0
          : tab.key === "s2b"
          ? done2
            ? b
            : 0
          : done2
          ? round(l.q - a + num(l.ret) - a2 - b)
          : 0;
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

type MainViewTab = "bay-packing" | "buyer-demands" | "demand-overview" | "packed-history";

export function PackingPage({ mod }: { mod: ModuleDef }) {
  const { data, upsert, remove, nextId } = useStore();

  // Top-level Navigation Tab State
  const [mainViewTab, setMainViewTab] = useState<MainViewTab>("bay-packing");

  // QC Subtabs State
  const [tabKey, setTabKey] = useState(TABS[0]!.key);
  const [packer, setPacker] = useState("Senthil P");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [customSizeActive, setCustomSizeActive] = useState<Record<string, boolean>>({});
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [targetBuyers, setTargetBuyers] = useState<Record<string, string>>({});
  const [activeQrRow, setActiveQrRow] = useState<Row | null>(null);

  // Filters for Buyer Demands and Packed Batches
  const [buyerSearch, setBuyerSearch] = useState("");
  const [buyerFilterStatus, setBuyerFilterStatus] = useState<"all" | "pending" | "fulfilled">("all");
  const [packedSearch, setPackedSearch] = useState("");

  // Split Modal State
  const [splitProduct, setSplitProduct] = useState<string | null>(null);
  const [splitRemaining, setSplitRemaining] = useState<number>(0);
  const [splitTargetPo, setSplitTargetPo] = useState<string>("");
  const [splitSourceStage, setSplitSourceStage] = useState<{
    stage: "Stage 1" | "Stage 2" | "Reject";
    grade: "Grade A" | "Grade B" | "Rejected";
  }>({
    stage: "Stage 1",
    grade: "Grade A",
  });
  const [splits, setSplits] = useState<SplitItem[]>([
    { size: 0.25, qty: 0, packs: 0 },
    { size: 0.5, qty: 0, packs: 0 },
  ]);

  const tab = TABS.find((t) => t.key === tabKey)!;
  const packRows = (data["packing"] ?? []).filter(
    (r) => r["stage"] === tab.stage && r["grade"] === tab.grade
  );
  const allPackRows = data["packing"] ?? [];
  const packedOf = (p: string) =>
    packRows.reduce((s, r) => s + (lines(r).find((l) => l.p === p)?.q ?? 0), 0);
  const products = [...graded(data, tab).entries()];
  const isReject = tab.stage === "Reject";

  // Buyer Allocations: Demand vs Actual based on Product Packaging (Packets & Grams)
  const buyerAllocations = useMemo(() => {
    const pos = (data["purchase-orders"] ?? []).filter((r) => r.status !== "Rejected");
    const packingRecords = data["packing"] ?? [];

    const items: Array<{
      poId: string;
      buyer: string;
      product: string;
      packSizeLabel: string;
      packSizeKg: number;
      packSizeGrams: number;
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
          PRODUCT_CATALOG.find((p) => p.name.toLowerCase().includes(l.p.toLowerCase())) || {
            defaultPackSize: "1 kg",
            packSizeKg: 1.0,
          };
        const packSizeKg = spec.packSizeKg > 0 ? spec.packSizeKg : 1.0;
        const packSizeGrams = Math.round(packSizeKg * 1000);
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
          return (
            sum +
            (num(pr["packs"]) ||
              Math.ceil((num(lines(pr)[0]?.q) || 0) / (num(pr["packSize"]) || packSizeKg)))
          );
        }, 0);

        const balanceKg = Math.max(0, round(l.q - actualKg));
        const balancePacks = Math.max(0, demandPacks - actualPacks);

        items.push({
          poId: po.id,
          buyer,
          product: l.p,
          packSizeLabel: spec.defaultPackSize,
          packSizeKg,
          packSizeGrams,
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
      totalDemandPacks: items.reduce((s, i) => s + i.demandPacks, 0),
      totalPackedKg: items.reduce((s, i) => s + i.actualKg, 0),
      totalPackedPacks: items.reduce((s, i) => s + i.actualPacks, 0),
      totalBalanceKg: items.reduce((s, i) => s + i.balanceKg, 0),
      totalBalancePacks: items.reduce((s, i) => s + i.balancePacks, 0),
      buyers: items,
    }));
  }, [buyerAllocations]);

  // Overall KPI aggregations
  const totalGradedKg = useMemo(() => {
    let sum = 0;
    for (const t of TABS) {
      sum += [...graded(data, t).values()].reduce((s, v) => s + v, 0);
    }
    return sum;
  }, [data]);

  const totalPackedKg = useMemo(() => {
    return (data["packing"] ?? []).reduce((sum, r) => sum + num(r["nominal"]), 0);
  }, [data]);

  const totalDemandKg = useMemo(() => {
    return buyerAllocations.reduce((sum, b) => sum + b.demandKg, 0);
  }, [buyerAllocations]);

  const totalBalanceKg = useMemo(() => {
    return buyerAllocations.reduce((sum, b) => sum + b.balanceKg, 0);
  }, [buyerAllocations]);

  // Pack a single batch
  const pack = (product: string, remaining: number): void => {
    const q =
      qtys[product] === undefined || qtys[product] === "" ? remaining : Number(qtys[product]);
    const size = Number(sizes[product]);
    if (!packer.trim()) {
      toast.error("Select at least one assigned packer");
      return;
    }
    if (!(size > 0)) {
      toast.error("Select or enter a bag size (e.g. 250 G, 500 G, 1 KG)");
      return;
    }
    if (!(q > 0) || q > remaining + 0.001) {
      toast.error(`Pack quantity must be between 0 and ${remaining} kg`);
      return;
    }

    const targetPoId = targetBuyers[product] || "";
    const targetPo = targetPoId
      ? (data["purchase-orders"] ?? []).find((p) => p.id === targetPoId)
      : null;
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
      packs: breakdown.full + (breakdown.partial > 0 ? 1 : 0),
      item: JSON.stringify([{ p: product, q }]),
    } as Row);

    const err = validateData({ ...data, packing: [...(data["packing"] ?? []), row] });
    if (err) {
      toast.error(err);
      return;
    }
    upsert("packing", row);
    setQtys((s) => ({ ...s, [product]: "" }));

    const sizeLabel = formatBagSize(size);
    if (targetPo && buyerName) {
      const matchAlloc = buyerAllocations.find(
        (b) => b.poId === targetPoId && b.product.toLowerCase() === product.toLowerCase()
      );
      const newBal = matchAlloc ? Math.max(0, round(matchAlloc.balanceKg - q)) : 0;

      const otherBuyers = buyerAllocations.filter(
        (b) =>
          b.poId !== targetPoId &&
          b.product.toLowerCase() === product.toLowerCase() &&
          b.balanceKg > 0
      );
      const otherNote = otherBuyers.length
        ? ` · Note: ${otherBuyers[0]!.buyer} still has ${otherBuyers[0]!.balanceKg} kg pending balance.`
        : "";

      toast.success(
        `${row.id}: ${q} kg ${product} packed for ${buyerName} (${targetPoId})! Remaining balance for ${buyerName}: ${newBal} kg.${otherNote}`
      );
    } else {
      if (breakdown.partial > 0) {
        toast.success(
          `${row.id}: ${q} kg ${product} packed into ${breakdown.full} full bags (${sizeLabel}) + 1 partial bag (${breakdown.partial} kg)`
        );
      } else {
        toast.success(
          `${row.id}: ${q} kg ${product} packed into ${breakdown.full} bags (${sizeLabel})`
        );
      }
    }
  };

  // Open the Split Modal with bag count & grams focus
  const openSplitModal = (
    product: string,
    remainingStock: number,
    targetPoId: string = "",
    sourceStage?: { stage: "Stage 1" | "Stage 2" | "Reject"; grade: "Grade A" | "Grade B" | "Rejected" }
  ) => {
    setSplitProduct(product);
    setSplitRemaining(remainingStock);
    setSplitTargetPo(targetPoId);
    setSplitSourceStage(sourceStage || { stage: tab.stage, grade: tab.grade });

    // Find pending demands for this product
    const demands = buyerAllocations.filter(
      (b) => b.product.toLowerCase() === product.toLowerCase() && b.balanceKg > 0.001
    );
    const top = targetPoId
      ? demands.find((d) => d.poId === targetPoId) || demands[0]
      : demands[0];

    if (top) {
      // Pre-fill top demand: target size × required packet count
      const topSize = top.packSizeKg > 0 ? top.packSizeKg : 0.5;
      const topPacks = top.balancePacks > 0 ? top.balancePacks : 25;
      const topQty = round(Math.min(remainingStock, topPacks * topSize));
      const actualPacks = topSize > 0 ? Math.ceil(topQty / topSize) : topPacks;
      const rem = Math.max(0, round(remainingStock - topQty));

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
        const next = demands.find((d) => d.poId !== top.poId);
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
      // Default: 500 G (25 packs = 12.5 kg) + remainder in 1 KG
      const defSize = 0.5;
      const defPacks = Math.min(25, Math.max(1, Math.floor(remainingStock / defSize)));
      const defQty = round(defPacks * defSize);
      const rem = Math.max(0, round(remainingStock - defQty));
      const nextSize = 1.0;
      const nextPacks = nextSize > 0 ? Math.ceil(rem / nextSize) : 0;

      setSplits([
        { size: defSize, packs: defPacks, qty: defQty, poId: targetPoId },
        { size: nextSize, packs: nextPacks, qty: rem, poId: "" },
      ]);
    }
  };

  // 1-Click Auto-Split by All Pending Buyer Demands
  const handleAutoSplitAllBuyers = () => {
    if (!splitProduct) return;
    const pendingDemands = buyerAllocations.filter(
      (b) => b.product.toLowerCase() === splitProduct.toLowerCase() && b.balanceKg > 0.001
    );

    if (!pendingDemands.length) {
      toast.info(`No pending buyer demands found for ${splitProduct}`);
      return;
    }

    let runningRem = splitRemaining;
    const newSplits: SplitItem[] = [];

    for (const d of pendingDemands) {
      if (runningRem <= 0.001) break;
      const sz = d.packSizeKg > 0 ? d.packSizeKg : 0.5;
      const maxPacksForStock = Math.floor(runningRem / sz);
      const packsToTake = Math.min(d.balancePacks, maxPacksForStock);
      if (packsToTake > 0) {
        const lineQty = round(packsToTake * sz);
        runningRem = round(runningRem - lineQty);
        newSplits.push({
          size: sz,
          packs: packsToTake,
          qty: lineQty,
          poId: d.poId,
          buyer: d.buyer,
        });
      }
    }

    // If stock still remains, add General Sales Stock
    if (runningRem > 0.001) {
      const defSize = 0.5;
      const defPacks = Math.ceil(runningRem / defSize);
      newSplits.push({
        size: defSize,
        packs: defPacks,
        qty: runningRem,
        poId: "",
        buyer: "",
      });
    }

    if (newSplits.length > 0) {
      setSplits(newSplits);
      toast.success(
        `Auto-Split configured across ${newSplits.length} lines matching all buyer packet & gram demands!`
      );
    }
  };

  // Submit and apply the split package allocations
  const handleApplySplit = () => {
    if (!splitProduct) return;
    const totalAllocated = splits.reduce((sum, s) => sum + num(s.qty), 0);
    if (totalAllocated <= 0) {
      toast.error("Enter packet counts or quantities for the split lines");
      return;
    }
    if (totalAllocated > splitRemaining + 0.001) {
      toast.error(
        `Total allocated (${totalAllocated} kg) exceeds available graded stock (${splitRemaining} kg)`
      );
      return;
    }
    if (!packer.trim()) {
      toast.error("Select at least one assigned packer");
      return;
    }

    const validSplits = splits.filter((s) => s.qty > 0 && s.size > 0);
    if (!validSplits.length) {
      toast.error("Configure at least one valid bag size and packet count");
      return;
    }

    // Verify buyer demand caps to avoid workflow validation rejections
    for (const sp of validSplits) {
      if (sp.poId) {
        const alloc = buyerAllocations.find(
          (b) => b.poId === sp.poId && b.product.toLowerCase() === splitProduct.toLowerCase()
        );
        if (alloc && sp.qty > alloc.balanceKg + 0.001) {
          toast.error(
            `${alloc.buyer} (${alloc.poId}): ${sp.qty} kg exceeds remaining balance deficit of ${alloc.balanceKg} kg (${alloc.balancePacks} pkts @ ${alloc.packSizeLabel})`
          );
          return;
        }
      }
    }

    let currentPacking = [...(data["packing"] ?? [])];
    const createdRows: Row[] = [];
    const dateStr = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < validSplits.length; i++) {
      const sp = validSplits[i]!;
      const maxIdNum = Math.max(1000, ...currentPacking.map((r) => Number(r.id.split("-")[1]) || 0));
      const newId = `PK-${maxIdNum + 1}`;

      // CRITICAL FIX: Only use sp.poId if it is a non-empty string. Do not fall back to splitTargetPo if explicitly General Stock!
      const linePoId = sp.poId ? sp.poId : "";
      const lineTargetPo = linePoId
        ? (data["purchase-orders"] ?? []).find((p) => p.id === linePoId)
        : null;
      const lineBuyerName = linePoId
        ? lineTargetPo
          ? String(lineTargetPo["buyer"] || "")
          : sp.buyer || ""
        : "";
      const packsCount = sp.packs || (sp.size > 0 ? Math.ceil(sp.qty / sp.size) : 1);

      const row = normalize("packing", {
        id: newId,
        status: "Packed",
        date: dateStr,
        po: linePoId,
        buyer: lineBuyerName,
        stage: splitSourceStage.stage,
        grade: splitSourceStage.grade,
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
    toast.success(
      `Package Split Complete: Generated ${createdRows.length} packaging lots for ${splitProduct} (${totalAllocated} kg total across requested packet sizes)!`
    );
  };

  // Helper to trigger packing demand directly from the Buyer Allocations table
  const handlePackDemandForBuyer = (item: (typeof buyerAllocations)[0]) => {
    // Check available graded stock in current tab
    const gKg = graded(data, tab).get(item.product) ?? 0;
    const packedKg = packedOf(item.product);
    const availInCurrentTab = Math.max(0, round(gKg - packedKg));

    if (availInCurrentTab > 0) {
      setTargetBuyers((prev) => ({ ...prev, [item.product]: item.poId }));
      setQtys((prev) => ({
        ...prev,
        [item.product]: String(Math.min(availInCurrentTab, item.balanceKg)),
      }));
      setSizes((prev) => ({ ...prev, [item.product]: String(item.packSizeKg) }));
      setCustomSizeActive((prev) => ({ ...prev, [item.product]: false }));
      setMainViewTab("bay-packing");
      toast.info(
        `Target set to ${item.buyer} (${item.poId}) for ${Math.min(
          availInCurrentTab,
          item.balanceKg
        )} kg (${item.balancePacks} pkts @ ${item.packSizeLabel}). Click "Pack" to finalize.`
      );
      return;
    }

    // Otherwise check Stage 1 Grade A
    const s1Tab = TABS[0]!;
    const s1Graded = graded(data, s1Tab).get(item.product) ?? 0;
    const s1Packed = (data["packing"] ?? [])
      .filter((r) => r["stage"] === s1Tab.stage && r["grade"] === s1Tab.grade)
      .reduce((s, r) => s + (lines(r).find((l) => l.p === item.product)?.q ?? 0), 0);
    const s1Avail = Math.max(0, round(s1Graded - s1Packed));

    if (s1Avail > 0) {
      setTabKey(s1Tab.key);
      setTargetBuyers((prev) => ({ ...prev, [item.product]: item.poId }));
      setQtys((prev) => ({
        ...prev,
        [item.product]: String(Math.min(s1Avail, item.balanceKg)),
      }));
      setSizes((prev) => ({ ...prev, [item.product]: String(item.packSizeKg) }));
      setCustomSizeActive((prev) => ({ ...prev, [item.product]: false }));
      setMainViewTab("bay-packing");
      toast.info(
        `Switched to Stage 1 Grade A for ${item.buyer} (${item.poId}) with ${Math.min(
          s1Avail,
          item.balanceKg
        )} kg. Click "Pack" to finalize.`
      );
    } else {
      toast.warning(
        `No Grade A stock currently available for ${item.product}. Complete QC check grading first.`
      );
    }
  };

  // Helper to open Split Pack directly from Buyer Allocations table
  const handleSplitPackForBuyer = (item: (typeof buyerAllocations)[0]) => {
    const gKg = graded(data, tab).get(item.product) ?? 0;
    const packedKg = packedOf(item.product);
    const availCurrent = Math.max(0, round(gKg - packedKg));

    if (availCurrent > 0) {
      openSplitModal(item.product, availCurrent, item.poId, {
        stage: tab.stage,
        grade: tab.grade,
      });
      return;
    }

    const s1Tab = TABS[0]!;
    const s1Graded = graded(data, s1Tab).get(item.product) ?? 0;
    const s1Packed = (data["packing"] ?? [])
      .filter((r) => r["stage"] === s1Tab.stage && r["grade"] === s1Tab.grade)
      .reduce((s, r) => s + (lines(r).find((l) => l.p === item.product)?.q ?? 0), 0);
    const s1Avail = Math.max(0, round(s1Graded - s1Packed));

    if (s1Avail > 0) {
      setTabKey(s1Tab.key);
      openSplitModal(item.product, s1Avail, item.poId, {
        stage: s1Tab.stage,
        grade: s1Tab.grade,
      });
    } else {
      openSplitModal(item.product, item.demandKg, item.poId, {
        stage: tab.stage,
        grade: tab.grade,
      });
      toast.info(
        `Configuring split pack for ${item.buyer}. Note: Ensure graded stock is available before submitting.`
      );
    }
  };

  // Filtered Buyer Allocations
  const filteredBuyerAllocations = useMemo(() => {
    return buyerAllocations.filter((item) => {
      const matchSearch =
        !buyerSearch.trim() ||
        item.buyer.toLowerCase().includes(buyerSearch.toLowerCase()) ||
        item.poId.toLowerCase().includes(buyerSearch.toLowerCase()) ||
        item.product.toLowerCase().includes(buyerSearch.toLowerCase());
      if (!matchSearch) return false;
      if (buyerFilterStatus === "pending") return item.balanceKg > 0.001;
      if (buyerFilterStatus === "fulfilled") return item.balanceKg <= 0.001;
      return true;
    });
  }, [buyerAllocations, buyerSearch, buyerFilterStatus]);

  // Filtered Packed Batches
  const filteredPackRows = useMemo(() => {
    return packRows.filter((r) => {
      if (!packedSearch.trim()) return true;
      const s = packedSearch.toLowerCase();
      const pNames = lines(r).map((l) => l.p.toLowerCase()).join(" ");
      return (
        r.id.toLowerCase().includes(s) ||
        pNames.includes(s) ||
        String(r["buyer"] || "").toLowerCase().includes(s) ||
        String(r["po"] || "").toLowerCase().includes(s) ||
        String(r["packer"] || "").toLowerCase().includes(s)
      );
    });
  }, [packRows, packedSearch]);

  const pendingBuyerDemandsCount = useMemo(
    () => buyerAllocations.filter((b) => b.balanceKg > 0.001).length,
    [buyerAllocations]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {mod.stage} · {mod.flows}
          </p>
          <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">{mod.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Pack produce into standard retail packet sizes (50g, 100g, 250g, 500g, 1kg), allocate to buyer
            purchase orders with packet and gram specifications, and issue BLE QR stickers.
          </p>
        </div>
      </div>

      {/* High-Level Warehouse KPI Pulse Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-3 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Graded QC Stock
          </p>
          <p className="mt-1 text-xl font-bold text-foreground">{kg(totalGradedKg)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Across Stage 1 & 2</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Packed Production
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {kg(totalPackedKg)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{allPackRows.length} total lots</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Buyer Demand
          </p>
          <p className="mt-1 text-xl font-bold text-foreground">{kg(totalDemandKg)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">From approved purchase orders</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Pending Deficit
          </p>
          <p
            className={cn(
              "mt-1 text-xl font-bold",
              totalBalanceKg > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"
            )}
          >
            {kg(totalBalanceKg)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {pendingBuyerDemandsCount} buyer orders pending
          </p>
        </div>
      </div>

      {/* TOP-LEVEL NAVIGATION TABS */}
      <div className="rounded-2xl border bg-card/60 p-1.5 shadow-xs">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setMainViewTab("bay-packing")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer",
              mainViewTab === "bay-packing"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <Package className="size-4 shrink-0" />
            <span className="truncate">1. Bay Packing (QC Stock)</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold shrink-0",
                mainViewTab === "bay-packing"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMainViewTab("buyer-demands")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer",
              mainViewTab === "buyer-demands"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <User className="size-4 shrink-0" />
            <span className="truncate">2. Buyer PO Allocations</span>
            {pendingBuyerDemandsCount > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-bold shrink-0",
                  mainViewTab === "buyer-demands"
                    ? "bg-amber-400 text-amber-950"
                    : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                )}
              >
                {pendingBuyerDemandsCount}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600">
                ✓
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainViewTab("demand-overview")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer",
              mainViewTab === "demand-overview"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <Sparkles className="size-4 shrink-0" />
            <span className="truncate">3. Demand vs Actual Overview</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold shrink-0",
                mainViewTab === "demand-overview"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {multiBuyerGroups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMainViewTab("packed-history")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer",
              mainViewTab === "packed-history"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <QrCode className="size-4 shrink-0" />
            <span className="truncate">4. Packed Batches & QR</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold shrink-0",
                mainViewTab === "packed-history"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {packRows.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BAY PACKING (QC STOCK TO PACK) */}
      {/* ========================================================================= */}
      {mainViewTab === "bay-packing" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Grade A Packing Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Grade A Quality Produce · Ready for Bag Packing
                </h3>
                <p className="text-xs text-muted-foreground">
                  QC First-Check produce is ready to be packed into retail packet sizes (50g – 5kg) with
                  buyer-specific packet and gram demand matching and same-day QR stickers.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-xs">
                Grade A · Active Station
              </span>
            </div>
          </div>

          {/* QC Stage Subtabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-1">
            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => {
                const total = [...graded(data, t).values()].reduce((s, v) => s + v, 0);
                return (
                  <button
                    key={t.key}
                    onClick={() => setTabKey(t.key)}
                    className={cn(
                      "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
                      t.key === tabKey
                        ? "border-primary text-primary font-bold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label} <span className="ml-1 text-xs font-semibold">({kg(total)})</span>
                  </button>
                );
              })}
            </div>

            {!isReject && (
              <div className="min-w-64 max-w-sm">
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
          </div>

          {/* Table 1: Graded Produce Table with Sticky Product Column */}
          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground sticky top-0 z-20">
                <tr>
                  <th className="px-4 py-3 text-left min-w-[220px] sticky left-0 bg-muted z-30 shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">
                    {isReject ? "Rejected KG" : "Graded KG"}
                  </th>
                  {!isReject && (
                    <>
                      <th className="px-4 py-3 text-left whitespace-nowrap">Packed KG</th>
                      <th className="px-4 py-3 text-left whitespace-nowrap">Remaining KG</th>
                      <th className="px-4 py-3 text-left min-w-[240px]">Target Buyer Demand</th>
                      <th className="px-4 py-3 text-left min-w-[260px]">Packet Size · Select / Presets</th>
                      <th className="px-4 py-3 text-left min-w-[130px]">Pack KG</th>
                      <th className="px-4 py-3 text-right min-w-[180px]">Actions</th>
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
                  const curQty =
                    qtys[p] === undefined || qtys[p] === "" ? remaining : Number(qtys[p]);
                  const breakdown =
                    curSize > 0 && curQty > 0 ? bagBreakdown(curQty, curSize) : null;
                  const isCustom =
                    customSizeActive[p] ||
                    (curSizeStr && !STANDARD_BAG_SIZES.some((s) => String(s.value) === curSizeStr));

                  const productSpec = PRODUCT_CATALOG.find(
                    (c) =>
                      c.name.toLowerCase() === p.toLowerCase() ||
                      p.toLowerCase().includes(c.name.toLowerCase())
                  );

                  const demandsForP = buyerAllocations.filter(
                    (b) => b.product.toLowerCase() === p.toLowerCase()
                  );
                  const selectedTargetPo = targetBuyers[p] || "";
                  const activeDemand = demandsForP.find((d) => d.poId === selectedTargetPo);

                  return (
                    <tr key={p} className="hover:bg-muted/20 transition-colors">
                      {/* Pinned Sticky Product Column */}
                      <td className="px-4 py-3.5 sticky left-0 bg-card z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                        <div className="flex items-center gap-2">
                          <span className="text-xl shrink-0" role="img" aria-label={p}>
                            {getProduceEmoji(p)}
                          </span>
                          <div>
                            <p className="font-bold text-foreground text-sm">{p}</p>
                            {productSpec && (
                              <span className="inline-flex items-center gap-1 mt-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                Pack: <strong className="text-foreground">{productSpec.defaultPackSize}</strong>
                                {productSpec.category && <span className="opacity-70">· {productSpec.category}</span>}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Interactive Buyer Demand Quick-Select Pills */}
                        {demandsForP.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Buyer Demands (Packets & Grams):
                            </p>
                            <div className="flex flex-wrap gap-1">
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
                                        setQtys((prev) => ({
                                          ...prev,
                                          [p]: String(Math.min(remaining, d.balanceKg)),
                                        }));
                                      }
                                      setSizes((prev) => ({ ...prev, [p]: String(d.packSizeKg) }));
                                      setCustomSizeActive((prev) => ({ ...prev, [p]: false }));
                                    }}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-all text-left border cursor-pointer",
                                      isSelected
                                        ? "border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary/30"
                                        : isFulfilled
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:border-amber-500"
                                    )}
                                    title={`Target ${d.buyer} (${d.demandPacks} pkts @ ${d.packSizeLabel})`}
                                  >
                                    <User className="size-2.5 shrink-0" />
                                    <span>{d.buyer}:</span>
                                    {isFulfilled ? (
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        Fulfilled ✓
                                      </span>
                                    ) : (
                                      <span>
                                        <strong className="text-amber-700 dark:text-amber-300">
                                          Bal: {d.balancePacks} pkts ({d.balanceKg} kg)
                                        </strong>
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                        {kg(g)}
                      </td>

                      {!isReject && (
                        <>
                          <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                            {kg(packed)}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
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
                                      setQtys((prev) => ({
                                        ...prev,
                                        [p]: String(Math.min(remaining, d.balanceKg)),
                                      }));
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
                                    👤 {d.buyer} · {d.poId} ({d.demandPacks} pkts @ {d.packSizeLabel}){" "}
                                    {d.balanceKg <= 0.001 ? "✓ Fulfilled" : `[Bal: ${d.balancePacks} pkts]`}
                                  </option>
                                ))}
                              </select>
                              {activeDemand ? (
                                <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                                  <span className="font-semibold text-primary">
                                    {activeDemand.buyer}:
                                  </span>
                                  <span className="text-muted-foreground">
                                    {activeDemand.demandPacks} pkts @ {activeDemand.packSizeLabel} ({activeDemand.demandKg} kg)
                                  </span>
                                  <span className="opacity-40">·</span>
                                  {activeDemand.balanceKg <= 0.001 ? (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      Fulfilled ✓
                                    </span>
                                  ) : (
                                    <span className="font-bold text-amber-600 dark:text-amber-400">
                                      Bal: {activeDemand.balancePacks} pkts ({activeDemand.balanceKg} kg)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">General warehouse stock</p>
                              )}
                            </div>
                          </td>

                          {/* Bag Size Selector with 1-click Presets */}
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
                                  <option value="">Select packet size...</option>
                                  {STANDARD_BAG_SIZES.map((opt) => (
                                    <option key={opt.label} value={String(opt.value)}>
                                      {opt.label} ({opt.displayKg})
                                    </option>
                                  ))}
                                  <option value="custom">Custom Grams / KG...</option>
                                </select>

                                {isCustom && (
                                  <input
                                    type="number"
                                    step="any"
                                    min={0.01}
                                    placeholder="e.g. 0.75"
                                    value={sizes[p] ?? ""}
                                    onChange={(e) =>
                                      setSizes((prev) => ({ ...prev, [p]: e.target.value }))
                                    }
                                    className="h-8 w-20 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                                  />
                                )}
                              </div>

                              {/* Quick 1-click Preset Pills in Grams */}
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
                                        "rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all cursor-pointer",
                                        active
                                          ? "bg-primary text-primary-foreground shadow-xs"
                                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                                      )}
                                      title={opt.displayKg}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Live split preview */}
                              {breakdown && (
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold leading-tight">
                                  ⚡ Split: {breakdown.full} {breakdown.full === 1 ? "packet" : "packets"}
                                  {breakdown.partial > 0
                                    ? ` + 1 partial (${breakdown.partial} kg)`
                                    : ""}
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
                                className="block text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                              >
                                All ({remaining} kg)
                              </button>
                            </div>
                          </td>

                          {/* Actions: Pack + Split Pack */}
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                disabled={remaining <= 0}
                                onClick={() => pack(p, remaining)}
                                className="h-8 gap-1 px-3 text-xs font-semibold shadow-xs"
                              >
                                <Package className="size-3.5" /> Pack
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={remaining <= 0}
                                onClick={() => openSplitModal(p, remaining, selectedTargetPo)}
                                className="h-8 gap-1 px-2.5 text-xs text-primary hover:bg-primary/10 border-primary/30"
                                title="Split into multiple packet sizes based on buyer packets & grams"
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
                  ? "Nothing graded yet for this stage. Complete Stage 2 in Quality Check."
                  : "Nothing graded yet. Complete Stage 1 in Quality Check."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BUYER PO ALLOCATIONS & DEMANDS */}
      {/* ========================================================================= */}
      {mainViewTab === "buyer-demands" && (
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm animate-in fade-in-50 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Buyer PO Allocations · Packaging Demands & Deficit
                </h2>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Order Line Specific
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every buyer purchase order line item with target packet sizes, required packet counts,
                packed quantities, and real-time deficit balances.
              </p>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search buyer or product..."
                  value={buyerSearch}
                  onChange={(e) => setBuyerSearch(e.target.value)}
                  className="h-8 w-48 rounded-lg border bg-background pl-8 pr-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="inline-flex rounded-lg border bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setBuyerFilterStatus("all")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                    buyerFilterStatus === "all"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All ({buyerAllocations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBuyerFilterStatus("pending")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                    buyerFilterStatus === "pending"
                      ? "bg-amber-500 text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Pending Deficit ({pendingBuyerDemandsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setBuyerFilterStatus("fulfilled")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                    buyerFilterStatus === "fulfilled"
                      ? "bg-emerald-600 text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Fulfilled ({buyerAllocations.length - pendingBuyerDemandsCount})
                </button>
              </div>
            </div>
          </div>

          {/* Table 2: Dedicated Buyer Demands Table */}
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3.5 py-3 text-left">Buyer & PO</th>
                  <th className="px-3.5 py-3 text-left">Product</th>
                  <th className="px-3.5 py-3 text-left">Target Packaging (Grams)</th>
                  <th className="px-3.5 py-3 text-right">Demand (KG)</th>
                  <th className="px-3.5 py-3 text-right">Demand Packets</th>
                  <th className="px-3.5 py-3 text-right">Actual Bags</th>
                  <th className="px-3.5 py-3 text-right">Actual KG</th>
                  <th className="px-3.5 py-3 text-right">Balance Deficit</th>
                  <th className="px-3.5 py-3 text-center">Fulfillment Status</th>
                  <th className="px-3.5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredBuyerAllocations.map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3.5 py-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <User className="size-3.5 text-primary shrink-0" />
                        <div>
                          <span className="block font-semibold text-foreground">{item.buyer}</span>
                          <span className="font-mono text-xs text-primary">{item.poId}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 font-semibold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{getProduceEmoji(item.product)}</span>
                        <span>{item.product}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                        {item.packSizeGrams} Grams ({item.packSizeKg} kg)
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
                          {item.balancePacks} pkts ({item.balanceKg} kg)
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      {item.actualPacks >= item.demandPacks ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
                          <CheckCircle2 className="size-3" /> Fulfilled
                        </span>
                      ) : item.actualPacks > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-xs font-semibold">
                          Partial ({item.demandPacks - item.actualPacks} pkts short)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-medium">
                          Pending Packing
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.balanceKg > 0.001 && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handlePackDemandForBuyer(item)}
                            className="h-7 text-xs gap-1 font-semibold"
                            title={`Target ${item.buyer} demand directly`}
                          >
                            <Zap className="size-3" /> Pack Demand
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSplitPackForBuyer(item)}
                          className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          title="Open Split Pack allocator with packet count & grams input"
                        >
                          <Layers className="size-3" /> Split Pack
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredBuyerAllocations.length && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No matching buyer purchase orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DEMAND VS ACTUAL OVERVIEW (CARDS GRID) */}
      {/* ========================================================================= */}
      {mainViewTab === "demand-overview" && (
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm animate-in fade-in-50 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  Multi-Buyer Produce Demand & Balance Overview
                </h2>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Comparative Produce Summary
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compare Buyer Demand Pack Count vs Actual Packed Bags across multiple buyers for each
                produce commodity.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {multiBuyerGroups.map((group) => {
              const pct =
                group.totalDemandKg > 0
                  ? Math.min(100, Math.round((group.totalPackedKg / group.totalDemandKg) * 100))
                  : 0;
              return (
                <div
                  key={group.product}
                  className="rounded-xl border bg-card p-3.5 space-y-3 shadow-xs hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl" role="img" aria-label={group.product}>
                        {getProduceEmoji(group.product)}
                      </span>
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{group.product}</h4>
                        <p className="text-xs text-muted-foreground">
                          Demand: <strong>{group.totalDemandPacks} pkts</strong> ({group.totalDemandKg} kg) · Packed:{" "}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {group.totalPackedPacks} pkts ({group.totalPackedKg} kg)
                          </strong>
                          {group.totalBalanceKg > 0 ? (
                            <span className="ml-1 text-amber-600 dark:text-amber-400">
                              · Pending: <strong>{group.totalBalancePacks} pkts ({group.totalBalanceKg} kg)</strong>
                            </span>
                          ) : (
                            <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                              · All Fulfilled ✓
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-bold rounded-full px-2 py-0.5 shrink-0",
                        pct >= 100
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      )}
                    >
                      {pct}% Packed
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        pct >= 100 ? "bg-emerald-600" : "bg-amber-500"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Buyer-by-buyer cards */}
                  <div className="space-y-1.5">
                    {group.buyers.map((b) => (
                      <div
                        key={b.poId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <User className="size-3 text-primary" />
                            <span>{b.buyer}</span>
                            <span className="font-mono text-[11px] text-primary">({b.poId})</span>
                          </div>
                          <p className="text-muted-foreground text-[11px]">
                            Requirement: <strong>{b.demandPacks} pkts @ {b.packSizeGrams}g</strong> ({b.demandKg} kg) · Packed:{" "}
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {b.actualPacks} pkts ({b.actualKg} kg)
                            </strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {b.balanceKg <= 0.001 ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
                              <CheckCircle2 className="size-3" /> Fulfilled
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-md bg-amber-500/10 px-2 py-1 font-bold text-amber-700 dark:text-amber-400 text-[11px]">
                                Bal: {b.balancePacks} pkts ({b.balanceKg} kg)
                              </span>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handlePackDemandForBuyer(b)}
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

      {/* ========================================================================= */}
      {/* TAB 4: PACKED BATCHES & BLE QR LABELS */}
      {/* ========================================================================= */}
      {mainViewTab === "packed-history" && (
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm animate-in fade-in-50 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div>
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  Packed Production Batches · Inventory & QR Manifest
                </h2>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {packRows.length} Lots in {tab.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate BLE Bluetooth QR code stickers for warehouse crates, verify packet breakdown,
                and trace packers.
              </p>
            </div>

            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search packed lots..."
                value={packedSearch}
                onChange={(e) => setPackedSearch(e.target.value)}
                className="h-8 w-56 rounded-lg border bg-background pl-8 pr-2 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  {[
                    "Ref",
                    "Product",
                    "Allocated To",
                    "Total KG",
                    "Packet Size",
                    "Packets Created",
                    "Packer(s)",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPackRows.map((r) => {
                  const nominal = num(r["nominal"]);
                  const size = num(r["packSize"]);
                  const breakdown = size > 0 && nominal > 0 ? bagBreakdown(nominal, size) : null;
                  const pName = lines(r).map((l) => l.p).join(", ");
                  return (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{r.id}</td>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{getProduceEmoji(pName)}</span>
                          <span>{pName}</span>
                        </div>
                      </td>
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
                        <span className="font-bold">{r["packs"]} pkts</span>
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
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} statuses={mod.statuses} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveQrRow(r)}
                            className="h-7 text-xs text-primary hover:bg-primary/10 inline-flex items-center gap-1 border-primary/30"
                          >
                            <QrCode className="size-3.5" /> Sticker (BLE)
                          </Button>
                          <button
                            aria-label="Delete"
                            className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
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
                {!filteredPackRows.length && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No packed batches found for {tab.label}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* PACKAGE SPLIT ALLOCATOR MODAL (BUYER-DEMAND, PACKETS & GRAMS FOCUSED) */}
      {/* ========================================================================= */}
      {splitProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl" role="img" aria-label={splitProduct}>
                  {getProduceEmoji(splitProduct)}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">Package Split Allocator</h3>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {splitSourceStage.stage} · {splitSourceStage.grade}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Split <strong>{splitProduct}</strong> into buyer-specified <strong>Packet Counts</strong> & <strong>Grams</strong> (Auto-computes Total KG).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSplitProduct(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {(() => {
              const productBuyerDemands = buyerAllocations.filter(
                (b) => b.product.toLowerCase() === splitProduct.toLowerCase() && b.balanceKg > 0.001
              );
              const topDemand = splitTargetPo
                ? productBuyerDemands.find((b) => b.poId === splitTargetPo) ||
                  productBuyerDemands[0]
                : productBuyerDemands[0];

              const totalAllocatedKg = splits.reduce((sum, s) => sum + num(s.qty), 0);
              const unallocatedKg = round(splitRemaining - totalAllocatedKg);
              const totalBags = splits.reduce(
                (sum, s) =>
                  sum +
                  (s.packs !== undefined
                    ? s.packs
                    : s.size > 0
                    ? Math.ceil(num(s.qty) / s.size)
                    : 0),
                0
              );
              const isOver = unallocatedKg < -0.001;

              return (
                <div className="space-y-4">
                  {/* PENDING BUYER DEMANDS SECTION */}
                  {productBuyerDemands.length > 0 && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <Sparkles className="size-4 text-primary" />
                          <span>Buyer Demands for {splitProduct} ({productBuyerDemands.length} Pending Orders)</span>
                        </div>
                        {productBuyerDemands.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={handleAutoSplitAllBuyers}
                            className="h-7 text-xs font-semibold gap-1 bg-primary text-primary-foreground shadow-xs shrink-0"
                          >
                            <Zap className="size-3 fill-current" /> Auto-Split All Buyer Demands
                          </Button>
                        )}
                      </div>

                      {/* Buyer Demands Cards */}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {productBuyerDemands.map((b) => {
                          const isTop = topDemand?.poId === b.poId;
                          return (
                            <div
                              key={b.poId}
                              className={cn(
                                "flex flex-col justify-between rounded-lg border p-2.5 transition-all",
                                isTop ? "bg-background border-primary/50 shadow-xs" : "bg-background/70 border-border"
                              )}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1 font-bold text-xs text-foreground">
                                    <User className="size-3 text-primary" />
                                    <span>{b.buyer}</span>
                                  </div>
                                  <span className="font-mono text-[10px] text-primary">{b.poId}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                                  <span>
                                    Target: <strong className="text-foreground">{b.packSizeGrams} Grams</strong>
                                  </span>
                                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                                    Needs: <strong>{b.balancePacks} pkts</strong> ({b.balanceKg} kg)
                                  </span>
                                </div>
                              </div>

                              <div className="mt-2 pt-2 border-t flex justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={isTop ? "default" : "outline"}
                                  onClick={() => {
                                    const sz = b.packSizeKg > 0 ? b.packSizeKg : 0.5;
                                    const pCount = b.balancePacks > 0 ? b.balancePacks : 25;
                                    const weight = round(pCount * sz);
                                    const remKg = Math.max(0, round(splitRemaining - weight));
                                    const newSplits: SplitItem[] = [
                                      {
                                        size: sz,
                                        packs: pCount,
                                        qty: weight,
                                        poId: b.poId,
                                        buyer: b.buyer,
                                      },
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
                                    setSplitTargetPo(b.poId);
                                    toast.success(
                                      `Configured line for ${b.buyer}: ${b.packSizeGrams}g × ${pCount} pkts (${weight} kg)`
                                    );
                                  }}
                                  className="h-6 text-[11px] gap-1 px-2 font-semibold"
                                >
                                  <Zap className="size-2.5" /> Fill {b.balancePacks} pkts @ {b.packSizeGrams}g
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Split Summary Metric Bar */}
                  <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-3 text-center border">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground">Available to Split</p>
                      <p className="text-base font-bold text-foreground">{kg(splitRemaining)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground">Total Allocated</p>
                      <p
                        className={cn(
                          "text-base font-bold",
                          isOver ? "text-destructive" : "text-primary"
                        )}
                      >
                        {kg(totalAllocatedKg)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground">Unallocated</p>
                      <p
                        className={cn(
                          "text-base font-bold",
                          isOver
                            ? "text-destructive"
                            : unallocatedKg === 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {kg(unallocatedKg)}
                      </p>
                    </div>
                  </div>

                  {/* Split Lines Editor */}
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Split Lines ({splits.length}) — Specify Packet Size & Packet Count
                      </p>
                      <span className="text-[11px] text-primary font-medium">
                        Packet Count (pkts) × Grams (g) = Total KG
                      </span>
                    </div>

                    {splits.map((s, idx) => {
                      const linePacks =
                        s.packs !== undefined
                          ? s.packs
                          : s.size > 0 && s.qty > 0
                          ? Math.ceil(s.qty / s.size)
                          : 0;

                      const selectedBuyerDemand = buyerAllocations.find(
                        (b) => b.poId === s.poId && b.product.toLowerCase() === splitProduct.toLowerCase()
                      );

                      const isOverBuyerDemand =
                        selectedBuyerDemand &&
                        s.qty > selectedBuyerDemand.balanceKg + 0.001;

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "rounded-xl border bg-background p-3 shadow-xs space-y-2",
                            isOverBuyerDemand && "border-amber-500/50 bg-amber-500/5"
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Allocated Buyer Dropdown with Automatic Specs Loading */}
                            <div className="w-56">
                              <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                                Allocated Buyer / PO
                              </label>
                              <select
                                value={s.poId || ""}
                                onChange={(e) => {
                                  const poVal = e.target.value;
                                  const poObj = (data["purchase-orders"] ?? []).find(
                                    (p) => p.id === poVal
                                  );
                                  const bAlloc = buyerAllocations.find(
                                    (b) => b.poId === poVal && b.product.toLowerCase() === splitProduct.toLowerCase()
                                  );

                                  setSplits((prev) =>
                                    prev.map((item, i) => {
                                      if (i !== idx) return item;
                                      if (bAlloc) {
                                        // Auto-load buyer's requested grams and pending packets!
                                        const newSz = bAlloc.packSizeKg > 0 ? bAlloc.packSizeKg : item.size;
                                        const newPks = bAlloc.balancePacks > 0 ? bAlloc.balancePacks : item.packs || 10;
                                        return {
                                          ...item,
                                          poId: poVal,
                                          buyer: String(poObj?.["buyer"] || bAlloc.buyer),
                                          size: newSz,
                                          packs: newPks,
                                          qty: round(newPks * newSz),
                                        };
                                      } else {
                                        return {
                                          ...item,
                                          poId: "",
                                          buyer: "",
                                        };
                                      }
                                    })
                                  );
                                }}
                                className="h-8 w-full rounded-md border bg-background px-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="">📦 General Sales Stock</option>
                                {buyerAllocations
                                  .filter((b) => b.product.toLowerCase() === splitProduct.toLowerCase())
                                  .map((b) => (
                                    <option key={b.poId} value={b.poId}>
                                      👤 {b.buyer} · {b.poId} ({b.demandPacks} pkts @ {b.packSizeGrams}g)
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {/* Packet Size / Grams Selector */}
                            <div className="w-44">
                              <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                                Packet Size (Grams)
                              </label>
                              <select
                                value={String(s.size)}
                                onChange={(e) => {
                                  const newSize = Number(e.target.value);
                                  setSplits((prev) =>
                                    prev.map((item, i) => {
                                      if (i !== idx) return item;
                                      const currentPacks =
                                        item.packs !== undefined
                                          ? item.packs
                                          : newSize > 0
                                          ? Math.ceil(item.qty / newSize)
                                          : 0;
                                      return {
                                        ...item,
                                        size: newSize,
                                        qty: round(currentPacks * newSize),
                                      };
                                    })
                                  );
                                }}
                                className="h-8 w-full rounded-md border bg-background px-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                              >
                                {STANDARD_BAG_SIZES.map((opt) => (
                                  <option key={opt.label} value={String(opt.value)}>
                                    {opt.displayKg}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Packet Count / Packs Input */}
                            <div className="w-28">
                              <label className="text-[10px] font-bold text-primary block mb-0.5">
                                Packet Count
                              </label>
                              <div className="inline-flex items-center gap-1 w-full">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={linePacks || ""}
                                  placeholder="e.g. 100"
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
                                <span className="text-[11px] text-muted-foreground font-semibold">
                                  pkts
                                </span>
                              </div>
                            </div>

                            {/* Calculated KG */}
                            <div className="w-24">
                              <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                                Total KG
                              </label>
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
                                        const calculatedPacks =
                                          item.size > 0 ? Math.ceil(val / item.size) : 0;
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

                            {/* Remove Line */}
                            {splits.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setSplits((prev) => prev.filter((_, i) => i !== idx))}
                                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-3 cursor-pointer"
                                title="Remove split line"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>

                          {/* Quick Increment Chips and Formula Badge */}
                          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] pt-1 border-t border-dashed">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground text-[10px]">Add pkts:</span>
                              {[10, 25, 50, 100].map((inc) => (
                                <button
                                  key={inc}
                                  type="button"
                                  onClick={() => {
                                    setSplits((prev) =>
                                      prev.map((item, i) => {
                                        if (i !== idx) return item;
                                        const nextP = (item.packs || 0) + inc;
                                        return {
                                          ...item,
                                          packs: nextP,
                                          qty: round(nextP * item.size),
                                        };
                                      })
                                    );
                                  }}
                                  className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
                                >
                                  +{inc}
                                </button>
                              ))}

                              {selectedBuyerDemand && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSplits((prev) =>
                                      prev.map((item, i) => {
                                        if (i !== idx) return item;
                                        const capP = selectedBuyerDemand.balancePacks;
                                        return {
                                          ...item,
                                          packs: capP,
                                          size: selectedBuyerDemand.packSizeKg,
                                          qty: round(capP * selectedBuyerDemand.packSizeKg),
                                        };
                                      })
                                    );
                                  }}
                                  className="rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 text-[10px] font-semibold hover:bg-amber-500/30 transition-colors cursor-pointer ml-1"
                                >
                                  Exact Buyer Balance ({selectedBuyerDemand.balancePacks} pkts)
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <span>⚡ {linePacks} pkts × {formatGramsLabel(s.size)} = {round(s.qty)} kg</span>
                            </div>
                          </div>

                          {/* Buyer Demand Over-allocation Warning */}
                          {isOverBuyerDemand && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                              <AlertCircle className="size-3" />
                              Allocated {s.qty} kg exceeds {selectedBuyerDemand.buyer} balance deficit of {selectedBuyerDemand.balanceKg} kg ({selectedBuyerDemand.balancePacks} pkts).
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Another Packet Size Split Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextSize = 0.5;
                      const remainingKg = Math.max(0, unallocatedKg);
                      const packsCount = nextSize > 0 ? Math.ceil(remainingKg / nextSize) : 0;
                      setSplits((prev) => [
                        ...prev,
                        { size: nextSize, packs: packsCount, qty: remainingKg, poId: "" },
                      ]);
                    }}
                    className="w-full text-xs gap-1 border-dashed"
                  >
                    <Plus className="size-3.5" /> Add Another Packet Size Split Line
                  </Button>

                  {/* Modal Footer */}
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-xs">
                      <span className="text-muted-foreground">Total Output: </span>
                      <strong className="text-foreground">{totalBags} packets</strong>
                      <span className="text-muted-foreground ml-1">({kg(totalAllocatedKg)})</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSplitProduct(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={totalAllocatedKg <= 0 || isOver}
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
