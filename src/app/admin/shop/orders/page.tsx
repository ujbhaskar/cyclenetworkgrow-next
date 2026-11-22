import { requireRole } from "@/lib/auth/dal";
import { listAllOrders, syncOrderPayment } from "@/lib/shop-orders";
import OrdersTable from "@/components/admin/OrdersTable";

export default async function AdminShopOrdersPage() {
  await requireRole("admin");
  // Unpaid orders are re-checked with Razorpay so the list is never stale.
  const orders = await Promise.all((await listAllOrders()).map(syncOrderPayment));

  return <OrdersTable orders={orders} />;
}
