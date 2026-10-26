import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Wallet, Building2, Users, Truck, Download, Search,
  ArrowUpRight, ArrowDownLeft, ShieldAlert,
  Calendar, CreditCard, Plus, RefreshCw, X, CheckCircle2,
  Receipt, FileText, AlertCircle, ArrowRight
} from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { num, round, buysFromTrip, lines, parseLines } from "@/lib/workflow";
import { fmtMoney, type ModuleDef, BUYERS, SUPPLIERS } from "@/lib/modules";
import { canViewPrice, maskPriceIfRestricted } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type LedgerType = "supplier" | "buyer" | "agent";

interface LedgerEntry {
  id: string;
  date: string;
  ref: string;
  party: string;
  type: string;
  particulars: string;
  debit: number;   // Amount charged/owed by party or paid out
  credit: number;  // Amount credited to party or received from party
  balance: number; // Running balance
  status: string;
}

export function LedgersPage({ mod }: { mod?: ModuleDef }) {
  const { data, role, upsert, nextId, purgeDummyLedgers } = useStore();
  const [activeLedger, setActiveLedger] = useState<LedgerType>("buyer"); // Default to Buyer ledger as requested
  const [selectedParty, setSelectedParty] = useState<string>("all");
  const [q, setQ] = useState<string>("");

  // Modal Dialog States for Real-Time Data Entry
  const [showBuyerModal, setShowBuyerModal] = useState<boolean>(false);
  const [showSupplierModal, setShowSupplierModal] = useState<boolean>(false);
  const [showTransporterModal, setShowTransporterModal] = useState<boolean>(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState<boolean>(false);

  // Buyer Receipt Form State
  const [buyerParty, setBuyerParty] = useState<string>(BUYERS[0]);
  const [buyerAmount, setBuyerAmount] = useState<string>("");
  const [buyerInvoiceRef, setBuyerInvoiceRef] = useState<string>("");
  const [buyerMode, setBuyerMode] = useState<string>("NEFT");
  const [buyerDate, setBuyerDate] = useState<string>("2026-10-22");
  const [buyerNote, setBuyerNote] = useState<string>("");
  const [buyerIsAdvance, setBuyerIsAdvance] = useState<boolean>(false);

  // Supplier Payment Form State
  const [supplierParty, setSupplierParty] = useState<string>(SUPPLIERS[0]);
  const [supplierAmount, setSupplierAmount] = useState<string>("");
  const [supplierTripRef, setSupplierTripRef] = useState<string>("");
  const [supplierMode, setSupplierMode] = useState<string>("NEFT");
  const [supplierDate, setSupplierDate] = useState<string>("2026-10-22");
  const [supplierNote, setSupplierNote] = useState<string>("");
  const [supplierIsAdvance, setSupplierIsAdvance] = useState<boolean>(false);

  // Transporter Payment Form State
  const [transporterParty, setTransporterParty] = useState<string>("Chennai Fresh Logistics");
  const [transporterAmount, setTransporterAmount] = useState<string>("");
  const [transporterTripRef, setTransporterTripRef] = useState<string>("");
  const [transporterMode, setTransporterMode] = useState<string>("NEFT");
  const [transporterDate, setTransporterDate] = useState<string>("2026-10-22");
  const [transporterNote, setTransporterNote] = useState<string>("");

  // Credit Note Form State
  const [cnBuyer, setCnBuyer] = useState<string>(BUYERS[0]);
  const [cnAmount, setCnAmount] = useState<string>("");
  const [cnInvoice, setCnInvoice] = useState<string>("");
  const [cnKind, setCnKind] = useState<string>("Return Adjustment");
  const [cnNote, setCnNote] = useState<string>("");

  // Helpers to detect phantom / disconnected dummy test seeds
  const isPhantomVoucher = (refStr: string, amt: number) => {
    return refStr.includes("0998") || refStr.includes("0991") || refStr.includes("PRC-1001") || refStr.includes("PRC-1002") || (refStr === "INV-1002" && amt === 15500);
  };

  const suppliersList = useMemo(() => {
    const fromTrips = (data["trips"] ?? []).map((t) => String(t["supplier"] || "")).filter(Boolean);
    const fromMaster = (data["suppliers"] ?? []).map((s) => String(s["name"] || "")).filter(Boolean);
    return Array.from(new Set([...fromTrips, ...fromMaster, ...SUPPLIERS])).filter(Boolean);
  }, [data]);

  const buyersList = useMemo(() => {
    const fromOrders = (data["sales-orders"] ?? []).map((so) => String(so["buyer"] || "")).filter(Boolean);
    const fromInvoices = (data["invoices"] ?? []).map((inv) => String(inv["buyer"] || "")).filter(Boolean);
    const fromMaster = (data["buyers"] ?? []).map((b) => String(b["name"] || "")).filter(Boolean);
    return Array.from(new Set([...fromOrders, ...fromInvoices, ...fromMaster, ...BUYERS])).filter(Boolean);
  }, [data]);

  const agentsList = useMemo(() => {
    const fromTransporters = (data["transporters"] ?? []).map((t) => String(t["name"] || "")).filter(Boolean);
    const fromTransport = (data["transport"] ?? []).map((t) => String(t["transporter"] || "")).filter(Boolean);
    return Array.from(new Set([...fromTransporters, ...fromTransport, "Chennai Fresh Logistics"]));
  }, [data]);

  // Build Supplier Ledger Entries (Purely from Real Purchases & Payments)
  const supplierLedger = useMemo<LedgerEntry[]>(() => {
    const rawEntries: LedgerEntry[] = [];
    const trips = data["trips"] ?? [];
    const payments = data["supplier-payments"] ?? [];
    const supplierPrices = data["supplier-prices"] ?? [];

    // 1. Real Market Purchases from Trips
    trips.forEach((t) => {
      const buys = buysFromTrip(t);
      if (buys.length) {
        buys.forEach((b, idx) => {
          const supp = b.s || String(t["supplier"] || "General Supplier");
          const cost = round(b.q * b.r);
          rawEntries.push({
            id: `${t.id}-${idx}`,
            date: String(t["date"] || "2026-10-22"),
            ref: t.id,
            party: supp,
            type: "Market Purchase",
            particulars: `${b.p}: ${b.q} kg @ ₹${b.r}/kg (Vehicle: ${t["vehicle"] || "TN 09 AB 1234"})`,
            debit: 0,
            credit: cost,
            balance: 0,
            status: String(t.status || "Submitted"),
          });
        });
      } else {
        const supp = String(t["supplier"] || "General Supplier");
        const cost = num(t["amount"]) || round(num(t["net"]) * num(t["rate"]));
        rawEntries.push({
          id: t.id,
          date: String(t["date"] || "2026-10-22"),
          ref: t.id,
          party: supp,
          type: "Market Purchase",
          particulars: `${lines(t).map((l) => `${l.p} (${l.q} kg)`).join(", ")} @ ₹${t["rate"] || 0}/kg`,
          debit: 0,
          credit: cost,
          balance: 0,
          status: String(t.status || "Submitted"),
        });
      }
    });

    // Confirmed Prices adjustments (if not already accounted for by DC)
    supplierPrices.forEach((sp) => {
      const supp = String(sp["supplier"] || "Supplier");
      const cost = num(sp["amount"]);
      if (!trips.some((t) => t.id === sp["dc"])) {
        const ls = parseLines(sp["item"]);
        const particulars = ls.length > 1
          ? `Confirmed Price: ${ls.map((l) => `${l.p} (${l.q} kg @ ₹${l.r ?? sp["rate"] ?? 0}/kg)`).join(", ")}`
          : `Confirmed Price: ${sp["qty"] || 0} kg @ ₹${sp["rate"] || 0}/kg`;
        rawEntries.push({
          id: sp.id,
          date: String(sp["date"] || "2026-10-22"),
          ref: String(sp["dc"] || sp.id),
          party: supp,
          type: "Price Settlement",
          particulars,
          debit: 0,
          credit: cost,
          balance: 0,
          status: String(sp.status || "Confirmed"),
        });
      }
    });

    // 2. Real Payments to Suppliers (Filtered to remove dummy phantom vouchers)
    payments.forEach((p) => {
      const supp = String(p["supplier"] || "Supplier");
      const amt = num(p["amount"]);
      const refStr = String(p["ref"] || "");
      if (isPhantomVoucher(refStr, amt)) return;

      const isAdv = Boolean(p["isAdvance"] || refStr.toLowerCase().includes("advance") || String(p["note"] || "").toLowerCase().includes("advance"));

      rawEntries.push({
        id: p.id,
        date: String(p["date"] || "2026-10-22"),
        ref: p.id,
        party: supp,
        type: isAdv ? "Supplier Advance" : `Payment (${p["mode"] || "NEFT"})`,
        particulars: isAdv
          ? `Supplier Advance payout via ${p["mode"] || "Bank"}`
          : `Supplier payout against ${p["ref"] || "Open Balance"} via ${p["mode"] || "Bank"}`,
        debit: amt,
        credit: 0,
        balance: 0,
        status: String(p.status || "Paid"),
      });
    });

    // Sort ascending by date
    rawEntries.sort((a, b) => a.date.localeCompare(b.date));
    return rawEntries;
  }, [data]);

  // Build Buyer Ledger Entries (Real Sales, Invoices, Collections, Returns & Credit Notes)
  const buyerLedger = useMemo<LedgerEntry[]>(() => {
    const rawEntries: LedgerEntry[] = [];
    const invoices = data["invoices"] ?? [];
    const salesOrders = data["sales-orders"] ?? [];
    const receipts = data["buyer-payments"] ?? [];
    const creditNotes = data["credit-notes"] ?? [];
    const returns = data["returns"] ?? [];

    // Track invoice IDs and linked sales order IDs to avoid duplicate billing
    const invoicedSaleOrderIds = new Set<string>();

    // 1. Sales Invoices
    invoices.forEach((inv) => {
      const buyer = String(inv["buyer"] || "Direct Buyer");
      const amt = num(inv["total"]) || num(inv["taxable"]);
      const dcRef = String(inv["dc"] || "");
      if (dcRef) invoicedSaleOrderIds.add(dcRef);

      // Check if this invoice links to a known SO directly
      const matchingSo = salesOrders.find(so => so.id === dcRef || (data["dispatch"] ?? []).some(d => d.id === dcRef && d["so"] === so.id));
      if (matchingSo) invoicedSaleOrderIds.add(matchingSo.id);

      rawEntries.push({
        id: inv.id,
        date: String(inv["date"] || "2026-10-22"),
        ref: inv.id,
        party: buyer,
        type: "Tax Invoice",
        particulars: `Sales Invoice against Dispatch ${inv["dc"] || "—"} (Taxable: ₹${inv["taxable"] || amt})`,
        debit: amt,
        credit: 0,
        balance: 0,
        status: String(inv.status || "Issued"),
      });
    });

    // 2. Dispatched / Confirmed / Closed Sales Orders NOT yet in invoices (Real-time live flow!)
    salesOrders.forEach((so) => {
      if (["Dispatched", "Closed", "Confirmed"].includes(so.status) && !invoicedSaleOrderIds.has(so.id)) {
        // Also check if any invoice matches this buyer and order value
        const isMatched = invoices.some(inv => inv["buyer"] === so["buyer"] && num(inv["total"]) === num(so["value"]));
        if (!isMatched) {
          const buyer = String(so["buyer"] || "Direct Buyer");
          const amt = num(so["value"]) || round(num(so["qty"]) * num(so["rate"]));
          rawEntries.push({
            id: so.id,
            date: String(so["date"] || "2026-10-22"),
            ref: so.id,
            party: buyer,
            type: "Sales Order",
            particulars: `${lines(so).map(l => `${l.p} (${l.q} kg)`).join(", ")} @ ₹${so["rate"] || 0}/kg (Demand: ${so["po"] || "—"})`,
            debit: amt,
            credit: 0,
            balance: 0,
            status: String(so.status || "Dispatched"),
          });
        }
      }
    });

    // 3. Buyer Payments Received (Exclude phantom seeds)
    receipts.forEach((r) => {
      const buyer = String(r["buyer"] || "Direct Buyer");
      const amt = num(r["amount"]);
      const invRef = String(r["invoice"] || "");
      if (isPhantomVoucher(invRef, amt)) return;

      const isAdv = Boolean(r["isAdvance"] || invRef.toLowerCase().includes("advance") || String(r["note"] || "").toLowerCase().includes("advance"));

      rawEntries.push({
        id: r.id,
        date: String(r["date"] || "2026-10-22"),
        ref: r.id,
        party: buyer,
        type: isAdv ? "Advance Receipt" : `Collection (${r["mode"] || "UPI"})`,
        particulars: isAdv
          ? `Advance payment received from ${buyer} via ${r["mode"] || "Bank"}`
          : `Received from buyer against ${r["invoice"] || "Ledger Balance"} via ${r["mode"] || "Bank"}`,
        debit: 0,
        credit: amt,
        balance: 0,
        status: String(r.status || "Reconciled"),
      });
    });

    // 4. Return Credit Notes
    creditNotes.forEach((cn) => {
      const buyer = String(cn["buyer"] || "Direct Buyer");
      const amt = num(cn["amount"]);
      const invRef = String(cn["invoice"] || "");
      if (isPhantomVoucher(invRef, amt)) return;

      rawEntries.push({
        id: cn.id,
        date: String(cn["date"] || "2026-10-22"),
        ref: cn.id,
        party: buyer,
        type: `Credit Note (${cn["kind"] || "Return"})`,
        particulars: `Credit adjustment: ${cn["note"] || "Return of damaged items"} (Inv: ${cn["invoice"] || "—"})`,
        debit: 0,
        credit: amt,
        balance: 0,
        status: String(cn.status || "Issued"),
      });
    });

    // 5. Approved/Received Returns not yet converted to credit note (real-time return protection!)
    returns.forEach((ret) => {
      const buyer = String(ret["buyer"] || "Direct Buyer");
      const hasCreditNote = creditNotes.some(cn => cn["buyer"] === buyer && (String(cn["note"]).includes(ret.id) || num(cn["amount"]) > 0));
      if (!hasCreditNote && ["Received", "Sent to QC", "Approved"].includes(ret.status)) {
        // Find sale rate
        const sale = salesOrders.find(s => s.id === ret["sale"]);
        const rate = sale ? num(sale["rate"]) : 42;
        const returnAmt = round(num(ret["qty"]) * rate);
        if (returnAmt > 0) {
          rawEntries.push({
            id: ret.id,
            date: String(ret["date"] || "2026-10-22"),
            ref: ret.id,
            party: buyer,
            type: "Sales Return",
            particulars: `${ret["qty"] || 0} kg returned: ${ret["reason"] || "QC Issue"} (Original Sale: ${ret["sale"] || "—"})`,
            debit: 0,
            credit: returnAmt,
            balance: 0,
            status: String(ret.status || "Received"),
          });
        }
      }
    });

    // Sort ascending by date
    rawEntries.sort((a, b) => a.date.localeCompare(b.date));
    return rawEntries;
  }, [data]);

  // Build Agent & Transporter Ledger Entries
  const agentLedger = useMemo<LedgerEntry[]>(() => {
    const rawEntries: LedgerEntry[] = [];
    const transport = data["transport"] ?? [];
    const dispatch = data["dispatch"] ?? [];
    const expenses = data["expenses"] ?? [];

    // 1. Inward Transport Freight
    transport.forEach((t) => {
      const transporter = String(t["transporter"] || "Chennai Fresh Logistics");
      const charges = num(t["charges"]) || 500;
      rawEntries.push({
        id: t.id,
        date: String(t["date"] || "2026-10-22"),
        ref: t.id,
        party: transporter,
        type: `Freight (${t["direction"] || "Inward"})`,
        particulars: `${t["direction"] || "Inward"} haulage ref ${t["ref"] || "—"} (${t["qty"] || 0} kg in ${t["vehicle"] || "Vehicle"})`,
        debit: 0,
        credit: charges,
        balance: 0,
        status: String(t.status || "Delivered"),
      });
    });

    // 2. Outward Dispatch Charges
    dispatch.forEach((d) => {
      const transporter = String(d["transporter"] || "Chennai Fresh Logistics");
      const charges = num(d["charges"]) || 250;
      rawEntries.push({
        id: d.id,
        date: String(d["date"] || "2026-10-22"),
        ref: d.id,
        party: transporter,
        type: "Dispatch Freight",
        particulars: `Delivery to ${d["buyer"] || "Buyer"} (${d["qty"] || 0} kg in ${d["vehicle"] || "Truck"})`,
        debit: 0,
        credit: charges,
        balance: 0,
        status: String(d.status || "Delivered"),
      });
    });

    // 3. Freight Settlements / Payouts from Expenses
    expenses.filter((e) => String(e["category"]).toLowerCase().includes("transport") || String(e["category"]).toLowerCase().includes("freight")).forEach((e) => {
      const transporter = String(e["vendor"] || "Chennai Fresh Logistics");
      const amt = num(e["amount"]);
      rawEntries.push({
        id: e.id,
        date: String(e["date"] || "2026-10-22"),
        ref: e.id,
        party: transporter,
        type: "Freight Settlement",
        particulars: `Payment for haulage / commission (${e["notes"] || "Freight disbursement"})`,
        debit: amt,
        credit: 0,
        balance: 0,
        status: "Paid",
      });
    });

    // Sort ascending by date
    rawEntries.sort((a, b) => a.date.localeCompare(b.date));
    return rawEntries;
  }, [data]);

  // Active Entries based on selected tab and party filter, with ACCURATE running balance
  const currentEntries = useMemo(() => {
    let list: LedgerEntry[] = [];
    if (activeLedger === "supplier") list = supplierLedger;
    else if (activeLedger === "buyer") list = buyerLedger;
    else list = agentLedger;

    if (selectedParty !== "all") {
      list = list.filter((e) => e.party === selectedParty);
    }

    if (q.trim()) {
      const term = q.trim().toLowerCase();
      list = list.filter((e) =>
        e.ref.toLowerCase().includes(term) ||
        e.party.toLowerCase().includes(term) ||
        e.particulars.toLowerCase().includes(term) ||
        e.type.toLowerCase().includes(term)
      );
    }

    // Accurately compute running balance on the filtered statement
    let running = 0;
    return list.map((e) => {
      if (activeLedger === "buyer") {
        running += e.debit - e.credit;
      } else {
        running += e.credit - e.debit;
      }
      return { ...e, balance: running };
    });
  }, [activeLedger, supplierLedger, buyerLedger, agentLedger, selectedParty, q]);

  // Aggregate Totals
  const totalDebit = currentEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = currentEntries.reduce((s, e) => s + e.credit, 0);
  const netBalance = activeLedger === "buyer" ? (totalDebit - totalCredit) : (totalCredit - totalDebit);

  // Calculate live party balance for real-time modal display
  const getPartyLiveBalance = (party: string, type: LedgerType) => {
    let pool: LedgerEntry[] = [];
    if (type === "buyer") pool = buyerLedger;
    else if (type === "supplier") pool = supplierLedger;
    else pool = agentLedger;

    const filtered = pool.filter(e => e.party === party);
    const deb = filtered.reduce((s, e) => s + e.debit, 0);
    const crd = filtered.reduce((s, e) => s + e.credit, 0);
    return type === "buyer" ? (deb - crd) : (crd - deb);
  };

  // Open Invoices for selected buyer in modal
  const buyerOpenInvoices = useMemo(() => {
    const list = (data["invoices"] ?? []).filter(inv => inv["buyer"] === buyerParty);
    // Also include sales orders if not yet invoiced
    const sos = (data["sales-orders"] ?? []).filter(so => so["buyer"] === buyerParty && ["Dispatched", "Closed", "Confirmed"].includes(so.status));
    const combined: { id: string; label: string; amount: number }[] = [];
    list.forEach(inv => {
      combined.push({
        id: inv.id,
        label: `${inv.id} · Tax Invoice (₹${inv["total"] || inv["taxable"] || 0})`,
        amount: num(inv["total"]) || num(inv["taxable"]) || 0
      });
    });
    sos.forEach(so => {
      if (!list.some(inv => inv["dc"] === so.id)) {
        combined.push({
          id: so.id,
          label: `${so.id} · Sales Order (${lines(so).map(l => l.p).join(", ")}) (₹${so["value"] || 0})`,
          amount: num(so["value"])
        });
      }
    });
    return combined;
  }, [data, buyerParty]);

  // Open Trips for selected supplier in modal
  const supplierOpenTrips = useMemo(() => {
    const trips = (data["trips"] ?? []).filter(t => t["supplier"] === supplierParty);
    return trips.map(t => ({
      id: t.id,
      label: `${t.id} · ${lines(t).map(l => `${l.p} (${l.q} kg)`).join(", ")} (₹${t["amount"] || 0})`,
      amount: num(t["amount"])
    }));
  }, [data, supplierParty]);

  // Handler: Record Buyer Payment in Real-Time
  const handleSaveBuyerReceipt = () => {
    const amt = Number(buyerAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid receipt amount");
      return;
    }
    const newId = nextId("buyer-payments");
    upsert("buyer-payments", {
      id: newId,
      date: buyerDate,
      buyer: buyerParty,
      invoice: buyerIsAdvance ? "Advance" : (buyerInvoiceRef || "General Ledger Balance"),
      mode: buyerMode,
      amount: amt,
      status: "Reconciled",
      isAdvance: buyerIsAdvance,
      note: buyerNote || (buyerIsAdvance ? `Advance receipt from ${buyerParty}` : `Payment received from ${buyerParty}`),
      responsible: "Ravi Kumar"
    });

    // If an invoice is referenced, update its status
    if (!buyerIsAdvance && buyerInvoiceRef && buyerInvoiceRef.startsWith("INV")) {
      const inv = (data["invoices"] ?? []).find(i => i.id === buyerInvoiceRef);
      if (inv) {
        const prevPaid = num(inv["paid"]);
        const totalAmt = num(inv["total"]) || num(inv["taxable"]);
        const newPaid = prevPaid + amt;
        upsert("invoices", {
          ...inv,
          paid: newPaid,
          status: newPaid >= totalAmt ? "Paid" : "Part paid"
        });
      }
    }

    setShowBuyerModal(false);
    setBuyerAmount("");
    setBuyerNote("");
    setBuyerIsAdvance(false);
    toast.success(`${buyerIsAdvance ? "Advance Receipt" : "Receipt"} ${newId} of ₹${amt.toLocaleString("en-IN")} recorded for ${buyerParty}`);
  };

  // Handler: Record Supplier Payment in Real-Time
  const handleSaveSupplierPayout = () => {
    const amt = Number(supplierAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid payout amount");
      return;
    }
    const newId = nextId("supplier-payments");
    upsert("supplier-payments", {
      id: newId,
      date: supplierDate,
      supplier: supplierParty,
      ref: supplierIsAdvance ? "Advance" : (supplierTripRef || "General Open Balance"),
      mode: supplierMode,
      amount: amt,
      status: "Paid",
      isAdvance: supplierIsAdvance,
      note: supplierNote || (supplierIsAdvance ? `Advance payout to ${supplierParty}` : `Payout disbursed to ${supplierParty}`),
      responsible: "Ravi Kumar"
    });

    setShowSupplierModal(false);
    setSupplierAmount("");
    setSupplierNote("");
    setSupplierIsAdvance(false);
    toast.success(`${supplierIsAdvance ? "Supplier Advance" : "Payout"} ${newId} of ₹${amt.toLocaleString("en-IN")} disbursed to ${supplierParty}`);
  };

  // Handler: Record Transporter Payment in Real-Time
  const handleSaveTransporterPayout = () => {
    const amt = Number(transporterAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid freight payment amount");
      return;
    }
    const newId = nextId("expenses");
    upsert("expenses", {
      id: newId,
      date: transporterDate,
      category: "Transport Freight",
      vendor: transporterParty,
      amount: amt,
      mode: transporterMode,
      notes: transporterNote || `Freight disbursement for ${transporterTripRef || "haulage"}`,
      status: "Paid",
      responsible: "Ravi Kumar"
    });

    setShowTransporterModal(false);
    setTransporterAmount("");
    setTransporterNote("");
    toast.success(`Freight payment ${newId} of ₹${amt.toLocaleString("en-IN")} recorded for ${transporterParty}`);
  };

  // Handler: Issue Credit Note in Real-Time
  const handleSaveCreditNote = () => {
    const amt = Number(cnAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid credit note amount");
      return;
    }
    const newId = nextId("credit-notes");
    upsert("credit-notes", {
      id: newId,
      date: "2026-10-22",
      buyer: cnBuyer,
      invoice: cnInvoice || "General Return",
      kind: cnKind,
      amount: amt,
      note: cnNote || "Credit note adjustment for returned items",
      status: "Issued",
      responsible: "Ravi Kumar"
    });

    setShowCreditNoteModal(false);
    setCnAmount("");
    setCnNote("");
    toast.success(`Credit Note ${newId} of ₹${amt.toLocaleString("en-IN")} issued to ${cnBuyer}`);
  };

  // Handler: Purge dummy data and re-sync
  const handlePurgeAndSync = () => {
    purgeDummyLedgers();
    toast.success("All phantom dummy entries removed. Ledgers re-synchronized with live process flow!");
  };

  const exportCsv = () => {
    if (!currentEntries.length) return;
    const headers = ["Date", "Voucher Ref", "Party", "Type", "Particulars", "Debit (INR)", "Credit (INR)", "Balance (INR)", "Status"];
    const rows = currentEntries.map((e) => [
      `"${e.date}"`,
      `"${e.ref}"`,
      `"${e.party.replaceAll('"', '""')}"`,
      `"${e.type.replaceAll('"', '""')}"`,
      `"${e.particulars.replaceAll('"', '""')}"`,
      e.debit,
      e.credit,
      e.balance,
      `"${e.status}"`
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `ledger-${activeLedger}-${selectedParty !== "all" ? selectedParty : "consolidated"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const hasPriceAccess = canViewPrice(role);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Financial Accounting & Settlement</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Live AP/AR Reconciliation
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">Party Financial Ledgers</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Complete statement of accounts linked strictly to real process flow transactions: Supplier Payables (purchases vs payouts),
            Buyer Receivables (invoices vs collections & credit notes), and Transporter / Agent Commission Ledgers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePurgeAndSync} className="inline-flex items-center gap-1.5 text-xs">
            <RefreshCw className="size-3.5 text-primary" /> Re-Sync Live Data
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="inline-flex items-center gap-1.5 text-xs">
            <Download className="size-3.5" /> Export Statement (CSV)
          </Button>

          {activeLedger === "buyer" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCnBuyer(selectedParty !== "all" ? selectedParty : BUYERS[0]);
                  setShowCreditNoteModal(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs"
              >
                <FileText className="size-3.5" /> Issue Credit Note
              </Button>
              <Button
                onClick={() => {
                  const p = selectedParty !== "all" ? selectedParty : BUYERS[0];
                  setBuyerParty(p);
                  const bal = getPartyLiveBalance(p, "buyer");
                  setBuyerAmount(bal > 0 ? String(bal) : "");
                  setShowBuyerModal(true);
                }}
                className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 shadow-sm"
              >
                <CreditCard className="size-4" /> Record Buyer Receipt
              </Button>
            </div>
          )}

          {activeLedger === "supplier" && (
            <Button
              onClick={() => {
                const p = selectedParty !== "all" ? selectedParty : SUPPLIERS[0];
                setSupplierParty(p);
                const bal = getPartyLiveBalance(p, "supplier");
                setSupplierAmount(bal > 0 ? String(bal) : "");
                setShowSupplierModal(true);
              }}
              className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 shadow-sm"
            >
              <CreditCard className="size-4" /> Record Supplier Payment
            </Button>
          )}

          {activeLedger === "agent" && (
            <Button
              onClick={() => {
                const p = selectedParty !== "all" ? selectedParty : "Chennai Fresh Logistics";
                setTransporterParty(p);
                const bal = getPartyLiveBalance(p, "agent");
                setTransporterAmount(bal > 0 ? String(bal) : "");
                setShowTransporterModal(true);
              }}
              className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 shadow-sm"
            >
              <Truck className="size-4" /> Record Freight Payout
            </Button>
          )}
        </div>
      </div>

      {/* Role Confidentiality Notice */}
      {!hasPriceAccess && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-400">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            Financial Privacy Protection: Active role <strong>{role}</strong> does not have financial ledger permission.
            Monetary debits, credits, and balances are masked under F01/F05 security rules.
          </span>
        </div>
      )}

      {/* Navigation Tabs between Buyer / Supplier / Agent */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeLedger === "buyer" ? "default" : "outline"}
            onClick={() => { setActiveLedger("buyer"); setSelectedParty("all"); setQ(""); }}
            className="inline-flex items-center gap-2"
          >
            <Users className="size-4" />
            Buyer Receivables Ledger
          </Button>
          <Button
            variant={activeLedger === "supplier" ? "default" : "outline"}
            onClick={() => { setActiveLedger("supplier"); setSelectedParty("all"); setQ(""); }}
            className="inline-flex items-center gap-2"
          >
            <Building2 className="size-4" />
            Supplier Payables Ledger
          </Button>
          <Button
            variant={activeLedger === "agent" ? "default" : "outline"}
            onClick={() => { setActiveLedger("agent"); setSelectedParty("all"); setQ(""); }}
            className="inline-flex items-center gap-2"
          >
            <Truck className="size-4" />
            Agent & Transporter Ledger
          </Button>
        </div>

        {/* Party Filter Selector with Live Balance Tag */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Select Party:</span>
          <select
            value={selectedParty}
            onChange={(e) => setSelectedParty(e.target.value)}
            className="rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Consolidated (All Parties)</option>
            {activeLedger === "buyer" && buyersList.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
            {activeLedger === "supplier" && suppliersList.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            {activeLedger === "agent" && agentsList.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {selectedParty !== "all" && (
            <span className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-bold font-mono",
              netBalance > 0 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            )}>
              {maskPriceIfRestricted(fmtMoney(netBalance), role)} {activeLedger === "buyer" ? (netBalance >= 0 ? "Due" : "Advance") : (netBalance >= 0 ? "Payable" : "Cleared")}
            </span>
          )}
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {activeLedger === "buyer" ? "Total Invoiced (Debits)" : "Total Purchases (Credits)"}
            </span>
            <ArrowUpRight className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-foreground">
            {maskPriceIfRestricted(fmtMoney(activeLedger === "buyer" ? totalDebit : totalCredit), role)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeLedger === "buyer" ? "Gross sales demand billed from orders" : "Produce purchased & verified from trips"}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {activeLedger === "buyer" ? "Payments Received" : "Payments Disbursed"}
            </span>
            <ArrowDownLeft className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-foreground">
            {maskPriceIfRestricted(fmtMoney(activeLedger === "buyer" ? totalCredit : totalDebit), role)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeLedger === "buyer" ? "Settled via UPI / Bank / Cash" : "Disbursed to suppliers / transporters"}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {activeLedger === "buyer" ? "Credit Adjustments" : "Active Transactions"}
            </span>
            <Calendar className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-foreground">
            {activeLedger === "buyer"
              ? maskPriceIfRestricted(fmtMoney(currentEntries.filter((e) => e.type.includes("Credit Note") || e.type.includes("Return")).reduce((s, e) => s + e.credit, 0)), role)
              : currentEntries.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeLedger === "buyer" ? "Approved return credit notes (F23/F26)" : "Posted vouchers in ledger"}
          </p>
        </div>

        <div className={cn(
          "rounded-2xl border p-5 shadow-card transition-colors",
          netBalance > 0 ? "bg-amber-500/5 border-amber-500/30" : "bg-emerald-500/5 border-emerald-500/30"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {activeLedger === "buyer" ? "Net Outstanding Receivable" : "Net Balance Payable"}
            </span>
            <Wallet className={cn("size-4", netBalance > 0 ? "text-amber-600" : "text-emerald-600")} />
          </div>
          <p className={cn("mt-2 text-2xl font-bold font-mono tracking-tight", netBalance > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
            {maskPriceIfRestricted(fmtMoney(netBalance), role)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {netBalance === 0 ? "Account completely reconciled" : activeLedger === "buyer" ? (netBalance > 0 ? "Pending collection from buyer" : "Advance / excess collection") : "Outstanding payable by Trading House"}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search voucher ref, party, or particulars…"
            className="w-full rounded-xl border bg-card py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Showing <strong>{currentEntries.length}</strong> live ledger entries</span>
          {selectedParty !== "all" && (
            <button
              onClick={() => setSelectedParty("all")}
              className="text-primary hover:underline font-medium"
            >
              Clear party filter
            </button>
          )}
        </div>
      </div>

      {/* Main Statement Table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/60 text-left uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Voucher Ref</th>
                <th className="px-4 py-3">Party Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 min-w-48">Particulars & Items</th>
                <th className="px-4 py-3 text-right">Debit (₹)</th>
                <th className="px-4 py-3 text-right">Credit (₹)</th>
                <th className="px-4 py-3 text-right font-bold">Balance (₹)</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {currentEntries.map((e) => (
                <tr key={e.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-primary whitespace-nowrap">{e.ref}</td>
                  <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{e.party}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-semibold",
                      e.type.includes("Purchase") ? "bg-blue-500/10 text-blue-700 dark:text-blue-400" :
                      e.type.includes("Invoice") || e.type.includes("Sales Order") ? "bg-purple-500/10 text-purple-700 dark:text-purple-400" :
                      e.type.includes("Payment") || e.type.includes("Collection") ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                      e.type.includes("Credit Note") || e.type.includes("Return") ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {e.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.particulars}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                    {e.debit > 0 ? maskPriceIfRestricted(fmtMoney(e.debit), role) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                    {e.credit > 0 ? maskPriceIfRestricted(fmtMoney(e.credit), role) : "—"}
                  </td>
                  <td className={cn(
                    "px-4 py-3 text-right font-mono font-bold tabular-nums",
                    e.balance > 0 ? "text-amber-700 dark:text-amber-400" : e.balance === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-blue-600"
                  )}>
                    {maskPriceIfRestricted(fmtMoney(e.balance), role)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      e.status === "Paid" || e.status === "Reconciled" || e.status === "Closed"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!currentEntries.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="size-8 text-muted-foreground/40" />
                      <p className="font-semibold text-foreground">No ledger transactions found</p>
                      <p className="text-xs">No entries match the current filter or search criteria.</p>
                      {activeLedger === "buyer" && (
                        <Button
                          size="sm"
                          onClick={() => { setBuyerParty(BUYERS[0]); setShowBuyerModal(true); }}
                          className="mt-2 inline-flex items-center gap-1.5"
                        >
                          <CreditCard className="size-3.5" /> Record Buyer Receipt Now
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Bar */}
        <div className="flex flex-wrap items-center justify-between border-t bg-muted/40 px-5 py-3 text-xs">
          <div className="text-muted-foreground">
            Account reconciliation type: <strong>{activeLedger === "supplier" ? "Accounts Payable (AP)" : activeLedger === "buyer" ? "Accounts Receivable (AR)" : "Freight & Commission Payable"}</strong>
          </div>
          <div className="flex items-center gap-6 font-mono">
            <span>Total Debits: <strong>{maskPriceIfRestricted(fmtMoney(totalDebit), role)}</strong></span>
            <span>Total Credits: <strong>{maskPriceIfRestricted(fmtMoney(totalCredit), role)}</strong></span>
            <span className={cn("font-bold", netBalance > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
              Net Balance: <strong>{maskPriceIfRestricted(fmtMoney(netBalance), role)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* MODAL 1: Record Buyer Receipt in Real-Time */}
      {showBuyerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                  <CreditCard className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Record Buyer Receipt · F24</h2>
                  <p className="text-xs text-muted-foreground">Enter real-time collection into the live receivables ledger</p>
                </div>
              </div>
              <button onClick={() => setShowBuyerModal(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-foreground">Select Buyer</label>
                <select
                  value={buyerParty}
                  onChange={(e) => {
                    setBuyerParty(e.target.value);
                    const bal = getPartyLiveBalance(e.target.value, "buyer");
                    setBuyerAmount(bal > 0 ? String(bal) : "");
                  }}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {buyersList.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Current Outstanding Balance:</span>
                  <span className="font-mono font-bold text-amber-600">
                    ₹{getPartyLiveBalance(buyerParty, "buyer").toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-2.5">
                <div>
                  <span className="text-xs font-semibold text-foreground">Transaction Classification</span>
                  <p className="text-[11px] text-muted-foreground">Select if this receipt is an advance or against an invoice</p>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="buyerType"
                      checked={!buyerIsAdvance}
                      onChange={() => setBuyerIsAdvance(false)}
                      className="size-3.5 text-primary"
                    />
                    <span>Settlement</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="buyerType"
                      checked={buyerIsAdvance}
                      onChange={() => {
                        setBuyerIsAdvance(true);
                        setBuyerInvoiceRef("Advance");
                      }}
                      className="size-3.5 text-primary"
                    />
                    <span className="text-primary font-bold">Advance</span>
                  </label>
                </div>
              </div>

              {!buyerIsAdvance && (
                <div>
                  <label className="font-semibold text-foreground">Against Invoice / Demand</label>
                  <select
                    value={buyerInvoiceRef}
                    onChange={(e) => {
                      setBuyerInvoiceRef(e.target.value);
                      const match = buyerOpenInvoices.find(i => i.id === e.target.value);
                      if (match) setBuyerAmount(String(match.amount));
                    }}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">General On-Account / Ledger Balance</option>
                    {buyerOpenInvoices.map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Receipt Amount (₹) *</label>
                  <input
                    type="number"
                    value={buyerAmount}
                    onChange={(e) => setBuyerAmount(e.target.value)}
                    placeholder="e.g. 966"
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Payment Mode</label>
                  <select
                    value={buyerMode}
                    onChange={(e) => setBuyerMode(e.target.value)}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="NEFT">NEFT / RTGS</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Bank Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Date of Collection</label>
                  <input
                    type="date"
                    value={buyerDate}
                    onChange={(e) => setBuyerDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">UTR / Transaction Ref</label>
                  <input
                    type="text"
                    value={buyerNote}
                    onChange={(e) => setBuyerNote(e.target.value)}
                    placeholder="e.g. UTR-98218731"
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowBuyerModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveBuyerReceipt} className="bg-primary text-primary-foreground">
                <CheckCircle2 className="mr-1.5 size-4" /> Save & Post to Ledger
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Supplier Payment in Real-Time */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Record Supplier Payout · F25</h2>
                  <p className="text-xs text-muted-foreground">Disburse payment to supplier and reduce Accounts Payable</p>
                </div>
              </div>
              <button onClick={() => setShowSupplierModal(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-foreground">Select Supplier</label>
                <select
                  value={supplierParty}
                  onChange={(e) => {
                    setSupplierParty(e.target.value);
                    const bal = getPartyLiveBalance(e.target.value, "supplier");
                    setSupplierAmount(bal > 0 ? String(bal) : "");
                  }}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {suppliersList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Current Outstanding Payable:</span>
                  <span className="font-mono font-bold text-amber-600">
                    ₹{getPartyLiveBalance(supplierParty, "supplier").toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-2.5">
                <div>
                  <span className="text-xs font-semibold text-foreground">Transaction Classification</span>
                  <p className="text-[11px] text-muted-foreground">Select if this payout is an advance or against a purchase</p>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="supplierType"
                      checked={!supplierIsAdvance}
                      onChange={() => setSupplierIsAdvance(false)}
                      className="size-3.5 text-primary"
                    />
                    <span>Settlement</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="supplierType"
                      checked={supplierIsAdvance}
                      onChange={() => {
                        setSupplierIsAdvance(true);
                        setSupplierTripRef("Advance");
                      }}
                      className="size-3.5 text-primary"
                    />
                    <span className="text-primary font-bold">Advance</span>
                  </label>
                </div>
              </div>

              {!supplierIsAdvance && (
                <div>
                  <label className="font-semibold text-foreground">Against Trip / Purchase DC</label>
                  <select
                    value={supplierTripRef}
                    onChange={(e) => {
                      setSupplierTripRef(e.target.value);
                      const match = supplierOpenTrips.find(t => t.id === e.target.value);
                      if (match) setSupplierAmount(String(match.amount));
                    }}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">General Open Account Balance</option>
                    {supplierOpenTrips.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Payout Amount (₹) *</label>
                  <input
                    type="number"
                    value={supplierAmount}
                    onChange={(e) => setSupplierAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Disbursement Mode</label>
                  <select
                    value={supplierMode}
                    onChange={(e) => setSupplierMode(e.target.value)}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="NEFT">NEFT / RTGS</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash at Hub</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Date of Disbursement</label>
                  <input
                    type="date"
                    value={supplierDate}
                    onChange={(e) => setSupplierDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Bank Ref / UTR / Remarks</label>
                  <input
                    type="text"
                    value={supplierNote}
                    onChange={(e) => setSupplierNote(e.target.value)}
                    placeholder="e.g. Bank payout ref 4091"
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowSupplierModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveSupplierPayout} className="bg-primary text-primary-foreground">
                <CheckCircle2 className="mr-1.5 size-4" /> Disburse Payment to Ledger
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Record Transporter Freight Payment */}
      {showTransporterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600">
                  <Truck className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Record Transporter Freight Settlement</h2>
                  <p className="text-xs text-muted-foreground">Disburse haulage charges and update freight ledger</p>
                </div>
              </div>
              <button onClick={() => setShowTransporterModal(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-foreground">Transporter Name</label>
                <select
                  value={transporterParty}
                  onChange={(e) => {
                    setTransporterParty(e.target.value);
                    const bal = getPartyLiveBalance(e.target.value, "agent");
                    setTransporterAmount(bal > 0 ? String(bal) : "");
                  }}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {agentsList.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Freight Settlement (₹) *</label>
                  <input
                    type="number"
                    value={transporterAmount}
                    onChange={(e) => setTransporterAmount(e.target.value)}
                    placeholder="e.g. 500"
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Payment Mode</label>
                  <select
                    value={transporterMode}
                    onChange={(e) => setTransporterMode(e.target.value)}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="NEFT">NEFT / RTGS</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground">Notes / Trip Reference</label>
                <input
                  type="text"
                  value={transporterNote}
                  onChange={(e) => setTransporterNote(e.target.value)}
                  placeholder="e.g. Inward transport for TRP-1001"
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowTransporterModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveTransporterPayout} className="bg-primary text-primary-foreground">
                <CheckCircle2 className="mr-1.5 size-4" /> Post Freight Settlement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Issue Credit Note in Real-Time */}
      {showCreditNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Issue Buyer Credit Note · F26</h2>
                  <p className="text-xs text-muted-foreground">Credit buyer account for approved returns or delivery adjustments</p>
                </div>
              </div>
              <button onClick={() => setShowCreditNoteModal(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-foreground">Select Buyer</label>
                <select
                  value={cnBuyer}
                  onChange={(e) => setCnBuyer(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {buyersList.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Credit Amount (₹) *</label>
                  <input
                    type="number"
                    value={cnAmount}
                    onChange={(e) => setCnAmount(e.target.value)}
                    placeholder="e.g. 126"
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Credit Type</label>
                  <select
                    value={cnKind}
                    onChange={(e) => setCnKind(e.target.value)}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Return Adjustment">Return Adjustment</option>
                    <option value="Manual">Manual Goodwill</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground">Original Invoice Reference</label>
                <input
                  type="text"
                  value={cnInvoice}
                  onChange={(e) => setCnInvoice(e.target.value)}
                  placeholder="e.g. INV-1001"
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground">Reason / Particulars</label>
                <input
                  type="text"
                  value={cnNote}
                  onChange={(e) => setCnNote(e.target.value)}
                  placeholder="e.g. 3 kg tomato returned due to transit soft texture"
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowCreditNoteModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveCreditNote} className="bg-primary text-primary-foreground">
                <CheckCircle2 className="mr-1.5 size-4" /> Issue Credit Note
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
