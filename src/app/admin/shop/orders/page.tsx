import { requireRole } from "@/lib/auth/dal";
import { listAllOrders, syncOrderPayment } from "@/lib/shop-orders";
import { orderViewUrl } from "@/lib/shop-notifications";
import OrdersTable from "@/components/admin/OrdersTable";

export default async function AdminShopOrdersPage() {
  await requireRole("admin");
  // Unpaid orders are re-checked with Razorpay so the list is never stale.
  const orders = await Promise.all((await listAllOrders()).map(syncOrderPayment));

  // Each buyer's order link, so an admin can copy and send it. Admin-only page:
  // a guest's link carries the secret that opens their order.
  const links = Object.fromEntries(await Promise.all(orders.map(async (o) => [o.id, await orderViewUrl(o)] as const)));

  return <OrdersTable orders={orders} links={links} />;
}
