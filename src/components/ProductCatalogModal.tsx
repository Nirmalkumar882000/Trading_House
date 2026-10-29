import { useState, useMemo } from "react";
import {
  X,
  Plus,
  Search,
  Pencil,
  Trash2,
  Download,
  RotateCcw,
  BookOpen,
  Scale,
  Boxes,
  Tag,
  Sparkles,
  CheckCircle2,
  Package,
  Layers,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { type ProductItem, detectUnitType } from "@/lib/modules";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const STANDARD_CATEGORIES = [
  "Vegetables",
  "Greens",
  "Fruits",
  "Gourd / Squash",
  "Chillies & Spices",
  "Coconut",
  "Greens & Herbs",
  "Staples",
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Greens: { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/30" },
  Fruits: { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", border: "border-amber-500/30" },
  Vegetables: { bg: "bg-teal-500/15", text: "text-teal-700 dark:text-teal-300", border: "border-teal-500/30" },
  "Gourd / Squash": { bg: "bg-lime-500/15", text: "text-lime-700 dark:text-lime-300", border: "border-lime-500/30" },
  "Chillies & Spices": { bg: "bg-rose-500/15", text: "text-rose-700 dark:text-rose-300", border: "border-rose-500/30" },
  Coconut: { bg: "bg-amber-700/15", text: "text-amber-900 dark:text-amber-200", border: "border-amber-700/30" },
  "Greens & Herbs": { bg: "bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-500/30" },
  Staples: { bg: "bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-500/30" },
};

function getCategoryBadge(cat?: string) {
  const c = cat || "General";
  const styling = CATEGORY_COLORS[c] || {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border",
        styling.bg,
        styling.text,
        styling.border
      )}
    >
      <Tag className="size-2.5 opacity-70" />
      {c}
    </span>
  );
}

interface ProductCatalogModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  embedded?: boolean;
}

