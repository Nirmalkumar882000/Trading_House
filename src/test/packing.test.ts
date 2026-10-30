import { describe, expect, it } from "vitest";
import { filterBuyerAllocations } from "@/lib/packing";

const allocations = [
  { buyer: "FreshMart", poId: "PO-101", product: "Mango", balanceKg: 4 },
  { buyer: "FreshMart", poId: "PO-102", product: "Banana", balanceKg: 0 },
  { buyer: "Green Market", poId: "PO-201", product: "Mango", balanceKg: 2 },
];

describe("filterBuyerAllocations", () => {
  it("filters allocations by buyer and keeps matching status/search filters", () => {
    expect(filterBuyerAllocations(allocations, "FreshMart", "pending", "mango")).toEqual([
      allocations[0],
    ]);
  });

  it("returns no rows when the selected buyer has no matching search result", () => {
    expect(filterBuyerAllocations(allocations, "Green Market", "all", "banana")).toEqual([]);
  });

  it("keeps all buyers visible when the buyer filter is set to all", () => {
    expect(filterBuyerAllocations(allocations, "all", "fulfilled", "")).toEqual([
      allocations[1],
    ]);
  });
});
