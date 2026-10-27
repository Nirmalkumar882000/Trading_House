import { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ShoppingCart,
  Users,
  ArrowRight,
  Search,
  Share2,
  Download,
  Info,
  ShieldAlert,
  CheckCircle2,
  Package,
  Layers,
  Eye,
  X,
  PlusCircle,
  Truck,
  CheckSquare,
  Square,
  ExternalLink,
  FileText,
  Check,
  Clock,
  Sparkles,
  RotateCcw,
  Navigation,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Trash2,
  Plus,
  UserCheck,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { ITEMS, PRODUCT_CATALOG, SUPPLIERS, BUYERS, type ModuleDef, type Row } from "@/lib/modules";
import { useStore } from "@/lib/store";
import { parseLines, validateData, round, normalize, parseBuys } from "@/lib/workflow";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type BuyerDemandItem = {
  buyer: string;
  baseQty: number;
  extraKg: number;
  qty: number;
  pos: string[];
};

type ProductPlan = {
  product: string;
  baseDemand: number;
  extraKg: number;
  demand: number;
  purchased: number;
  reserved: number;
  balance: number;
  buyers: BuyerDemandItem[];
};

interface TripModalItem {
  product: string;
  supplier: string;
  qty: number;
  rate: number;
  totalDemand: number;
  baseDemand: number;
  extraKg: number;
  containerType: string;
  boxCount: number;
  buyersCount: number;
}

interface InwardReturnItem {
  supplier: string;
  containerType: string;
  returnCount: number;
}

export function DemandPlan({ mod }: { mod: ModuleDef }) {
  const { data, upsert, nextId } = useStore();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "fulfilled">("all");
  const [selectedProduct, setSelectedProduct] = useState<ProductPlan | null>(null);
  const [editingPoBuffer, setEditingPoBuffer] = useState<{ poId: string; buffer: number } | null>(null);

  // Multi-selection for bulk planning
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Plan Market Trip Modal State
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [tripItems, setTripItems] = useState<TripModalItem[]>([]);
  const [tripDirection, setTripDirection] = useState<"Inward" | "Inward Return">("Inward");
  const [tripSupplier, setTripSupplier] = useState<string>("");
  const [tripTransporter, setTripTransporter] = useState<string>("");
  const [tripVehicle, setTripVehicle] = useState<string>("");
  const [tripDriver, setTripDriver] = useState<string>("");
  const [tripDriverPhone, setTripDriverPhone] = useState<string>("9840012345");
  const [tripCharges, setTripCharges] = useState<number>(600);
  const [tripContainerType, setTripContainerType] = useState<string>("Plastic crates");
  const [tripContainerCount, setTripContainerCount] = useState<number>(0);
  const [tripDc, setTripDc] = useState<string>("");
  const [tripDate, setTripDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [tripTime, setTripTime] = useState<string>(() =>
    new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
  const [tripStatus, setTripStatus] = useState<string>("Submitted");
  const [tripFromLocation, setTripFromLocation] = useState<string>("Koyambedu Wholesale Mandi (Supplier Stall)");
  const [tripToLocation, setTripToLocation] = useState<string>("Velaan Bay Warehouse (Receiving Bay)");
  const [tripManagerName, setTripManagerName] = useState<string>("Suresh Kumar (Purchase Manager)");
  const [tripManagerPhone, setTripManagerPhone] = useState<string>("9840234567");

  // Inward Return Container Lines
  const [returnItems, setReturnItems] = useState<InwardReturnItem[]>([
    {
      supplier: "Murugan Traders",
      containerType: "Plastic crates",
      returnCount: 10,
    },
  ]);

  // Transport Tracking State
  const [transportFilterTab, setTransportFilterTab] = useState<
    "all" | "Inward" | "Inward Return" | "Outward" | "Outward Return"
  >("all");
  const [transportSearch, setTransportSearch] = useState("");

  // Suppliers & Transporters options from store or defaults
  const suppliersList = useMemo(() => {
    const fromStore = (data["suppliers"] ?? [])
      .filter((s) => s.status !== "Inactive" && s.status !== "Rejected")
      .map((s) => String(s["name"] || ""))
      .filter(Boolean);
    return fromStore.length ? fromStore : SUPPLIERS;
  }, [data]);

  const transportersList = useMemo(() => {
    const fromStore = (data["transporters"] ?? [])
      .filter((t) => t.status !== "Inactive")
      .map((t) => ({
        name: String(t["name"] || ""),
        vehicle: String(t["vehicle"] || ""),
        driver: String(t["driver"] || ""),
        phone: String(t["phone"] || ""),
      }))
      .filter((t) => t.name);

    if (fromStore.length) return fromStore;
    return [
      { name: "Chennai Fresh Logistics", vehicle: "TN 09 AB 1234", driver: "Raja", phone: "9840012345" },
      { name: "Koyambedu Speed Transports", vehicle: "TN 22 CD 5678", driver: "Ganesh", phone: "9841098765" },
      { name: "Kaveri Express Cargo", vehicle: "TN 07 EF 9012", driver: "Suresh", phone: "9444054321" },
    ];
  }, [data]);

  // 1) Calculate comprehensive consolidation plan with exact extraKg breakdown
  const plans = useMemo<ProductPlan[]>(() => {
    const map = new Map<string, ProductPlan>();
    const get = (p: string): ProductPlan => {
      let r = map.get(p);
      if (!r) {
        r = { product: p, baseDemand: 0, extraKg: 0, demand: 0, purchased: 0, reserved: 0, balance: 0, buyers: [] };
        map.set(p, r);
      }
      return r;
    };

    // Buyer demand: every PO line, per buyer, excluding rejected POs
    for (const po of data["purchase-orders"] ?? []) {
      if (po.status === "Rejected") continue;
      const lines = parseLines(po["item"]);
      const totalBase = lines.reduce((a, l) => a + (Number(l.q) || 0), 0);
      const poExtraKg = Number(po["extraKg"]) || 0;

      for (const l of lines) {
        const lineBase =
          Number(l.q) ||
          (lines.length === 1 ? Number(po["qty"]) || 0 : totalBase ? 0 : Math.round((Number(po["qty"]) || 0) / lines.length));
        const lineRatio = totalBase > 0 ? lineBase / totalBase : 1 / Math.max(1, lines.length);
        const extraShare = poExtraKg > 0 ? round(poExtraKg * lineRatio) : 0;
        const lineTotal = round(lineBase + extraShare);

        const plan = get(l.p);
        plan.baseDemand = round(plan.baseDemand + lineBase);
        plan.extraKg = round(plan.extraKg + extraShare);
        plan.demand = round(plan.demand + lineTotal);

        let b = plan.buyers.find((x) => x.buyer === po["buyer"]);
        if (!b) {
          b = { buyer: String(po["buyer"]), baseQty: 0, extraKg: 0, qty: 0, pos: [] };
          plan.buyers.push(b);
        }
        b.baseQty = round(b.baseQty + lineBase);
        b.extraKg = round(b.extraKg + extraShare);
        b.qty = round(b.qty + lineTotal);
        if (!b.pos.includes(po.id)) b.pos.push(po.id);
      }
    }

    // Market purchase so far: product quantities on submitted & draft market trips
    for (const t of data["trips"] ?? []) {
      const lines = parseLines(t["item"]);
      const totalQ = lines.reduce((a, l) => a + (Number(l.q) || 0), 0);
      for (const l of lines) {
        const qty = l.q || (lines.length === 1 ? Number(t["net"]) || 0 : totalQ ? 0 : 0);
        if (qty) {
          if (t.status === "Submitted") {
            get(l.p).purchased = round(get(l.p).purchased + qty);
          } else {
            get(l.p).reserved = round(get(l.p).reserved + qty);
          }
        }
      }
    }

    const known = ITEMS.filter((i) => map.has(i));
    const extra = [...map.keys()].filter((k) => !ITEMS.includes(k));
    return [...known, ...extra].flatMap((k) => {
      const plan = map.get(k);
      if (!plan) return [];
      plan.balance = Math.max(0, round(plan.demand - plan.purchased - plan.reserved));
      return [plan];
    });
  }, [data]);

  // Aggregated KPI numbers
  const totalBaseDemand = useMemo(() => round(plans.reduce((a, p) => a + p.baseDemand, 0)), [plans]);
  const totalExtraKg = useMemo(() => round(plans.reduce((a, p) => a + p.extraKg, 0)), [plans]);
  const totalDemand = useMemo(() => round(plans.reduce((a, p) => a + p.demand, 0)), [plans]);
  const totalPurchased = useMemo(() => round(plans.reduce((a, p) => a + p.purchased, 0)), [plans]);
  const totalReserved = useMemo(() => round(plans.reduce((a, p) => a + p.reserved, 0)), [plans]);
  const totalBalance = useMemo(() => round(plans.reduce((a, p) => a + p.balance, 0)), [plans]);

  // Filtered plans based on search & tab
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (filterTab === "pending" && p.balance <= 0) return false;
      if (filterTab === "fulfilled" && p.balance > 0) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesProduct = p.product.toLowerCase().includes(q);
        const matchesBuyer = p.buyers.some((b) => b.buyer.toLowerCase().includes(q));
        if (!matchesProduct && !matchesBuyer) return false;
      }
      return true;
    });
  }, [plans, filterTab, search]);

  // Selection helpers
  const handleToggleSelectProduct = (product: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(product)) next.delete(product);
      else next.add(product);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === filteredPlans.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredPlans.map((p) => p.product)));
    }
  };

  // Open Market Trip confirmation popup
  const openPlanTripModal = (productsToPlan: ProductPlan[], direction: "Inward" | "Inward Return" = "Inward") => {
    if (!productsToPlan.length) {
      toast.error("Please select at least one product to plan market procurement.");
      return;
    }

    const items: TripModalItem[] = productsToPlan.map((p) => {
      let defaultRate = 28;
      for (const t of data["trips"] ?? []) {
        if (t["buys"]) {
          const b = parseBuys(t["buys"]).find((x) => x.p === p.product);
          if (b && b.r > 0) {
            defaultRate = b.r;
            break;
          }
        }
      }

      const targetQty = p.balance > 0 ? p.balance : p.demand;
      const defaultContainer =
        p.product.toLowerCase().includes("onion") || p.product.toLowerCase().includes("potato")
          ? "Gunny bags"
          : "Plastic crates";
      const capacity = defaultContainer === "Gunny bags" ? 50 : defaultContainer === "Carton boxes" ? 15 : 20;
      const defaultBoxCount = Math.max(1, Math.ceil(targetQty / capacity));

      return {
        product: p.product,
        supplier: suppliersList[0] || "Murugan Traders",
        qty: targetQty,
        rate: defaultRate,
        totalDemand: p.demand,
        baseDemand: p.baseDemand,
        extraKg: p.extraKg,
        containerType: defaultContainer,
        boxCount: defaultBoxCount,
        buyersCount: p.buyers.length,
      };
    });

    const totalNet = items.reduce((s, i) => s + i.qty, 0);
    const totalBoxes = items.reduce((s, i) => s + (i.boxCount || 0), 0);
    const suggestedCrates = totalBoxes || Math.max(1, Math.ceil(totalNet / 20));

    // Auto-generate DC
    const existingDcs = (data["trips"] ?? []).map((t) => String(t["dc"] || "")).filter(Boolean);
    let nextDcNum = 4441;
    for (const d of existingDcs) {
      const match = d.match(/DC-MKT-(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val >= nextDcNum) nextDcNum = val + 1;
      }
    }

    const defaultTransporter = transportersList[0];

    setTripItems(items);
    setTripDirection(direction);
    setTripSupplier(suppliersList[0] || "Murugan Traders");
    setTripTransporter(defaultTransporter?.name || "Chennai Fresh Logistics");
    setTripVehicle(defaultTransporter?.vehicle || "TN 09 AB 1234");
    setTripDriver(defaultTransporter?.driver || "Raja");
    setTripDriverPhone(defaultTransporter?.phone || "9840012345");
    setTripCharges(direction === "Inward Return" ? 350 : 600);
    setTripContainerType("Plastic crates");
    const initialCrates = direction === "Inward Return" ? 10 : suggestedCrates;
    setTripContainerCount(initialCrates);
    setReturnItems([
      {
        supplier: suppliersList[0] || "Murugan Traders",
        containerType: "Plastic crates",
        returnCount: initialCrates,
      },
    ]);
    setTripDc(direction === "Inward Return" ? `DC-RET-${nextDcNum}` : `DC-MKT-${nextDcNum}`);
    setTripDate(new Date().toISOString().slice(0, 10));
    setTripTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    setTripStatus("Scheduled");
    setTripFromLocation(
      direction === "Inward Return"
        ? "Velaan Bay Warehouse (Receiving Bay)"
        : "Koyambedu Wholesale Mandi (Supplier Stall)"
    );
    setTripToLocation(
      direction === "Inward Return"
        ? "Koyambedu Wholesale Mandi (Supplier Stall)"
        : "Velaan Bay Warehouse (Receiving Bay)"
    );
    setTripManagerName(
      direction === "Inward Return"
        ? "Karthik (Fleet & Bay Manager)"
        : "Suresh Kumar (Purchase Manager)"
    );
    setTripManagerPhone("9840234567");
    setIsTripModalOpen(true);
  };

  // Open Market Trip confirmation for selected items or all pending demand products by default
  const handleOpenDefaultTripModal = () => {
    if (selectedProducts.size > 0) {
      const selected = plans.filter((p) => selectedProducts.has(p.product));
      openPlanTripModal(selected, "Inward");
    } else {
      const pending = plans.filter((p) => p.balance > 0);
      const toPlan = pending.length > 0 ? pending : (plans.length > 0 ? plans : []);
      if (!toPlan.length) {
        toast.info("No demand products found. Please add a buyer PO first.");
        return;
      }
      openPlanTripModal(toPlan, "Inward");
    }
  };

  // Change transporter auto-fills vehicle & driver & phone
  const handleTransporterChange = (name: string) => {
    setTripTransporter(name);
    const found = transportersList.find((t) => t.name === name);
    if (found) {
      if (found.vehicle) setTripVehicle(found.vehicle);
      if (found.driver) setTripDriver(found.driver);
      if (found.phone) setTripDriverPhone(found.phone);
    }
  };

  // Update item product in trip modal
  const handleUpdateTripItemProduct = (index: number, newProduct: string) => {
    setTripItems((prev) => {
      const next = [...prev];
      const item = next[index];
      const foundPlan = plans.find((p) => p.product === newProduct);
      const totalDemand = foundPlan ? foundPlan.demand : 0;
      const baseDemand = foundPlan ? foundPlan.baseDemand : 0;
      const extraKg = foundPlan ? foundPlan.extraKg : 0;
      const targetQty = foundPlan ? (foundPlan.balance > 0 ? foundPlan.balance : foundPlan.demand) : item.qty || 25;

      let defaultRate = item.rate || 28;
      for (const t of data["trips"] ?? []) {
        if (t["buys"]) {
          const b = parseBuys(t["buys"]).find((x) => x.p === newProduct && (!item.supplier || x.s === item.supplier));
          if (b && b.r > 0) {
            defaultRate = b.r;
            break;
          }
        }
      }

      const defaultContainer =
        newProduct.toLowerCase().includes("onion") || newProduct.toLowerCase().includes("potato")
          ? "Gunny bags"
          : "Plastic crates";
      const capacity = defaultContainer === "Gunny bags" ? 50 : defaultContainer === "Carton boxes" ? 15 : 20;
      const newBoxCount = Math.max(1, Math.ceil(targetQty / capacity));

      next[index] = {
        ...item,
        product: newProduct,
        totalDemand,
        baseDemand,
        extraKg,
        qty: targetQty,
        rate: defaultRate,
        containerType: defaultContainer,
        boxCount: newBoxCount,
        buyersCount: foundPlan ? foundPlan.buyers.length : 0,
      };
      const newTotalBoxes = next.reduce((s, i) => s + (i.boxCount || 0), 0);
      setTripContainerCount(newTotalBoxes);
      return next;
    });
  };

  // Update item supplier in trip modal
  const handleUpdateTripItemSupplier = (index: number, newSupplier: string) => {
    setTripItems((prev) => {
      const next = [...prev];
      const item = next[index];
      let supplierRate = item.rate;
      for (const p of data["supplier-prices"] ?? []) {
        if (p["supplier"] === newSupplier && p["item"]) {
          const l = parseLines(p["item"]).find((x) => x.p === item.product);
          if (l && Number(l.r) > 0) {
            supplierRate = Number(l.r);
            break;
          }
        }
      }
      next[index] = { ...item, supplier: newSupplier, rate: supplierRate };
      return next;
    });
  };

  // Add new product line to trip modal
  const handleAddTripItem = () => {
    const existingProducts = new Set(tripItems.map((i) => i.product));
    const nextProduct = ITEMS.find((i) => !existingProducts.has(i)) || ITEMS[0];
    const foundPlan = plans.find((p) => p.product === nextProduct);
    const targetQty = foundPlan ? (foundPlan.balance > 0 ? foundPlan.balance : foundPlan.demand) : 25;
    const defaultContainer =
      nextProduct.toLowerCase().includes("onion") || nextProduct.toLowerCase().includes("potato")
        ? "Gunny bags"
        : "Plastic crates";
    const capacity = defaultContainer === "Gunny bags" ? 50 : 20;
    const boxCount = Math.max(1, Math.ceil(targetQty / capacity));

    const newItem: TripModalItem = {
      product: nextProduct,
      supplier: tripSupplier || suppliersList[0] || "Murugan Traders",
      qty: targetQty,
      rate: 28,
      totalDemand: foundPlan ? foundPlan.demand : 0,
      baseDemand: foundPlan ? foundPlan.baseDemand : 0,
      extraKg: foundPlan ? foundPlan.extraKg : 0,
      containerType: defaultContainer,
      boxCount,
      buyersCount: foundPlan ? foundPlan.buyers.length : 0,
    };

    setTripItems((prev) => {
      const next = [...prev, newItem];
      const newTotalBoxes = next.reduce((s, i) => s + (i.boxCount || 0), 0);
      setTripContainerCount(newTotalBoxes);
      return next;
    });
  };

  // Remove a product line from trip modal
  const handleRemoveTripItem = (index: number) => {
    setTripItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const newTotalBoxes = next.reduce((s, i) => s + (i.boxCount || 0), 0);
      setTripContainerCount(newTotalBoxes);
      return next;
    });
  };

  // Update item quantity in trip modal
  const handleUpdateTripItemQty = (index: number, qty: number) => {
    setTripItems((prev) => {
      const next = [...prev];
      const validQty = Math.max(0, qty);
      const item = next[index];
      const capacity =
        item.containerType === "Gunny bags" ? 50 : item.containerType === "Carton boxes" ? 15 : 20;
      const newBoxCount = Math.max(1, Math.ceil(validQty / capacity));
      next[index] = { ...item, qty: validQty, boxCount: newBoxCount };
      const newTotalBoxes = next.reduce((s, i) => s + (i.boxCount || 0), 0);
      setTripContainerCount(newTotalBoxes);
      return next;
    });
  };

  // Update item container type in trip modal
  const handleUpdateTripItemContainer = (index: number, containerType: string) => {
    setTripItems((prev) => {
      const next = [...prev];
      const item = next[index];
      const capacity =
        containerType === "Gunny bags" ? 50 : containerType === "Carton boxes" ? 15 : 20;
      const newBoxCount = Math.max(1, Math.ceil(item.qty / capacity));
      next[index] = { ...item, containerType, boxCount: newBoxCount };
      const newTotalBoxes = next.reduce((s, i) => s + (i.boxCount || 0), 0);
      setTripContainerCount(newTotalBoxes);
      return next;
    });
  };

  // Update item box count in trip modal
  const handleUpdateTripItemBoxCount = (index: number, boxCount: number) => {
    setTripItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], boxCount: Math.max(0, boxCount) };
      const newTotalBoxes = next.reduce((s, i) => s + (i.boxCount || 0), 0);
      setTripContainerCount(newTotalBoxes);
      return next;
    });
  };

  const handleUpdateTripItemRate = (index: number, rate: number) => {
    setTripItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], rate: Math.max(0, rate) };
      return next;
    });
  };

  // Calculate live trip modal totals
  const tripTotalNet = useMemo(() => round(tripItems.reduce((s, i) => s + i.qty, 0)), [tripItems]);
  const tripTotalBoxes = useMemo(() => tripItems.reduce((s, i) => s + (i.boxCount || 0), 0), [tripItems]);
  const tripTotalDemand = useMemo(
    () => round(tripItems.reduce((s, i) => s + (i.totalDemand || 0), 0)),
    [tripItems]
  );
  const tripTotalAmount = useMemo(
    () => round(tripItems.reduce((s, i) => s + i.qty * (i.rate || 0), 0)),
    [tripItems]
  );
  const tripAvgRate = tripTotalNet > 0 ? round(tripTotalAmount / tripTotalNet) : 0;

  // Total Return Containers Count
  const totalReturnContainers = useMemo(
    () => returnItems.reduce((acc, item) => acc + (Number(item.returnCount) || 0), 0),
    [returnItems]
  );

  const handleAddReturnDetail = () => {
    setReturnItems((prev) => [
      ...prev,
      {
        supplier: prev[prev.length - 1]?.supplier || suppliersList[0] || "Murugan Traders",
        containerType: prev[prev.length - 1]?.containerType || "Plastic crates",
        returnCount: 10,
      },
    ]);
  };

  const handleRemoveReturnDetail = (idx: number) => {
    setReturnItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateReturnDetail = (idx: number, field: keyof InwardReturnItem, val: any) => {
    setReturnItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  // WhatsApp Message for Inward Container Return
  const sendWhatsAppForInwardReturn = (transport: Row, details: InwardReturnItem[]) => {
    const detailsText = details
      .map((d) => `• *${d.supplier}*: ${d.returnCount} units (${d.containerType})`)
      .join("\n");

    const message =
      `*Velaan Bay — Inward Container Return & Vehicle Dispatch Order*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Movement Type:* Inward Return (Bay ➔ Supplier)\n` +
      `*Transport Movement Ref:* ${transport.id}\n` +
      `*Delivery Challan (DC):* ${transport["dc"] || "—"}\n` +
      `*Date & Time:* ${transport["date"]} at ${transport["time"] || "—"}\n` +
      `*Route:* ${transport["fromLocation"] || "Velaan Bay"} ➔ ${transport["toLocation"] || "Koyambedu Mandi"}\n` +
      `*Trip Status:* ${transport.status}\n\n` +
      `*Returned Containers Breakdown:*\n${detailsText}\n\n` +
      `*Total Return Count:* ${transport["containerCount"]} units\n` +
      `*Fleet / Bay Manager:* ${transport["managerName"] || "Karthik (Fleet & Bay Manager)"} (Ph: ${transport["managerPhone"] || "9840234567"})\n` +
      `*Transporter:* ${transport["transporter"]}\n` +
      `*Vehicle No:* ${transport["vehicle"]}\n` +
      `*Driver:* ${transport["driver"]} (Ph: ${transport["driverPhone"] || "—"})\n` +
      `*Freight Charges:* ₹${Number(transport["charges"] || 0).toLocaleString("en-IN")}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Warehouse Bay & Drivers: Inspect empty crates/containers upon dispatch and collect supplier gate acknowledgment receipt._`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  // Confirm and create trip + auto-create transport movement
  const handleConfirmCreateTrip = (sendWhatsApp: boolean = false) => {
    const isReturn = tripDirection === "Inward Return";

    if (!isReturn && (!tripItems.length || tripTotalNet <= 0)) {
      toast.error("Please add at least one product with positive KG quantity.");
      return;
    }
    if (isReturn && (!returnItems.length || totalReturnContainers <= 0)) {
      toast.error("Please enter a valid container return count.");
      return;
    }
    if (isReturn && returnItems.some((r) => !r.supplier)) {
      toast.error("Please select a supplier for each return line.");
      return;
    }
    if (!tripVehicle.trim()) {
      toast.error("Vehicle number is required.");
      return;
    }
    if (!tripDriver.trim()) {
      toast.error("Driver name is required.");
      return;
    }

    const movId = nextId("transport");

    if (isReturn) {
      const uniqueSuppliers = [...new Set(returnItems.map((r) => r.supplier).filter(Boolean))];
      const supplierSummary = uniqueSuppliers.join(", ") || tripSupplier;
      const primarySupplier = uniqueSuppliers[0] || tripSupplier;
      const primaryContainerType = returnItems[0]?.containerType || "Plastic crates";

      const itemSummary = returnItems
        .map((r) => `${r.returnCount} ${r.containerType} ➔ ${r.supplier}`)
        .join("; ");

      const returnMovement: Row = {
        id: movId,
        date: tripDate,
        time: tripTime,
        direction: "Inward Return",
        supplier: supplierSummary,
        party: primarySupplier,
        transporter: tripTransporter,
        vehicle: tripVehicle,
        driver: tripDriver,
        driverPhone: tripDriverPhone,
        fromLocation: tripFromLocation,
        toLocation: tripToLocation,
        managerName: tripManagerName,
        managerPhone: tripManagerPhone,
        qty: 0,
        containerType: returnItems.length === 1 ? primaryContainerType : "Mixed containers",
        containerCount: totalReturnContainers,
        charges: tripCharges || 350,
        status: tripStatus,
        responsible: "Ravi Kumar",
        item: itemSummary,
        dc: tripDc || `DC-RET-${Date.now().toString().slice(-4)}`,
      };

      const normalizedMovement = normalize("transport", returnMovement);
      const err = validateData({
        ...data,
        transport: [...(data["transport"] ?? []), normalizedMovement],
      });

      if (err) {
        toast.error(err);
        return;
      }

      upsert("transport", normalizedMovement);
      toast.success(
        `Inward Return ${movId} scheduled! Returning ${totalReturnContainers} containers to ${supplierSummary} via ${tripVehicle}.`
      );

      if (sendWhatsApp) {
        sendWhatsAppForInwardReturn(normalizedMovement, returnItems);
      }

      setIsTripModalOpen(false);
      setSelectedProducts(new Set());
      return;
    }

    const tripId = nextId("trips");

    const buys = tripItems.map((i) => ({
      s: i.supplier || tripSupplier,
      p: i.product,
      q: i.qty,
      r: i.rate || 0,
    }));

    // Find PO reference from first product
    const firstProduct = plans.find((p) => p.product === tripItems[0]?.product);
    const poRef = firstProduct?.buyers[0]?.pos[0] || "";
    const uniqueSuppliers = [...new Set(tripItems.map((i) => i.supplier || tripSupplier).filter(Boolean))];
    const supplierSummary = uniqueSuppliers.join(", ") || tripSupplier;

    const newTrip: Row = {
      id: tripId,
      status: tripStatus,
      date: tripDate,
      time: tripTime,
      fromLocation: tripFromLocation,
      toLocation: tripToLocation,
      managerName: tripManagerName,
      managerPhone: tripManagerPhone,
      dc: tripDc || `DC-MKT-4450`,
      buys: JSON.stringify(buys),
      item: JSON.stringify(tripItems.map((i) => ({ p: i.product, q: i.qty }))),
      supplier: supplierSummary,
      net: tripTotalNet,
      rate: tripAvgRate,
      amount: tripTotalAmount,
      containerType: tripContainerType,
      containerCount: tripTotalBoxes || tripContainerCount,
      transporter: tripTransporter,
      vehicle: tripVehicle,
      driver: tripDriver,
      signatures: tripStatus === "Submitted" ? "3" : "1",
      responsible: "Ravi Kumar",
      po: poRef,
    };

    const normalizedTrip = normalize("trips", newTrip);

    // Auto-create corresponding Inward Transport Movement
    const transportStatus =
      tripStatus === "Submitted" || tripStatus === "Delivered"
        ? "Delivered"
        : tripStatus === "Loading" || tripStatus === "In transit"
          ? "In transit"
          : "Scheduled";
    const newTransport: Row = {
      id: movId,
      date: tripDate,
      time: tripTime,
      direction: tripDirection,
      ref: tripId,
      supplier: tripSupplier,
      party: tripSupplier,
      transporter: tripTransporter,
      vehicle: tripVehicle,
      driver: tripDriver,
      driverPhone: tripDriverPhone,
      fromLocation: tripFromLocation,
      toLocation: tripToLocation,
      managerName: tripManagerName,
      managerPhone: tripManagerPhone,
      qty: tripTotalNet,
      containerType: tripContainerType,
      containerCount: tripContainerCount,
      charges: tripCharges,
      status: transportStatus,
      responsible: "Ravi Kumar",
      item: JSON.stringify(tripItems.map((i) => ({ p: i.product, q: i.qty }))),
      dc: tripDc,
    };

    const err = validateData({
      ...data,
      trips: [...(data["trips"] ?? []), normalizedTrip],
      transport: [...(data["transport"] ?? []), newTransport],
    });

    if (err) {
      toast.error(err);
      return;
    }

    upsert("trips", normalizedTrip);
    upsert("transport", newTransport);

    toast.success(
      `${tripId} (${normalizedTrip["dc"]}) and Transport ${movId} (${tripDirection}) created! Vehicle ${tripVehicle} sent to ${tripSupplier}.`
    );

    if (sendWhatsApp) {
      sendWhatsAppForTrip(normalizedTrip, newTransport, tripItems);
    }

    setIsTripModalOpen(false);
    setSelectedProducts(new Set());
  };

  // WhatsApp Message for specific trip & transport movement
  const sendWhatsAppForTrip = (trip: Row, transport: Row, items: TripModalItem[]) => {
    const itemsText = items
      .map((i) => {
        const amt = round(i.qty * (i.rate || 0));
        return `• *${i.product}*: ${i.qty.toLocaleString("en-IN")} kg (${i.boxCount} ${i.containerType}) @ ₹${i.rate}/kg = ₹${amt.toLocaleString("en-IN")}`;
      })
      .join("\n");

    const message =
      `*Velaan Bay — Inward Market Procurement & Loading Order*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Trip ID:* ${trip.id}\n` +
      `*Transport Movement Ref:* ${transport.id} (${transport["direction"]})\n` +
      `*Delivery Challan (DC):* ${trip["dc"]}\n` +
      `*Trip Date:* ${trip["date"]}${trip["time"] ? ` at ${trip["time"]}` : ""}\n` +
      `*Route:* ${transport["fromLocation"] || "Koyambedu Mandi"} ➔ ${transport["toLocation"] || "Velaan Bay"}\n` +
      `*Status:* ${trip.status}\n\n` +
      `*Market Supplier:* ${trip["supplier"]} (Koyambedu Wholesale Mandi)\n` +
      `*Fleet / Purchase Manager:* ${transport["managerName"] || trip["managerName"]} (Ph: ${transport["managerPhone"] || trip["managerPhone"] || "—"})\n` +
      `*Transporter:* ${trip["transporter"]}\n` +
      `*Vehicle No:* ${trip["vehicle"]}\n` +
      `*Driver:* ${trip["driver"]} (Ph: ${transport["driverPhone"] || "—"})\n` +
      `*Freight Charges:* ₹${Number(transport["charges"] || 0).toLocaleString("en-IN")}\n` +
      `*Packaging:* ${trip["containerCount"]} ${trip["containerType"]}\n\n` +
      `*Consolidated Products to Procure:*\n${itemsText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Total Net Quantity:* ${Number(trip["net"]).toLocaleString("en-IN")} kg\n` +
      `*Total Purchase Value:* ₹${Number(trip["amount"]).toLocaleString("en-IN")}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Purchase Manager & Drivers: Verify produce quality, weighment, and collect physical DC signatures upon loading._`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  // WhatsApp share of entire or selected demand plan
  const handleWhatsAppProcurementSheet = (selectedOnly: boolean = false) => {
    const targetPlans = selectedOnly && selectedProducts.size > 0
      ? plans.filter((p) => selectedProducts.has(p.product))
      : plans;

    const itemsText = targetPlans
      .map((p) => {
        const bufferTag = p.extraKg > 0 ? ` [incl. +${p.extraKg} kg buffer]` : "";
        const balTag = p.balance > 0 ? `⚠️ *Buy: ${p.balance} kg*` : (p.reserved > 0 ? "🚚 Planned in Trip" : "✅ Fulfilled");
        const buyersList = p.buyers.map((b) => `${b.buyer} (${b.qty}kg)`).join(", ");
        return `• *${p.product}*: Demand ${p.demand} kg${bufferTag} | Mkt: ${p.purchased} kg | ${balTag}\n   _Buyers: ${buyersList}_`;
      })
      .join("\n");

    const sumDemand = round(targetPlans.reduce((s, p) => s + p.demand, 0));
    const sumBase = round(targetPlans.reduce((s, p) => s + p.baseDemand, 0));
    const sumExtra = round(targetPlans.reduce((s, p) => s + p.extraKg, 0));
    const sumPurchased = round(targetPlans.reduce((s, p) => s + p.purchased, 0));
    const sumBalance = round(targetPlans.reduce((s, p) => s + p.balance, 0));

    const message =
      `*Velaan Bay — Consolidated Buyer Demand & Procurement Sheet*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Date:* ${new Date().toISOString().slice(0, 10)}\n` +
      `*Items Count:* ${targetPlans.length} products\n` +
      `*Total Consolidated Demand:* ${sumDemand.toLocaleString("en-IN")} kg\n` +
      `*Base Buyer Demand:* ${sumBase.toLocaleString("en-IN")} kg\n` +
      `*Extra Buyer Buffer Margin:* +${sumExtra.toLocaleString("en-IN")} kg\n` +
      `*Purchased in Market:* ${sumPurchased.toLocaleString("en-IN")} kg\n` +
      `*Pending Market Buy:* ${sumBalance.toLocaleString("en-IN")} kg\n\n` +
      `*Product-wise Requirements:*\n${itemsText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Purchase Managers & Drivers: Please purchase the pending quantities at Koyambedu Wholesale Mandi._`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  // Export CSV with full Base + Extra Buffer breakdown
  const handleExportCsv = () => {
    const headers = [
      "Product",
      "Buyers",
      "Base Demand (KG)",
      "Extra Buffer (KG)",
      "Total Demand (KG)",
      "Purchased (KG)",
      "Planned in Trips (KG)",
      "Balance to Buy (KG)",
      "Status",
    ];
    const rows = plans.map((p) => {
      const buyersList = p.buyers.map((b) => `${b.buyer} (${b.baseQty}kg + ${b.extraKg}kg buffer)`).join("; ");
      const status = p.balance <= 0 ? (p.reserved > 0 ? "Planned" : "Fulfilled") : "Pending";
      return [
        `"${p.product}"`,
        `"${buyersList}"`,
        p.baseDemand,
        p.extraKg,
        p.demand,
        p.purchased,
        p.reserved,
        p.balance,
        `"${status}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Demand_Consolidation_Plan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Demand Consolidation CSV exported successfully.");
  };

  // Quick save buffer on a specific PO
  const handleSavePoBuffer = (poId: string, newBuffer: number) => {
    const po = (data["purchase-orders"] ?? []).find((x) => x.id === poId);
    if (!po) return;
    const ls = parseLines(po["item"]);
    const baseQty = ls.reduce((s, l) => s + (Number(l.q) || 0), 0);
    const updatedPo = normalize("purchase-orders", {
      ...po,
      extraKg: Math.max(0, newBuffer),
      qty: round(baseQty + Math.max(0, newBuffer)),
    });
    const err = validateData({
      ...data,
      "purchase-orders": (data["purchase-orders"] ?? []).map((x) => (x.id === poId ? updatedPo : x)),
    });
    if (err) {
      toast.error(err);
      return;
    }
    upsert("purchase-orders", updatedPo);
    toast.success(`${poId} extra buffer updated to +${newBuffer} kg. Total demand recalculated.`);
    setEditingPoBuffer(null);
  };

  // All Transport Movements with enriched supplier, buyer & product details
  const allTransportMovements = useMemo(() => {
    const list = data["transport"] ?? [];
    return [...list].reverse().map((mov) => {
      const dir = String(mov["direction"] || "Inward");
      const refId = String(mov["ref"] || "");
      let partyName = "";
      let partyRole = "";
      let itemsList: { p: string; q: number }[] = [];
      let containerText = "";

      if (dir === "Inward" || dir === "Inward Return") {
        const trip = (data["trips"] ?? []).find((t) => t.id === refId);
        partyName = String(trip?.["supplier"] || mov["supplier"] || "Koyambedu Wholesale Supplier");
        partyRole = "Supplier";
        itemsList = trip ? parseLines(trip["item"]) : parseLines(mov["item"]);
        containerText = trip?.["containerCount"] ? `${trip["containerCount"]} ${trip["containerType"]}` : "";
      } else if (dir === "Outward") {
        const so = (data["sales-orders"] ?? []).find((s) => s.id === refId);
        partyName = String(so?.["buyer"] || mov["buyer"] || "Direct Retail Buyer");
        partyRole = "Buyer";
        itemsList = so ? parseLines(so["item"]) : parseLines(mov["item"]);
      } else if (dir === "Outward Return") {
        const ret = (data["returns"] ?? []).find((r) => r.id === refId);
        partyName = String(ret?.["buyer"] || mov["buyer"] || "Buyer Store");
        partyRole = "Buyer (Return)";
        itemsList = ret ? parseLines(ret["item"]) : parseLines(mov["item"]);
      }

      return {
        ...mov,
        partyName,
        partyRole,
        itemsList,
        containerText,
      };
    });
  }, [data]);

  // Filtered transport movements
  const filteredTransportMovements = useMemo(() => {
    return allTransportMovements.filter((m) => {
      if (transportFilterTab !== "all" && m.direction !== transportFilterTab) return false;
      if (transportSearch.trim()) {
        const q = transportSearch.toLowerCase();
        const matchesId = String(m.id).toLowerCase().includes(q);
        const matchesRef = String(m["ref"]).toLowerCase().includes(q);
        const matchesTransporter = String(m["transporter"]).toLowerCase().includes(q);
        const matchesVehicle = String(m["vehicle"]).toLowerCase().includes(q);
        const matchesDriver = String(m["driver"]).toLowerCase().includes(q);
        const matchesParty = String(m.partyName).toLowerCase().includes(q);
        if (!matchesId && !matchesRef && !matchesTransporter && !matchesVehicle && !matchesDriver && !matchesParty) {
          return false;
        }
      }
      return true;
    });
  }, [allTransportMovements, transportFilterTab, transportSearch]);

  // Counts for transport direction tabs
  const inwardCount = useMemo(() => allTransportMovements.filter((m) => m.direction === "Inward").length, [allTransportMovements]);
  const inwardReturnCount = useMemo(() => allTransportMovements.filter((m) => m.direction === "Inward Return").length, [allTransportMovements]);
  const outwardCount = useMemo(() => allTransportMovements.filter((m) => m.direction === "Outward").length, [allTransportMovements]);
  const outwardReturnCount = useMemo(() => allTransportMovements.filter((m) => m.direction === "Outward Return").length, [allTransportMovements]);

  // Quick Transport Status Update
  const handleUpdateTransportStatus = (movId: string, nextStatus: "In transit" | "Delivered") => {
    const mov = (data["transport"] ?? []).find((m) => m.id === movId);
    if (!mov) return;
    const updatedMov = { ...mov, status: nextStatus };
    upsert("transport", updatedMov);

    // If it's an Inward trip, sync the trip status as well
    if (mov["ref"] && String(mov["direction"]).startsWith("Inward")) {
      const trip = (data["trips"] ?? []).find((t) => t.id === mov["ref"]);
      if (trip) {
        const tripNextStatus = nextStatus === "Delivered" ? "Submitted" : "Loading";
        const updatedTrip = normalize("trips", { ...trip, status: tripNextStatus });
        upsert("trips", updatedTrip);
      }
    }

    toast.success(`Transport ${movId} status updated to “${nextStatus}”.`);
  };

  // WhatsApp Gate Pass for individual movement
  const sendWhatsAppTransportSlip = (mov: typeof allTransportMovements[0]) => {
    const dir = String(mov.direction || "Inward");
    const itemsText = mov.itemsList.map((i) => `• ${i.p}: ${i.q} kg`).join("\n") || `• Produce Weight: ${mov.qty} kg`;

    const message =
      `*Velaan Bay — Vehicle Transport & Gate Pass Slip*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Movement Ref:* ${mov.id}\n` +
      `*Direction:* ${dir} (${dir.includes("Inward") ? "Supplier ➔ Bay" : "Bay ➔ Buyer"})\n` +
      `*Reference Order:* ${mov["ref"]}\n` +
      `*Date:* ${mov["date"]}\n` +
      `*Status:* ${mov["status"]}\n\n` +
      `*${mov.partyRole || "Party"}:* ${mov.partyName}\n` +
      (mov["managerName"] ? `*Fleet / Purchase Manager:* ${mov["managerName"]} (Ph: ${mov["managerPhone"] || "—"})\n` : "") +
      `*Transporter:* ${mov["transporter"]}\n` +
      `*Vehicle Number:* ${mov["vehicle"]}\n` +
      `*Driver:* ${mov["driver"]} (Ph: ${mov["driverPhone"] || "—"})\n` +
      `*Total Weight:* ${mov["qty"]} kg\n` +
      `*Transport Charges:* ₹${Number(mov["charges"] || 0).toLocaleString("en-IN")}\n` +
      (mov.containerText ? `*Containers:* ${mov.containerText}\n\n` : `\n`) +
      `*Produce Manifest:*\n${itemsText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Driver, please present this digital slip at the warehouse receiving/dispatch gate._`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {mod.stage} · {mod.flows}
          </p>
          <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">{mod.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{mod.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-xs hover:bg-muted"
          >
            <Download className="size-3.5" /> Export Sheet
          </Button>
          <Button
            onClick={() => handleWhatsAppProcurementSheet(false)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
          >
            <Share2 className="size-3.5" /> WhatsApp Mandi Sheet
          </Button>
          <Button
            onClick={handleOpenDefaultTripModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90"
          >
            <ShoppingCart className="size-3.5" /> Plan Market Trip
          </Button>
        </div>
      </div>

      {/* 4 Rich KPI Metric Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Buyer Demand */}
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <p className="text-xs font-medium uppercase tracking-wide">Total Buyer Demand</p>
            <Package className="size-4 text-primary" />
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">
            {totalDemand.toLocaleString("en-IN")}{" "}
            <span className="text-sm font-normal text-muted-foreground">kg</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {totalBaseDemand.toLocaleString("en-IN")} kg base + {totalExtraKg.toLocaleString("en-IN")} kg extra buffer
          </p>
        </div>

        {/* Extra Buffer Margin */}
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 shadow-card">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
            <p className="text-xs font-medium uppercase tracking-wide flex items-center gap-1">
              <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" /> Extra KG Buffer Margin
            </p>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
              Safety Margin
            </span>
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-amber-700 dark:text-amber-400">
            +{totalExtraKg.toLocaleString("en-IN")}{" "}
            <span className="text-sm font-normal text-amber-800/80 dark:text-amber-300/80">kg</span>
          </p>
          <p className="mt-1 text-[11px] text-amber-900/80 dark:text-amber-300/80">
            Aggregated contingency buffer across accepted buyer POs
          </p>
        </div>

        {/* Purchased in Market */}
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <p className="text-xs font-medium uppercase tracking-wide">Purchased in Market</p>
            <Truck className="size-4 text-emerald-600" />
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-primary">
            {totalPurchased.toLocaleString("en-IN")}{" "}
            <span className="text-sm font-normal text-muted-foreground">kg</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {totalReserved > 0 ? `${totalReserved} kg reserved in loading trips` : "Submitted market DC purchases"}
          </p>
        </div>

        {/* Balance to Buy */}
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <p className="text-xs font-medium uppercase tracking-wide">Balance to Buy</p>
            <ShoppingCart className={cn("size-4", totalBalance > 0 ? "text-amber-600" : "text-emerald-600")} />
          </div>
          <p
            className={cn(
              "mt-1 font-display text-2xl font-semibold",
              totalBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {totalBalance.toLocaleString("en-IN")}{" "}
            <span className="text-sm font-normal text-muted-foreground">kg</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {totalBalance > 0 ? "Pending market trip procurement" : "All product demand is covered"}
          </p>
        </div>
      </div>

      {/* Action Banner (Default Always Shown & Multi-Selection) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/10 p-3 shadow-xs">
        <div className="flex items-center gap-2">
          {selectedProducts.size > 0 ? (
            <>
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {selectedProducts.size}
              </span>
              <span className="text-xs font-semibold text-foreground">
                Products Selected ·{" "}
                <span className="text-primary font-bold">
                  {plans
                    .filter((p) => selectedProducts.has(p.product))
                    .reduce((s, p) => s + (p.balance > 0 ? p.balance : p.demand), 0)
                    .toLocaleString("en-IN")}{" "}
                  kg
                </span>{" "}
                procurement volume
              </span>
            </>
          ) : (
            <>
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                {plans.length}
              </span>
              <span className="text-xs font-semibold text-foreground">
                Active Demand Items ·{" "}
                <span className="text-primary font-bold">
                  {totalBalance > 0
                    ? `${totalBalance.toLocaleString("en-IN")} kg pending purchase`
                    : `${totalDemand.toLocaleString("en-IN")} kg total demand`}
                </span>
                <span className="text-muted-foreground ml-1.5 font-normal hidden sm:inline">
                  (select products or plan directly)
                </span>
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedProducts.size > 0 ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleWhatsAppProcurementSheet(true)}
                className="h-8 text-xs font-medium bg-card text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <Share2 className="size-3.5 mr-1" /> WhatsApp Selected
              </Button>
              <Button
                size="sm"
                onClick={() => openPlanTripModal(plans.filter((p) => selectedProducts.has(p.product)), "Inward")}
                className="h-8 bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:opacity-95"
              >
                <ShoppingCart className="size-3.5 mr-1.5" /> Plan Market Trip for Selected ({selectedProducts.size})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProducts(new Set())}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleWhatsAppProcurementSheet(false)}
                className="h-8 text-xs font-medium bg-card text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <Share2 className="size-3.5 mr-1" /> WhatsApp Mandi Sheet
              </Button>
              <Button
                size="sm"
                onClick={handleOpenDefaultTripModal}
                className="h-8 bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:opacity-95"
              >
                <ShoppingCart className="size-3.5 mr-1.5" /> Plan Market Trip
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Consolidation Table Card */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        {/* Search & Tabs Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3.5 bg-muted/30">
          <div className="relative min-w-64 flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products or buyers…"
              className="w-full rounded-lg border bg-background py-1.5 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1 text-xs">
            <button
              onClick={() => setFilterTab("all")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                filterTab === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Products ({plans.length})
            </button>
            <button
              onClick={() => setFilterTab("pending")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                filterTab === "pending"
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pending Buy
            </button>
            <button
              onClick={() => setFilterTab("fulfilled")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                filterTab === "fulfilled"
                  ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Fulfilled
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 w-10 text-center">
                  <button
                    onClick={handleSelectAll}
                    title="Select all products"
                    className="flex size-4 items-center justify-center rounded border border-muted-foreground/40 text-primary transition-colors hover:border-primary"
                  >
                    {selectedProducts.size === filteredPlans.length && filteredPlans.length > 0 ? (
                      <CheckSquare className="size-3.5 fill-primary text-primary-foreground" />
                    ) : (
                      <Square className="size-3.5 text-muted-foreground" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Buyer-Wise Demand Breakdown</th>
                <th className="px-4 py-3 text-right font-semibold">Base Demand</th>
                <th className="px-4 py-3 text-right font-semibold text-amber-700 dark:text-amber-400">
                  ➕ Extra Buffer
                </th>
                <th className="px-4 py-3 text-right font-semibold">Total Demand</th>
                <th className="px-4 py-3 text-right font-semibold">Purchased</th>
                <th className="px-4 py-3 text-right font-semibold">Balance to Buy</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPlans.map((p) => {
                const isSelected = selectedProducts.has(p.product);
                const pct = p.demand ? Math.min(100, (p.purchased / p.demand) * 100) : 0;

                return (
                  <tr
                    key={p.product}
                    className={cn(
                      "hover:bg-muted/20 transition-colors",
                      isSelected && "bg-primary-soft/30"
                    )}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleToggleSelectProduct(p.product)}
                        className="flex size-4 items-center justify-center rounded border border-muted-foreground/40 text-primary transition-colors hover:border-primary"
                      >
                        {isSelected ? (
                          <CheckSquare className="size-3.5 fill-primary text-primary-foreground" />
                        ) : (
                          <Square className="size-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </td>

                    {/* Product Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-primary" />
                        <span className="font-semibold text-foreground">{p.product}</span>
                      </div>
                    </td>

                    {/* Buyer-Wise Demand with clean badges */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {p.buyers.map((b) => (
                          <span
                            key={b.buyer}
                            title={`${b.pos.join(", ")} · Base: ${b.baseQty} kg${b.extraKg > 0 ? ` (+${b.extraKg} kg buffer)` : ""}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-foreground"
                          >
                            <Users className="size-3 text-primary" />
                            <span>{b.buyer}</span>
                            <span className="font-semibold text-primary">· {b.baseQty.toLocaleString("en-IN")} kg</span>
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Base Demand */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground font-medium">
                      {p.baseDemand.toLocaleString("en-IN")} kg
                    </td>

                    {/* Extra Buffer KG */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.extraKg > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          +{p.extraKg.toLocaleString("en-IN")} kg
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Total Demand */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-bold text-foreground text-sm block">
                        {p.demand.toLocaleString("en-IN")} kg
                      </span>
                    </td>

                    {/* Purchased in Market */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      <p className="font-medium text-foreground">{p.purchased.toLocaleString("en-IN")} kg</p>
                      <div className="ml-auto mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full transition-all", p.balance <= 0 ? "bg-emerald-500" : "bg-amber-500")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>

                    {/* Balance to Buy */}
                    <td
                      className={cn(
                        "px-4 py-3 text-right tabular-nums font-semibold",
                        p.balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {p.balance > 0 ? (
                        <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                          {p.balance.toLocaleString("en-IN")} kg
                        </span>
                      ) : p.reserved > 0 ? (
                        <span className="text-xs text-blue-600 font-medium">Planned in Trip</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                          <CheckCircle2 className="size-3" /> Fulfilled
                        </span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedProduct(p)}
                          className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                          title="View buyers, PO breakdown & adjust buffer"
                        >
                          <Eye className="size-3.5 mr-1" /> Details
                        </Button>
                        {/* Plan trip button commented out as requested */}
                        {/* <Button
                          onClick={() => openPlanTripModal([p], "Inward")}
                          size="sm"
                          className={cn(
                            "h-8 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-2xs transition-all",
                            p.balance > 0
                              ? "bg-primary text-primary-foreground hover:opacity-90"
                              : "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                          )}
                        >
                          <ShoppingCart className="size-3.5" /> Plan trip
                        </Button> */}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filteredPlans.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    {search ? `No products match "${search}".` : "No buyer demand found. Add buyer purchase orders first."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Submitted market trips update purchased quantities. Draft & Loading trips reserve balance.</span>
          </div>
          <Link
            to="/m/$module"
            params={{ module: "trips" }}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Go to market trips <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* COMPREHENSIVE LIVE TRANSPORT & LOGISTICS TRACKING (INWARD, INWARD RETURN, OUTWARD, OUTWARD RETURN) */}
      <div className="overflow-hidden rounded-2xl border bg-card p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Stage D · Logistics & Fleet Tracking
              </span>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {allTransportMovements.length} Total Movements
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground">
              Inward & Outward Transport Tracking (Supplier ➔ Bay ➔ Buyer)
            </h2>
            <p className="text-xs text-muted-foreground">
              Live tracking for Inward procurement, Inward returns to suppliers, Outward buyer deliveries, and Outward returns.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openPlanTripModal(plans.filter((p) => p.demand > 0), "Inward Return")}
              className="text-xs border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            >
              <RotateCcw className="size-3.5 mr-1" /> Return to Supplier (Inward Return)
            </Button>
            <Link
              to="/m/$module"
              params={{ module: "transport" }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline ml-2"
            >
              Transport Module <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>

        {/* Direction Filter Tabs & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-xl border">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setTransportFilterTab("all")}
              className={cn(
                "rounded-md px-3 py-1 font-semibold transition-all",
                transportFilterTab === "all"
                  ? "bg-card text-foreground shadow-xs border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Movements ({allTransportMovements.length})
            </button>
            <button
              onClick={() => setTransportFilterTab("Inward")}
              className={cn(
                "rounded-md px-3 py-1 font-semibold transition-all flex items-center gap-1.5",
                transportFilterTab === "Inward"
                  ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 shadow-xs border border-emerald-500/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Truck className="size-3.5 text-emerald-600" /> Inward ({inwardCount})
            </button>
            <button
              onClick={() => setTransportFilterTab("Inward Return")}
              className={cn(
                "rounded-md px-3 py-1 font-semibold transition-all flex items-center gap-1.5",
                transportFilterTab === "Inward Return"
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 shadow-xs border border-amber-500/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <RotateCcw className="size-3.5 text-amber-600" /> Inward Return ({inwardReturnCount})
            </button>
            <button
              onClick={() => setTransportFilterTab("Outward")}
              className={cn(
                "rounded-md px-3 py-1 font-semibold transition-all flex items-center gap-1.5",
                transportFilterTab === "Outward"
                  ? "bg-blue-500/15 text-blue-800 dark:text-blue-300 shadow-xs border border-blue-500/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Package className="size-3.5 text-blue-600" /> Outward ({outwardCount})
            </button>
            <button
              onClick={() => setTransportFilterTab("Outward Return")}
              className={cn(
                "rounded-md px-3 py-1 font-semibold transition-all flex items-center gap-1.5",
                transportFilterTab === "Outward Return"
                  ? "bg-purple-500/15 text-purple-800 dark:text-purple-300 shadow-xs border border-purple-500/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowLeftRight className="size-3.5 text-purple-600" /> Outward Return ({outwardReturnCount})
            </button>
          </div>

          <div className="relative min-w-56 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={transportSearch}
              onChange={(e) => setTransportSearch(e.target.value)}
              placeholder="Filter vehicle, driver, supplier…"
              className="w-full rounded-md border bg-background py-1 pl-8 pr-2.5 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Movements Grid */}
        {filteredTransportMovements.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTransportMovements.map((mov) => {
              const dir = String(mov.direction || "Inward");
              const isDelivered = mov.status === "Delivered";
              const isInTransit = mov.status === "In transit";

              // Color styles by direction
              const directionConfig = {
                Inward: {
                  badgeBg: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/25",
                  icon: <ArrowDownLeft className="size-3 text-emerald-600" />,
                  label: "Inward: Supplier ➔ Bay",
                },
                "Inward Return": {
                  badgeBg: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/25",
                  icon: <RotateCcw className="size-3 text-amber-600" />,
                  label: "Inward Return: Bay ➔ Supplier",
                },
                Outward: {
                  badgeBg: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/25",
                  icon: <ArrowUpRight className="size-3 text-blue-600" />,
                  label: "Outward: Bay ➔ Buyer",
                },
                "Outward Return": {
                  badgeBg: "bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/25",
                  icon: <ArrowLeftRight className="size-3 text-purple-600" />,
                  label: "Outward Return: Buyer ➔ Bay",
                },
              }[dir] || {
                badgeBg: "bg-muted text-foreground border",
                icon: <Truck className="size-3 text-primary" />,
                label: dir,
              };

              return (
                <div
                  key={mov.id}
                  className="rounded-xl border bg-card p-3.5 space-y-2.5 shadow-2xs hover:border-primary/40 transition-colors"
                >
                  {/* Top Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-primary">{mov.id}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">({mov["ref"]})</span>
                    </div>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        isDelivered
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : isInTransit
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                            : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      )}
                    >
                      {mov.status}
                    </span>
                  </div>

                  {/* Direction Badge */}
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border",
                        directionConfig.badgeBg
                      )}
                    >
                      {directionConfig.icon}
                      <span>{directionConfig.label}</span>
                    </span>
                  </div>

                  {/* Details Block */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{mov.partyRole || "Party"}:</span>
                      <span className="font-semibold text-foreground truncate max-w-[170px]" title={mov.partyName}>
                        {mov.partyName || "Direct Mandi / Buyer"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transporter:</span>
                      <span className="font-medium text-foreground truncate max-w-[170px]">
                        {mov["transporter"]}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehicle & Driver:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {mov["vehicle"]} · {mov["driver"]}
                      </span>
                    </div>
                    {mov.containerText && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Packaging:</span>
                        <span className="font-medium text-foreground">{mov.containerText}</span>
                      </div>
                    )}
                    {(mov.fromLocation || mov.toLocation) && (
                      <div className="flex items-start justify-between gap-1 text-[11px] pt-1 border-t">
                        <span className="text-muted-foreground shrink-0">Route:</span>
                        <span className="font-medium text-foreground text-right truncate">
                          {mov.fromLocation || "Origin"} ➔ {mov.toLocation || "Destination"}
                        </span>
                      </div>
                    )}
                    {mov["managerName"] && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Manager:</span>
                        <span className="font-medium text-foreground truncate max-w-[170px]" title={String(mov["managerName"])}>
                          {String(mov["managerName"])}
                          {mov["managerPhone"] ? ` · ${mov["managerPhone"]}` : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product & Weight Info */}
                  <div className="rounded-lg bg-muted/40 p-2 border text-[11px] space-y-1">
                    <div className="flex items-center justify-between font-semibold">
                      <span>Produce Weight:</span>
                      <span className="font-bold text-primary">{Number(mov["qty"]).toLocaleString("en-IN")} kg</span>
                    </div>
                    {Number(mov["charges"]) > 0 && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Freight Charges:</span>
                        <span className="font-semibold text-foreground">₹{Number(mov["charges"]).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {mov.itemsList.length > 0 && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {mov.itemsList.map((l) => `${l.p}: ${l.q}kg`).join(", ")}
                      </p>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendWhatsAppTransportSlip(mov)}
                      className="h-7 px-2 text-[11px] text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    >
                      <Share2 className="size-3 mr-1" /> Slip
                    </Button>

                    <div className="flex items-center gap-1.5">
                      {!isDelivered && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateTransportStatus(mov.id, isInTransit ? "Delivered" : "In transit")}
                          className={cn(
                            "h-7 px-2 text-[11px] font-semibold",
                            isInTransit
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          )}
                        >
                          {isInTransit ? "Mark Delivered" : "Dispatch"}
                        </Button>
                      )}

                      <Link
                        to="/m/$module"
                        params={{ module: "transport" }}
                        className="inline-flex items-center text-xs text-primary font-medium hover:underline ml-1"
                      >
                        Open <ExternalLink className="size-3 ml-0.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-6 text-center">
            {transportSearch
              ? `No transport movements match "${transportSearch}".`
              : "No transport movements recorded yet."}
          </p>
        )}
      </div>

      {/* PLAN MARKET TRIP & LOGISTICS CONFIRMATION MODAL */}
      {isTripModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/50 backdrop-blur-xs" onClick={() => setIsTripModalOpen(false)} />
          <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl border animate-in zoom-in-95 space-y-5">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                    Stage C & D · Market Procurement & Inward Logistics
                  </span>
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-bold uppercase",
                      tripDirection === "Inward"
                        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                        : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                    )}
                  >
                    {tripDirection === "Inward" ? "🚛 Inward: Mandi ➔ Bay" : "↩️ Inward Return: Bay ➔ Supplier"}
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-bold text-foreground">
                  {tripDirection === "Inward"
                    ? "Confirm Market Purchase & Inward Vehicle Dispatch"
                    : "Confirm Inward Return & Supplier Return Vehicle"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {tripDirection === "Inward"
                    ? "Creates both the Market Trip and the linked Inward Transport Movement with vehicle, driver, and container packaging."
                    : "Creates the Inward Return Transport Movement with supplier, container count, vehicle, driver, and dispatch schedule."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsTripModalOpen(false)}
                className="rounded-full"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Movement Direction Toggle */}
            <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20 text-xs">
              <span className="font-semibold text-foreground">Movement Type:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTripDirection("Inward");
                    setTripFromLocation("Koyambedu Wholesale Mandi (Supplier Stall)");
                    setTripToLocation("Velaan Bay Warehouse (Receiving Bay)");
                    setTripManagerName("Suresh Kumar (Purchase Manager)");
                    setTripManagerPhone("9840234567");
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all",
                    tripDirection === "Inward"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-card border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Truck className="size-3.5" /> Inward (Send Truck to Supplier)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTripDirection("Inward Return");
                    setTripFromLocation("Velaan Bay Warehouse (Receiving Bay)");
                    setTripToLocation("Koyambedu Wholesale Mandi (Supplier Stall)");
                    setTripManagerName("Karthik (Fleet & Bay Manager)");
                    setTripManagerPhone("9840234567");
                    if (!returnItems.length) {
                      setReturnItems([
                        {
                          supplier: suppliersList[0] || "Murugan Traders",
                          containerType: "Plastic crates",
                          returnCount: 10,
                        },
                      ]);
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all",
                    tripDirection === "Inward Return"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-card border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <RotateCcw className="size-3.5" /> Inward Return (Return to Supplier)
                </button>
              </div>
            </div>

            {/* CONDITIONAL LAYOUT: INWARD RETURN vs INWARD PROCUREMENT */}
            {tripDirection === "Inward Return" ? (
              <div className="space-y-4">
                {/* 1. Supplier & Container Return Information */}
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="size-4 text-amber-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Supplier & Container Return Details ({returnItems.length})
                      </h3>
                      <button
                        type="button"
                        onClick={handleAddReturnDetail}
                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/50 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors shadow-2xs"
                      >
                        <Plus className="size-3.5" /> Add Details
                      </button>
                    </div>
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Total Return Containers: {totalReturnContainers.toLocaleString("en-IN")} {totalReturnContainers === 1 ? "unit" : "units"}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border bg-background">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 text-muted-foreground font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left min-w-[200px]">Supplier *</th>
                          <th className="px-3 py-2 text-left min-w-[180px]">Container Type *</th>
                          <th className="px-3 py-2 text-right min-w-[140px]">Container Return Count *</th>
                          <th className="px-2 py-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {returnItems.map((detail, idx) => (
                          <tr key={idx} className="hover:bg-muted/15">
                            <td className="px-3 py-2.5">
                              <select
                                value={detail.supplier}
                                onChange={(e) => handleUpdateReturnDetail(idx, "supplier", e.target.value)}
                                className="w-full rounded-md border border-muted-foreground/30 bg-background px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-1 focus:ring-primary truncate"
                              >
                                {suppliersList.map((sup) => (
                                  <option key={sup} value={sup}>
                                    {sup}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2.5">
                              <select
                                value={detail.containerType}
                                onChange={(e) => handleUpdateReturnDetail(idx, "containerType", e.target.value)}
                                className="w-full rounded-md border border-muted-foreground/30 bg-background px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-1 focus:ring-primary truncate"
                              >
                                <option value="Plastic crates">Plastic crates (~20-25 kg)</option>
                                <option value="Gunny bags">Gunny bags (~50 kg)</option>
                                <option value="Wooden boxes">Wooden boxes (~20 kg)</option>
                                <option value="Carton boxes">Carton boxes (~15 kg)</option>
                              </select>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={detail.returnCount || ""}
                                onChange={(e) =>
                                  handleUpdateReturnDetail(idx, "returnCount", Math.max(1, parseInt(e.target.value, 10) || 0))
                                }
                                placeholder="e.g. 20"
                                className="w-28 rounded-md border border-muted-foreground/30 bg-background px-2.5 py-1.5 text-right text-xs font-bold tabular-nums outline-none focus:ring-1 focus:ring-primary ml-auto"
                              />
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <button
                                type="button"
                                title="Remove container return line"
                                disabled={returnItems.length <= 1}
                                onClick={() => handleRemoveReturnDetail(idx)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {returnItems.length > 1 && (
                        <tfoot className="bg-muted/40 font-semibold border-t">
                          <tr>
                            <td className="px-3 py-2 text-foreground font-bold">Total Return Sourcing</td>
                            <td className="px-3 py-2 text-muted-foreground font-medium">
                              {[...new Set(returnItems.map((r) => r.supplier))].length} suppliers · {returnItems.length} lines
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                              {totalReturnContainers.toLocaleString("en-IN")} units
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* 2. Transporter, Vehicle & Driver Information */}
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Truck className="size-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Transporter & Vehicle Details
                    </h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4 text-xs">
                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Transporter <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={tripTransporter}
                        onChange={(e) => handleTransporterChange(e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                      >
                        {transportersList.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Vehicle <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={tripVehicle}
                        onChange={(e) => setTripVehicle(e.target.value)}
                        placeholder="TN 09 AB 1234"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono font-semibold outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Driver <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={tripDriver}
                        onChange={(e) => setTripDriver(e.target.value)}
                        placeholder="Raja"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Driver Phone
                      </label>
                      <input
                        type="text"
                        value={tripDriverPhone}
                        onChange={(e) => setTripDriverPhone(e.target.value)}
                        placeholder="9840012345"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* From & To Route Locations */}
                  <div className="grid gap-3 sm:grid-cols-2 text-xs pt-2 border-t">
                    <div>
                      <label className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        From Location <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={tripFromLocation}
                        onChange={(e) => setTripFromLocation(e.target.value)}
                        placeholder="e.g. Velaan Bay Warehouse (Receiving Bay)"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Dispatch pickup / departure origin
                      </span>
                    </div>

                    <div>
                      <label className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                        <span className="size-2 rounded-full bg-blue-500" />
                        To Location <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={tripToLocation}
                        onChange={(e) => setTripToLocation(e.target.value)}
                        placeholder="e.g. Koyambedu Wholesale Mandi (Supplier Stall)"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Destination dropoff location
                      </span>
                    </div>
                  </div>

                  {/* Fleet & Bay Manager In-Charge */}
                  <div className="grid gap-3 sm:grid-cols-2 text-xs pt-2 border-t">
                    <div>
                      <label className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                        <UserCheck className="size-3.5 text-primary" />
                        Fleet / Bay Manager Name
                      </label>
                      <input
                        type="text"
                        value={tripManagerName}
                        onChange={(e) => setTripManagerName(e.target.value)}
                        placeholder="e.g. Karthik (Fleet & Bay Manager)"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Reverse dispatch supervisor in-charge
                      </span>
                    </div>

                    <div>
                      <label className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                        <Phone className="size-3.5 text-primary" />
                        Manager Contact / Phone
                      </label>
                      <input
                        type="text"
                        value={tripManagerPhone}
                        onChange={(e) => setTripManagerPhone(e.target.value)}
                        placeholder="9840234567"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Direct contact phone for reverse transport
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Trip Status, Date & Time Information */}
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Clock className="size-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Trip Status & Schedule
                    </h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 text-xs">
                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Trip Status <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={tripStatus}
                        onChange={(e) => setTripStatus(e.target.value as any)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="Scheduled">Scheduled</option>
                        <option value="In transit">In transit</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        Current reverse movement state
                      </span>
                    </div>

                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Date <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="date"
                        value={tripDate}
                        onChange={(e) => setTripDate(e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        Dispatch departure date
                      </span>
                    </div>

                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Time <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="time"
                        value={tripTime}
                        onChange={(e) => setTripTime(e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        Dispatch departure time
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Step 1: Products and Purchase Quantities */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Products to Procure ({tripItems.length})
                      </h3>
                      <button
                        type="button"
                        onClick={handleAddTripItem}
                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/50 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Plus className="size-3" /> Add Item
                      </button>
                    </div>
                    <span className="text-xs font-semibold text-primary">
                      Total Demand: {tripTotalDemand.toLocaleString("en-IN")} kg · Net Procure: {tripTotalNet.toLocaleString("en-IN")} kg ({tripTotalBoxes} {tripTotalBoxes === 1 ? "box" : "boxes"}) · Est. Value: ₹{tripTotalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 text-muted-foreground font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left min-w-[180px]">Product</th>
                          <th className="px-2 py-2 text-left min-w-[160px]">Supplier</th>
                          <th className="px-3 py-2 text-right">Total Demand</th>
                          <th className="px-2 py-2 text-left">Container</th>
                          <th className="px-2 py-2 text-right">Box Count</th>
                          <th className="px-3 py-2 text-right">Procure KG</th>
                          <th className="px-3 py-2 text-right">Rate / KG (₹)</th>
                          <th className="px-3 py-2 text-right">Amount (₹)</th>
                          <th className="px-2 py-2 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {tripItems.map((item, idx) => (
                          <tr key={`${item.product}-${idx}`} className="hover:bg-muted/15">
                            <td className="px-3 py-2.5 font-semibold text-foreground">
                              <select
                                value={item.product}
                                onChange={(e) => handleUpdateTripItemProduct(idx, e.target.value)}
                                className="w-full min-w-[170px] rounded-md border border-muted-foreground/30 bg-background px-2 py-1 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary truncate"
                              >
                                {ITEMS.map((prod) => (
                                  <option key={prod} value={prod}>
                                    {prod}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2.5 text-left">
                              <select
                                value={item.supplier}
                                onChange={(e) => handleUpdateTripItemSupplier(idx, e.target.value)}
                                className="w-full min-w-[150px] rounded-md border border-muted-foreground/30 bg-background px-2 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-primary truncate"
                              >
                                {suppliersList.map((sup) => (
                                  <option key={sup} value={sup}>
                                    {sup}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground font-semibold">
                              {item.totalDemand.toLocaleString("en-IN")} kg
                            </td>
                            <td className="px-2 py-2.5 text-left">
                              <select
                                value={item.containerType}
                                onChange={(e) => handleUpdateTripItemContainer(idx, e.target.value)}
                                className="w-28 rounded-md border border-muted-foreground/30 bg-background px-2 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="Plastic crates">Plastic crates</option>
                                <option value="Gunny bags">Gunny bags</option>
                                <option value="Wooden boxes">Wooden boxes</option>
                                <option value="Carton boxes">Carton boxes</option>
                              </select>
                            </td>
                            <td className="px-2 py-2.5 text-right">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.boxCount}
                                onChange={(e) => handleUpdateTripItemBoxCount(idx, Number(e.target.value))}
                                className="w-16 rounded-md border border-muted-foreground/30 bg-background px-2 py-1 text-right text-xs font-bold tabular-nums outline-none focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.qty}
                                onChange={(e) => handleUpdateTripItemQty(idx, Number(e.target.value))}
                                className="w-20 rounded-md border border-primary/40 bg-background px-2 py-1 text-right text-xs font-bold tabular-nums outline-none focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.rate}
                                onChange={(e) => handleUpdateTripItemRate(idx, Number(e.target.value))}
                                className="w-16 rounded-md border border-muted-foreground/30 bg-background px-2 py-1 text-right text-xs font-semibold tabular-nums outline-none focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-foreground">
                              ₹{round(item.qty * (item.rate || 0)).toLocaleString("en-IN")}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <button
                                type="button"
                                title="Remove item"
                                disabled={tripItems.length <= 1}
                                onClick={() => handleRemoveTripItem(idx)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/40 font-semibold border-t">
                        <tr>
                          <td className="px-3 py-2 text-foreground font-bold">
                            Total Market Trip Sourcing
                          </td>
                          <td className="px-2 py-2 text-left text-muted-foreground font-medium truncate">
                            {[...new Set(tripItems.map((i) => i.supplier).filter(Boolean))].length} suppliers
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-muted-foreground tabular-nums">
                            {tripTotalDemand.toLocaleString("en-IN")} kg
                          </td>
                          <td className="px-2 py-2 text-left text-muted-foreground font-medium">
                            {tripItems.length} {tripItems.length === 1 ? "item" : "items"}
                          </td>
                          <td className="px-2 py-2 text-right font-bold text-foreground tabular-nums">
                            {tripTotalBoxes} {tripTotalBoxes === 1 ? "box" : "boxes"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-primary tabular-nums">
                            {tripTotalNet.toLocaleString("en-IN")} kg
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                            Avg ₹{tripAvgRate}/kg
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-foreground tabular-nums">
                            ₹{tripTotalAmount.toLocaleString("en-IN")}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Logistics & Vehicle Details */}
                <div className="rounded-xl bg-muted/30 p-3.5 border text-xs space-y-3">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <label className="font-semibold text-muted-foreground block mb-1">
                        Transporter <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={tripTransporter}
                        onChange={(e) => handleTransporterChange(e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                      >
                        {transportersList.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-muted-foreground block mb-1">
                        Vehicle Number <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={tripVehicle}
                        onChange={(e) => setTripVehicle(e.target.value)}
                        placeholder="TN 09 AB 1234"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono font-semibold outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-muted-foreground block mb-1">
                        Driver Name <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={tripDriver}
                        onChange={(e) => setTripDriver(e.target.value)}
                        placeholder="Raja"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-muted-foreground block mb-1">
                        Driver Phone
                      </label>
                      <input
                        type="text"
                        value={tripDriverPhone}
                        onChange={(e) => setTripDriverPhone(e.target.value)}
                        placeholder="9840012345"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
                    <div>
                      <label className="font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        From Location <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={tripFromLocation}
                        onChange={(e) => setTripFromLocation(e.target.value)}
                        placeholder="e.g. Koyambedu Wholesale Mandi (Supplier Stall)"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Pickup / departure origin
                      </span>
                    </div>

                    <div>
                      <label className="font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                        <span className="size-2 rounded-full bg-blue-500" />
                        To Location <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={tripToLocation}
                        onChange={(e) => setTripToLocation(e.target.value)}
                        placeholder="e.g. Velaan Bay Warehouse (Receiving Bay)"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Destination receiving bay
                      </span>
                    </div>
                  </div>

                  {/* Fleet / Purchase Manager In-Charge */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
                    <div>
                      <label className="font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                        <UserCheck className="size-3.5 text-primary" />
                        Field / Purchase Manager Name
                      </label>
                      <input
                        type="text"
                        value={tripManagerName}
                        onChange={(e) => setTripManagerName(e.target.value)}
                        placeholder="e.g. Suresh Kumar (Purchase Manager)"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Procurement & fleet supervisor in-charge
                      </span>
                    </div>

                    <div>
                      <label className="font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                        <Phone className="size-3.5 text-primary" />
                        Manager Contact / Phone
                      </label>
                      <input
                        type="text"
                        value={tripManagerPhone}
                        onChange={(e) => setTripManagerPhone(e.target.value)}
                        placeholder="9840234567"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Mobile number for mandi dispatch & escalations
                      </span>
                    </div>
                  </div>
                </div>

                {/* Trip Status, Date & Time Information for Inward */}
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Clock className="size-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Trip Status & Schedule
                    </h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 text-xs">
                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Trip Status <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={tripStatus}
                        onChange={(e) => setTripStatus(e.target.value as any)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="Scheduled">Scheduled</option>
                        <option value="Loading">Loading</option>
                        <option value="In transit">In transit</option>
                        <option value="Submitted">Submitted</option>
                      </select>
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        Current market trip & procurement state
                      </span>
                    </div>

                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Date <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="date"
                        value={tripDate}
                        onChange={(e) => setTripDate(e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        Dispatch departure date
                      </span>
                    </div>

                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Time <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="time"
                        value={tripTime}
                        onChange={(e) => setTripTime(e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        Dispatch departure time
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTripModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleConfirmCreateTrip(true)}
                  className="h-9 inline-flex items-center gap-1.5 rounded-lg border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-semibold shadow-xs"
                >
                  <Share2 className="size-3.5" /> Confirm & Send WhatsApp
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleConfirmCreateTrip(false)}
                  className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95"
                >
                  <Check className="size-3.5" />
                  {tripDirection === "Inward Return"
                    ? `Confirm Inward Return (${totalReturnContainers} ${totalReturnContainers === 1 ? (returnItems[0]?.containerType || "container") : "containers"})`
                    : `Confirm & Create Trip (${tripTotalNet} kg)`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Demand Breakdown & PO Buffer Adjustment Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/40 backdrop-blur-xs" onClick={() => setSelectedProduct(null)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl border animate-in zoom-in-95 space-y-4">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                  Demand Breakdown & Buffer Control
                </span>
                <h2 className="mt-1 text-xl font-bold text-foreground">{selectedProduct.product}</h2>
                <p className="text-xs text-muted-foreground">
                  Consolidated buyer purchase orders, base demand, and extra KG buffer allocation.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedProduct(null)}
                className="rounded-full"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Metrics Overview in Modal */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl bg-muted/40 p-3 border text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Base Demand</span>
                <span className="font-bold text-foreground text-sm mt-0.5 block">
                  {selectedProduct.baseDemand.toLocaleString("en-IN")} kg
                </span>
              </div>
              <div>
                <span className="text-amber-800 dark:text-amber-300 block text-[11px] font-medium flex items-center gap-0.5">
                  <ShieldAlert className="size-3 text-amber-600" /> Extra Buffer
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-400 text-sm mt-0.5 block">
                  +{selectedProduct.extraKg.toLocaleString("en-IN")} kg
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Consolidated</span>
                <span className="font-bold text-primary text-sm mt-0.5 block">
                  {selectedProduct.demand.toLocaleString("en-IN")} kg
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Purchased</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 block">
                  {selectedProduct.purchased.toLocaleString("en-IN")} kg
                </span>
              </div>
            </div>

            {/* Contributing Buyer Purchase Orders Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contributing Buyer Orders ({selectedProduct.buyers.reduce((a, b) => a + b.pos.length, 0)} POs)
              </h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">PO Reference</th>
                      <th className="px-3 py-2 text-left">Buyer Name</th>
                      <th className="px-3 py-2 text-right">Base KG</th>
                      <th className="px-3 py-2 text-right text-amber-700 dark:text-amber-400">Extra Buffer</th>
                      <th className="px-3 py-2 text-right">Total Demand</th>
                      <th className="px-3 py-2 text-center">Adjust Buffer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedProduct.buyers.flatMap((b) =>
                      b.pos.map((poId) => {
                        const po = (data["purchase-orders"] ?? []).find((x) => x.id === poId);
                        const lines = po ? parseLines(po["item"]) : [];
                        const line = lines.find((l) => l.p === selectedProduct.product);
                        const totalBase = lines.reduce((s, x) => s + (Number(x.q) || 0), 0);
                        const lineBase = line ? Number(line.q) || 0 : 0;
                        const poExtra = Number(po?.["extraKg"]) || 0;
                        const ratio = totalBase > 0 ? lineBase / totalBase : 1 / Math.max(1, lines.length);
                        const lineExtra = poExtra > 0 ? round(poExtra * ratio) : 0;
                        const lineTotal = round(lineBase + lineExtra);

                        const isEditing = editingPoBuffer?.poId === poId;

                        return (
                          <tr key={poId} className="hover:bg-muted/20">
                            <td className="px-3 py-2.5 font-mono font-bold text-primary">{poId}</td>
                            <td className="px-3 py-2.5 font-medium text-foreground">{b.buyer}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground font-medium">
                              {lineBase} kg
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {lineExtra > 0 ? (
                                <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 font-bold text-amber-800 dark:text-amber-300">
                                  +{lineExtra} kg
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-foreground">
                              {lineTotal} kg
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {isEditing ? (
                                <div className="inline-flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    defaultValue={poExtra}
                                    id={`po-buffer-input-${poId}`}
                                    className="w-16 rounded border border-amber-500/40 bg-background px-1.5 py-0.5 text-right text-xs font-bold outline-none"
                                  />
                                  <Button
                                    size="sm"
                                    className="h-6 px-2 text-[10px] bg-primary text-primary-foreground"
                                    onClick={() => {
                                      const input = document.getElementById(
                                        `po-buffer-input-${poId}`
                                      ) as HTMLInputElement;
                                      const val = Number(input?.value) || 0;
                                      handleSavePoBuffer(poId, val);
                                    }}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-1 text-[10px]"
                                    onClick={() => setEditingPoBuffer(null)}
                                  >
                                    ✕
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingPoBuffer({ poId, buffer: poExtra })}
                                  className="h-6 px-2 text-[11px] rounded-md border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10"
                                >
                                  {poExtra > 0 ? `Edit (+${poExtra}kg)` : "+ Add Buffer"}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="bg-muted/40 font-semibold text-xs border-t">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-foreground font-bold">
                        Consolidated Demand for {selectedProduct.product}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {selectedProduct.baseDemand} kg
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400 font-bold">
                        +{selectedProduct.extraKg} kg
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-primary font-bold">
                        {selectedProduct.demand} kg
                      </td>
                      <td className="px-3 py-2" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const spec =
                    PRODUCT_CATALOG.find((x) => x.name.toLowerCase() === selectedProduct.product.toLowerCase()) ||
                    { defaultPackSize: "1 kg" };
                  const buyersText = selectedProduct.buyers
                    .map((b) => `• ${b.buyer}: ${b.baseQty} kg${b.extraKg > 0 ? ` (+${b.extraKg} kg buffer)` : ""}`)
                    .join("\n");
                  const msg =
                    `*Velaan Bay — Product Procurement Requirement*\n` +
                    `*Product:* ${selectedProduct.product} (${spec.defaultPackSize})\n` +
                    `*Total Demand:* ${selectedProduct.demand} kg (Base: ${selectedProduct.baseDemand} kg + Buffer: ${selectedProduct.extraKg} kg)\n` +
                    `*Purchased:* ${selectedProduct.purchased} kg\n\n` +
                    `*Buyer Demand Breakdown:*\n${buyersText}\n\n` +
                    `_Please procure balance produce at market._`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
                }}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"
              >
                <Share2 className="size-3.5" /> Share on WhatsApp
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)} className="text-xs">
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const targetProduct = selectedProduct;
                    setSelectedProduct(null);
                    openPlanTripModal([targetProduct], "Inward");
                  }}
                  className="bg-primary text-primary-foreground text-xs font-semibold"
                >
                  <ShoppingCart className="size-3.5 mr-1" /> Plan Market Trip
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
