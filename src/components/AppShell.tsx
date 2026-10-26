import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, type ReactNode } from "react";
import {
  Anchor, Search, SlidersHorizontal, LayoutGrid, ClipboardList, ShoppingBasket,
  Package, ScanSearch, Boxes, Truck, Wallet, Warehouse, Store, Users, UserCog,
  Building2, BarChart3, Route, Tags, Container, ArrowRightLeft, StickyNote,
  Receipt, ClipboardCheck, Undo2, FileText, BadgeIndianRupee, CalendarCheck,
  History, Workflow, ShieldAlert, X, Menu, Trash2, RotateCcw,
  ChevronRight, ChevronLeft, ArrowRight, ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { MODULES } from "@/lib/modules";
import { useStore } from "@/lib/store";
import { canViewPrice, isModuleAllowedForRole, ROLES } from "@/lib/rbac";
import { num, round, lines, normalize, syncReceiptDownstream } from "@/lib/workflow";
import { RoleSwitcher } from "./RoleSwitcher";
import { BluetoothScaleModal } from "./BluetoothScaleModal";
import { GoodsReceiptVoucherModal } from "./GoodsReceiptVoucherModal";
import { QrStickerModal } from "./QrStickerModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface RailGroup {
  id: string;
  letter: string;
  headerLabel: string;
  tooltip: string;
  icon: LucideIcon;
  modules: {
    slug: string;
    title: string;
    icon: LucideIcon;
    isDashboard?: boolean;
  }[];
}

