import { requireRole } from "@/lib/auth/dal";
import { listAllProducts } from "@/lib/products";
import ProductsTable from "@/components/admin/ProductsTable";

export default async function AdminShopPage() {
  await requireRole("admin");
  const products = await listAllProducts();

  return <ProductsTable initialProducts={products} />;
}
