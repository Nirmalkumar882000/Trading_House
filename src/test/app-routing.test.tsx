import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { getModule } from "@/lib/modules";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("resolves warehouse receipt URL aliases to the existing receipts module", () => {
    for (const slug of [
      "receipts",
      "warehouse-receipt",
      "warehouse-receipts",
      "warehouse-receipt-note",
      "warehouse-receipt-notes",
      "goods-receipt",
      "goods-receipts",
      "grn",
    ]) {
      expect(getModule(slug)?.slug).toBe("receipts");
    }
  });
});
