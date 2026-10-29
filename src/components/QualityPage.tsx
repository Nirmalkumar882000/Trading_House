import { useState, useMemo, Fragment, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  Trash2,
  Plus,
  X,
  Package,
  Clock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  Layers,
  UserCheck,
  ShieldCheck,
  Boxes,
  Split,
  Users,
  Zap,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import type { ModuleDef, Row } from "@/lib/modules";
import { PRODUCT_CATALOG, DEFAULT_WAREHOUSE } from "@/lib/modules";
import { useStore } from "@/lib/store";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { EmployeeSelect } from "./EmployeeSelect";
import { cn } from "@/lib/utils";
import { lines, normalize, num, parseLines, populate, returnsAvailable, round, validateData, type ProductLine } from "@/lib/workflow";

type Tab = "assign" | "s1" | "s2";
const kg = (v: number) => `${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg`;
const th = "px-3 py-2.5 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider";
type S2Edit = Record<string, { a2: string; b: string; ret: string }>; // key: `${recordId}|${product}|${idx}`

interface QCLineItem extends ProductLine {
  box?: number;
  startTime?: string;
  grader?: string;
  lineTag?: string;
}

// Compact, multi-employee selector for single produce lines
function LineGraderSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const toggle = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selected.includes(name)) {
      const next = selected.filter((n) => n !== name);
      onChange(next.join(", "));
    } else {
      const next = [...selected, name];
      onChange(next.join(", "));
    }
  };

  const remove = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = selected.filter((n) => n !== name);
    onChange(next.join(", "));
  };

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-h-[32px] max-w-[260px] flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-semibold text-foreground hover:border-primary/50 transition-colors focus:ring-1 focus:ring-primary outline-none"
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground font-normal">+ Assign employee(s)...</span>
        ) : (
          selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
            >
              <UserCheck className="size-2.5" />
              <span>{name}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => remove(name, e)}
                className="hover:text-destructive p-0.5"
                title={`Remove ${name}`}
              >
                <X className="size-2.5" />
              </span>
            </span>
          ))
        )}
        <ChevronDown className={cn("size-3 ml-auto text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border bg-popover p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mb-1 flex items-center justify-between">
            <span>Assign Employee(s) to Line</span>
            <span className="text-primary font-mono">{selected.length}</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {options.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <div
                  key={opt}
                  onClick={(e) => toggle(opt, e)}
                  className={cn(
                    "flex items-center justify-between rounded px-2 py-1.5 text-xs cursor-pointer transition-colors",
                    isSelected ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "grid size-3.5 place-items-center rounded border",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                      )}
                    >
                      {isSelected && <Check className="size-2.5 stroke-[3]" />}
                    </div>
                    <span>{opt}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Modern, flexible interactive split action button (50/50, 3-way, or custom kg)
function SplitLineAction({
  line,
  index,
  onSplit,
  availableGraders,
}: {
  line: QCLineItem;
  index: number;
  onSplit: (
    index: number,
    splitLines: { q: number; grader: string; tag: string }[]
  ) => void;
  availableGraders: string[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"50-50" | "3-way" | "custom">("50-50");
  const currentQ = Number(line.q) || 0;

  const [customL1, setCustomL1] = useState(round(currentQ / 2));
  const customL2 = Math.max(0, round(currentQ - customL1));

  const [g1, setG1] = useState(line.grader || availableGraders[0] || "Karthik M");
  const [g2, setG2] = useState(
    availableGraders.find((g) => g !== line.grader) || availableGraders[1] || "Divya R"
  );
  const [g3, setG3] = useState(availableGraders[2] || "Senthil P");

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setCustomL1(round(currentQ / 2));
      setG1(line.grader || availableGraders[0] || "Karthik M");
      setG2(availableGraders.find((g) => g !== line.grader) || availableGraders[1] || "Divya R");
    }
  }, [open, currentQ, line.grader, availableGraders]);

  const handleApply = (selectedMode: "50-50" | "3-way" | "custom") => {
    if (currentQ <= 0) {
      toast.error("Line quantity must be greater than 0 to split");
      return;
    }

    if (selectedMode === "50-50") {
      const h1 = round(currentQ / 2);
      const h2 = round(currentQ - h1);
      onSplit(index, [
        { q: h1, grader: g1, tag: "Line 1/2" },
        { q: h2, grader: g2, tag: "Line 2/2" },
      ]);
      toast.success(`Split ${line.p} into 2 equal lines: ${h1} kg (${g1}) and ${h2} kg (${g2})`);
    } else if (selectedMode === "3-way") {
      const p1 = round(currentQ / 3);
      const p2 = round(currentQ / 3);
      const p3 = round(currentQ - p1 - p2);
      onSplit(index, [
        { q: p1, grader: g1, tag: "Line 1/3" },
        { q: p2, grader: g2, tag: "Line 2/3" },
        { q: p3, grader: g3, tag: "Line 3/3" },
      ]);
      toast.success(`Split ${line.p} into 3 lines: ${p1} kg, ${p2} kg, and ${p3} kg`);
    } else if (selectedMode === "custom") {
      if (customL1 <= 0 || customL2 <= 0) {
        toast.error("Both split lines must have positive quantities");
        return;
      }
      onSplit(index, [
        { q: customL1, grader: g1, tag: "Line 1/2" },
        { q: customL2, grader: g2, tag: "Line 2/2" },
      ]);
      toast.success(`Split ${line.p} into ${customL1} kg (${g1}) and ${customL2} kg (${g2})`);
    }

    setOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all shadow-xs outline-none",
          open
            ? "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20"
            : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50"
        )}
        title="Split this produce line into multiple lines (50/50, 3-way, or custom kg)"
      >
        <Split className="size-3.5" />
        <span>Split Line</span>
        <ChevronDown className={cn("size-3 transition-transform text-primary/70 shrink-0", open && "rotate-180 text-primary-foreground")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border bg-card p-3 shadow-xl animate-in fade-in-50 zoom-in-95 text-left text-foreground">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <div className="grid size-6 place-items-center rounded bg-primary/10 text-primary">
                <Split className="size-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold leading-tight text-foreground">{line.p}</div>
                <div className="text-[10px] text-muted-foreground">
                  Total Lot: <span className="font-mono font-semibold text-foreground">{currentQ} kg</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1 mb-3 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setMode("50-50")}
              className={cn(
                "rounded py-1 text-center transition-colors",
                mode === "50-50" ? "bg-background text-primary shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              50 / 50
            </button>
            <button
              type="button"
              onClick={() => setMode("3-way")}
              className={cn(
                "rounded py-1 text-center transition-colors",
                mode === "3-way" ? "bg-background text-primary shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              3 Lines
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={cn(
                "rounded py-1 text-center transition-colors",
                mode === "custom" ? "bg-background text-primary shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Custom KG
            </button>
          </div>

          {/* Mode 1: 50 / 50 */}
          {mode === "50-50" && (
            <div className="space-y-2.5">
              <div className="rounded-lg border bg-muted/30 p-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Line 1 (50%):</span>
                  <span className="font-mono font-bold text-foreground">{round(currentQ / 2)} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Line 2 (50%):</span>
                  <span className="font-mono font-bold text-foreground">{round(currentQ - round(currentQ / 2))} kg</span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Second Line Grader
                </label>
                <select
                  value={g2}
                  onChange={(e) => setG2(e.target.value)}
                  className="w-full h-8 rounded-md border bg-background px-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                >
                  {availableGraders.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => handleApply("50-50")}
                className="w-full h-8 text-xs font-semibold gap-1.5 mt-1"
              >
                <Split className="size-3.5" /> Apply 50/50 Split
              </Button>
            </div>
          )}

          {/* Mode 2: 3-Way */}
          {mode === "3-way" && (
            <div className="space-y-2.5">
              <div className="rounded-lg border bg-muted/30 p-2 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Line 1:</span>
                  <span className="font-mono font-bold text-foreground">{round(currentQ / 3)} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Line 2:</span>
                  <span className="font-mono font-bold text-foreground">{round(currentQ / 3)} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Line 3:</span>
                  <span className="font-mono font-bold text-foreground">{round(currentQ - round(currentQ / 3) * 2)} kg</span>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => handleApply("3-way")}
                className="w-full h-8 text-xs font-semibold gap-1.5 mt-1"
              >
                <Users className="size-3.5" /> Split into 3 Equal Lines
              </Button>
            </div>
          )}

          {/* Mode 3: Custom KG */}
          {mode === "custom" && (
            <div className="space-y-2.5">
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Line 1 Allocated:</span>
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="number"
                      min={0.1}
                      max={currentQ - 0.1}
                      step="any"
                      value={customL1}
                      onChange={(e) => setCustomL1(Number(e.target.value))}
                      className="w-20 h-7 rounded border bg-background px-2 text-right font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-muted-foreground text-xs">kg</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs">Line 2 (Remaining):</span>
                  <span className="font-mono font-bold text-foreground">{customL2} kg</span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Line 2 Grader
                </label>
                <select
                  value={g2}
                  onChange={(e) => setG2(e.target.value)}
                  className="w-full h-8 rounded-md border bg-background px-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                >
                  {availableGraders.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => handleApply("custom")}
                className="w-full h-8 text-xs font-semibold gap-1.5 mt-1"
              >
                <Check className="size-3.5" /> Apply Custom Split
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function QualityPage({ mod }: { mod: ModuleDef }) {
  const { data, upsert, remove, nextId } = useStore();
  const [tab, setTab] = useState<Tab>("assign");
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

  // ---- Stage 1 State & Assignment State ----
  const [lot, setLot] = useState("");
  const [grader, setGrader] = useState("Karthik M, Divya R");
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

  // All available QC graders for single line multi-employee assignment
  const allQCGraders = useMemo(() => {
    const fromMaster = (data["employees"] ?? [])
      .filter((e) => e.status !== "Disabled" && e["role"] === "QC grader")
      .map((e) => String(e["name"]));
    const combined = [...new Set([...assignedGradersList, ...fromMaster, "Karthik M", "Divya R"])].filter(Boolean);
    return combined;
  }, [assignedGradersList, data]);

  const handleGraderChange = (newGrader: string) => {
    setGrader(newGrader);
    const valid = newGrader
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const first = valid[0] || "";
    setS1((prev) =>
      prev.map((l) => {
        if (!l.grader) {
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
    const initialLines = pendingFor(id).map((l, idx) => ({
      p: l.p,
      q: l.q,
      a: 0,
      box: Math.max(1, Math.ceil(l.q / 25)),
      startTime: defaultStartTime,
      grader: assignedGradersList[idx % assignedGradersList.length] || firstGrader,
    }));
    setS1(initialLines);
  };

  // Split produce line into multiple lines (50/50, 3-way, or custom kg)
  const handleSplitProduceLine = (
    index: number,
    splits: { q: number; grader: string; tag: string }[]
  ) => {
    const target = s1[index];
    if (!target) return;

    const newLines: QCLineItem[] = splits.map((s) => ({
      ...target,
      q: s.q,
      a: 0,
      box: Math.max(1, Math.ceil(s.q / 25)),
      grader: s.grader,
      lineTag: s.tag,
    }));

    setS1((prev) => {
      const copy = [...prev];
      copy.splice(index, 1, ...newLines);
      return copy;
    });
  };

  // Quick 50/50 split helper across different employees
  const splitLine = (index: number) => {
    const target = s1[index];
    if (!target) return;
    const currentQ = Number(target.q) || 0;
    if (currentQ <= 0) {
      toast.error("Line quantity must be greater than 0 to split");
      return;
    }
    const half1 = round(currentQ / 2);
    const half2 = round(currentQ - half1);
    const nextGrader = assignedGradersList.find((g) => g !== target.grader) || assignedGradersList[1] || target.grader || "Divya R";

    handleSplitProduceLine(index, [
      { q: half1, grader: target.grader || assignedGradersList[0] || "Karthik M", tag: "Line 1/2" },
      { q: half2, grader: nextGrader, tag: "Line 2/2" },
    ]);

    toast.success(`Split ${target.p} (${currentQ} kg) into 2 lines: ${half1} kg & ${half2} kg`);
  };

  // Auto-split bulk produce (e.g. 500 kg Tomato) across 2 lines
  const autoSplit500KgDemo = () => {
    const demoLotId = "GRN-TOMATO-500";
    const existing = receipts.find((r) => r.id === demoLotId);
    if (!existing) {
      upsert("receipts", normalize("receipts", {
        id: demoLotId,
        date: new Date().toISOString().slice(0, 10),
        status: "Posted",
        route: "Market trip",
        dc: "TRP-1001",
        item: JSON.stringify([{ p: "Tomato", q: 500 }]),
        sent: 500,
        received: 500,
        diff: 0,
        supplier: "Murugan Traders",
        containerType: "Plastic crates",
        containerCount: 20,
      }));
    }

    setLot(demoLotId);
    setGrader("Karthik M, Divya R");
    setSupervisor("Ravi Kumar");

    // Auto-split 500 kg Tomato into 2 lines: 250 kg Karthik M & 250 kg Divya R
    const line1: QCLineItem = {
      p: "Tomato",
      q: 250,
      a: 0,
      box: 10,
      startTime: defaultStartTime,
      grader: "Karthik M",
      lineTag: "Line 1/2",
    };
    const line2: QCLineItem = {
      p: "Tomato",
      q: 250,
      a: 0,
      box: 10,
      startTime: defaultStartTime,
      grader: "Divya R",
      lineTag: "Line 2/2",
    };
    setS1([line1, line2]);
    toast.success("Loaded: 500 kg Tomato auto-split into 2 lines (250 kg each for Karthik M & Divya R)");
  };

  // Proceed to Step 2 (First QC Check)
  const proceedToFirstCheck = () => {
    if (!lot) {
      toast.error("Please select a Source Receipt (GRN) first");
      return;
    }
    const positiveLines = s1.filter((l) => Number(l.q) > 0);
    if (!positiveLines.length) {
      toast.error("Please configure at least one line with positive KG quantity");
      return;
    }
    setTab("s1");
    toast.success(`First QC Check ready! Enter Grade A quantities below.`);
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
        startTime: defaultStartTime,
        grader: firstGrader,
        lineTag: `Line ${prev.length + 1}`,
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

    const automatedEndTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const allGraders = [...new Set([
      grader,
      ...ls.flatMap((l) => (l.grader || "").split(",").map((s) => s.trim()).filter(Boolean))
    ])].join(", ");

    const totalGradeA = ls.reduce((sum, l) => sum + num(l.a), 0);
    const totalRemaining = ls.reduce((sum, l) => sum + Math.max(0, l.q - num(l.a)), 0);

    const srcReceipt = receipts.find((r) => r.id === lot);
    const row = normalize("quality-check", {
      id: nextId("quality-check"),
      status: "Stage 1 done",
      date: new Date().toISOString().slice(0, 10),
      sourceType: "Purchase",
      lot,
      warehouse: String(srcReceipt?.["warehouse"] || DEFAULT_WAREHOUSE),
      grader: allGraders,
      supervisor: supervisor.trim(),
      startTime: defaultStartTime,
      endTime: automatedEndTime,
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
          lineTag: l.lineTag,
        }))
      ),
    } as Row);

    const err = validateData({ ...data, "quality-check": [...rows, row] });
    if (err) return void toast.error(err);

    upsert("quality-check", row);
    toast.success(
      `${row.id}: Stage 1 completed. ${totalGradeA} kg Grade A ready for packing. ${totalRemaining} kg routed to Stage 2.`
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
  
  const field = (rec: Row, l: ProductLine, idx: number = 0) =>
    edit[`${rec.id}|${l.p}|${idx}`] ?? edit[`${rec.id}|${l.p}`] ?? { a2: "", b: "", ret: String(returnsAvailable(data, l.p, rec.id)) };
  const setField = (rec: Row, l: ProductLine, patch: Partial<S2Edit[string]>, idx: number = 0) =>
    setEdit((e) => ({ ...e, [`${rec.id}|${l.p}|${idx}`]: { ...field(rec, l, idx), ...patch } }));

  const saveStage2 = (rec: Row) => {
    const ls = lines(rec, "input").map((l, idx) => {
      const f = field(rec, l, idx);
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
    toast.success(`${rec.id}: Stage 2 completed and saved`);
    setLot2("");
  };

  const tabs: { key: Tab; label: string; count: number; icon: any }[] = [
    { key: "assign", label: "1. Assign Employees & Split Lines", count: stage1Receipts.length, icon: Users },
    { key: "s1", label: "2. First QC Check (Grade A Entry)", count: s1.length > 0 ? s1.length : stage1Receipts.length, icon: Sparkles },
    { key: "s2", label: "3. Stage 2 (Secondary & Returns)", count: pending.length, icon: Layers },
  ];

  const totalInputKg = s1.reduce((sum, l) => sum + (Number(l.q) || 0), 0);
  const totalBoxes = s1.reduce((sum, l) => sum + (Number(l.box) || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {mod.stage} · {mod.flows}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">{mod.title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Assign single or multiple employees to produce lines, auto-split bulk lots, and capture Grade A yield.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 h-9">
          <Link to="/m/$module" params={{ module: "packing" }}>
            <Package className="mr-1.5 size-4" /> Go to Allocation & Packing <ArrowRight className="ml-1.5 size-4" />
          </Link>
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b pb-px">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary text-primary font-semibold bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <Icon className="size-3.5" />
              <span>{t.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-mono", active ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground")}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* STEP 1: CLEAN, UNCONGESTED ASSIGN EMPLOYEES & SPLIT LINES SCREEN */}
      {tab === "assign" && (
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
          {/* Top Form Controls in One Clean Bar */}
          <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
            <div className="grid gap-3 sm:grid-cols-3 flex-1 min-w-[300px]">
              <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                <span>Source Receipt (GRN)</span>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                  value={lot}
                  onChange={(e) => pickLot(e.target.value)}
                >
                  <option value="">Select warehouse receipt</option>
                  {stage1Receipts.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r["warehouse"] ? `[${r["warehouse"]}] · ` : ""}{lines(r, "received").map((l) => `${l.p} ${l.q} kg`).join(", ")}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1">
                <EmployeeSelect
                  multiple
                  label="QC Grader(s) Assigned"
                  roleFilter="QC grader"
                  value={grader}
                  onChange={handleGraderChange}
                  placeholder="Select Grader(s)"
                />
              </div>

              <div className="space-y-1">
                <EmployeeSelect
                  label="QC Supervisor"
                  roleFilter={["Admin", "Receipt staff"]}
                  value={supervisor}
                  onChange={setSupervisor}
                  placeholder="Select Supervisor"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={autoSplit500KgDemo}
              className="h-9 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 gap-1.5 shrink-0"
            >
              <Zap className="size-3.5 text-amber-500 fill-amber-500" /> Demo: 500 kg Tomato (2-Line Split)
            </Button>
          </div>

          {/* SINGLE UNIFIED PRODUCE LINES TABLE (SUPPORTS MULTIPLE EMPLOYEES PER SINGLE LINE) */}
          {lot ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Produce Lines & Grader Assignment</h3>
                  <p className="text-xs text-muted-foreground">
                    Assign <span className="font-semibold text-primary">single or multiple employees</span> to each line. Use <span className="font-semibold text-primary">"Split Line"</span> to divide produce into multiple lines (50/50, 3-way, or custom kg).
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-8 text-xs gap-1">
                  <Plus className="size-3" /> Add Produce Line
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border bg-background">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 border-b">
                    <tr>
                      <th className={th}>#</th>
                      <th className={th}>Produce Item</th>
                      <th className={th}>Allocated KG</th>
                      <th className={th}>Boxes / Crates</th>
                      <th className={th}>Assigned Employee(s) (Multi-Select)</th>
                      <th className={th}>Start Time</th>
                      <th className={cn(th, "text-right")}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {s1.map((l, i) => {
                      const currentBox = l.box || Math.max(1, Math.ceil(Number(l.q) / 25));
                      return (
                        <tr key={i} className="hover:bg-muted/15 transition-colors">
                          <td className="px-3 py-2 text-muted-foreground font-mono font-medium">{i + 1}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <span>{l.p}</span>
                              {l.lineTag && (
                                <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary font-bold">
                                  {l.lineTag}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                aria-label={`${l.p} input kg`}
                                className="w-24 h-8 rounded border bg-background px-2 font-mono font-semibold text-xs outline-none focus:ring-1 focus:ring-primary"
                                value={l.q || ""}
                                onChange={(e) => {
                                  const newQ = Number(e.target.value);
                                  setS1((prev) =>
                                    prev.map((x, j) =>
                                      j === i ? { ...x, q: newQ, box: Math.max(1, Math.ceil(newQ / 25)) } : x
                                    )
                                  );
                                }}
                              />
                              <span className="text-muted-foreground text-xs">kg</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              className="w-16 h-8 rounded border bg-background px-2 font-mono text-xs outline-none focus:ring-1 focus:ring-primary"
                              value={l.box || currentBox}
                              onChange={(e) =>
                                setS1((prev) =>
                                    prev.map((x, j) => (j === i ? { ...x, box: Number(e.target.value) } : x))
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            {/* MULTI-EMPLOYEE ASSIGNMENT FOR SINGLE LINE */}
                            <LineGraderSelect
                              value={l.grader || ""}
                              onChange={(val) =>
                                setS1((prev) =>
                                  prev.map((x, j) => (j === i ? { ...x, grader: val } : x))
                                )
                              }
                              options={allQCGraders}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              className="w-20 h-8 rounded border bg-background px-2 font-mono text-xs outline-none focus:ring-1 focus:ring-primary"
                              value={l.startTime || defaultStartTime}
                              onChange={(e) =>
                                setS1((prev) =>
                                  prev.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x))
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <SplitLineAction
                                line={l}
                                index={i}
                                onSplit={handleSplitProduceLine}
                                availableGraders={allQCGraders}
                              />
                              {s1.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeLine(i)}
                                  className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Delete line"
                                >
                                  <X className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t bg-muted/30 font-semibold text-xs">
                    <tr>
                      <td colSpan={2} className="px-3 py-2.5">
                        Total ({s1.length} lines)
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                        {kg(totalInputKg)}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {totalBoxes} boxes
                      </td>
                      <td colSpan={3} className="px-3 py-2.5 text-right text-muted-foreground">
                        Ready to proceed to Grade A check
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Bottom Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>
                    {s1.length} lines configured ({kg(totalInputKg)})
                  </span>
                </div>

                <Button onClick={proceedToFirstCheck} className="font-semibold gap-1.5 px-5 h-9">
                  <span>Confirm Lines & Proceed to First QC Check</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed py-8 px-4 text-center text-xs text-muted-foreground space-y-2">
              <Users className="mx-auto size-7 text-muted-foreground/50" />
              <p className="font-semibold text-foreground">Select a Source Receipt (GRN) above to view and assign lines</p>
              <p className="text-muted-foreground">Or click below to test with a 500 kg Tomato auto-split demo.</p>
              <Button variant="outline" size="sm" onClick={autoSplit500KgDemo} className="mt-1 text-xs">
                Load 500 kg Tomato Demo
              </Button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: CLEAN, SPACIOUS FIRST QC CHECK (GRADE A ENTRY) */}
      {tab === "s1" && (
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
          {/* Clean Batch Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-mono font-bold text-primary">
                {lot || "No Lot"}
              </span>
              <span className="text-xs text-muted-foreground">• Supervisor: <b className="text-foreground">{supervisor}</b></span>
              <span className="text-xs text-muted-foreground">• Default Graders: <b className="text-foreground">{assignedGradersList.join(", ")}</b></span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTab("assign")}
                className="text-xs h-8 gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" /> Back to Line Assignment
              </Button>
              {lot && (
                <Button type="button" variant="outline" size="sm" onClick={addLine} className="text-xs h-8">
                  <Plus className="mr-1 size-3.5" /> Add Line
                </Button>
              )}
            </div>
          </div>

          {/* First Check Table */}
          {s1.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border bg-background">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 border-b">
                    <tr>
                      <th className={th}>#</th>
                      <th className={th}>Produce Line</th>
                      <th className={th}>Input KG</th>
                      <th className={th}>Boxes</th>
                      <th className={th}>Assigned Employee(s)</th>
                      <th className={th}>Grade A KG (First Check)</th>
                      <th className={th}>Stage 1 Rejected → Goes to Stage 2</th>
                      <th className={th}>Status</th>
                      <th className={cn(th, "text-right")}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {s1.map((l, i) => {
                      const stage2Remainder = Math.max(0, round(l.q - num(l.a)));
                      const hasGradeA = num(l.a) > 0;
                      return (
                        <tr key={i} className="hover:bg-muted/15 transition-colors">
                          <td className="px-3 py-2.5 text-muted-foreground font-mono">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <span>{l.p}</span>
                              {l.lineTag && (
                                <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                                  {l.lineTag}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold">{kg(l.q)}</td>
                          <td className="px-3 py-2.5 font-mono">{l.box || Math.max(1, Math.ceil(l.q / 25))}</td>
                          <td className="px-3 py-2.5">
                            {/* MULTI-EMPLOYEE ASSIGNMENT IN FIRST CHECK */}
                            <LineGraderSelect
                              value={l.grader || ""}
                              onChange={(val) =>
                                setS1((prev) =>
                                  prev.map((x, j) => (j === i ? { ...x, grader: val } : x))
                                )
                              }
                              options={allQCGraders}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                aria-label={`${l.p} Grade A KG`}
                                className="w-24 h-8 rounded border bg-background px-2 font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 outline-none focus:ring-1 focus:ring-primary"
                                value={l.a || ""}
                                placeholder="0"
                                onChange={(e) =>
                                  setS1((prev) =>
                                    prev.map((x, j) => (j === i ? { ...x, a: Number(e.target.value) } : x))
                                  )
                                }
                              />
                              <span className="text-muted-foreground text-xs">kg</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-amber-600 dark:text-amber-400">
                            {kg(stage2Remainder)}
                          </td>
                          <td className="px-3 py-2.5">
                            {hasGradeA ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-semibold">
                                <CheckCircle2 className="size-3" /> Grade A ready
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Pending Grade A entry</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <SplitLineAction
                                line={l}
                                index={i}
                                onSplit={handleSplitProduceLine}
                                availableGraders={allQCGraders}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLine(i)}
                                className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Delete line"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t bg-muted/30 font-semibold text-xs">
                    <tr>
                      <td colSpan={2} className="px-3 py-2.5">
                        Total ({s1.length} lines)
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold">{kg(totalInputKg)}</td>
                      <td className="px-3 py-2.5 font-mono">{totalBoxes} boxes</td>
                      <td />
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {kg(s1.reduce((sum, l) => sum + num(l.a), 0))} (Grade A)
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                        {kg(s1.reduce((sum, l) => sum + Math.max(0, round(l.q - num(l.a))), 0))} (To Stage 2)
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Save Stage 1 Action */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5 text-primary" />
                  <span>Grading End Time stamps automatically when saved.</span>
                </div>
                <Button disabled={!s1.length} onClick={saveStage1} className="font-semibold gap-1.5 px-5 h-9">
                  <Check className="size-4" /> Save Stage 1 (Capture Grade A & Route Remainder)
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed py-8 px-4 text-center text-xs text-muted-foreground space-y-2">
              <Sparkles className="mx-auto size-7 text-muted-foreground/50" />
              <p className="font-semibold text-foreground">No lines currently loaded for First QC Check</p>
              <p className="text-muted-foreground">Go to Step 1 to select a receipt and assign employee graders to lines.</p>
              <Button onClick={() => setTab("assign")} size="sm" className="mt-1 text-xs">
                Go to Step 1 · Assign Employees
              </Button>
            </div>
          )}
        </div>
      )}

      {/* STAGE 2: REMAINING STOCK & RETURNS */}
      {tab === "s2" && (
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
          <label className="block max-w-md space-y-1.5 text-xs font-semibold text-muted-foreground">
            <span>Source Receipt / Lot</span>
            <select className="w-full h-9 rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary" value={lot2} onChange={(e) => setLot2(e.target.value)}>
              <option value="">Select receipt</option>
              {pendingLots.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {!pendingLots.length && <p className="text-xs text-muted-foreground">Nothing is waiting for Stage 2. Finish Stage 1 first.</p>}
          {records.map((rec) => (
            <div key={rec.id} className="space-y-3 rounded-lg border bg-background p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <p className="text-xs font-medium">
                  <span className="font-mono font-bold text-primary">{rec.id}</span> · Receipt {rec["lot"]} · Stage 1 Grader:{" "}
                  <span className="font-semibold text-foreground">{rec["grader"]}</span>
                </p>
                <div className="w-64">
                  <EmployeeSelect
                    multiple
                    label="Stage 2 Grader(s)"
                    roleFilter="QC grader"
                    value={s2Graders[rec.id] ?? String(rec["grader"] || "Karthik M")}
                    onChange={(v) => setS2Graders((prev) => ({ ...prev, [rec.id]: v }))}
                    placeholder="Assign Stage 2 Graders"
                  />
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full whitespace-nowrap text-xs">
                  <thead className="bg-muted/60 border-b">
                    <tr>
                      <th className={th}>Product</th>
                      <th className={th}>Stage 1 Input</th>
                      <th className={th}>Grade A (Stage 1)</th>
                      <th className={th}>Remaining (Rejects)</th>
                      <th className={th}>+ Buyer Returns</th>
                      <th className={th}>Pool</th>
                      <th className={th}>Grade A (Stage 2)</th>
                      <th className={th}>Grade B</th>
                      <th className={th}>Final Rejected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines(rec, "input").map((l, lIdx) => {
                      const f = field(rec, l, lIdx);
                      const rem = round(l.q - num(l.a));
                      const pool = round(rem + num(f.ret));
                      const rejected = round(pool - num(f.a2) - num(f.b));
                      return (
                        <tr key={lIdx} className="border-t hover:bg-muted/15">
                          <td className="px-3 py-2 font-semibold">
                            {l.p}
                            {l.lineTag && <span className="ml-1 text-[10px] text-muted-foreground font-mono">({l.lineTag})</span>}
                          </td>
                          <td className="px-3 py-2 font-mono">{kg(l.q)}</td>
                          <td className="px-3 py-2 font-medium text-emerald-600 font-mono">{kg(num(l.a))}</td>
                          <td className="px-3 py-2 font-medium text-amber-600 font-mono">{kg(rem)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              className="w-20 h-7 rounded border bg-background px-2 text-xs font-mono"
                              value={f.ret}
                              onChange={(e) => setField(rec, l, { ret: e.target.value }, lIdx)}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-primary font-mono">{kg(pool)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              className="w-20 h-7 rounded border bg-background px-2 text-xs font-mono text-emerald-600 font-bold"
                              value={f.a2}
                              onChange={(e) => setField(rec, l, { a2: e.target.value }, lIdx)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              className="w-20 h-7 rounded border bg-background px-2 text-xs font-mono text-blue-600 font-bold"
                              value={f.b}
                              onChange={(e) => setField(rec, l, { b: e.target.value }, lIdx)}
                            />
                          </td>
                          <td className={cn("px-3 py-2 font-medium font-mono", rejected < 0 ? "text-destructive" : "text-amber-600")}>
                            {kg(rejected)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-end pt-1">
                <Button onClick={() => saveStage2(rec)} size="sm" className="font-semibold gap-1.5 h-8 text-xs">
                  <Check className="size-3.5" /> Save Stage 2
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QC AUDITED RECORDS SECTION */}
      <section className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm text-foreground">Quality Check Records</h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {filteredRecords.length} of {rows.filter((r) => r.status !== "Assigned").length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search ref, receipt..."
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

            <div className="flex items-center rounded-md border bg-muted/40 p-0.5 text-xs">
              {(["all", "Stage 1 done", "Stage 2 done"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
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
                    <ChevronUp className="size-3.5" /> Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" /> Expand
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Records Table */}
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground border-b select-none">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">QC Batch / Time</th>
                  <th className="py-2.5 px-3 font-semibold">Source Receipt</th>
                  <th className="py-2.5 px-3 font-semibold min-w-[240px]">Products & Input KG</th>
                  <th className="py-2.5 px-3 font-semibold min-w-[180px]">Quality Output & Yield</th>
                  <th className="py-2.5 px-3 font-semibold">QC Graders</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 text-right font-semibold w-20">Actions</th>
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
                  const isExpanded = !!expandedRows[r.id];

                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={cn(
                          "transition-colors hover:bg-muted/15 cursor-pointer",
                          isExpanded && "bg-muted/10"
                        )}
                        onClick={() => toggleExpand(r.id)}
                      >
                        <td className="py-2.5 px-3 align-top">
                          <div className="font-mono text-xs font-bold text-primary">{r.id}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {String(r["startTime"] || "10:00 AM")} → {String(r["endTime"] || "Done")}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 align-top">
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground border">
                            <Package className="size-2.5 text-primary" />
                            {r["lot"]}
                          </span>
                          {r["warehouse"] && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                                <Building2 className="size-2.5" />
                                {String(r["warehouse"])}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 align-top">
                          <div className="space-y-1">
                            <div className="font-semibold text-foreground">
                              {rLines.length} {rLines.length === 1 ? "Line" : "Lines"} · {kg(totalIn)}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {rLines.map((l, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[11px]"
                                >
                                  <span className="font-medium text-foreground">{l.p}</span>
                                  {l.lineTag && <span className="text-[10px] text-primary font-bold">({l.lineTag})</span>}
                                  <span className="font-mono font-bold">{kg(l.q)}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {pctA}% Grade A
                              </span>
                              <span className="text-muted-foreground">{kg(gradeA)}</span>
                            </div>
                            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              {pctA > 0 && (
                                <div style={{ width: `${pctA}%` }} className="bg-emerald-500" />
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 align-top">
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {String(r["grader"] || "—")
                              .split(",")
                              .map((g) => g.trim())
                              .filter(Boolean)
                              .map((g) => (
                                <span
                                  key={g}
                                  className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                                >
                                  <UserCheck className="size-2.5" />
                                  {g}
                                </span>
                              ))}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 align-top">
                          <StatusBadge status={r.status} statuses={mod.statuses} />
                        </td>

                        <td className="py-2.5 px-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleExpand(r.id)}
                              className="size-7 text-muted-foreground"
                            >
                              {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const err = validateData({ ...data, "quality-check": rows.filter((x) => x.id !== r.id) });
                                if (err) return void toast.error(err);
                                remove("quality-check", r.id);
                                toast.success(`${r.id} deleted`);
                              }}
                              className="size-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Produce Line Details */}
                      {isExpanded && (
                        <tr className="bg-muted/20 border-t">
                          <td colSpan={7} className="p-3">
                            <div className="rounded-lg border bg-background p-3 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between text-xs border-b pb-2">
                                <span className="font-semibold text-foreground">Line Details for {r.id} (Receipt {r["lot"]})</span>
                                <span className="text-muted-foreground">Supervisor: <b className="text-foreground">{r["supervisor"] || "Ravi Kumar"}</b></span>
                              </div>

                              <table className="w-full text-xs">
                                <thead className="text-[10px] uppercase text-muted-foreground border-b">
                                  <tr>
                                    <th className="py-1 px-2 text-left">#</th>
                                    <th className="py-1 px-2 text-left">Produce Line</th>
                                    <th className="py-1 px-2 text-left">Assigned Employee(s)</th>
                                    <th className="py-1 px-2 text-right">Received</th>
                                    <th className="py-1 px-2 text-right">Grade A</th>
                                    <th className="py-1 px-2 text-right">Stage 2 Rejects</th>
                                    <th className="py-1 px-2 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                  {rLines.map((lineItem, lIdx) => {
                                    const lineGradeA = num(lineItem.a);
                                    const lineRemainder = Math.max(0, round(lineItem.q - lineGradeA));
                                    const itemGrader = (lineItem as QCLineItem).grader || r["grader"] || "—";
                                    const graders = itemGrader.split(",").map((s) => s.trim()).filter(Boolean);

                                    return (
                                      <tr key={lIdx}>
                                        <td className="py-1.5 px-2 text-muted-foreground font-mono">{lIdx + 1}</td>
                                        <td className="py-1.5 px-2 font-semibold">
                                          {lineItem.p}
                                          {lineItem.lineTag && <span className="ml-1 text-[10px] text-primary font-bold">({lineItem.lineTag})</span>}
                                        </td>
                                        <td className="py-1.5 px-2">
                                          <div className="flex flex-wrap gap-1">
                                            {graders.map((g) => (
                                              <span key={g} className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                                <UserCheck className="size-2.5" />
                                                {g}
                                              </span>
                                            ))}
                                          </div>
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-mono font-bold">{kg(lineItem.q)}</td>
                                        <td className="py-1.5 px-2 text-right font-mono text-emerald-600 font-semibold">{kg(lineGradeA)}</td>
                                        <td className="py-1.5 px-2 text-right font-mono text-amber-600 font-semibold">{kg(lineRemainder)}</td>
                                        <td className="py-1.5 px-2 text-center">
                                          {lineGradeA > 0 ? (
                                            <span className="rounded bg-emerald-500/10 text-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold">
                                              Grade A
                                            </span>
                                          ) : (
                                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                              Stage 2
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
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
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Boxes className="mx-auto size-6 text-muted-foreground/50 mb-1" />
              <p className="font-semibold text-foreground">No records match filter</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
