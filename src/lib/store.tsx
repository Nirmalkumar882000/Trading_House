import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { MODULES, seedRows, ensureDirectoryDemoData, type Row, INITIAL_PRODUCT_CATALOG, syncProductCatalog, type ProductItem } from "./modules";
import { normalize, syncReceiptContainers, syncReceiptDownstream } from "./workflow";
import type { UserRole } from "./rbac";

type Data = Record<string, Row[]>;
const STORAGE_KEY = "trading-house-data";
const ROLE_STORAGE_KEY = "trading-house-role";
const CLEAN_VERSION_KEY = "trading-house-portal-clean-v11";
const CATALOG_STORAGE_KEY = "trading-house-product-catalog";

const loadCatalog = (): ProductItem[] => {
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        syncProductCatalog(parsed);
        return parsed;
      }
    }
  } catch { /* ignore */ }
  syncProductCatalog(INITIAL_PRODUCT_CATALOG);
  return [...INITIAL_PRODUCT_CATALOG];
};

// Default demo initial data with rich produce records, clean quantities and packet counts
const initial = (): Data => Object.fromEntries(MODULES.map((m) => [m.slug, []]));
const demoInitial = (): Data => Object.fromEntries(MODULES.map((m) => [m.slug, seedRows(m)]));

const load = (): Data => {
  try {
    const isClean = localStorage.getItem(CLEAN_VERSION_KEY);
    if (!isClean) {
      // Auto-purge stale dummy data from earlier sessions and populate clean comprehensive demo dataset
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(CLEAN_VERSION_KEY, "true");
      let demo = demoInitial();
      if (demo["receipts"]) {
        for (const r of demo["receipts"]) {
          if (Number(r["containerCount"]) > 0) {
            demo = syncReceiptContainers(demo, r);
          }
        }
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(demo)); } catch { /* ignore */ }
      return demo;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      let demo = demoInitial();
      if (demo["receipts"]) {
        for (const r of demo["receipts"]) {
          if (Number(r["containerCount"]) > 0) {
            demo = syncReceiptContainers(demo, r);
          }
        }
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(demo)); } catch { /* ignore */ }
      return demo;
    }
    const parsed = JSON.parse(raw) as Data;
    let merged = ensureDirectoryDemoData({ ...demoInitial(), ...parsed });
    if (merged["receipts"]) {
      for (const r of merged["receipts"]) {
        if (Number(r["containerCount"]) > 0) {
          merged = syncReceiptContainers(merged, r);
        }
      }
    }
    return merged;
  } catch {
    return demoInitial();
  }
};

