import "server-only";
import { isSoldOut, variantCombos, variantKey, type VariantChoice } from "@/lib/models/product";
import { listAllProducts } from "@/lib/products";
import { listAllOrders } from "@/lib/shop-orders";

export type InventoryRow = VariantChoice & {
  /** Paid orders that include this variant. */
  paidOrders: number;
  /** Units in those paid orders. */
  unitsSold: number;
  /** Units in orders still waiting for payment. */
  unitsPending: number;
  /** Marked out of stock by the admin. */
  soldOut: boolean;
};

export type InventoryProduct = {
  productId: string;
  title: string;
  /** False for a product that's since been deleted but still has orders. */
  exists: boolean;
  published: boolean;
  rows: InventoryRow[];
  totals: { paidOrders: number; unitsSold: number; unitsPending: number };
};

/** Per product, per color/size/sleeve: how many orders, units sold, units
 * pending payment, and whether it's currently available. Pending ones are as last recorded —
 * the Orders page re-checks them with Razorpay when it's opened. */
export async function getInventoryBreakdown(): Promise<InventoryProduct[]> {
  const [products, orders] = await Promise.all([listAllProducts(), listAllOrders()]);

  type Tally = { paidOrderIds: Set<string>; unitsSold: number; unitsPending: number };
  const tallies = new Map<string, Map<string, Tally>>(); // productId -> variantKey -> tally
  const titles = new Map<string, string>();

  orders.forEach((order) => {
    order.items.forEach((item) => {
      titles.set(item.productId, item.productTitle);
      const byVariant = tallies.get(item.productId) ?? new Map<string, Tally>();
      tallies.set(item.productId, byVariant);
      const key = variantKey(item);
      const tally = byVariant.get(key) ?? { paidOrderIds: new Set<string>(), unitsSold: 0, unitsPending: 0 };
      byVariant.set(key, tally);
      if (order.status === "paid") {
        tally.paidOrderIds.add(order.id);
        tally.unitsSold += item.qty;
      } else if (order.status === "created") {
        tally.unitsPending += item.qty;
      } // expired / cancelled orders count as neither
    });
  });

  const build = (productId: string, title: string, exists: boolean, published: boolean, base: VariantChoice[], soldOutOf: (c: VariantChoice) => boolean): InventoryProduct => {
    const byVariant = tallies.get(productId) ?? new Map<string, Tally>();
    const rowsByKey = new Map<string, InventoryRow>();

    // Every variant the product offers, plus any ordered variant whose option
    // has since been removed from the product.
    const seen = new Map<string, VariantChoice>();
    base.forEach((c) => seen.set(variantKey(c), c));
    orders.forEach((o) =>
      o.items.filter((i) => i.productId === productId).forEach((i) => seen.set(variantKey(i), { color: i.color, size: i.size, sleeve: i.sleeve })),
    );
    seen.forEach((choice, key) => {
      const tally = byVariant.get(key);
      const soldOut = soldOutOf(choice);
      if (!tally && !soldOut) return; // available and never ordered — nothing to show
      rowsByKey.set(key, {
        ...choice,
        paidOrders: tally?.paidOrderIds.size ?? 0,
        unitsSold: tally?.unitsSold ?? 0,
        unitsPending: tally?.unitsPending ?? 0,
        soldOut,
      });
    });

    const rows = [...rowsByKey.values()].sort((a, b) =>
      [a.color, a.size, a.sleeve].join("\u0000").localeCompare([b.color, b.size, b.sleeve].join("\u0000")),
    );
    return {
      productId,
      title,
      exists,
      published,
      rows,
      totals: {
        paidOrders: new Set([...byVariant.values()].flatMap((t) => [...t.paidOrderIds])).size,
        unitsSold: rows.reduce((n, r) => n + r.unitsSold, 0),
        unitsPending: rows.reduce((n, r) => n + r.unitsPending, 0),
      },
    };
  };

  const result = products.map((product) =>
    build(
      product.id,
      product.title,
      true,
      product.published,
      variantCombos(product.colors, product.sizes, product.sleeves.map((s) => s.name)),
      (choice) => isSoldOut(product, choice),
    ),
  );

  // Orders for products that were deleted since.
  const known = new Set(products.map((p) => p.id));
  [...tallies.keys()]
    .filter((id) => !known.has(id))
    .forEach((id) => result.push(build(id, titles.get(id) ?? "Deleted product", false, false, [], () => false)));

  return result;
}
