import { formatPrice } from "@/lib/models/product";
import Link from "next/link";
import { PAYMENT_WINDOW_MINUTES, orderItemOptions, type ShopOrder } from "@/lib/models/order";
import OrderStatusBadge from "@/components/shop/OrderStatusBadge";

export function formatOrderDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="d-flex justify-content-between gap-3 py-2 border-bottom">
      <span className="text-muted">{label}</span>
      <span className="text-end">{children}</span>
    </div>
  );
}

// Read-only receipt shown to the rider: what they ordered, the Razorpay
// transaction details, and where it's going.
export default function OrderSummary({ order }: { order: ShopOrder }) {
  const paid = order.status === "paid";
  const ship = order.shipTo;

  return (
    <div className="row g-4">
      <div className="col-md-7">
        <div className="bg-white border rounded p-3 mb-4">
          <h2 className="h6 fw-bold mb-3">Order summary</h2>
          <div className="d-flex flex-column gap-3 mb-3">
            {order.items.map((item, index) => (
              <div key={index} className="d-flex gap-3">
                {item.productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external Firebase Storage URL
                  <img src={item.productImage} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} />
                ) : (
                  <div className="bg-light rounded" style={{ width: 72, height: 72 }} />
                )}
                <div className="flex-grow-1">
                  <div className="fw-semibold">{item.productTitle}</div>
                  <div className="text-muted small">{orderItemOptions(item)}</div>
                  <div className="text-muted small">
                    {item.qty} × {formatPrice(item.unitPrice)}
                  </div>
                </div>
                <div className="fw-bold text-nowrap">{formatPrice(item.unitPrice * item.qty)}</div>
              </div>
            ))}
          </div>
          <Row label="Order ID">{order.orderNumber}</Row>
          <Row label="Placed on">{formatOrderDate(order.createdAt)}</Row>
          <Row label="Total">
            <strong>{formatPrice(order.amount)}</strong>
          </Row>
        </div>

        {paid && (
        <div className="bg-white border rounded p-3 mb-4">
          <h2 className="h6 fw-bold mb-3">Shipment</h2>
          {order.shipment ? (
            <>
              <Row label="Courier">{order.shipment.courier}</Row>
              <Row label="Tracking number">
                <code>{order.shipment.trackingNumber}</code>
              </Row>
              <Row label="Shipped on">{formatOrderDate(order.shipment.shippedAt)}</Row>
              {order.shipment.note && <Row label="Note">{order.shipment.note}</Row>}
              {order.shipment.trackingUrl ? (
                <a
                  href={order.shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-success mt-3"
                >
                  <i className="bi bi-truck me-1" aria-hidden />
                  Track shipment
                </a>
              ) : (
                <p className="text-muted small mt-3 mb-0">
                  Use the tracking number above on {order.shipment.courier}&apos;s website or app.
                </p>
              )}
            </>
          ) : (
            <p className="text-muted small mb-0">
              Your order hasn&apos;t been shipped yet. Courier and tracking details will appear here once it is.
            </p>
          )}
        </div>
        )}

        <div className="bg-white border rounded p-3">
          <h2 className="h6 fw-bold mb-3">Transaction details</h2>
          <Row label="Status">
            <OrderStatusBadge status={order.status} />
          </Row>

          {order.status === "paid" && (
            <>
              <Row label="Transaction ID">
                <code>{order.razorpayPaymentId ?? "—"}</code>
              </Row>
              <Row label="Payment method">{order.paymentMethod ? order.paymentMethod.toUpperCase() : "—"}</Row>
              <Row label="Paid on">{formatOrderDate(order.paidAt)}</Row>
              <Row label="Amount paid">{formatPrice(order.amount)}</Row>
            </>
          )}

          {order.status === "created" && (
            <>
              <p className="text-muted small mt-3 mb-0">
                We haven&apos;t received your payment yet. Orders must be paid within {PAYMENT_WINDOW_MINUTES} minutes of
                placing them, otherwise they expire.
                {order.paymentLinkUrl && " If you were charged, refresh this page in a minute."}
              </p>
              {order.paymentLinkUrl && (
                <a href={order.paymentLinkUrl} className="btn btn-success mt-3">
                  Complete payment
                </a>
              )}
            </>
          )}

          {order.status === "expired" && (
            <>
              <p className="text-muted small mt-3 mb-0">
                This order wasn&apos;t paid within {PAYMENT_WINDOW_MINUTES} minutes, so it expired. You haven&apos;t been
                charged. Your items are still in your cart if you&apos;d like to try again.
              </p>
              <Link href="/cart" className="btn btn-success mt-3">
                Go to my cart
              </Link>
            </>
          )}

          {order.status === "cancelled" && (
            <>
              <Row label="Cancelled on">{formatOrderDate(order.cancelledAt)}</Row>
              {order.cancelReason && <Row label="Reason">{order.cancelReason}</Row>}
              <p className="text-muted small mt-3 mb-0">
                {order.razorpayPaymentId
                  ? `This order was cancelled after payment. If you haven't received a refund soon, contact us with your transaction ID ${order.razorpayPaymentId}.`
                  : "This order was cancelled. You haven't been charged."}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="col-md-5">
        <div className="bg-white border rounded p-3">
          <h2 className="h6 fw-bold mb-3">Delivery address</h2>
          <p className="mb-0" style={{ whiteSpace: "pre-line" }}>
            <strong>{ship.name}</strong>
            {"\n"}
            {ship.address}
            {"\n"}
            {[ship.city, ship.state].filter(Boolean).join(", ")} {ship.pincode}
            {ship.phone && `\nPhone: ${ship.phone}`}
          </p>
        </div>
      </div>
    </div>
  );
}
