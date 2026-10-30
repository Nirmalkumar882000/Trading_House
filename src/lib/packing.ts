export type BuyerAllocationStatus = "all" | "pending" | "fulfilled";

export function filterBuyerAllocations<T extends {
  buyer: string;
  poId: string;
  product: string;
  balanceKg: number;
}>(
  allocations: T[],
  buyer: string,
  status: BuyerAllocationStatus,
  search: string,
): T[] {
  const query = search.trim().toLowerCase();
  return allocations.filter((item) => {
    if (buyer !== "all" && item.buyer !== buyer) return false;
    if (
      query &&
      !item.buyer.toLowerCase().includes(query) &&
      !item.poId.toLowerCase().includes(query) &&
      !item.product.toLowerCase().includes(query)
    ) return false;
    if (status === "pending") return item.balanceKg > 0.001;
    if (status === "fulfilled") return item.balanceKg <= 0.001;
    return true;
  });
}
