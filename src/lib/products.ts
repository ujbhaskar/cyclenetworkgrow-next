import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Product, ProductInput, ProductSleeve } from "@/lib/models/product";

// This app's own collection. Named "shopProducts" (not "products") because
// challenge1177's Firestore is shared with the legacy letscng app — see the
// note on "events" in firestore.rules.
const COLLECTION = "shopProducts";

function toProduct(id: string, data: FirebaseFirestore.DocumentData): Product {
  return {
    id,
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : "",
    images: Array.isArray(data.images) ? data.images.filter((u: unknown): u is string => typeof u === "string") : [],
    price: typeof data.price === "number" ? data.price : 0,
    colors: Array.isArray(data.colors) ? data.colors.filter((c: unknown): c is string => typeof c === "string") : [],
    sizes: Array.isArray(data.sizes) ? data.sizes.filter((s: unknown): s is string => typeof s === "string") : [],
    sleeves: Array.isArray(data.sleeves)
      ? data.sleeves.flatMap((s: unknown): ProductSleeve[] => {
          if (typeof s === "string") return [{ name: s, price: null }];
          const o = s as { name?: unknown; price?: unknown } | null;
          return typeof o?.name === "string" ? [{ name: o.name, price: typeof o.price === "number" ? o.price : null }] : [];
        })
      : [],
    soldOut: Array.isArray(data.soldOut)
      ? data.soldOut.map((e: unknown) => {
          const o = (e ?? {}) as Record<string, unknown>;
          const opt = (v: unknown) => (typeof v === "string" && v ? v : null);
          return { color: opt(o.color), size: opt(o.size), sleeve: opt(o.sleeve) };
        })
      : [],
    published: data.published === true,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
  };
}

function newestFirst(a: Product, b: Product): number {
  return b.createdAt.localeCompare(a.createdAt);
}

/** Admin view — every product, published or not. */
export async function listAllProducts(): Promise<Product[]> {
  const snapshot = await adminDb.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => toProduct(doc.id, doc.data())).sort(newestFirst);
}

/** Public shop listing. Filtered in memory — the catalog is small, and it
 * avoids needing a composite index for published + createdAt. */
export async function listPublishedProducts(): Promise<Product[]> {
  const all = await listAllProducts();
  return all.filter((product) => product.published);
}

/** Public product page — null for missing OR unpublished products. */
export async function getPublishedProduct(id: string): Promise<Product | null> {
  const doc = await adminDb.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const product = toProduct(doc.id, doc.data() ?? {});
  return product.published ? product : null;
}

export async function createProduct(input: ProductInput): Promise<{ id: string }> {
  const ref = adminDb.collection(COLLECTION).doc();
  await ref.set({ ...input, createdAt: new Date().toISOString() });
  return { id: ref.id };
}

export async function updateProduct(id: string, input: ProductInput): Promise<boolean> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  if (!(await ref.get()).exists) return false;
  await ref.set(input, { merge: true });
  return true;
}

export async function deleteProduct(id: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).delete();
}
