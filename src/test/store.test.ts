import { describe, expect, it } from "vitest";
import { ensureDirectoryDemoData, seedRows, MODULES, type Row } from "@/lib/modules";

describe("directory demo data", () => {
  it("restores supplier, buyer, and transporter examples when their saved lists are empty", () => {
    const data: Record<string, Row[]> = {
      suppliers: [],
      buyers: [],
      transporters: [],
      receipts: [{ id: "GRN-9001" }],
    };

    const restored = ensureDirectoryDemoData(data);

    for (const slug of ["suppliers", "buyers", "transporters"]) {
      const module = MODULES.find((item) => item.slug === slug);
      if (!module) throw new Error(`Missing module ${slug}`);
      expect(restored[slug]).toEqual(seedRows(module));
      expect(restored[slug].length).toBeGreaterThan(0);
    }
    expect(restored.receipts).toEqual(data.receipts);
  });

  it("preserves user-entered directory rows instead of replacing them with examples", () => {
    const savedSupplier: Row = { id: "SUP-9001", name: "My Supplier", status: "Active" };
    const savedBuyer: Row = { id: "BUY-9001", name: "My Buyer", status: "Approved" };
    const savedTransporter: Row = { id: "TPT-9001", name: "My Transporter", status: "Active" };
    const data: Record<string, Row[]> = {
      suppliers: [savedSupplier],
      buyers: [savedBuyer],
      transporters: [savedTransporter],
    };

    const restored = ensureDirectoryDemoData(data);

    expect(restored.suppliers).toEqual([savedSupplier]);
    expect(restored.buyers).toEqual([savedBuyer]);
    expect(restored.transporters).toEqual([savedTransporter]);
  });
});
