import { describe, it, expect, beforeEach } from "vitest";
import {
  PRODUCT_CATALOG,
  INITIAL_PRODUCT_CATALOG,
  syncProductCatalog,
  detectUnitType,
  ITEMS,
  getModule,
  type ProductItem,
} from "@/lib/modules";

describe("Product Catalog Specifications & Dynamic Management", () => {
  beforeEach(() => {
    syncProductCatalog(INITIAL_PRODUCT_CATALOG);
  });

  it("contains the complete 36 commodities requested by user in INITIAL_PRODUCT_CATALOG", () => {
    expect(INITIAL_PRODUCT_CATALOG.length).toBe(36);

    const names = INITIAL_PRODUCT_CATALOG.map((p) => p.name);
    expect(names).toContain("Amaranth Green Leaves (Arai Keerai)");
    expect(names).toContain("Amaranth Red Leaves (Red Mulai Keerai)");
    expect(names).toContain("Banana Elaichi (Yelakki)");
    expect(names).toContain("Banana Poovan Semi Ripe");
    expect(names).toContain("Banana Red Semi Ripe");
    expect(names).toContain("Beans Broad (Avarakkaai)");
    expect(names).toContain("Beans Cluster (Seeni Avaraikkaai)");
    expect(names).toContain("Beans Cowpea");
    expect(names).toContain("Beetroot");
    expect(names).toContain("Bottle Gourd (Surakkaai)");
    expect(names).toContain("Cabbage");
    expect(names).toContain("Chilli Green (Pachchai Milagai)");
    expect(names).toContain("Chilli Green Gundu (Bullet Chilli)");
    expect(names).toContain("Coconut (Thengaai) Medium");
    expect(names).toContain("Coconut Small");
    expect(names).toContain("Coconut Sprout");
    expect(names).toContain("Coriander Leaves (Koththamalli) - Cleaned, with roots");
    expect(names).toContain("Curry Leaves (Karuveppilai) - Cleaned, without roots");
    expect(names).toContain("Drumstick");
    expect(names).toContain("Drumsticks");
    expect(names).toContain("Lady Finger (Vendikaai)");
    expect(names).toContain("Mint Leaves");
    expect(names).toContain("Radish White (Mooli)");
    expect(names).toContain("Spinach (Palak) - Cleaned, without roots");
    expect(names).toContain("Sweet Corn");
    expect(names).toContain("Sweet Corn (Cholam)");
    expect(names).toContain("Tender Coconut (Elaneer)");
    expect(names).toContain("Tomato Local");
    expect(names).toContain("Tomato Local (Naattu Thakkali)");
    expect(names).toContain("Tomato");
    expect(names).toContain("Onion");
    expect(names).toContain("Potato");
    expect(names).toContain("Carrot");
    expect(names).toContain("Beans");
    expect(names).toContain("Coriander");
    expect(names).toContain("Banana");
  });

  it("accurately detects unit types (kg / piece / range)", () => {
    expect(detectUnitType("250 g")).toBe("kg");
    expect(detectUnitType("1 kg")).toBe("kg");
    expect(detectUnitType("500 g")).toBe("kg");

    expect(detectUnitType("1 pc")).toBe("piece");
    expect(detectUnitType("2 pcs")).toBe("piece");
    expect(detectUnitType("3 pcs")).toBe("piece");

    expect(detectUnitType("450 g - 550 g")).toBe("range");
    expect(detectUnitType("200 - 300 g")).toBe("range");
    expect(detectUnitType("90 - 100 g")).toBe("range");
  });

  it("supports adding dynamic products with custom unit types and categories", () => {
    const newKgProduct: ProductItem = {
      name: "Capsicum Green",
      defaultPackSize: "250 g",
      packSizeKg: 0.25,
      category: "Vegetables",
    };

    const newPieceProduct: ProductItem = {
      name: "Watermelon Striped",
      defaultPackSize: "1 pc",
      packSizeKg: 2.5,
      category: "Fruits",
    };

    const newRangeProduct: ProductItem = {
      name: "Papaya Semi Ripe",
      defaultPackSize: "800 g - 1 kg",
      packSizeKg: 0.9,
      category: "Fruits",
    };

    syncProductCatalog([newKgProduct, newPieceProduct, newRangeProduct, ...INITIAL_PRODUCT_CATALOG]);

    expect(PRODUCT_CATALOG.length).toBe(39);
    expect(ITEMS).toContain("Capsicum Green");
    expect(ITEMS).toContain("Watermelon Striped");
    expect(ITEMS).toContain("Papaya Semi Ripe");

    const foundCapsicum = PRODUCT_CATALOG.find((p) => p.name === "Capsicum Green");
    expect(foundCapsicum?.packSizeKg).toBe(0.25);
    expect(foundCapsicum?.category).toBe("Vegetables");

    const foundWatermelon = PRODUCT_CATALOG.find((p) => p.name === "Watermelon Striped");
    expect(foundWatermelon?.defaultPackSize).toBe("1 pc");
    expect(foundWatermelon?.packSizeKg).toBe(2.5);

    const foundPapaya = PRODUCT_CATALOG.find((p) => p.name === "Papaya Semi Ripe");
    expect(foundPapaya?.defaultPackSize).toBe("800 g - 1 kg");
    expect(foundPapaya?.packSizeKg).toBe(0.9);
  });

  it("supports catalog module definition and catalog alias in getModule", () => {
    const mod = getModule("product-catalog");
    expect(mod).toBeDefined();
    expect(mod?.title).toBe("Add Catalog");

    const aliasMod = getModule("catalog");
    expect(aliasMod).toBeDefined();
    expect(aliasMod?.slug).toBe("product-catalog");
  });
});