const RAIL_GROUPS: RailGroup[] = [
  {
    id: "setup",
    letter: "A",
    headerLabel: "A · SETUP",
    tooltip: "Setup & Masters",
    icon: SlidersHorizontal,
    modules: [
      { slug: "", title: "Dashboard & reports", icon: LayoutGrid, isDashboard: true },
      { slug: "suppliers", title: "Suppliers", icon: Store },
      { slug: "buyers", title: "Buyers", icon: Users },
      { slug: "employees", title: "Employees & access", icon: UserCog },
      { slug: "transporters", title: "Transporters", icon: Truck },
      { slug: "business-profile", title: "Business Profile & KYC", icon: Building2 },
    ],
  },
  {
    id: "demand",
    letter: "B",
    headerLabel: "B · BUYER DEMAND",
    tooltip: "Buyer Demand",
    icon: ClipboardList,
    modules: [
      { slug: "purchase-orders", title: "Buyer - Purchase Order", icon: ClipboardList },
      { slug: "demand-plan", title: "Demand Consolidation Plan", icon: BarChart3 },
    ],
  },
  {
    id: "sourcing",
    letter: "C",
    headerLabel: "C · SOURCING & PURCHASE",
    tooltip: "Sourcing & Purchase",
    icon: ShoppingBasket,
    modules: [
      { slug: "trips", title: "Mandi Trips & Purchase", icon: Route },
      { slug: "supplier-prices", title: "Supplier Price Board", icon: Tags },
    ],
  },
  {
    id: "inward",
    letter: "D",
    headerLabel: "D · INWARD & LOGISTICS",
    tooltip: "Inward & Logistics",
    icon: Package,
    modules: [
      { slug: "receipts", title: "Warehouse Receipts (GRN)", icon: Warehouse },
      { slug: "containers", title: "Crates & Containers", icon: Container },
      { slug: "transport", title: "Transport Tracking", icon: ArrowRightLeft },
    ],
  },
  {
    id: "qc",
    letter: "E",
    headerLabel: "E · QUALITY CHECK",
    tooltip: "Two-Stage Quality Check",
    icon: ScanSearch,
    modules: [
      { slug: "quality-check", title: "Two-Stage Quality Check", icon: ScanSearch },
    ],
  },
  {
    id: "packing",
    letter: "F",
    headerLabel: "F · ALLOCATION & PACKING",
    tooltip: "Allocation & Packing",
    icon: Boxes,
    modules: [
      { slug: "packing", title: "Allocation & Packing", icon: Boxes },
      { slug: "catalogue", title: "Daily Sales Catalogue", icon: StickyNote },
    ],
  },
  {
    id: "sales",
    letter: "G",
    headerLabel: "G · SALES & DELIVERY",
    tooltip: "Sales & Delivery",
    icon: Truck,
    modules: [
      { slug: "sales-orders", title: "Sales Orders", icon: Receipt },
      { slug: "dispatch", title: "Outward Dispatch & Load", icon: Truck },
      { slug: "deliveries", title: "Buyer Deliveries & POD", icon: ClipboardCheck },
      { slug: "returns", title: "Returns & Quarantine", icon: Undo2 },
    ],
  },
  {
    id: "billing",
    letter: "H",
    headerLabel: "H · BILLING & LEDGERS",
    tooltip: "Billing & Ledgers",
    icon: Wallet,
    modules: [
      { slug: "invoices", title: "Sales Invoices", icon: FileText },
      { slug: "buyer-payments", title: "Buyer Receipts / Payments", icon: BadgeIndianRupee },
      { slug: "supplier-payments", title: "Supplier Settlements", icon: Wallet },
      { slug: "credit-notes", title: "Credit Notes & Adjustments", icon: FileText },
      { slug: "financial-ledgers", title: "Party Ledgers (AP / AR)", icon: Wallet },
      { slug: "attendance", title: "Staff Attendance & Payroll", icon: CalendarCheck },
      { slug: "expenses", title: "Overheads & Expenses", icon: BadgeIndianRupee },
    ],
  },
  {
    id: "inventory",
    letter: "I",
    headerLabel: "I · INVENTORY & AUDIT",
    tooltip: "Inventory & Reports",
    icon: Warehouse,
    modules: [
      { slug: "inventory", title: "Stock & Location Balances", icon: Warehouse },
      { slug: "stock-movements", title: "Stock Movement Audit", icon: History },
      { slug: "workflow-reports", title: "Workflow Reports Suite", icon: BarChart3 },
      { slug: "flow-map", title: "Process Flow Map (F01–F28)", icon: Workflow },
      { slug: "open-points", title: "Decisions Register (C01–C14)", icon: ShieldAlert },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { role, setRole, data, upsert, clearAllData, seedDemoData, reset } = useStore();
  const [query, setQuery] = useState("");
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [headerReceiptId, setHeaderReceiptId] = useState<string | null>(null);
  const [headerVoucherRow, setHeaderVoucherRow] = useState<any | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Filter rail groups and modules by active role permissions
  const roleFilteredRailGroups = useMemo(() => {
    if (role === "Admin" || role === "Trading House Owner") {
      return RAIL_GROUPS;
    }
    const allowedSlugs = ROLES[role]?.primaryModules ?? [];
    return RAIL_GROUPS.map((grp) => {
      const allowedModules = grp.modules.filter(
        (m) => m.isDashboard || allowedSlugs.includes(m.slug)
      );
      return {
        ...grp,
        modules: allowedModules,
      };
    }).filter((grp) => grp.modules.length > 0);
  }, [role]);

  // Current active module slug
  const activeModuleSlug = path.startsWith("/m/") ? path.replace("/m/", "") : (path === "/" ? "" : null);

  // Check if current module is allowed for active persona
  const isCurrentModuleAllowed = useMemo(() => {
    if (!activeModuleSlug) return true; // "/" is always allowed
    return isModuleAllowedForRole(activeModuleSlug, role);
  }, [activeModuleSlug, role]);

  const matchedGroup = useMemo(() => {
    return roleFilteredRailGroups.find((g) =>
      g.modules.some((m) => (m.isDashboard && path === "/") || (!m.isDashboard && m.slug === activeModuleSlug))
    );
  }, [path, activeModuleSlug, roleFilteredRailGroups]);

  const [selectedGroupId, setSelectedGroupId] = useState<string>("setup");

  // Keep selected group synchronized with URL navigation and active role
  useEffect(() => {
    if (matchedGroup && roleFilteredRailGroups.some((g) => g.id === matchedGroup.id)) {
      setSelectedGroupId(matchedGroup.id);
    } else if (roleFilteredRailGroups.length > 0 && !roleFilteredRailGroups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(roleFilteredRailGroups[0].id);
    }
  }, [path, role, matchedGroup]);

  const currentRailGroup = roleFilteredRailGroups.find((g) => g.id === selectedGroupId) || roleFilteredRailGroups[0] || RAIL_GROUPS[0];
  const currentGroupIndex = roleFilteredRailGroups.findIndex((g) => g.id === currentRailGroup.id);
  const prevGroup = currentGroupIndex > 0 ? roleFilteredRailGroups[currentGroupIndex - 1] : null;
  const nextGroup = currentGroupIndex >= 0 && currentGroupIndex < roleFilteredRailGroups.length - 1
    ? roleFilteredRailGroups[currentGroupIndex + 1]
    : null;

  const handleSelectGroup = (group: RailGroup) => {
    setSelectedGroupId(group.id);
    const isCurrentInGroup = group.modules.some(
      (m) => (m.isDashboard && path === "/") || (!m.isDashboard && m.slug === activeModuleSlug)
    );
    if (!isCurrentInGroup) {
      const target = group.modules[0];
      if (target) {
        navigate({
          to: target.isDashboard ? "/" : "/m/$module",
          params: target.isDashboard ? undefined : { module: target.slug },
        });
      }
    }
    setOpen(false);
  };

  const q = query.trim().toLowerCase();

  // Search across role-allowed modules only
  const allModules = useMemo(() => {
    const list: { slug: string; title: string; icon: LucideIcon; isDashboard?: boolean; groupLabel: string }[] = [];
    roleFilteredRailGroups.forEach((g) => {
      g.modules.forEach((m) => {
        if (!list.some((existing) => existing.slug === m.slug && existing.isDashboard === m.isDashboard)) {
          list.push({ ...m, groupLabel: g.headerLabel });
        }
      });
    });
    return list;
  }, [roleFilteredRailGroups]);

  const searchResults = useMemo(() => {
    if (!q) return [];
    return allModules.filter(
      (m) => m.title.toLowerCase().includes(q) || m.slug.toLowerCase().includes(q)
    );
  }, [allModules, q]);

  const activeModuleDef = MODULES.find((m) => path === `/m/${m.slug}`);

  const sidebarContent = (
    <div className="flex h-full w-full select-none">
      {/* 1. Left Rail (Slim dark icon navigation) */}
      <div className="flex w-[72px] shrink-0 flex-col items-center border-r border-[#083035] bg-[#02181b] py-3 text-slate-300">
        {/* Anchor Avatar Logo at Top */}
        <Link
          to="/"
          onClick={() => {
            setSelectedGroupId(roleFilteredRailGroups[0]?.id || "setup");
            setOpen(false);
          }}
          title="Velaan Bay Portal"
          className="group relative mb-4 flex size-11 items-center justify-center rounded-full bg-[#f59e0b] text-[#062427] shadow-lg transition-transform hover:scale-105"
        >
          <Anchor className="size-6 stroke-[2.5]" />
        </Link>

        {/* Rail Icons (Role Filtered) */}
        <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto px-1 py-1 scrollbar-none w-full">
          {roleFilteredRailGroups.map((grp) => {
            const Icon = grp.icon;
            const isSelected = selectedGroupId === grp.id;
            return (
              <div key={grp.id} className="relative flex w-full items-center justify-center">
                {/* Active indicator tab on far left edge */}
                {isSelected && (
                  <div className="absolute left-0 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-r-full bg-[#f59e0b]" />
                )}
                <button
                  type="button"
                  title={grp.tooltip}
                  onClick={() => {
                    handleSelectGroup(grp);
                  }}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-2xl transition-all cursor-pointer",
                    isSelected
                      ? "bg-[#f59e0b] text-slate-950 shadow-md font-bold"
                      : "text-[#3f7b82] hover:bg-[#06282d] hover:text-white"
                  )}
                >
                  <Icon className={cn("size-5", isSelected ? "stroke-[2.5]" : "stroke-[1.8]")} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Right Submenu Panel (Dark Forest Teal) */}
      <div className="flex w-[260px] shrink-0 flex-col bg-[#042024] px-4 py-4 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[17px] font-bold leading-tight tracking-tight text-white">
              Velaan Bay
            </h1>
            <p className="text-[11px] font-normal text-[#4dd0c0]/80">
              Agent Portal · Trading House
            </p>
          </div>
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-[#3f7b82] hover:bg-[#08353b] hover:text-white lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-[#3f7b82]" />
          <input
            aria-label="Search modules"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules..."
            className="w-full rounded-xl border border-[#0d444b] bg-[#083238] py-2 pl-8 pr-7 text-xs text-white placeholder:text-[#4d868e] outline-none transition-all focus:border-[#f59e0b]/70"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-2.5 text-xs text-[#3f7b82] hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Module Links */}
        <div className="flex-1 overflow-y-auto pt-4 space-y-2 scrollbar-thin">
          {q ? (
            /* Search Results */
            <div className="space-y-1">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-[#f59e0b]">
                Search Results ({searchResults.length})
              </p>
              {searchResults.map((m) => {
                const Icon = m.icon;
                const active = m.isDashboard ? path === "/" : path === `/m/${m.slug}`;
                return (
                  <Link
                    key={m.slug || "dash"}
                    to={m.isDashboard ? "/" : "/m/$module"}
                    params={m.isDashboard ? undefined : { module: m.slug }}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-xs transition-all",
                      active
                        ? "bg-[#f59e0b] font-bold text-slate-950 shadow-sm"
                        : "text-slate-200 hover:bg-[#072f34] hover:text-white"
                    )}
                  >
                    {active ? (
                      <Icon className="size-4 shrink-0 text-slate-950" />
                    ) : (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#08353b] text-[#2dd4bf]">
                        <Icon className="size-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block font-medium text-[13px] leading-snug">{m.title}</span>
                      <span className="text-[10px] text-muted-foreground">{m.groupLabel}</span>
                    </div>
                  </Link>
                );
              })}
              {searchResults.length === 0 && (
                <p className="py-6 text-center text-xs text-[#3f7b82]">
                  No modules found matching "{query}"
                </p>
              )}
            </div>
          ) : (
            /* Selected Category Content */
            <div className="flex flex-col justify-between min-h-full pb-2">
              <div>
                {/* Category Label with Stage progress indicator */}
                <div className="flex items-center justify-between px-1 pb-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#f59e0b]">
                    {currentRailGroup.headerLabel}
                  </p>
                  <span className="text-[10px] font-medium text-[#4dd0c0]/70">
                    Stage {currentGroupIndex + 1}/{roleFilteredRailGroups.length}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {currentRailGroup.modules.map((m) => {
                    const Icon = m.icon;
                    const active = m.isDashboard ? path === "/" : path === `/m/${m.slug}`;
                    return (
                      <Link
                        key={m.slug || "dash"}
                        to={m.isDashboard ? "/" : "/m/$module"}
                        params={m.isDashboard ? undefined : { module: m.slug }}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "group flex items-center transition-all",
                          active
                            ? "gap-3 rounded-2xl bg-[#f59e0b] px-3.5 py-2.5 text-slate-950 shadow-sm"
                            : "gap-3 rounded-xl px-2 py-2 text-slate-200 hover:bg-[#072f34] hover:text-white"
                        )}
                      >
                        {active ? (
                          <Icon className="size-4.5 shrink-0 text-slate-950 stroke-[2.2]" />
                        ) : (
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#08353b] text-[#2dd4bf] group-hover:bg-[#0a3f46] group-hover:text-[#5eead4] transition-colors">
                            <Icon className="size-4" />
                          </div>
                        )}
                        <span
                          className={cn(
                            "leading-snug text-[13px]",
                            active ? "font-bold text-slate-950" : "font-medium"
                          )}
                        >
                          {m.title}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Next Process Stage Action */}
              {nextGroup ? (
                <div className="mt-5 pt-3 border-t border-[#083035]">
                  <p className="px-1 text-[10px] font-semibold tracking-wider uppercase text-[#4dd0c0]/70 mb-2">
                    Next Workflow Stage
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectGroup(nextGroup)}
                    className="flex w-full items-center justify-between rounded-xl bg-[#083238] hover:bg-[#0c4952] border border-[#0d444b] p-2.5 text-xs text-white transition-all group shadow-sm text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#f59e0b] text-[11px] font-black text-slate-950">
                        {nextGroup.letter}
                      </span>
                      <div className="truncate">
                        <span className="block text-[11px] font-semibold text-white truncate leading-tight">{nextGroup.headerLabel}</span>
                        <span className="block text-[10px] text-[#4dd0c0]/80 truncate leading-tight">{nextGroup.tooltip}</span>
                      </div>
                    </div>
                    <ArrowRight className="size-3.5 shrink-0 text-[#f59e0b] group-hover:translate-x-0.5 transition-transform ml-1" />
                  </button>
                </div>
              ) : (
                <div className="mt-5 pt-3 border-t border-[#083035]">
                  <button
                    type="button"
                    onClick={() => roleFilteredRailGroups[0] && handleSelectGroup(roleFilteredRailGroups[0])}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#08353b]/60 hover:bg-[#08353b] border border-[#0d444b] p-2 text-[11px] font-medium text-[#4dd0c0] transition-all cursor-pointer"
                  >
                    <RotateCcw className="size-3 text-[#f59e0b]" /> Restart Flow (Stage A)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom User / Portal Control */}
        <div className="border-t border-[#083035] pt-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <div className="grid size-6 shrink-0 place-items-center rounded-full bg-[#f59e0b]/20 text-[10px] font-bold text-[#f59e0b]">
                RK
              </div>
              <div className="truncate">
                <p className="text-[11px] font-semibold leading-tight text-white truncate">Ravi Kumar</p>
                <p className="text-[10px] text-[#4dd0c0]/70 leading-tight truncate">Role: {role}</p>
              </div>
            </div>
            <button
              type="button"
              title="Reset / Clear portal dummy data"
              onClick={() => {
                if (confirm("Clear all dummy and portal data to empty state? Ready for real operational entry.")) {
                  clearAllData();
                  toast.success("Portal wiped clean. 0 dummy records. Ready for real-time entries.");
                }
              }}
              className="flex items-center gap-1 shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="size-3" /> Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Dual-Rail Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[332px] shrink-0 border-r border-[#083035] bg-[#02181b] lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[332px] bg-[#02181b] shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <div className="flex items-center gap-2">
              {currentRailGroup && (
                <span className="hidden sm:inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {currentRailGroup.headerLabel}
                </span>
              )}
              <span className="font-semibold text-foreground text-sm">
                {activeModuleDef?.title ?? (path === "/" ? "Operations Dashboard" : "Velaan Bay Portal")}
              </span>
            </div>

            {/* Quick Sequential Process Stage Navigator */}
            <div className="hidden md:flex items-center gap-1.5 ml-2 border-l pl-3 border-border/60">
              {prevGroup && (
                <button
                  type="button"
                  title={`Go back to previous stage: ${prevGroup.headerLabel}`}
                  onClick={() => handleSelectGroup(prevGroup)}
                  className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all shadow-xs cursor-pointer"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>{prevGroup.letter} · Prev</span>
                </button>
              )}

              {nextGroup ? (
                <button
                  type="button"
                  title={`Advance to next stage: ${nextGroup.headerLabel}`}
                  onClick={() => handleSelectGroup(nextGroup)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#f59e0b]/15 hover:bg-[#f59e0b]/25 border border-[#f59e0b]/40 px-2.5 py-1 text-[11px] font-bold text-[#b45309] dark:text-[#f59e0b] transition-all shadow-xs group cursor-pointer"
                >
                  <span>Next: {nextGroup.headerLabel}</span>
                  <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ) : (
                <button
                  type="button"
                  title="Loop back to start of process (Stage A)"
                  onClick={() => roleFilteredRailGroups[0] && handleSelectGroup(roleFilteredRailGroups[0])}
                  className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all shadow-xs cursor-pointer"
                >
                  <RotateCcw className="size-3 text-[#f59e0b]" />
                  <span>Restart (Stage A)</span>
                </button>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            {/* RBAC Role Selector */}
            <RoleSwitcher />

            {/* User Profile / Portal Data Management Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Profile and options"
                className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
              >
                RK
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-semibold text-sm">Ravi Kumar</p>
                  <p className="text-xs text-muted-foreground font-normal">Trading Operations Lead</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/m/$module" params={{ module: "business-profile" }}>
                    <Building2 className="mr-2 size-4" /> Business Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/m/$module" params={{ module: "workflow-reports" }}>
                    <BarChart3 className="mr-2 size-4" /> Operational Reports
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (confirm("Remove all dummy data from the portal? This ensures clean tables ready for real-time operation.")) {
                      clearAllData();
                      toast.success("All dummy data removed. Ready for live transactions!");
                    }
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" /> Remove All Dummy Data
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    seedDemoData();
                    toast.success("Loaded sample demo datasets for walkthrough");
                  }}
                >
                  <RotateCcw className="mr-2 size-4" /> Load Sample Demo Data
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Role Restriction Banner if Price Access is restricted */}
        {!canViewPrice(role) && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-800 dark:text-amber-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldAlert className="size-3.5 shrink-0" />
              Role Confidentiality Notice: Active persona <strong>{role}</strong>. Purchase rates, ledger balances, and financial values are masked under F01 / F05 controls.
            </span>
            <span
              className="text-[11px] underline cursor-pointer"
              onClick={() => toast.info("To view financial data, switch role to Admin, Owner, Pricing Officer or Accounts Staff in the header.")}
            >
              Learn more
            </span>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-8">
          {!isCurrentModuleAllowed ? (
            <div className="mx-auto max-w-xl py-12 text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="rounded-2xl border border-amber-500/30 bg-card p-8 shadow-md space-y-4">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <ShieldAlert className="size-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Workspace Access Restricted</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    Active Persona: <strong className="text-foreground">{ROLES[role]?.label || role}</strong>.
                    <br />
                    The module <strong>{activeModuleDef?.title || activeModuleSlug}</strong> is restricted under F01 / F05 role segregation controls.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Button
                    onClick={() => {
                      const firstAllowed = ROLES[role]?.primaryModules[0];
                      if (firstAllowed) {
                        navigate({ to: "/m/$module", params: { module: firstAllowed } });
                      } else {
                        navigate({ to: "/" });
                      }
                    }}
                    className="font-semibold"
                  >
                    Go to {ROLES[role]?.label} Workspace
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRole("Admin");
                      toast.success("Switched to Administrator with full access.");
                    }}
                  >
                    Switch to Administrator View
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Global Bluetooth Hardware Modals */}
      {(() => {
        const allReceipts = data["receipts"] ?? [];
        const targetReceipt = (headerReceiptId ? allReceipts.find((x) => x.id === headerReceiptId) : null) || allReceipts[0];
        const sentWeight = targetReceipt ? num(targetReceipt["sent"]) : 320;
        const productName = targetReceipt ? lines(targetReceipt).map((l) => l.p).join(", ") : "Tomato";
        const sourceDc = targetReceipt ? String(targetReceipt["dc"] || targetReceipt.id) : "TRP-1001";
        return (
          <>
            <BluetoothScaleModal
              isOpen={showScaleModal}
              onClose={() => setShowScaleModal(false)}
              sentWeight={sentWeight}
              productName={productName}
              sourceDc={sourceDc}
              receipts={allReceipts}
              activeReceiptId={targetReceipt?.id}
              onSelectReceipt={(id) => setHeaderReceiptId(id)}
              itemJson={targetReceipt ? String(targetReceipt["item"] || "") : ""}
              onApplyWeight={(wt, rsn, chosenId) => {
                const target = (chosenId ? allReceipts.find((x) => x.id === chosenId) : null) || targetReceipt;
                if (target) {
                  const diff = round(wt - num(target["sent"]));
                  const reason = rsn || (diff !== 0 ? (Math.abs(diff / (num(target["sent"]) || 1)) > 0.1 ? "Spillage" : "Moisture loss") : "—");
                  const updated = normalize("receipts", {
                    ...target,
                    received: wt,
                    diff,
                    reason,
                    status: "Posted",
                  });
                  upsert("receipts", updated);

                  // Synchronize downstream QC
                  const synced = syncReceiptDownstream(data, updated);
                  if (synced["quality-check"] && synced["quality-check"] !== data["quality-check"]) {
                    synced["quality-check"].forEach((qc) => {
                      if (qc["lot"] === updated.id) {
                        upsert("quality-check", qc);
                      }
                    });
                  }

                  setShowScaleModal(false);
                  setHeaderVoucherRow(updated);
                  toast.success(`Scale captured ${wt} kg applied to ${updated.id} (${updated["dc"]}). Goods Receipt Note generated!`);
                } else {
                  setShowScaleModal(false);
                  toast.success(`Scale captured ${wt} kg (Reason: ${rsn})`);
                }
              }}
            />
            {headerVoucherRow && (
              <GoodsReceiptVoucherModal
                isOpen={true}
                onClose={() => setHeaderVoucherRow(null)}
                receipt={headerVoucherRow}
                trip={(data["trips"] ?? []).find((t) => t.id === headerVoucherRow["dc"])}
              />
            )}
          </>
        );
      })()}

      <QrStickerModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        product="Tomato Grade A"
        grade="Grade A"
        packSizeKg={1.0}
        lotId="PK-1001"
        packerName="Senthil P"
        shelfLifeDays={3}
      />
    </div>
  );
}
