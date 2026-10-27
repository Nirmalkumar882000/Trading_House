import { useState, useMemo, Fragment } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  Trash2,
  Plus,
  X,
  Package,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Layers,
  UserCheck,
  Eye,
  ShieldCheck,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";
import type { ModuleDef, Row } from "@/lib/modules";
import { PRODUCT_CATALOG } from "@/lib/modules";
import { useStore } from "@/lib/store";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { EmployeeSelect } from "./EmployeeSelect";
import { cn } from "@/lib/utils";
import { lines, normalize, num, parseLines, populate, returnsAvailable, round, validateData, type ProductLine } from "@/lib/workflow";

type Tab = "s1" | "s2";
const kg = (v: number) => `${v.toLocaleString("en-IN", { maximumFractionDigits: 3 })} kg`;
const cell = "w-24 rounded-md border bg-background px-2 py-1 text-sm";
const th = "px-3 py-2 text-left";
type S2Edit = Record<string, { a2: string; b: string; ret: string }>; // key: `${recordId}|${product}`

interface QCLineItem extends ProductLine {
  box?: number;
  startTime?: string;
  grader?: string;
}

export function QualityPage({ mod }: { mod: ModuleDef }) {
  const { data, upsert, remove, nextId } = useStore();
  const [tab, setTab] = useState<Tab>("s1");
  const rows = data["quality-check"] ?? [];
  const receipts = data["receipts"] ?? [];

  // Table search & expansion state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredRecords = useMemo(() => {
    return rows
      .filter((r) => r.status !== "Assigned")
      .filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchRef = r.id.toLowerCase().includes(q);
        const matchLot = String(r["lot"] || "").toLowerCase().includes(q);
        const matchGrader = String(r["grader"] || "").toLowerCase().includes(q);
        const matchSupervisor = String(r["supervisor"] || "").toLowerCase().includes(q);
        const matchProducts = lines(r, "input").some((l) => l.p.toLowerCase().includes(q));
        return matchRef || matchLot || matchGrader || matchSupervisor || matchProducts;
      });
  }, [rows, statusFilter, searchQuery]);

  const toggleExpandAll = () => {
    const hasAnyOpen = Object.values(expandedRows).some(Boolean);
    if (hasAnyOpen) {
      setExpandedRows({});
    } else {
      const allOpen: Record<string, boolean> = {};
      filteredRecords.forEach((r) => {
        allOpen[r.id] = true;
      });
      setExpandedRows(allOpen);
    }
  };

  // ---- Stage 1 State ----
  const [lot, setLot] = useState("");
  const [grader, setGrader] = useState("Karthik M");
  const [supervisor, setSupervisor] = useState("Ravi Kumar");
  const [defaultStartTime, setDefaultStartTime] = useState("10:00 AM");
  const [s1, setS1] = useState<QCLineItem[]>([]);

  // List of assigned graders from Default QC Grader(s) selection
  const assignedGradersList = useMemo(() => {
    const selected = grader
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (selected.length > 0) return selected;
    const activeQC = (data["employees"] ?? [])
      .filter((e) => e.status !== "Disabled" && e["role"] === "QC grader")
      .map((e) => String(e["name"]));
    return activeQC.length > 0 ? activeQC : ["Karthik M", "Divya R"];
  }, [grader, data]);

  const handleGraderChange = (newGrader: string) => {
    setGrader(newGrader);
    const valid = newGrader
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const first = valid[0] || "";
    setS1((prev) =>
      prev.map((l) => {
        if (!l.grader || (valid.length > 0 && !valid.includes(l.grader))) {
          return { ...l, grader: first };
        }
        return l;
      })
    );
  };

  const pendingFor = (id: string) => parseLines(populate("quality-check", "lot", id, { id: "", status: "" } as Row, data)["item"]);
  const stage1Receipts = receipts.filter((r) => r.status === "Posted" && pendingFor(r.id).length > 0);

  const pickLot = (id: string) => {
    setLot(id);
    if (!id) {
      setS1([]);
      return;
    }
    const firstGrader = assignedGradersList[0] || "Karthik M";
    const initialLines = pendingFor(id).map((l) => ({
      p: l.p,
      q: l.q,
      a: 0,
      box: Math.max(1, Math.ceil(l.q / 25)), // ~25kg per box estimate
      startTime: defaultStartTime,
      grader: firstGrader,
    }));
    setS1(initialLines);
  };

  const addLine = () => {
    const fallbackProduct = PRODUCT_CATALOG[0]?.name || "Tomato";
    const firstGrader = assignedGradersList[0] || "Karthik M";
    setS1((prev) => [
      ...prev,
      {
        p: fallbackProduct,
        q: 50,
        a: 0,
        box: 2,
        startTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        grader: firstGrader,
      },
    ]);
  };

  const removeLine = (idx: number) => {
    setS1((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveStage1 = () => {
    if (!lot) return void toast.error("Select the source receipt");
    if (!grader.trim()) return void toast.error("Select at least one grader");
    const ls = s1.filter((l) => l.q > 0);
    if (!ls.length) return void toast.error("Add at least one product with positive quantity");

    // Automate End Time after grading the product (Requirement 12)
    const automatedEndTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const allGraders = [...new Set([grader, ...ls.map((l) => l.grader).filter(Boolean)])].join(", ");

    const totalGradeA = ls.reduce((sum, l) => sum + num(l.a), 0);
    const totalRemaining = ls.reduce((sum, l) => sum + Math.max(0, l.q - num(l.a)), 0);

    const row = normalize("quality-check", {
      id: nextId("quality-check"),
      status: "Stage 1 done",
      date: new Date().toISOString().slice(0, 10),
      sourceType: "Purchase",
      lot,
      grader: allGraders,
      supervisor: supervisor.trim(),
      startTime: defaultStartTime,
      endTime: automatedEndTime, // Automate end time
      item: JSON.stringify(
        ls.map((l) => ({
          p: l.p,
          q: l.q,
          a: num(l.a),
          a2: 0,
          b: 0,
          ret: 0,
          grader: l.grader,
          box: l.box,
          startTime: l.startTime,
        }))
      ),
    } as Row);

    const err = validateData({ ...data, "quality-check": [...rows, row] });
    if (err) return void toast.error(err);

    upsert("quality-check", row);
    toast.success(
      `${row.id}: Stage 1 completed at ${automatedEndTime}. ${totalGradeA} kg Grade A ready for packing. ${totalRemaining} kg routed to Stage 2.`
    );
    pickLot("");
  };

  // ---- Stage 2 State ----
  const [lot2, setLot2] = useState("");
  const [s2Graders, setS2Graders] = useState<Record<string, string>>({});
  const [edit, setEdit] = useState<S2Edit>({});
  const pending = rows.filter((r) => r.status === "Stage 1 done");
  const pendingLots = [...new Set(pending.map((r) => String(r["lot"])))];
  const records = pending.filter((r) => r["lot"] === lot2);
  const field = (rec: Row, l: ProductLine) => edit[`${rec.id}|${l.p}`] ?? { a2: "", b: "", ret: String(returnsAvailable(data, l.p, rec.id)) };
  const setField = (rec: Row, l: ProductLine, patch: Partial<S2Edit[string]>) =>
    setEdit((e) => ({ ...e, [`${rec.id}|${l.p}`]: { ...field(rec, l), ...patch } }));

  const saveStage2 = (rec: Row) => {
    const ls = lines(rec, "input").map((l) => {
      const f = field(rec, l);
      return { ...l, a2: num(f.a2), b: num(f.b), ret: num(f.ret) };
    });
    const finalGrader = s2Graders[rec.id] || rec["grader"] || grader;
    const automatedEndTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const row = normalize("quality-check", {
      ...rec,
      grader: finalGrader,
      status: "Stage 2 done",
      endTime: automatedEndTime,
      item: JSON.stringify(ls),
    } as Row);

    const err = validateData({ ...data, "quality-check": rows.map((r) => (r.id === rec.id ? row : r)) });
    if (err) return void toast.error(err);
    upsert("quality-check", row);
    toast.success(`${rec.id}: Stage 2 completed and saved at ${automatedEndTime}`);
    setLot2("");
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "s1", label: "Stage 1 · First Check (Grade A)", count: stage1Receipts.length },
    { key: "s2", label: "Stage 2 · Remaining Stock & Returns", count: pending.length },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {mod.stage} · {mod.flows}
          </p>
          <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">{mod.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Stage 1: Capture First Grade A with line employee assignments. Stage 2: The remaining KG (plus buyer returns) is graded into Grade A, Grade B, and Rejected.
          </p>
        </div>
        <Button asChild variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10">
          <Link to="/m/$module" params={{ module: "packing" }}>
            <Package className="mr-1.5 size-4" /> Go to Allocation & Packing <ArrowRight className="ml-1.5 size-4" />
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              t.key === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label} <span className="ml-1 rounded-full bg-muted px-2 text-xs">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "s1" && (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-4 items-start">
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-semibold text-muted-foreground">Source Receipt (GRN)</span>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm" value={lot} onChange={(e) => pickLot(e.target.value)}>
                <option value="">Select receipt</option>
                {stage1Receipts.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {lines(r, "received").map((l) => `${l.p} ${l.q} kg`).join(", ")}
                  </option>
                ))}
              </select>
            </label>
            <EmployeeSelect
              multiple
              label="Default QC Grader(s)"
              roleFilter="QC grader"
              value={grader}
              onChange={handleGraderChange}
              placeholder="Select Grader(s)"
            />
            <EmployeeSelect
              label="QC Supervisor"
              roleFilter={["Admin", "Receipt staff"]}
              value={supervisor}
              onChange={setSupervisor}
              placeholder="Select Supervisor"
            />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground">Batch Start Time:</span>
              <div className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium">
                <Clock className="size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={defaultStartTime}
                  onChange={(e) => setDefaultStartTime(e.target.value)}
                  className="w-20 bg-transparent outline-none text-foreground font-semibold"
                />
              </div>
            </div>
            {lot && (
              <Button type="button" variant="outline" size="sm" onClick={addLine} className="text-xs h-8">
                <Plus className="mr-1 size-3.5" /> Add Grading Line
              </Button>
            )}
          </div>

          {s1.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className={th}>#</th>
                    <th className={th}>Product</th>
                    <th className={th}>Input KG</th>
                    <th className={th}>Box / Crates</th>
                    <th className={th}>Start Time</th>
                    <th className={th}>Assigned Grader</th>
                    <th className={th}>Grade A KG (First Check)</th>
                    <th className={th}>Stage 1 Rejected → Goes to Stage 2</th>
                    <th className={th}>Stage 1 Status</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {s1.map((l, i) => {
                    const stage2Remainder = Math.max(0, round(l.q - num(l.a)));
                    const hasGradeA = num(l.a) > 0;
                    return (
                      <tr key={i} className="border-t hover:bg-muted/20">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold">
                          <input
                            type="text"
                            value={l.p}
                            onChange={(e) => setS1((prev) => prev.map((x, j) => (j === i ? { ...x, p: e.target.value } : x)))}
                            className="w-32 rounded border bg-background px-2 py-1 text-sm font-semibold"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className={cell}
                            value={l.q || ""}
                            onChange={(e) => setS1((prev) => prev.map((x, j) => (j === i ? { ...x, q: Number(e.target.value) } : x)))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            placeholder="Crates"
                            className="w-20 rounded-md border bg-background px-2 py-1 text-sm"
                            value={l.box || ""}
                            onChange={(e) => setS1((prev) => prev.map((x, j) => (j === i ? { ...x, box: Number(e.target.value) } : x)))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            placeholder="10:00 AM"
                            className="w-24 rounded-md border bg-background px-2 py-1 text-xs font-mono"
                            value={l.startTime || defaultStartTime}
                            onChange={(e) => setS1((prev) => prev.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={l.grader && assignedGradersList.includes(l.grader) ? l.grader : assignedGradersList[0] || ""}
                            onChange={(e) => setS1((prev) => prev.map((x, j) => (j === i ? { ...x, grader: e.target.value } : x)))}
                            className="rounded-md border bg-background px-2 py-1 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
                          >
                            {assignedGradersList.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            aria-label={`${l.p} Grade A KG`}
                            className={cn(cell, "font-semibold text-emerald-600 dark:text-emerald-400")}
                            value={l.a || ""}
                            placeholder="0"
                            onChange={(e) => setS1((prev) => prev.map((x, j) => (j === i ? { ...x, a: Number(e.target.value) } : x)))}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                          {kg(stage2Remainder)}
                        </td>
                        <td className="px-3 py-2">
                          {hasGradeA ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">
                              <CheckCircle2 className="size-3" /> Grade A · Packing needed
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending Grade A entry</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(i)}
                            className="size-7 text-destructive hover:bg-danger-soft"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t bg-muted/40 text-xs font-semibold">
                  <tr>
                    <td colSpan={2} className="px-3 py-2">
                      Total ({s1.length} lines)
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {kg(s1.reduce((sum, l) => sum + (Number(l.q) || 0), 0))}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {s1.reduce((sum, l) => sum + (Number(l.box) || 0), 0)} boxes
                    </td>
                    <td colSpan={2} />
                    <td className="px-3 py-2 tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                      {kg(s1.reduce((sum, l) => sum + num(l.a), 0))} (Grade A)
                    </td>
                    <td className="px-3 py-2 tabular-nums text-amber-600 dark:text-amber-400 font-bold">
                      {kg(s1.reduce((sum, l) => sum + Math.max(0, round(l.q - num(l.a))), 0))} (To Stage 2)
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {!stage1Receipts.length && (
            <p className="text-sm text-muted-foreground">
              No received stock is waiting for Stage 1. Post a warehouse receipt (GRN) first.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-4 text-primary" />
              <span>
                Grading End Time stamps upon saving.
              </span>
            </div>
            <Button disabled={!s1.length} onClick={saveStage1} className="font-semibold">
              <Check className="mr-1.5 size-4" /> Save Stage 1 (Capture Grade A & Route Remainder)
            </Button>
          </div>
        </section>
      )}

      {tab === "s2" && (
        <section className="space-y-4">
          <label className="block max-w-md space-y-1.5 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">Source Receipt / Lot</span>
            <select className="w-full rounded-lg border bg-card px-3 py-2" value={lot2} onChange={(e) => setLot2(e.target.value)}>
              <option value="">Select receipt</option>
              {pendingLots.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {!pendingLots.length && <p className="text-sm text-muted-foreground">Nothing is waiting for Stage 2. Finish Stage 1 first.</p>}
          {records.map((rec) => (
            <div key={rec.id} className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <p className="text-sm font-medium">
                  <span className="font-mono text-xs font-semibold text-primary">{rec.id}</span> · Receipt {rec["lot"]} · Stage 1 Grader:{" "}
                  <span className="font-semibold text-foreground">{rec["grader"]}</span> · Start: {rec["startTime"] || "10:00 AM"}
                </p>
                <div className="w-72">
                  <EmployeeSelect
                    multiple
                    label="Stage 2 Grader(s) (Multi-select)"
                    roleFilter="QC grader"
                    value={s2Graders[rec.id] ?? String(rec["grader"] || "Karthik M")}
                    onChange={(v) => setS2Graders((prev) => ({ ...prev, [rec.id]: v }))}
                    placeholder="Assign Stage 2 Graders"
                  />
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead className="bg-muted/60 text-[11px] uppercase text-muted-foreground">
                    <tr>
                      <th className={th}>Product</th>
                      <th className={th}>Stage 1 Input</th>
                      <th className={th}>Grade A in Stage 1</th>
                      <th className={th}>Remaining (Stage 1 Rejected)</th>
                      <th className={th}>+ Buyer Returns</th>
                      <th className={th}>To Grade Pool</th>
                      <th className={th}>Grade A (Stage 2)</th>
                      <th className={th}>Grade B</th>
                      <th className={th}>Final Rejected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines(rec, "input").map((l) => {
                      const f = field(rec, l);
                      const rem = round(l.q - num(l.a));
                      const pool = round(rem + num(f.ret));
                      const rejected = round(pool - num(f.a2) - num(f.b));
                      return (
                        <tr key={l.p} className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2 font-semibold">{l.p}</td>
                          <td className="px-3 py-2">{kg(l.q)}</td>
                          <td className="px-3 py-2 font-medium text-emerald-600 dark:text-emerald-400">{kg(num(l.a))}</td>
                          <td className="px-3 py-2 font-medium text-amber-600 dark:text-amber-400">{kg(rem)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              className={cell}
                              value={f.ret}
                              onChange={(e) => setField(rec, l, { ret: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-primary tabular-nums">{kg(pool)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              className={cn(cell, "text-emerald-600 font-semibold")}
                              value={f.a2}
                              onChange={(e) => setField(rec, l, { a2: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              className={cn(cell, "text-blue-600 font-semibold")}
                              value={f.b}
                              onChange={(e) => setField(rec, l, { b: e.target.value })}
                            />
                          </td>
                          <td className={cn("px-3 py-2 font-medium tabular-nums", rejected < 0 ? "text-destructive" : "text-warning")}>
                            {kg(rejected)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  Grading End Time records when saving Stage 2.
                </span>
                <Button onClick={() => saveStage2(rec)} className="font-semibold">
                  <Check className="mr-1.5 size-4" /> Save Stage 2
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* QC Records Section */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">Quality Check Records</h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {filteredRecords.length} of {rows.filter((r) => r.status !== "Assigned").length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Audited grading batches with line-item product yields, grader assignments, and status.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search ref, receipt, product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-md border bg-background pl-8 pr-7 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center rounded-md border bg-muted/40 p-0.5 text-xs">
              {(["all", "Stage 1 done", "Stage 2 done"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "rounded px-2.5 py-1 font-medium transition-colors",
                    statusFilter === st
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {st === "all" ? "All" : st === "Stage 1 done" ? "Stage 1" : "Stage 2"}
                </button>
              ))}
            </div>

            {filteredRecords.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleExpandAll}
                className="h-8 text-xs gap-1 font-medium"
              >
                {Object.values(expandedRows).some(Boolean) ? (
                  <>
                    <ChevronUp className="size-3.5" /> Collapse All
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" /> Expand All
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Records Container */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-muted/70 text-[11px] uppercase tracking-wider text-muted-foreground border-b select-none">
                <tr>
                  <th className="py-3 px-3.5 font-semibold">QC Batch / Time</th>
                  <th className="py-3 px-3 font-semibold">Source Receipt</th>
                  <th className="py-3 px-3.5 font-semibold min-w-[280px]">Products & Input KG</th>
                  <th className="py-3 px-3.5 font-semibold min-w-[220px]">Quality Output & Yield</th>
                  <th className="py-3 px-3 font-semibold min-w-[140px]">QC Graders</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3 text-right font-semibold w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRecords.map((r) => {
                  const rLines = lines(r, "input");
                  const totalIn = rLines.reduce((s, l) => s + (Number(l.q) || 0), 0);
                  const gradeA = num(r["gradeA"]);
                  const gradeB = num(r["gradeB"]);
                  const trash = num(r["trash"]);
                  const totalGraded = gradeA + gradeB + trash;
                  const pctA = totalGraded > 0 ? Math.round((gradeA / totalGraded) * 100) : 0;
                  const pctB = totalGraded > 0 ? Math.round((gradeB / totalGraded) * 100) : 0;
                  const pctTrash = totalGraded > 0 ? Math.max(0, 100 - pctA - pctB) : 0;
                  const isExpanded = !!expandedRows[r.id];

                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={cn(
                          "transition-colors hover:bg-muted/20 cursor-pointer",
                          isExpanded && "bg-muted/15"
                        )}
                        onClick={() => toggleExpand(r.id)}
                      >
                        {/* QC Batch / Time */}
                        <td className="py-3 px-3.5 align-top">
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-primary">
                              <span>{r.id}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                              <Clock className="size-3 text-muted-foreground/80 shrink-0" />
                              <span>
                                {String(r["startTime"] || "10:00 AM")} → {String(r["endTime"] || "Completed")}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Source Receipt */}
                        <td className="py-3 px-3 align-top">
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground border border-border/70">
                              <Package className="size-3 text-primary" />
                              {r["lot"]}
                            </span>
                            {r["supervisor"] && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[120px]" title={String(r["supervisor"])}>
                                Sup: {String(r["supervisor"])}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Products & Input KG */}
                        <td className="py-3 px-3.5 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Boxes className="size-3.5 text-primary" />
                              <span className="font-semibold text-foreground">
                                {rLines.length} {rLines.length === 1 ? "Product" : "Products"}
                              </span>
                              <span className="text-muted-foreground font-medium">· Total {kg(totalIn)}</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {rLines.map((l, idx) => (
                                <div
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background/90 px-2 py-1 text-xs shadow-xs"
                                >
                                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="font-medium text-foreground">{l.p}</span>
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono font-bold text-foreground">
                                    {kg(l.q)}
                                  </span>
                                  {num(l.a) > 0 && (
                                    <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                                      {kg(num(l.a))} Grade A
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* Quality Output & Yield */}
                        <td className="py-3 px-3.5 align-top">
                          <div className="space-y-1.5 max-w-xs">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">Quality Yield</span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {pctA}% Grade A
                              </span>
                            </div>

                            {/* Yield Distribution Bar */}
                            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                              {pctA > 0 && (
                                <div
                                  style={{ width: `${pctA}%` }}
                                  className="bg-emerald-500 transition-all duration-300"
                                  title={`Grade A: ${kg(gradeA)} (${pctA}%)`}
                                />
                              )}
                              {pctB > 0 && (
                                <div
                                  style={{ width: `${pctB}%` }}
                                  className="bg-blue-500 transition-all duration-300"
                                  title={`Grade B: ${kg(gradeB)} (${pctB}%)`}
                                />
                              )}
                              {pctTrash > 0 && (
                                <div
                                  style={{ width: `${pctTrash}%` }}
                                  className="bg-amber-500 transition-all duration-300"
                                  title={`Rejected: ${kg(trash)} (${pctTrash}%)`}
                                />
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[11px]">
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="size-3" /> A: {kg(gradeA)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 font-mono font-semibold text-blue-700 dark:text-blue-300">
                                B: {kg(gradeB)}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono font-semibold",
                                  trash > 0
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                Rej: {kg(trash)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* QC Graders */}
                        <td className="py-3 px-3 align-top">
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {String(r["grader"] || "—")
                              .split(",")
                              .map((g) => g.trim())
                              .filter(Boolean)
                              .map((g) => (
                                <span
                                  key={g}
                                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary"
                                >
                                  <UserCheck className="size-3" />
                                  {g}
                                </span>
                              ))}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 align-top">
                          <StatusBadge status={r.status} statuses={mod.statuses} />
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpand(r.id)}
                              className="h-8 px-2 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                              <span>{isExpanded ? "Close" : "Details"}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete"
                              onClick={() => {
                                const err = validateData({ ...data, "quality-check": rows.filter((x) => x.id !== r.id) });
                                if (err) return void toast.error(err);
                                remove("quality-check", r.id);
                                toast.success(`${r.id} deleted`);
                              }}
                              className="size-8 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Produce Line Details */}
                      {isExpanded && (
                        <tr className="bg-muted/30 border-t">
                          <td colSpan={7} className="p-4">
                            <div className="rounded-lg border bg-background p-4 shadow-xs space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-primary">{r.id}</span>
                                  <span className="text-xs text-muted-foreground">• Receipt {r["lot"]}</span>
                                  <span className="text-xs text-muted-foreground">• Batch Time: {r["startTime"] || "10:00 AM"} → {r["endTime"] || "Completed"}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Supervisor: <span className="font-semibold text-foreground">{r["supervisor"] || "Ravi Kumar"}</span>
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                                    <tr>
                                      <th className="py-2 px-3 text-left">#</th>
                                      <th className="py-2 px-3 text-left">Produce Item</th>
                                      <th className="py-2 px-3 text-left">Assigned Grader</th>
                                      <th className="py-2 px-3 text-right">Received (KG)</th>
                                      <th className="py-2 px-3 text-right">Grade A (First Check)</th>
                                      <th className="py-2 px-3 text-right">Stage 2 Remaining</th>
                                      {r.status === "Stage 2 done" && (
                                        <>
                                          <th className="py-2 px-3 text-right">Stage 2 Grade A</th>
                                          <th className="py-2 px-3 text-right">Grade B</th>
                                          <th className="py-2 px-3 text-right">Rejected</th>
                                        </>
                                      )}
                                      <th className="py-2 px-3 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/60">
                                    {rLines.map((lineItem, lIdx) => {
                                      const lineGradeA = num(lineItem.a);
                                      const lineRemainder = Math.max(0, round(lineItem.q - lineGradeA));
                                      const itemGrader = (lineItem as QCLineItem).grader || r["grader"] || "—";

                                      return (
                                        <tr key={lIdx} className="hover:bg-muted/20">
                                          <td className="py-2 px-3 text-muted-foreground font-mono">{lIdx + 1}</td>
                                          <td className="py-2 px-3 font-semibold text-foreground">{lineItem.p}</td>
                                          <td className="py-2 px-3">
                                            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                                              <UserCheck className="size-2.5" />
                                              {itemGrader}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold">{kg(lineItem.q)}</td>
                                          <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                            {kg(lineGradeA)}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                                            {kg(lineRemainder)}
                                          </td>
                                          {r.status === "Stage 2 done" && (
                                            <>
                                              <td className="py-2 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                                {kg(num(lineItem.a2))}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono text-blue-600 dark:text-blue-400">
                                                {kg(num(lineItem.b))}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono text-amber-600 dark:text-amber-400">
                                                {kg(num(lineItem.ret))}
                                              </td>
                                            </>
                                          )}
                                          <td className="py-2 px-3 text-center">
                                            {lineGradeA > 0 ? (
                                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                                <Check className="size-3" /> Grade A ready
                                              </span>
                                            ) : (
                                              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                To Stage 2
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!filteredRecords.length && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Boxes className="mx-auto size-8 text-muted-foreground/50 mb-2" />
              <p className="font-semibold text-foreground">No quality check records match your filter</p>
              <p className="text-xs text-muted-foreground mt-0.5">Try adjusting your search query or status filter.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