export function ProductCatalogModal({ isOpen = true, onClose, embedded = false }: ProductCatalogModalProps) {
  const { catalog, addCatalogItem, updateCatalogItem, deleteCatalogItem, resetCatalog } = useStore();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [unitType, setUnitType] = useState<"kg" | "piece" | "range">("kg");
  // kg state
  const [kgVal, setKgVal] = useState("250");
  const [kgUnit, setKgUnit] = useState<"g" | "kg">("g");
  // piece state
  const [pcCount, setPcCount] = useState("1");
  const [pcWeightKg, setPcWeightKg] = useState("0.5");
  // range state
  const [rangeMin, setRangeMin] = useState("450");
  const [rangeMax, setRangeMax] = useState("550");
  const [rangeUnit, setRangeUnit] = useState<"g" | "kg">("g");
  // calculated and editable outputs
  const [defaultPackSize, setDefaultPackSize] = useState("250 g");
  const [packSizeKg, setPackSizeKg] = useState("0.25");
  const [category, setCategory] = useState("Vegetables");
  const [customCategory, setCustomCategory] = useState("");

  // Open add form
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormName("");
    setUnitType("kg");
    setKgVal("250");
    setKgUnit("g");
    setDefaultPackSize("250 g");
    setPackSizeKg("0.25");
    setCategory("Vegetables");
    setCustomCategory("");
    setIsAddFormOpen(true);
  };

  // Open edit form
  const handleOpenEdit = (item: ProductItem) => {
    setEditingItem(item);
    setFormName(item.name);
    const detected = detectUnitType(item.defaultPackSize);
    setUnitType(detected);

    if (detected === "piece") {
      const match = item.defaultPackSize.match(/^(\d+)\s*pc/i);
      setPcCount(match ? match[1] : "1");
      setPcWeightKg(String(item.packSizeKg || 0.5));
    } else if (detected === "range") {
      const parts = item.defaultPackSize.split(/[-–]/).map((s) => s.trim());
      const minMatch = parts[0]?.match(/(\d+)/);
      const maxMatch = parts[1]?.match(/(\d+)/);
      const isKg = item.defaultPackSize.toLowerCase().includes("kg");
      setRangeMin(minMatch ? minMatch[1] : "450");
      setRangeMax(maxMatch ? maxMatch[1] : "550");
      setRangeUnit(isKg ? "kg" : "g");
    } else {
      const isKg = item.defaultPackSize.toLowerCase().includes("kg");
      const numMatch = item.defaultPackSize.match(/([\d.]+)/);
      setKgVal(numMatch ? numMatch[1] : "250");
      setKgUnit(isKg ? "kg" : "g");
    }

    setDefaultPackSize(item.defaultPackSize);
    setPackSizeKg(String(item.packSizeKg));
    if (item.category && STANDARD_CATEGORIES.includes(item.category)) {
      setCategory(item.category);
      setCustomCategory("");
    } else if (item.category) {
      setCategory("Other");
      setCustomCategory(item.category);
    } else {
      setCategory("Vegetables");
      setCustomCategory("");
    }

    setIsAddFormOpen(true);
  };

  // Recalculate derived defaultPackSize and packSizeKg whenever unit and values change
  const handleUnitOrValueChange = (
    nextUnitType: "kg" | "piece" | "range",
    params: {
      kgVal?: string;
      kgUnit?: "g" | "kg";
      pcCount?: string;
      pcWeightKg?: string;
      rangeMin?: string;
      rangeMax?: string;
      rangeUnit?: "g" | "kg";
    } = {}
  ) => {
    const uType = nextUnitType;
    const kv = params.kgVal !== undefined ? params.kgVal : kgVal;
    const ku = params.kgUnit !== undefined ? params.kgUnit : kgUnit;
    const pc = params.pcCount !== undefined ? params.pcCount : pcCount;
    const pw = params.pcWeightKg !== undefined ? params.pcWeightKg : pcWeightKg;
    const rMin = params.rangeMin !== undefined ? params.rangeMin : rangeMin;
    const rMax = params.rangeMax !== undefined ? params.rangeMax : rangeMax;
    const ru = params.rangeUnit !== undefined ? params.rangeUnit : rangeUnit;

    if (uType === "kg") {
      const numVal = parseFloat(kv) || 0;
      if (ku === "g") {
        setDefaultPackSize(`${kv || "0"} g`);
        setPackSizeKg(String(Math.round((numVal / 1000) * 1000) / 1000));
      } else {
        setDefaultPackSize(`${kv || "0"} kg`);
        setPackSizeKg(String(numVal));
      }
    } else if (uType === "piece") {
      const count = parseInt(pc) || 1;
      const wt = parseFloat(pw) || 0.5;
      setDefaultPackSize(count === 1 ? "1 pc" : `${count} pcs`);
      setPackSizeKg(String(wt));
    } else if (uType === "range") {
      const minN = parseFloat(rMin) || 0;
      const maxN = parseFloat(rMax) || 0;
      setDefaultPackSize(`${rMin} ${ru} - ${rMax} ${ru}`);
      const avg = (minN + maxN) / 2;
      const avgKg = ru === "g" ? avg / 1000 : avg;
      setPackSizeKg(String(Math.round(avgKg * 1000) / 1000));
    }
  };

  // Save product
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) {
      toast.error("Please enter a valid product name.");
      return;
    }

    const finalCategory = category === "Other" ? customCategory.trim() || "General" : category;
    const parsedKg = parseFloat(packSizeKg);

    if (isNaN(parsedKg) || parsedKg <= 0) {
      toast.error("Pack size in KG must be a positive number.");
      return;
    }

    const newItem: ProductItem = {
      name: trimmedName,
      defaultPackSize: defaultPackSize.trim() || `${parsedKg} kg`,
      packSizeKg: Math.round(parsedKg * 1000) / 1000,
      category: finalCategory,
    };

    if (editingItem) {
      updateCatalogItem(editingItem.name, newItem);
      toast.success(`Updated "${newItem.name}" in Product Catalog`);
    } else {
      addCatalogItem(newItem);
      toast.success(`Added "${newItem.name}" to Product Catalog (${newItem.defaultPackSize})`);
    }

    setIsAddFormOpen(false);
    setEditingItem(null);
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ["Product Name", "Category", "Default Pack Size", "Pack Size (KG)", "Unit Type"];
    const rows = catalog.map((item) => [
      `"${item.name.replace(/"/g, '""')}"`,
      `"${(item.category || "General").replace(/"/g, '""')}"`,
      `"${item.defaultPackSize.replace(/"/g, '""')}"`,
      item.packSizeKg,
      detectUnitType(item.defaultPackSize),
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Product_Catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Product Catalog exported to CSV");
  };

  // Categories list derived from catalog
  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ["All", ...Array.from(set)];
  }, [catalog]);

  // Filtered catalog items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((item) => {
      const matchCat = selectedCategory === "All" || item.category === selectedCategory;
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        item.defaultPackSize.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [catalog, search, selectedCategory]);

  // Statistics
  const stats = useMemo(() => {
    let weightCount = 0;
    let pieceCount = 0;
    let rangeCount = 0;
    catalog.forEach((i) => {
      const t = detectUnitType(i.defaultPackSize);
      if (t === "kg") weightCount++;
      else if (t === "piece") pieceCount++;
      else if (t === "range") rangeCount++;
    });
    return {
      total: catalog.length,
      categoriesCount: categories.length - 1,
      weightCount,
      pieceCount,
      rangeCount,
    };
  }, [catalog, categories]);

  if (!isOpen && !embedded) return null;

  const content = (
    <div className="space-y-6">
      {/* Top Header & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">
                Master Product Catalog
              </h2>
              <p className="text-xs text-muted-foreground">
                Commodity pack size specifications (kg / piece / range) & categories for Buyer Purchase Orders
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Download className="size-3.5" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Reset catalog to the default 36 standard commodities? Custom changes will be restored.")) {
                resetCatalog();
                toast.success("Product Catalog restored to standard defaults.");
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <RotateCcw className="size-3.5" /> Reset Defaults
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <Plus className="size-4" /> Add Product
          </Button>
          {!embedded && onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Quick Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <div className="rounded-xl border bg-card p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Boxes className="size-3 text-primary" /> Total Products
          </span>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{stats.total}</p>
          <span className="text-[10px] text-muted-foreground">Master commodities</span>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Tag className="size-3 text-emerald-600" /> Categories
          </span>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.categoriesCount}
          </p>
          <span className="text-[10px] text-muted-foreground">Distinct groups</span>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Scale className="size-3 text-blue-600" /> KG / Weight Items
          </span>
          <p className="mt-1 font-display text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.weightCount}
          </p>
          <span className="text-[10px] text-muted-foreground">Fixed gram/kg packs</span>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Package className="size-3 text-amber-600" /> Piece Count Items
          </span>
          <p className="mt-1 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.pieceCount}
          </p>
          <span className="text-[10px] text-muted-foreground">1 pc / 2 pcs / 3 pcs</span>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Layers className="size-3 text-purple-600" /> Range Items
          </span>
          <p className="mt-1 font-display text-2xl font-bold text-purple-600 dark:text-purple-400">
            {stats.rangeCount}
          </p>
          <span className="text-[10px] text-muted-foreground">e.g. 450 g - 550 g</span>
        </div>
      </div>

      {/* Add / Edit Product Slide-over / Modal Form */}
      {isAddFormOpen && (
        <form
          onSubmit={handleSaveProduct}
          className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in-50 zoom-in-98"
        >
          <div className="flex items-center justify-between border-b border-primary/20 pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary p-1 text-primary-foreground">
                {editingItem ? <Pencil className="size-4" /> : <Plus className="size-4" />}
              </div>
              <h3 className="text-base font-bold text-foreground">
                {editingItem ? `Edit Product: ${editingItem.name}` : "Add New Product to Catalog"}
              </h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddFormOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Field 1: Name */}
            <div className="md:col-span-6 space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                Product Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Amaranth Green Leaves (Arai Keerai), Apple, Capsicum"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-[11px] text-muted-foreground">
                Enter clean commodity name (and local/Tamil name in brackets if applicable).
              </p>
            </div>

            {/* Field 2: Unit Type Dropdown (kg | piece | range) */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                Measurement Type <span className="text-destructive">*</span>
              </label>
              <select
                value={unitType}
                onChange={(e) => {
                  const val = e.target.value as "kg" | "piece" | "range";
                  setUnitType(val);
                  handleUnitOrValueChange(val);
                }}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="kg">⚖️ Weight (kg / g)</option>
                <option value="piece">📦 Piece count (pc / pcs)</option>
                <option value="range">📏 Weight Range (min - max)</option>
              </select>
              <p className="text-[11px] text-muted-foreground">Select unit format: kg, piece, or range.</p>
            </div>

            {/* Field 3: Category */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                Category <span className="text-destructive">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
              >
                {STANDARD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="Other">+ Custom Category...</option>
              </select>
              {category === "Other" && (
                <input
                  type="text"
                  placeholder="Type custom category name..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            </div>
          </div>

          {/* Dynamic Values Entry Section based on Unit Dropdown */}
          <div className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {unitType === "kg" && "1. Weight Specification Input"}
              {unitType === "piece" && "1. Piece Count & Piece Weight Input"}
              {unitType === "range" && "1. Range Specification Input (Min - Max)"}
            </h4>

            {unitType === "kg" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Enter Weight Value</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={kgVal}
                      onChange={(e) => {
                        setKgVal(e.target.value);
                        handleUnitOrValueChange("kg", { kgVal: e.target.value });
                      }}
                      placeholder="e.g. 250 or 1"
                      className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="flex rounded-lg border bg-muted p-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setKgUnit("g");
                          handleUnitOrValueChange("kg", { kgUnit: "g" });
                        }}
                        className={cn(
                          "px-3 py-1 text-xs font-semibold rounded-md",
                          kgUnit === "g" ? "bg-card shadow-xs text-foreground" : "text-muted-foreground"
                        )}
                      >
                        g
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setKgUnit("kg");
                          handleUnitOrValueChange("kg", { kgUnit: "kg" });
                        }}
                        className={cn(
                          "px-3 py-1 text-xs font-semibold rounded-md",
                          kgUnit === "kg" ? "bg-card shadow-xs text-foreground" : "text-muted-foreground"
                        )}
                      >
                        kg
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                  Quick examples: <strong>250 g</strong> (0.25 kg), <strong>500 g</strong> (0.5 kg),{" "}
                  <strong>1 kg</strong> (1.0 kg).
                </div>
              </div>
            )}

            {unitType === "piece" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Number of Pieces (pc / pcs)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={pcCount}
                    onChange={(e) => {
                      setPcCount(e.target.value);
                      handleUnitOrValueChange("piece", { pcCount: e.target.value });
                    }}
                    placeholder="e.g. 1, 2, 3"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Total Pack Weight in KG</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={pcWeightKg}
                    onChange={(e) => {
                      setPcWeightKg(e.target.value);
                      handleUnitOrValueChange("piece", { pcWeightKg: e.target.value });
                    }}
                    placeholder="e.g. 0.35, 0.7, 1.0, 1.5"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            )}

            {unitType === "range" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Min Range</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={rangeMin}
                    onChange={(e) => {
                      setRangeMin(e.target.value);
                      handleUnitOrValueChange("range", { rangeMin: e.target.value });
                    }}
                    placeholder="e.g. 450"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Max Range</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={rangeMax}
                    onChange={(e) => {
                      setRangeMax(e.target.value);
                      handleUnitOrValueChange("range", { rangeMax: e.target.value });
                    }}
                    placeholder="e.g. 550"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Range Unit</label>
                  <div className="flex rounded-lg border bg-muted p-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRangeUnit("g");
                        handleUnitOrValueChange("range", { rangeUnit: "g" });
                      }}
                      className={cn(
                        "flex-1 py-1.5 text-xs font-semibold rounded-md",
                        rangeUnit === "g" ? "bg-card shadow-xs text-foreground" : "text-muted-foreground"
                      )}
                    >
                      Grams (g)
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRangeUnit("kg");
                        handleUnitOrValueChange("range", { rangeUnit: "kg" });
                      }}
                      className={cn(
                        "flex-1 py-1.5 text-xs font-semibold rounded-md",
                        rangeUnit === "kg" ? "bg-card shadow-xs text-foreground" : "text-muted-foreground"
                      )}
                    >
                      Kilograms (kg)
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Auto-Calculated Default Pack Size & Pack Size KG */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border bg-background p-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Default Pack Size Label</span>
                <span className="text-[10px] text-primary font-normal">Auto-generated · Editable</span>
              </label>
              <input
                type="text"
                required
                value={defaultPackSize}
                onChange={(e) => setDefaultPackSize(e.target.value)}
                placeholder='e.g. "250 g", "1 pc", "450 g - 550 g"'
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-[10px] text-muted-foreground">
                Label shown in Buyer PO dropdowns, labels, and receipts.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Pack Size in KG (Weight)</span>
                <span className="text-[10px] text-primary font-normal">Auto-calculated · Editable</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  value={packSizeKg}
                  onChange={(e) => setPackSizeKg(e.target.value)}
                  placeholder="e.g. 0.25, 0.5, 1.0"
                  className="w-full rounded-lg border bg-card px-3 py-2 pr-10 text-sm font-bold font-mono text-primary outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-muted-foreground">KG</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Used to compute packet counts and truck gross tonnage.
              </p>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddFormOpen(false);
                setEditingItem(null);
              }}
              className="rounded-lg text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-card hover:opacity-90"
            >
              <CheckCircle2 className="size-4" />
              {editingItem ? "Save Changes" : "Save to Product Catalog"}
            </Button>
          </div>
        </form>
      )}

      {/* Search & Category Filter Navigation */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products by name, pack size, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const count = cat === "All" ? catalog.length : catalog.filter((i) => i.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <Button
                key={cat}
                type="button"
                variant="ghost"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "h-auto rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                )}
              >
                {cat} <span className="ml-1 opacity-70 text-[10px]">({count})</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Product Catalog Items Table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-xs text-xs font-bold uppercase tracking-wider text-muted-foreground border-b z-10">
              <tr>
                <th className="px-4 py-3 w-12 text-center">#</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Unit Type</th>
                <th className="px-4 py-3">Default Pack Size</th>
                <th className="px-4 py-3 text-right">Pack Size (KG)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredItems.map((item, idx) => {
                const uType = detectUnitType(item.defaultPackSize);
                return (
                  <tr
                    key={item.name}
                    className="hover:bg-primary-soft/40 transition-colors group cursor-pointer"
                    onClick={() => handleOpenEdit(item)}
                  >
                    <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getCategoryBadge(item.category)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {uType === "kg" && "⚖️ Weight (kg/g)"}
                        {uType === "piece" && "📦 Piece (pc)"}
                        {uType === "range" && "📏 Range"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                        {item.defaultPackSize}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums text-foreground">
                      {item.packSizeKg.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}{" "}
                      <span className="text-muted-foreground font-normal">kg</span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit product"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 w-8 rounded-md text-primary hover:bg-primary-soft"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete product"
                          onClick={() => {
                            if (confirm(`Remove "${item.name}" from the product catalog?`)) {
                              deleteCatalogItem(item.name);
                              toast.success(`Removed "${item.name}" from catalog`);
                            }
                          }}
                          className="h-8 w-8 rounded-md text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filteredItems.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <p className="font-medium text-foreground">No products match your search or filter.</p>
                    <p className="mt-1 text-xs">Try clearing filters or click "+ Add Product" to create one.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            Showing <strong>{filteredItems.length}</strong> of <strong>{catalog.length}</strong> catalog items
          </span>
          <span className="text-[11px]">Click any product row to edit its specification</span>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="max-w-7xl mx-auto p-4 sm:p-6">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-foreground/30 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl bg-card p-5 sm:p-7 shadow-2xl border animate-in zoom-in-95">
        {content}
      </div>
    </div>
  );
}
