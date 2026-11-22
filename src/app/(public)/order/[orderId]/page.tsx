import { notFound } from "next/navigation";
import Link from "next/link";
import Container from "react-bootstrap/Container";
import { requireNavAccess } from "@/lib/nav-links";
import { guestTokenMatches } from "@/lib/shop-guest";
import { getOrder, syncOrderPayment } from "@/lib/shop-orders";
import OrderSummary from "@/components/shop/OrderSummary";
import ClearGuestCart from "@/components/shop/ClearGuestCart";

// A guest has no account, so this page is opened by a private link — the order
// id plus a secret token stored on the order. A wrong or missing token looks
// exactly like a missing order. Kept out of search engines.
export const metadata = { title: "Your order", robots: { index: false, follow: false } };

export default async function GuestOrderPage({ params, searchParams }: PageProps<"/order/[orderId]">) {
  const { orderId } = await params;
  await requireNavAccess("/shop");

  const raw = (await searchParams).t;
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token || !(await guestTokenMatches(orderId, token))) {
    notFound();
  }

  const found = await getOrder(orderId);
  if (!found) {
    notFound();
  }
  const order = await syncOrderPayment(found);

  return (
    <Container className="py-3" style={{ maxWidth: 900 }}>
      {order.status === "paid" && <ClearGuestCart />}

      <h1 className="fw-bold mb-1">
        {order.status === "paid"
          ? "Thank you — payment received"
          : order.status === "cancelled"
            ? "Order cancelled"
            : order.status === "expired"
              ? "Order expired"
              : "Order summary"}
      </h1>
      <p className="text-muted mb-1">Order {order.orderNumber}</p>
      <p className="text-muted small mb-4">
        Keep this page&apos;s link to check on your order. We&apos;ll also email you a receipt
        {order.shipTo.email ? ` at ${order.shipTo.email}` : ""}.
      </p>

      <OrderSummary order={order} />

      <p className="mt-4">
        <Link href="/shop" className="text-decoration-none">
          <i className="bi bi-arrow-left me-1" aria-hidden />
          Continue shopping
        </Link>
      </p>
    </Container>
  );
}
