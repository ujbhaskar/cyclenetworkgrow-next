import Link from "next/link";
import Container from "react-bootstrap/Container";
import { verifySession } from "@/lib/auth/dal";
import { listOrdersForUser, syncOrderPayment } from "@/lib/shop-orders";
import { formatPrice } from "@/lib/models/product";
import { formatOrderDate } from "@/components/shop/OrderSummary";
import OrderStatusBadge from "@/components/shop/OrderStatusBadge";

export const metadata = { title: "My orders" };

export default async function MyOrdersPage() {
  const session = await verifySession();
  // Unpaid ones are re-checked with Razorpay, so a payment finished in
  // another tab (or whose redirect back never landed) shows as paid here.
  const orders = await Promise.all((await listOrdersForUser(session.uid)).map(syncOrderPayment));

  return (
    <Container className="py-3" style={{ maxWidth: 900 }}>
      <h1 className="fw-bold mb-4">My orders</h1>

      {orders.length === 0 ? (
        <p className="text-muted">
          You haven&apos;t ordered anything yet. <Link href="/shop">Browse the shop</Link>
        </p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/my-orders/${order.id}`}
              className="bg-white border rounded p-3 text-decoration-none text-reset d-flex justify-content-between align-items-center gap-3"
            >
              <div>
                <div className="fw-semibold">
                  {order.items[0]?.productTitle}
                  {order.items.length > 1 && ` + ${order.items.length - 1} more`}
                </div>
                <div className="text-muted small">
                  {order.orderNumber} · {order.items.reduce((n, i) => n + i.qty, 0)} item
                  {order.items.reduce((n, i) => n + i.qty, 0) === 1 ? "" : "s"} · {formatOrderDate(order.createdAt)}
                </div>
              </div>
              <div className="text-end text-nowrap">
                <div className="fw-bold">{formatPrice(order.amount)}</div>
                <OrderStatusBadge status={order.status} />
                {order.shipment && order.status === "paid" && <span className="badge text-bg-info ms-1">Shipped</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
