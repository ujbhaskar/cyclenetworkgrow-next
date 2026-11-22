import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "react-bootstrap/Container";
import { verifySession } from "@/lib/auth/dal";
import { getOrder, syncOrderPayment } from "@/lib/shop-orders";
import OrderSummary from "@/components/shop/OrderSummary";

export const metadata = { title: "Order summary" };

export default async function OrderPage({ params }: PageProps<"/my-orders/[orderId]">) {
  const session = await verifySession();
  const { orderId } = await params;
  const found = await getOrder(orderId);

  // Someone else's order looks exactly like a missing one. Admins may view any.
  if (!found || (found.uid !== session.uid && session.role !== "admin")) {
    notFound();
  }
  const order = await syncOrderPayment(found);

  return (
    <Container className="py-3" style={{ maxWidth: 900 }}>
      <Link href="/my-orders" className="text-decoration-none small">
        <i className="bi bi-arrow-left me-1" aria-hidden />
        My orders
      </Link>

      <h1 className="fw-bold mt-2 mb-1">
        {order.status === "paid"
          ? "Thank you — payment received"
          : order.status === "cancelled"
            ? "Order cancelled"
            : order.status === "expired"
              ? "Order expired"
              : "Order summary"}
      </h1>
      <p className="text-muted mb-4">Order {order.orderNumber}</p>

      <OrderSummary order={order} />
    </Container>
  );
}