interface Ctx {
  data: Data;
  role: UserRole;
  setRole: (role: UserRole) => void;
  catalog: ProductItem[];
  addCatalogItem: (item: ProductItem) => void;
  updateCatalogItem: (originalName: string, item: ProductItem) => void;
  deleteCatalogItem: (name: string) => void;
  resetCatalog: () => void;
  upsert: (slug: string, row: Row) => void;
  remove: (slug: string, id: string) => void;
  clearModule: (slug: string) => void;
  clearAllData: () => void;
  reset: () => void;
  seedDemoData: () => void;
  purgeDummyLedgers: () => void;
  nextId: (slug: string) => string;
}
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(initial);
  const [role, setRoleState] = useState<UserRole>("Admin");
  const [catalog, setCatalogState] = useState<ProductItem[]>(loadCatalog);
  const hydrated = useRef(false);

  useEffect(() => {
    setData(load());
    setCatalogState(loadCatalog());
    try {
      const savedRole = localStorage.getItem(ROLE_STORAGE_KEY) as UserRole | null;
      if (savedRole) setRoleState(savedRole);
    } catch { /* ignore */ }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* storage full or unavailable */ }
  }, [data]);

  const setRole = (r: UserRole) => {
    setRoleState(r);
    try { localStorage.setItem(ROLE_STORAGE_KEY, r); } catch { /* ignore */ }
  };

  const addCatalogItem = (item: ProductItem) => {
    setCatalogState((prev) => {
      const filtered = prev.filter((p) => p.name.trim().toLowerCase() !== item.name.trim().toLowerCase());
      const next = [item, ...filtered];
      syncProductCatalog(next);
      try {
        localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const updateCatalogItem = (originalName: string, item: ProductItem) => {
    setCatalogState((prev) => {
      const next = prev.map((p) => (p.name.trim().toLowerCase() === originalName.trim().toLowerCase() ? item : p));
      syncProductCatalog(next);
      try {
        localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const deleteCatalogItem = (name: string) => {
    setCatalogState((prev) => {
      const next = prev.filter((p) => p.name.trim().toLowerCase() !== name.trim().toLowerCase());
      syncProductCatalog(next);
      try {
        localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const resetCatalog = () => {
    const resetList = [...INITIAL_PRODUCT_CATALOG];
    setCatalogState(resetList);
    syncProductCatalog(resetList);
    try {
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(resetList));
    } catch { /* ignore */ }
  };

  const value: Ctx = {
    data,
    role,
    setRole,
    catalog,
    addCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    resetCatalog,
    upsert: (slug, row) =>
      setData((d) => {
        const list = d[slug] ?? [];
        const full = normalize(slug, row);
        const exists = list.some((r) => r.id === full.id);
        let next = { ...d, [slug]: exists ? list.map((r) => (r.id === full.id ? full : r)) : [full, ...list] };
        if (slug === "receipts") {
          next = syncReceiptDownstream(next, full);
          next = syncReceiptContainers(next, full);
        }
        const previous = list.find((r) => r.id === full.id);
        const audit = {
          id: `AUD-${(d["transaction-audit"] ?? []).length + 1}`,
          status: "Recorded",
          ref: full.id,
          action: exists ? "Updated" : "Created",
          beforeStatus: previous?.status ?? "—",
          afterStatus: full.status,
          before: JSON.stringify(previous ?? {}),
          after: JSON.stringify(full),
          date: new Date().toISOString(),
          person: String(full["responsible"] || full["grader"] || full["packer"] || "Ravi Kumar"),
        };
        return { ...next, "transaction-audit": [audit, ...(d["transaction-audit"] ?? [])] };
      }),
    remove: (slug, id) =>
      setData((d) => {
        const previous = (d[slug] ?? []).find((r) => r.id === id);
        const audit = {
          id: `AUD-${(d["transaction-audit"] ?? []).length + 1}`,
          status: "Recorded",
          ref: id,
          action: "Deleted",
          beforeStatus: previous?.status ?? "—",
          afterStatus: "Deleted",
          before: JSON.stringify(previous ?? {}),
          after: "{}",
          date: new Date().toISOString(),
          person: "Ravi Kumar",
        };
        let next = {
          ...d,
          [slug]: (d[slug] ?? []).filter((r) => r.id !== id),
          "transaction-audit": [audit, ...(d["transaction-audit"] ?? [])],
        };
        if (slug === "receipts") {
          const containers = next["containers"] ?? [];
          next["containers"] = containers.filter(
            (c) => c["receipt"] !== id && c["receiptRef"] !== id && c.id !== `CNT-${id.replace(/\D/g, "")}`
          );
        }
        return next;
      }),
    clearModule: (slug: string) => {
      setData((d) => ({ ...d, [slug]: [] }));
    },
    clearAllData: () => {
      const empty = initial();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
      } catch { /* ignore */ }
      setData(empty);
    },
    reset: () => {
      const demo = demoInitial();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
      } catch { /* ignore */ }
      setData(demo);
      resetCatalog();
      setRole("Admin");
    },
    seedDemoData: () => {
      const demo = demoInitial();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
      } catch { /* ignore */ }
      setData(demo);
    },
    purgeDummyLedgers: () => {
      // Kept for backward compatibility
    },
    nextId: (slug) => {
      const m = MODULES.find((x) => x.slug === slug);
      if (!m) throw new Error("Unknown module");
      const max = Math.max(1000, ...(data[slug] ?? []).map((r) => Number(r.id.split("-")[1]) || 0));
      return `${m.prefix}-${max + 1}`;
    },
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
