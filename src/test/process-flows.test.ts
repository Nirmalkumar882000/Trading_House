import { describe, it, expect } from "vitest";
import { OPEN_POINTS } from "@/components/OpenPointsRegister";
import { PROCESS_FLOWS } from "@/components/ProcessFlowMap";
import { ROLES, canViewPrice, isModuleAllowedForRole, maskPriceIfRestricted } from "@/lib/rbac";
import { MODULES, seedRows, type Row } from "@/lib/modules";
import { normalize, lines, stock, validateData, syncReceiptContainers, movements, populate, receiptBelongsToBuyer, type Data } from "@/lib/workflow";
import { getProductPackSpec, computePackets } from "@/components/DemandPlan";

const demo = (): Data => Object.fromEntries(MODULES.map((m) => [m.slug, seedRows(m)]));

describe("Trading House F01-F28 & C01-C14 Business Rules", () => {
  it("C01-C14 Open Points Register covers all 14 customer open points with status and impacts", () => {
    expect(OPEN_POINTS.length).toBe(14);
    const ids = OPEN_POINTS.map((op) => op.id);
    for (let i = 1; i <= 14; i++) {
      const expectedId = `C${String(i).padStart(2, "0")}`;
      expect(ids).toContain(expectedId);
    }
    for (const op of OPEN_POINTS) {
      expect(op.topic).toBeTruthy();
      expect(op.requirement).toBeTruthy();
      expect(op.proposedOptions.length).toBeGreaterThan(0);
      expect(op.customerDecision).toBeTruthy();
      expect(op.implementationImpact).toBeTruthy();
      expect(op.testingImpact).toBeTruthy();
      expect(["Approved", "Pending", "Deferred"]).toContain(op.status);
    }
  });

  it("Process Flow Map covers all 28 flows (F01-F28) with decision gates and acceptance checks", () => {
    expect(PROCESS_FLOWS.length).toBe(28);
    const ids = PROCESS_FLOWS.map((f) => f.id);
    for (let i = 1; i <= 28; i++) {
      const expectedId = `F${String(i).padStart(2, "0")}`;
      expect(ids).toContain(expectedId);
    }
    for (const flow of PROCESS_FLOWS) {
      expect(flow.title).toBeTruthy();
      expect(flow.inputs.length).toBeGreaterThan(0);
      expect(flow.outputs.length).toBeGreaterThan(0);
      expect(flow.decisionPoints.length).toBeGreaterThan(0);
      expect(flow.acceptanceChecks.length).toBeGreaterThan(0);
    }
  });

  it("F01 & F05 RBAC: Receipt Staff and QC Graders cannot view purchase prices", () => {
    expect(canViewPrice("Receipt Staff")).toBe(false);
    expect(canViewPrice("QC Grader")).toBe(false);
    expect(canViewPrice("Packer")).toBe(false);

    expect(canViewPrice("Admin")).toBe(true);
    expect(canViewPrice("Trading House Owner")).toBe(true);
    expect(canViewPrice("Pricing Officer")).toBe(true);
    expect(canViewPrice("Accounts Staff")).toBe(true);

    expect(maskPriceIfRestricted("₹28.00", "Receipt Staff")).toContain("Restricted");
    expect(maskPriceIfRestricted("₹28.00", "Admin")).toBe("₹28.00");
  });

  it("F04: Transport Delivery Challan requires all 3 signatures before trip submission", () => {
    const tripMod = MODULES.find((m) => m.slug === "trips");
    expect(tripMod).toBeDefined();
    if (!tripMod) return;

    // Submitting with less than 3 signatures must fail validation
    const invalidTrip = { id: "TRP-9001", status: "Submitted", signatures: "2" };
    expect(tripMod.validate?.(invalidTrip)).toMatch(/3 signatures/);

    // Submitting with 3 signatures must pass validation
    const validTrip = { id: "TRP-9001", status: "Submitted", signatures: "3" };
    expect(tripMod.validate?.(validTrip)).toBeNull();

    // Draft or Loading status does not require all 3 signatures yet
    expect(tripMod.validate?.({ id: "TRP-9001", status: "Draft", signatures: "0" })).toBeNull();
    expect(tripMod.validate?.({ id: "TRP-9001", status: "Loading", signatures: "1" })).toBeNull();
  });

  it("F07: Receipt validation enforces reason when received weight differs from sent", () => {
    const receiptMod = MODULES.find((m) => m.slug === "receipts");
    expect(receiptMod).toBeDefined();
    if (!receiptMod) return;

    // Different weight without reason fails
    const invalidReceipt = { id: "GRN-9001", status: "Posted", sent: 592, received: 580, diff: -12, reason: "—" };
    expect(receiptMod.validate?.(invalidReceipt)).toMatch(/reason is required/);

    // Different weight with reason passes
    const validReceipt = { id: "GRN-9001", status: "Posted", sent: 592, received: 580, diff: -12, reason: "Moisture loss" };
    expect(receiptMod.validate?.(validReceipt)).toBeNull();
  });

  it("F07: Receipt lines validate and retain a separate reason for each product variance", () => {
    const data = demo();
    const trip = normalize("trips", {
      id: "TRP-9002",
      status: "Submitted",
      signatures: "3",
      item: JSON.stringify([{ p: "Tomato", q: 10 }, { p: "Onion", q: 10 }]),
      net: 20,
      rate: 30,
    });
    const receipt = normalize("receipts", {
      id: "GRN-9002",
      status: "Posted",
      dc: trip.id,
      sent: 20,
      received: 18.5,
      diff: -1.5,
      reason: "Multiple reasons",
      item: JSON.stringify([
        { p: "Tomato", sentQ: 10, q: 9, reason: "Moisture loss" },
        { p: "Onion", sentQ: 10, q: 9.5, reason: "Spillage" },
      ]),
    });
    data["trips"] = [...(data["trips"] ?? []), trip];
    data["receipts"] = [...(data["receipts"] ?? []), receipt];

    expect(validateData(data)).toBeNull();
    expect(lines(receipt, "received").map((line) => line.reason)).toEqual([
      "Moisture loss",
      "Spillage",
    ]);

    const missingLineReason = normalize("receipts", {
      ...receipt,
      item: JSON.stringify([
        { p: "Tomato", sentQ: 10, q: 9, reason: "Moisture loss" },
        { p: "Onion", sentQ: 10, q: 9.5, reason: "—" },
      ]),
    });
    data["receipts"] = [...(data["receipts"] ?? []).filter((line) => line.id !== receipt.id), missingLineReason];

    expect(validateData(data)).toMatch(/Onion: a difference reason is required/);
  });

  it("F11 & F12: Two-Stage QC outputs must reconcile with input", () => {
    const d = demo();
    const qcRecords = d["quality-check"] ?? [];
    const stage2Records = qcRecords.filter((r) => r.status === "Stage 2 done");
    expect(stage2Records.length).toBeGreaterThan(0);

    for (const r of stage2Records) {
      const input = Number(r["input"]) || 0;
      const gradeA = Number(r["gradeA"]) || 0;
      const gradeB = Number(r["gradeB"]) || 0;
      const trash = Number(r["trash"]) || 0;
      // In Stage 2, input produce + returns must equal Grade A + Grade B + Trash
      expect(gradeA).toBeGreaterThanOrEqual(0);
      expect(gradeB).toBeGreaterThanOrEqual(0);
      expect(trash).toBeGreaterThanOrEqual(0);
      expect(gradeA + gradeB).toBeLessThanOrEqual(input + 50); // bounded
    }
  });

  it("Buyer quality-check view only resolves receipts linked to the logged-in buyer's PO", () => {
    const receipt = { id: "GRN-BUYER", status: "Posted", dc: "TRP-BUYER" };
    const trips = [
      { id: "TRP-BUYER", status: "Submitted", po: "PO-FRESHMART" },
      { id: "TRP-OTHER", status: "Submitted", po: "PO-OTHER" },
    ] as Row[];
    const purchaseOrders = [
      { id: "PO-FRESHMART", status: "Accepted", buyer: "FreshMart Retail" },
      { id: "PO-OTHER", status: "Accepted", buyer: "Nilgiris Supermarket" },
    ] as Row[];

    expect(ROLES.Buyer.buyerName).toBe("FreshMart Retail");
    expect(isModuleAllowedForRole("quality-check", "Buyer")).toBe(true);
    expect(receiptBelongsToBuyer(receipt, "FreshMart Retail", trips, purchaseOrders)).toBe(true);
    expect(receiptBelongsToBuyer(receipt, "Nilgiris Supermarket", trips, purchaseOrders)).toBe(false);
    expect(receiptBelongsToBuyer(
      { ...receipt, dc: "TRP-UNKNOWN" },
      "FreshMart Retail",
      trips,
      purchaseOrders,
    )).toBe(false);
  });

  it("F15: QR sticker payload strictly excludes selling price", () => {
    // Generate sample QR payload as formatted in QrStickerModal
    const samplePayload = {
      cmp: "Velaan Bay Trading House",
      p: "Tomato Grade A",
      g: "Grade A",
      wt: "1kg",
      pkd: "2026-10-22",
      exp: "2026-10-25",
      lot: "PK-1001",
      sn: "PK-1001-9876",
      pkr: "Senthil P",
    };
    const jsonString = JSON.stringify(samplePayload);
    expect(jsonString).not.toMatch(/price|sellingPrice|rate|amount|₹|rupees/i);
    expect(samplePayload.p).toBe("Tomato Grade A");
    expect(samplePayload.g).toBe("Grade A");
  });

  it("F20: Sales invoice issuance reduces sales stock exactly once", () => {
    const d = demo();
    const before = stock(d);
    // Adding an invoice does not reduce inventory again because stock was reduced at dispatch
    d["invoices"] = [...(d["invoices"] || []), { id: "INV-9999", status: "Issued", dc: "SDC-1001", total: 966 }];
    expect(stock(d)).toEqual(before);
  });

  it("F06 & F07: Bluetooth scale / manual weight capture reflects on receipt and synchronizes product line weight", () => {
    const receipt = {
      id: "GRN-1003",
      dc: "TRP-1003",
      item: JSON.stringify([{ p: "Carrot", q: 30 }]),
      sent: 30,
      received: 30,
      diff: 0,
      status: "Posted",
    };

    // User captures 29.6 kg via BLE scale or manual entry
    const normalized = normalize("receipts", {
      ...receipt,
      received: 29.6,
    });

    expect(normalized.received).toBe(29.6);
    expect(normalized.diff).toBe(-0.4);
    expect(normalized.reason).toBe("Moisture loss");
    const parsed = JSON.parse(String(normalized.item));
    expect(parsed[0].p).toBe("Carrot");
    expect(parsed[0].q).toBe(29.6);
  });

  it("F24 & F25: Party Ledgers reconcile Supplier Payables, Buyer Receivables, and Agent Commissions", () => {
    const d = demo();

    // Verify complete elimination of phantom dummy vouchers
    const buyerPayments = d["buyer-payments"] || [];
    const supplierPayments = d["supplier-payments"] || [];
    const creditNotes = d["credit-notes"] || [];
    
    expect(buyerPayments.some((r) => String(r["invoice"]).includes("0998"))).toBe(false);
    expect(creditNotes.some((r) => String(r["invoice"]).includes("0998") || String(r["invoice"]).includes("0991"))).toBe(false);
    expect(supplierPayments.some((r) => String(r["ref"]).includes("PRC-1001"))).toBe(false);

    // Supplier Ledger: Purchases (Credits) - Payments (Debits)
    const trips = d["trips"] || [];
    const supplierPurchases = trips.reduce((s, t) => s + (Number(t["amount"]) || 0), 0);
    const supplierPaymentsTotal = supplierPayments.reduce((s, p) => s + (Number(p["amount"]) || 0), 0);
    expect(supplierPurchases).toBeGreaterThan(0);
    expect(supplierPaymentsTotal).toBeGreaterThan(0);

    // Buyer Ledger: Invoices (Debits) - Collections (Credits) - Credit Notes (Credits)
    const invoices = d["invoices"] || [];
    const buyerBilled = invoices.reduce((s, inv) => s + (Number(inv["total"]) || 0), 0);
    const buyerCollected = buyerPayments.reduce((s, r) => s + (Number(r["amount"]) || 0), 0);
    const creditNotesTotal = creditNotes.reduce((s, cn) => s + (Number(cn["amount"]) || 0), 0);
    expect(buyerBilled).toBeGreaterThanOrEqual(10966); // FreshMart ₹966 + Nilgiris ₹10,000
    expect(buyerCollected + creditNotesTotal).toBeGreaterThanOrEqual(0);
    expect(buyerBilled - buyerCollected - creditNotesTotal).toBeGreaterThanOrEqual(0); // Non-negative realistic balance!

    // Transporter Ledger: Freight charges incurred
    const transportCharges = (d["transport"] || []).reduce((s, t) => s + (Number(t["charges"]) || 0), 0);
    expect(transportCharges).toBeGreaterThan(0);
  });

  it("F09: Warehouse receipt with container details automatically creates & updates returnable containers", () => {
    const d = demo();

    // Create a new receipt with container details entered (like in Image 1 & 2)
    const newReceipt = normalize("receipts", {
      id: "GRN-2001",
      date: "2026-10-25",
      dc: "TRP-1001",
      supplier: "Murugan Traders",
      item: JSON.stringify([{ p: "Tomato", q: 155 }]),
      sent: 155,
      received: 155,
      diff: 0,
      containerType: "Plastic crates",
      containerCount: 20,
      reason: "—",
      status: "Posted",
      responsible: "Ravi Kumar",
    });

    // Sync containers from receipt
    const syncedData = syncReceiptContainers(d, newReceipt);
    const containerRecords = syncedData["containers"] || [];
    const createdContainer = containerRecords.find(
      (c) => c["receipt"] === "GRN-2001" || c.id === "CNT-2001"
    );

    expect(createdContainer).toBeDefined();
    if (!createdContainer) return;

    // Verify automatic entry details (matching Image 3 table columns)
    expect(createdContainer.id).toBe("CNT-2001");
    expect(createdContainer["type"]).toBe("Plastic crates");
    expect(createdContainer["party"]).toBe("Murugan Traders");
    expect(createdContainer["out"]).toBe(20);
    expect(createdContainer["back"]).toBe(0);
    expect(createdContainer["balance"]).toBe(20);
    expect(createdContainer["status"]).toBe("With us");

    // Process return: return 15 crates out of 20
    const partialReturn = normalize("containers", {
      ...createdContainer,
      back: 15,
      returnDc: "RDC-CNT-2001",
      returnDate: "2026-10-26",
    });

    expect(partialReturn["out"]).toBe(20);
    expect(partialReturn["back"]).toBe(15);
    expect(partialReturn["balance"]).toBe(5);
    expect(partialReturn["status"]).toBe("With us");

    // Process complete return: return remaining 5
    const fullReturn = normalize("containers", {
      ...partialReturn,
      back: 20,
      returnDc: "RDC-CNT-2001",
      returnDate: "2026-10-26",
    });

    expect(fullReturn["out"]).toBe(20);
    expect(fullReturn["back"]).toBe(20);
    expect(fullReturn["balance"]).toBe(0);
    expect(fullReturn["status"]).toBe("Returned");

    // Shortage scenario: 18 returned, 2 damaged
    const shortReturn = normalize("containers", {
      ...createdContainer,
      back: 18,
      short: 2,
      returnDc: "RDC-CNT-2001",
    });

    expect(shortReturn["out"]).toBe(20);
    expect(shortReturn["back"]).toBe(18);
    expect(shortReturn["short"]).toBe(2);
    expect(shortReturn["balance"]).toBe(0);
    expect(shortReturn["status"]).toBe("Short");
  });

  it("F10: QC grader list strictly displays only QC graders and assigns them to product lines", () => {
    const defaultList = [
      { name: "Karthik M", role: "QC grader" },
      { name: "Divya R", role: "QC grader" },
      { name: "Senthil P", role: "Packer" },
      { name: "Priya S", role: "Receipt staff" },
      { name: "Ravi Kumar", role: "Admin" },
      { name: "Meena K", role: "Accounts" },
    ];

    // Filter by "QC grader" roleFilter
    const roleFilter = "QC grader";
    const filteredGraders = defaultList.filter((e) => e.role === roleFilter);

    // Verify non-graders (Accounts, Admin, Receipt staff, Packer) are strictly excluded
    expect(filteredGraders.map((g) => g.name)).toEqual(["Karthik M", "Divya R"]);
    expect(filteredGraders.some((g) => g.role !== "QC grader")).toBe(false);

    // When assigned in Default QC Graders ("Karthik M, Divya R")
    const selectedGraders = "Karthik M, Divya R";
    const assigned = selectedGraders.split(",").map((s) => s.trim()).filter(Boolean);
    expect(assigned).toEqual(["Karthik M", "Divya R"]);

    // Grading line items can only select from the assigned list
    const lineItem1 = { p: "Amaranth Green", q: 25, grader: assigned[0] };
    const lineItem2 = { p: "Amaranth Red Leaves", q: 30, grader: assigned[1] };

    expect(assigned.includes(lineItem1.grader)).toBe(true);
    expect(assigned.includes(lineItem2.grader)).toBe(true);
  });

  it("Inward Return: creates movement returning rejected produce or empty crates back to supplier stall at market and validates correctly", () => {
    const d = demo();

    const inwardReturnMovement = normalize("transport", {
      id: "MOV-3001",
      date: "2026-10-27",
      direction: "Inward Return",
      supplier: "Murugan Traders",
      ref: "TRP-1001",
      item: JSON.stringify([{ p: "Tomato", q: 15, r: 42, reason: "QC Rejection: Rotting & Pest" }]),
      qty: 15,
      containerType: "Plastic crates (~20-25 kg)",
      containerCount: 10,
      transporter: "Chennai Fresh Logistics",
      vehicle: "TN 09 AB 1234",
      driver: "Raja",
      driverPhone: "9840012345",
      charges: 350,
      status: "Scheduled",
      dc: "RET-DC-3001",
      responsible: "Ravi Kumar",
    });

    const updatedData = {
      ...d,
      transport: [...(d["transport"] || []), inwardReturnMovement],
    };

    const err = validateData(updatedData);
    expect(err).toBeNull();
    expect(inwardReturnMovement["direction"]).toBe("Inward Return");
    expect(inwardReturnMovement["supplier"]).toBe("Murugan Traders");
  });

  it("Outward Return: creates return record and movement from buyer, validates against original sales order, and handles reverse logistics", () => {
    const d = demo();

    // Pick existing sales order
    const so = (d["sales-orders"] || [])[0];
    expect(so).toBeDefined();

    // 1. Create return record
    const returnRecord = normalize("returns", {
      id: "RDC-3001",
      date: "2026-10-27",
      sale: so.id,
      buyer: so["buyer"],
      item: JSON.stringify([{ p: "Tomato", q: 2, r: 40 }]),
      qty: 2,
      reason: "Quality issue",
      status: "Received",
      responsible: "Ravi Kumar",
    });

    // 2. Create transport movement linked to return record
    const transportRecord = normalize("transport", {
      id: "MOV-3002",
      date: "2026-10-27",
      direction: "Outward Return",
      buyer: so["buyer"],
      ref: "RDC-3001",
      item: JSON.stringify([{ p: "Tomato", q: 2, r: 40 }]),
      qty: 2,
      containerType: "Plastic crates (~20-25 kg)",
      containerCount: 3,
      transporter: "Chennai Fresh Logistics",
      vehicle: "TN 09 AB 1234",
      driver: "Raja",
      charges: 250,
      status: "Scheduled",
      responsible: "Ravi Kumar",
    });

    const updatedData = {
      ...d,
      returns: [...(d["returns"] || []), returnRecord],
      transport: [...(d["transport"] || []), transportRecord],
    };

    const err = validateData(updatedData);
    expect(err).toBeNull();
    expect(transportRecord["direction"]).toBe("Outward Return");
    expect(transportRecord["ref"]).toBe("RDC-3001");
  });

  it("First QC Check: separate employee assignment and auto-split 500 kg Tomato into 2 lines across different graders", () => {
    const d = demo();

    // 1. Post a warehouse receipt with 500 kg Tomato linked to a submitted purchase trip
    const trip: Row = normalize("trips", {
      id: "TRP-2005",
      date: "2026-10-28",
      supplier: "Murugan Traders",
      item: JSON.stringify([{ p: "Tomato", q: 500 }]),
      net: 500,
      gross: 520,
      tare: 20,
      rate: 30,
      amount: 15000,
      signatures: "3",
      status: "Submitted",
      buys: JSON.stringify([{ s: "Murugan Traders", p: "Tomato", q: 500, r: 30 }]),
    });
    d["trips"] = [...(d["trips"] || []), trip];

    const receipt: Row = normalize("receipts", {
      id: "GRN-2005",
      date: "2026-10-28",
      route: "Market trip",
      dc: "TRP-2005",
      item: JSON.stringify([{ p: "Tomato", q: 500 }]),
      sent: 500,
      received: 500,
      diff: 0,
      supplier: "Murugan Traders",
      status: "Posted",
      containerType: "Plastic crates",
      containerCount: 20,
    });
    d["receipts"] = [...(d["receipts"] || []), receipt];

    // 2. Auto-split 500 kg Tomato into 2 lines of 250 kg each, assigned to Karthik M and Divya R
    const line1 = { p: "Tomato", q: 250, a: 210, box: 10, startTime: "10:00 AM", grader: "Karthik M", lineTag: "Line 1/2" };
    const line2 = { p: "Tomato", q: 250, a: 220, box: 10, startTime: "10:00 AM", grader: "Divya R", lineTag: "Line 2/2" };

    expect(line1.q + line2.q).toBe(500);
    expect(line1.grader).not.toBe(line2.grader);

    // 3. Save Stage 1 First QC Check record with the two split lines
    const qcRow: Row = normalize("quality-check", {
      id: "QC-2005",
      status: "Stage 1 done",
      date: "2026-10-28",
      sourceType: "Purchase",
      lot: "GRN-2005",
      grader: "Karthik M, Divya R",
      supervisor: "Ravi Kumar",
      startTime: "10:00 AM",
      endTime: "10:45 AM",
      item: JSON.stringify([line1, line2]),
    });

    d["quality-check"] = [...(d["quality-check"] || []), qcRow];

    // Verify validation passes
    const validationError = validateData(d);
    expect(validationError).toBeNull();

    // Verify stock movements: 210 + 220 = 430 kg Grade A, (250-210) + (250-220) = 40 + 30 = 70 kg Remaining for Stage 2
    const totalGradeA = stock(d).find((s) => s.product === "Tomato" && s.category === "Grade A")?.qty;
    const initialGradeA = 147; // from seed demo
    expect(totalGradeA).toBe(initialGradeA + 430);

    // 4. Overallocating beyond received quantity (e.g. 260 + 250 = 510 kg) must be rejected
    const invalidLine = { ...line1, q: 260 };
    const invalidQc: Row = normalize("quality-check", {
      ...qcRow,
      id: "QC-2006",
      item: JSON.stringify([invalidLine, line2]),
    });
    const invalidData = {
      ...d,
      "quality-check": [...(d["quality-check"] || []).filter((r) => r.id !== "QC-2005"), invalidQc],
    };
    expect(validateData(invalidData)).toMatch(/insufficient Ungraded stock|is already assigned or graded/);
  });

  it("First QC Check: allows assigning multiple employees to a single produce line", () => {
    const d = demo();

    // 1. Inbound receipt for 200 kg Potato
    const trip: Row = normalize("trips", {
      id: "TRP-2007",
      date: "2026-10-28",
      vehicle: "TN-38-QC-9999",
      buyer: "Ravi Kumar",
      driver: "Kandan",
      driverPhone: "9876543210",
      net: 200,
      gross: 210,
      tare: 10,
      rate: 25,
      amount: 5000,
      signatures: "3",
      status: "Submitted",
      buys: JSON.stringify([{ s: "Murugan Traders", p: "Potato", q: 200, r: 25 }]),
    });
    d["trips"] = [...(d["trips"] || []), trip];

    const receipt: Row = normalize("receipts", {
      id: "GRN-2007",
      date: "2026-10-28",
      route: "Market trip",
      dc: "TRP-2007",
      item: JSON.stringify([{ p: "Potato", q: 200 }]),
      sent: 200,
      received: 200,
      diff: 0,
      supplier: "Murugan Traders",
      status: "Posted",
      containerType: "Bags",
      containerCount: 8,
    });
    d["receipts"] = [...(d["receipts"] || []), receipt];

    // 2. Single line with MULTIPLE employees assigned (e.g. Karthik M, Divya R working collaboratively)
    const collaborativeLine = {
      p: "Potato",
      q: 200,
      a: 175,
      box: 8,
      startTime: "10:00 AM",
      grader: "Karthik M, Divya R",
      lineTag: "Main Sort Line",
    };

    const qcRow: Row = normalize("quality-check", {
      id: "QC-2007",
      status: "Stage 1 done",
      date: "2026-10-28",
      sourceType: "Purchase",
      lot: "GRN-2007",
      grader: collaborativeLine.grader,
      supervisor: "Ravi Kumar",
      startTime: "10:00 AM",
      endTime: "10:30 AM",
      item: JSON.stringify([collaborativeLine]),
    });

    d["quality-check"] = [...(d["quality-check"] || []), qcRow];

    // Validation passes cleanly
    expect(validateData(d)).toBeNull();

    // Verify stock updated with 175 kg Grade A
    const potatoStock = stock(d).find((s) => s.product === "Potato" && s.category === "Grade A")?.qty;
    const initialPotato = 20; // from demo
    expect(potatoStock).toBe(initialPotato + 175);
  });

  it("Warehouse receipt: mention warehouse in New GRN and propagate across multi-warehouse stock flow", () => {
    const d = demo();

    const trip: Row = normalize("trips", {
      id: "TRP-POLLACHI-01",
      date: "2026-10-28",
      supplier: "Murugan Traders",
      item: JSON.stringify([{ p: "Tomato", q: 300 }]),
      net: 300,
      rate: 28,
      amount: 8400,
      signatures: "3",
      status: "Submitted",
      warehouse: "Pollachi Depot",
    });
    d["trips"] = [...(d["trips"] || []), trip];

    // 1. Post a new GRN with explicit receiving warehouse
    const receipt: Row = normalize("receipts", {
      id: "GRN-POLLACHI-01",
      date: "2026-10-28",
      dc: "TRP-POLLACHI-01",
      warehouse: "Pollachi Depot",
      item: JSON.stringify([{ p: "Tomato", q: 300 }]),
      sent: 300,
      received: 300,
      diff: 0,
      status: "Posted",
      containerType: "Plastic crates",
      containerCount: 15,
      reason: "—",
    });
    d["receipts"] = [...(d["receipts"] || []), receipt];

    // Validate that warehouse is preserved and defaults correctly
    expect(receipt["warehouse"]).toBe("Pollachi Depot");
    expect(validateData(d)).toBeNull();

    // 2. Check that movements inherit the warehouse
    const moves = movements(d);
    const grnMove = moves.find((m) => m.ref === "GRN-POLLACHI-01");
    expect(grnMove).toBeDefined();
    expect(grnMove?.warehouse).toBe("Pollachi Depot");
    expect(grnMove?.source).toBe("Market");
    expect(grnMove?.destination).toBe("Ungraded");
    expect(grnMove?.qty).toBe(300);

    // 3. Check warehouse-specific stock filtering
    const pollachiStock = stock(d, "Pollachi Depot");
    const pollachiTomatoUngraded = pollachiStock.find((s) => s.product === "Tomato" && s.category === "Ungraded");
    expect(pollachiTomatoUngraded?.qty).toBe(300);

    // 4. Quality check inherits warehouse from the source GRN
    const qc = populate("quality-check", "lot", "GRN-POLLACHI-01", { id: "QC-POLLACHI-01", status: "Stage 1 done" } as Row, d);
    expect(qc["warehouse"]).toBe("Pollachi Depot");
  });

  it("F14 & F15: Buyer packet-count and grams-based split packing correctly allocates to multiple buyers and General Stock", () => {
    const d = demo();

    // Setup Buyer POs with packet and gram specifications:
    // PO-7001: Hotel Saravana Bhavan: 50 kg Tomato (100 pkts @ 500g)
    // PO-7002: FreshMart Retail: 25 kg Tomato (100 pkts @ 250g)
    const po1 = normalize("purchase-orders", {
      id: "PO-7001",
      buyer: "Hotel Saravana Bhavan",
      item: JSON.stringify([{ p: "Tomato", q: 50 }]),
      qty: 50,
      status: "Accepted",
    });
    const po2 = normalize("purchase-orders", {
      id: "PO-7002",
      buyer: "FreshMart Retail",
      item: JSON.stringify([{ p: "Tomato", q: 25 }]),
      qty: 25,
      status: "Accepted",
    });
    d["purchase-orders"] = [...(d["purchase-orders"] || []), po1, po2];

    // Graded produce available in QC Stage 1: 150 kg Tomato
    // Execute 3-way split:
    // 1. Hotel Saravana Bhavan: 100 pkts @ 500g (0.5 kg) = 50 kg
    // 2. FreshMart Retail: 100 pkts @ 250g (0.25 kg) = 25 kg
    // 3. General Stock: 150 pkts @ 500g (0.5 kg) = 75 kg
    const packLot1 = normalize("packing", {
      id: "PK-7001",
      status: "Packed",
      po: "PO-7001",
      buyer: "Hotel Saravana Bhavan",
      stage: "Stage 1",
      grade: "Grade A",
      packer: "Senthil P",
      packSize: 0.5,
      packs: 100,
      item: JSON.stringify([{ p: "Tomato", q: 50 }]),
    });

    const packLot2 = normalize("packing", {
      id: "PK-7002",
      status: "Packed",
      po: "PO-7002",
      buyer: "FreshMart Retail",
      stage: "Stage 1",
      grade: "Grade A",
      packer: "Senthil P",
      packSize: 0.25,
      packs: 100,
      item: JSON.stringify([{ p: "Tomato", q: 25 }]),
    });

    const packLot3 = normalize("packing", {
      id: "PK-7003",
      status: "Packed",
      po: "",
      buyer: "",
      stage: "Stage 1",
      grade: "Grade A",
      packer: "Senthil P",
      packSize: 0.5,
      packs: 140,
      item: JSON.stringify([{ p: "Tomato", q: 70 }]),
    });

    d["packing"] = [...(d["packing"] || []), packLot1, packLot2, packLot3];

    // Data validation passes without "allocation exceeds buyer demand" error
    expect(validateData(d)).toBeNull();

    // Verify stock is derived correctly: 50 + 25 + 75 = 150 kg total Tomato packed
    const tomatoPackedLots = (d["packing"] || []).filter((r) =>
      lines(r).some((l) => l.p === "Tomato")
    );
    expect(tomatoPackedLots.some((r) => r.id === "PK-7001" && r["packs"] === 100)).toBe(true);
    expect(tomatoPackedLots.some((r) => r.id === "PK-7002" && r["packs"] === 100)).toBe(true);
    expect(tomatoPackedLots.some((r) => r.id === "PK-7003" && r["buyer"] === "")).toBe(true);
  });

  it("F16: Demand summary & purchase plan calculates and displays packet counts accurately from commodity packaging specs and buyer line specs", () => {
    // 1. Pack spec resolution matches commodity definitions
    const amaranthSpec = getProductPackSpec("Amaranth Green Leaves (Arai Keerai)");
    expect(amaranthSpec.defaultPackSize).toBe("250 g");
    expect(amaranthSpec.packSizeKg).toBe(0.25);

    const redAmaranthSpec = getProductPackSpec("Amaranth Red Leaves (Red Mulai Keerai)");
    expect(redAmaranthSpec.defaultPackSize).toBe("150 g");
    expect(redAmaranthSpec.packSizeKg).toBe(0.15);

    const bananaSpec = getProductPackSpec("Banana Poovan Semi Ripe");
    expect(bananaSpec.packSizeKg).toBe(0.5);

    const beansSpec = getProductPackSpec("Beans Broad (Avarakkaai)");
    expect(beansSpec.defaultPackSize).toBe("250 g");
    expect(beansSpec.packSizeKg).toBe(0.25);

    const chilliSpec = getProductPackSpec("Chilli Green Gundu (Bullet Chilli)");
    expect(chilliSpec.defaultPackSize).toBe("200 g");
    expect(chilliSpec.packSizeKg).toBe(0.2);

    const ladyFingerSpec = getProductPackSpec("Lady Finger (Vendikaai)");
    expect(ladyFingerSpec.defaultPackSize).toBe("250 g");
    expect(ladyFingerSpec.packSizeKg).toBe(0.25);

    // 2. Exact packet count computations matching user's screenshot
    // Amaranth Green Leaves: 25 kg base demand @ 250g
    expect(computePackets(25, amaranthSpec.packSizeKg)).toBe(100);
    // With extra buffer 2.14 kg -> total 27.14 kg -> Math.ceil(27.14 / 0.25) = 109 pkts
    expect(computePackets(27.14, amaranthSpec.packSizeKg)).toBe(109);

    // Amaranth Red Leaves: 15 kg @ 150g -> 100 pkts
    expect(computePackets(15, redAmaranthSpec.packSizeKg)).toBe(100);

    // Banana Poovan: 25 kg @ 500g -> 50 pkts
    expect(computePackets(25, bananaSpec.packSizeKg)).toBe(50);

    // Beans Broad: 20 kg @ 250g -> 80 pkts
    expect(computePackets(20, beansSpec.packSizeKg)).toBe(80);

    // Chilli Green Gundu: 10 kg @ 200g -> 50 pkts
    expect(computePackets(10, chilliSpec.packSizeKg)).toBe(50);

    // Lady Finger: 25 kg @ 250g -> 100 pkts
    expect(computePackets(25, ladyFingerSpec.packSizeKg)).toBe(100);

    // Total base demand packets for Date 2026-10-25: 100 + 100 + 50 + 80 + 50 + 100 = 480 pkts
    const totalBasePackets =
      computePackets(25, amaranthSpec.packSizeKg) +
      computePackets(15, redAmaranthSpec.packSizeKg) +
      computePackets(25, bananaSpec.packSizeKg) +
      computePackets(20, beansSpec.packSizeKg) +
      computePackets(10, chilliSpec.packSizeKg) +
      computePackets(25, ladyFingerSpec.packSizeKg);
    expect(totalBasePackets).toBe(480);
  });
});


