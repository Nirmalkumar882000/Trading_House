import { ProductCatalogModal } from "./ProductCatalogModal";
import type { ModuleDef } from "@/lib/modules";

export function ProductCatalogPage({ mod }: { mod?: ModuleDef }) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ProductCatalogModal embedded={true} />
    </div>
  );
}
