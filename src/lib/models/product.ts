// Shop product shape + request validation, shared by client forms and
// server Route Handlers — deliberately no "server-only"/Firestore imports.
// Actual reads/writes live in src/lib/products.ts.

export const MAX_PRODUCT_IMAGES = 10;
/** Most of one product (same options) a rider can put in a single cart line. */
export const MAX_QTY_PER_LINE = 10;

/** `price` null means "same as the product's base price". */
export type ProductSleeve = { name: string; price: number | null };

export type ProductInput = {
  title: string;
  description: string;
  /** Ordered — the first one is the main/cover image. Public Storage URLs. */
  images: string[];
  /** Whole rupees. */
  price: number;
  colors: string[];
  sizes: string[];
  /** e.g. Half sleeve / Full sleeve — empty means the product has no sleeve choice. */
  sleeves: ProductSleeve[];
  /**
   * Color/size/sleeve combinations the admin has marked out of stock. Anything
   * not listed here is available.
   */
  soldOut: VariantChoice[];
  /** Unpublished products are visible to admins only. */
  published: boolean;
};

export type VariantChoice = { color: string | null; size: string | null; sleeve: string | null };

export type Product = ProductInput & { id: string; createdAt: string };

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      out.push(trimmed);
    }
  }
  return out;
}

function cleanSleeves(value: unknown): ProductSleeve[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: ProductSleeve[] = [];
  for (const item of value) {
    // Plain strings are accepted too (older clients sent just names).
    const raw = typeof item === "string" ? { name: item } : (item as { name?: unknown; price?: unknown } | null);
    const name = typeof raw?.name === "string" ? raw.name.trim() : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const price = typeof raw?.price === "number" || typeof raw?.price === "string" ? Number(raw.price) : NaN;
    out.push({ name, price: raw?.price !== "" && Number.isFinite(price) && price >= 0 ? Math.round(price) : null });
  }
  return out;
}

export function variantKey(choice: VariantChoice): string {
  return [choice.color ?? "", choice.size ?? "", choice.sleeve ?? ""].map(encodeURIComponent).join("|");
}

/** Every color × size × sleeve combination a product can be bought in (an
 * option list that's empty contributes a single "none"). */
export function variantCombos(colors: string[], sizes: string[], sleeves: string[]): VariantChoice[] {
  const axis = (list: string[]): (string | null)[] => (list.length ? list : [null]);
  const out: VariantChoice[] = [];
  for (const color of axis(colors))
    for (const size of axis(sizes))
      for (const sleeve of axis(sleeves)) out.push({ color, size, sleeve });
  return out;
}

// Keeps only combinations that really exist among the product's current
// options (a rename/removal can leave stale entries behind).
function cleanSoldOut(value: unknown, colors: string[], sizes: string[], sleeves: string[]): VariantChoice[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set(variantCombos(colors, sizes, sleeves).map(variantKey));
  const seen = new Set<string>();
  const out: VariantChoice[] = [];
  for (const item of value) {
    const o = (item ?? {}) as Record<string, unknown>;
    const choice: VariantChoice = {
      color: typeof o.color === "string" && o.color ? o.color : null,
      size: typeof o.size === "string" && o.size ? o.size : null,
      sleeve: typeof o.sleeve === "string" && o.sleeve ? o.sleeve : null,
    };
    const key = variantKey(choice);
    if (!valid.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(choice);
  }
  return out;
}

export function parseProductInput(
  body: unknown,
): { ok: true; input: ProductInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { ok: false, error: "title is required" };

  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: "price must be a number, 0 or more" };
  }

  const images = cleanList(b.images).filter((url) => /^https?:\/\//.test(url));
  if (images.length > MAX_PRODUCT_IMAGES) {
    return { ok: false, error: `at most ${MAX_PRODUCT_IMAGES} images` };
  }

  const colors = cleanList(b.colors);
  const sizes = cleanList(b.sizes);
  const sleeves = cleanSleeves(b.sleeves);

  return {
    ok: true,
    input: {
      title,
      description: typeof b.description === "string" ? b.description.trim() : "",
      images,
      price: Math.round(price),
      colors,
      sizes,
      sleeves,
      soldOut: cleanSoldOut(b.soldOut, colors, sizes, sleeves.map((s) => s.name)),
      published: Boolean(b.published),
    },
  };
}

export function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN")}`;
}

/** What one unit costs for the chosen sleeve: that sleeve's own price if the
 * admin set one, otherwise the product's base price. */
export function unitPrice(product: Pick<ProductInput, "price" | "sleeves">, sleeve: string | null): number {
  const match = sleeve ? product.sleeves.find((s) => s.name === sleeve) : undefined;
  return match?.price ?? product.price;
}

/** Cheapest and dearest a product can cost — equal when no sleeve overrides the price. */
export function priceRange(product: Pick<ProductInput, "price" | "sleeves">): { min: number; max: number } {
  if (product.sleeves.length === 0) return { min: product.price, max: product.price };
  const prices = product.sleeves.map((s) => s.price ?? product.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Has the admin marked this exact color/size/sleeve combination out of stock? */
export function isSoldOut(product: Pick<ProductInput, "soldOut">, choice: VariantChoice): boolean {
  const key = variantKey(choice);
  return product.soldOut.some((entry) => variantKey(entry) === key);
}
