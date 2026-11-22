"use client";

import { useEffect, useState } from "react";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import { formatPrice } from "@/lib/models/product";
import { DELETE_AFTER_DAYS, canDeleteOrder, deletableFrom, isPaymentWindowOpen, orderItemOptions, paymentWindowMessage, type OrderFlag, type OrderShipTo, type OrderShipment, type ShopOrder } from "@/lib/models/order";
import { formatOrderDate } from "@/components/shop/OrderSummary";
import ShipmentModal from "./ShipmentModal";
import OrderAddressModal from "./OrderAddressModal";
import OrderFlagModal from "./OrderFlagModal";
import OrderCancelModal from "./OrderCancelModal";
import OrderStatusBadge from "@/components/shop/OrderStatusBadge";

type Filter = "all" | "paid" | "created" | "cancelled" | "expired" | "flagged" | "pinned";

export default function OrdersTable({ orders: initialOrders }: { orders: ShopOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [shipping, setShipping] = useState<ShopOrder | null>(null);
  const [editingAddress, setEditingAddress] = useState<ShopOrder | null>(null);
  const [flagging, setFlagging] = useState<ShopOrder | null>(null);
  const [cancelling, setCancelling] = useState<ShopOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Re-render every 30s so the buttons of an order unlock by themselves once
  // its payment window closes, without reloading the page.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  function handleShipmentSaved(orderId: string, shipment: OrderShipment | null) {
    setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, shipment } : o)));
  }

  const patch = (orderId: string, change: Partial<ShopOrder>) =>
    setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, ...change } : o)));

  async function togglePin(order: ShopOrder) {
    setError(null);
    const pinned = !order.pinned;
    patch(order.id, { pinned }); // optimistic
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
    if (!res.ok) {
      patch(order.id, { pinned: order.pinned });
      setError("Couldn't update the pin.");
    }
  }

  async function handleDelete(order: ShopOrder) {
    const warning =
      order.status === "paid"
        ? `${order.orderNumber} is PAID (${formatPrice(order.amount)}). Deleting it does NOT refund the payment — refund it in the Razorpay dashboard separately.\n\nDelete this order permanently?`
        : `Delete ${order.orderNumber} permanently?`;
    // (The server enforces the 7-day rule too; this is just so a stale tab can't mislead.)
    if (!confirm(warning)) return;
    setError(null);
    const res = await fetch(`/api/admin/orders/${order.id}`, { method: "DELETE" });
    if (res.ok) {
      setOrders((list) => list.filter((o) => o.id !== order.id));
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't delete that order.");
    }
  }

  const term = search.trim().toLowerCase();
  const visible = orders
    .filter((order) => {
    if (filter === "flagged") return order.flag !== null && matchesSearch(order);
    if (filter === "pinned") return order.pinned && matchesSearch(order);
    if (filter !== "all" && order.status !== filter) return false;
    return matchesSearch(order);
    })
    // Pinned first; the server already sends newest-first, and sort() is stable.
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  function matchesSearch(order: ShopOrder): boolean {
    if (!term) return true;
    return [
      order.orderNumber,
      order.shipTo.name,
      order.shipTo.phone,
      order.shipTo.email,
      order.flag?.reason ?? "",
      ...order.items.map((i) => i.productTitle),
      order.razorpayPaymentId ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  }

  const paidTotal = orders.filter((o) => o.status === "paid").reduce((sum, o) => sum + o.amount, 0);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Shop orders</h1>
        <span className="text-muted small">
          {orders.filter((o) => o.status === "paid").length} paid · {formatPrice(paidTotal)} collected
        </span>
      </div>

      {error && <p className="text-danger small">{error}</p>}

      <div className="d-flex flex-wrap gap-2 mb-3">
        <Form.Control
          size="sm"
          style={{ width: 260 }}
          placeholder="Search order, name, phone, email, product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Form.Select size="sm" style={{ width: 170 }} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All orders</option>
          <option value="paid">Paid</option>
          <option value="created">Payment pending</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
          <option value="flagged">Flagged</option>
          <option value="pinned">Pinned</option>
        </Form.Select>
        <span className="text-muted small ms-auto align-self-center">
          {visible.length} of {orders.length}
        </span>
      </div>

      <Table responsive hover className="table table-striped align-middle">
        <thead>
          <tr>
            <th>Order</th>
            <th>Date</th>
            <th>Rider</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Items</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Transaction ID</th>
            <th>Delivery address</th>
            <th>Courier</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={12} className="text-muted text-center py-4">
                No orders to show.
              </td>
            </tr>
          )}
          {visible.map((order) => (
            <tr
              key={order.id}
              className={order.flag ? "table-danger" : order.pinned ? "table-warning" : ""}
              style={order.status === "cancelled" || order.status === "expired" ? { opacity: 0.65 } : undefined}
            >
              <td className="text-nowrap fw-semibold">
                {order.pinned && <i className="bi bi-pin-angle-fill text-warning-emphasis me-1" title="Pinned" aria-label="Pinned" />}
                {order.orderNumber}
                {order.flag && (
                  <div className="small fw-normal text-danger" style={{ maxWidth: 200, whiteSpace: "normal" }}>
                    <i className="bi bi-flag-fill me-1" aria-hidden />
                    {order.flag.reason}
                  </div>
                )}
              </td>
              <td className="text-nowrap">{formatOrderDate(order.createdAt)}</td>
              <td className="text-nowrap">
                {order.shipTo.name}
                {order.guest && <span className="badge text-bg-secondary ms-1" title="Checked out without an account">Guest</span>}
              </td>
              <td className="text-nowrap">{order.shipTo.phone || "—"}</td>
              <td>{order.shipTo.email || "—"}</td>
              <td style={{ minWidth: 220 }}>
                {order.items.map((item, index) => (
                  <div key={index} className="small mb-1">
                    <strong>{item.qty} ×</strong> {item.productTitle}
                    <div className="text-muted">{orderItemOptions(item)} · {formatPrice(item.unitPrice)} each</div>
                  </div>
                ))}
              </td>
              <td className="text-nowrap">{formatPrice(order.amount)}</td>
              <td>
                <OrderStatusBadge status={order.status} />
                {order.paymentMethod && order.status === "paid" && (
                  <div className="text-muted small">{order.paymentMethod.toUpperCase()}</div>
                )}
                {order.status === "cancelled" && (
                  <div className="small text-danger" style={{ maxWidth: 180, whiteSpace: "normal" }}>
                    {order.cancelReason ?? "No reason given"}
                    {order.razorpayPaymentId && <div className="fw-semibold">Paid — refund in Razorpay</div>}
                  </div>
                )}
              </td>
              <td>
                <code className="small">{order.razorpayPaymentId ?? "—"}</code>
              </td>
              <td style={{ minWidth: 220 }} className="small">
                {order.shipTo.address}, {order.shipTo.city}, {order.shipTo.state} {order.shipTo.pincode}
              </td>
              <td className="text-nowrap small">
                {order.shipment && (
                  <div className="mb-1">
                    <Badge bg="info" text="dark" className="me-1">
                      Shipped
                    </Badge>
                    {order.shipment.courier}
                    <div className="text-muted">{order.shipment.trackingNumber}</div>
                  </div>
                )}
                {order.status === "paid" ? (
                  <Button size="sm" variant="outline-secondary" onClick={() => setShipping(order)}>
                    {order.shipment ? "Edit" : "Add courier"}
                  </Button>
                ) : (
                  <span className="text-muted">{order.status === "created" ? "Awaiting payment" : "—"}</span>
                )}
              </td>
              <td className="text-nowrap">
                <div className="d-flex gap-1">
                  <Button
                    size="sm"
                    variant={order.pinned ? "warning" : "outline-secondary"}
                    onClick={() => togglePin(order)}
                    title={order.pinned ? "Unpin" : "Pin to top"}
                  >
                    <i className="bi bi-pin-angle" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant={order.flag ? "danger" : "outline-secondary"}
                    onClick={() => setFlagging(order)}
                    title={order.flag ? "Edit or clear flag" : "Flag this order"}
                  >
                    <i className="bi bi-flag" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => setEditingAddress(order)}
                    disabled={isPaymentWindowOpen(order)}
                    title={isPaymentWindowOpen(order) ? paymentWindowMessage(order) : "Edit delivery details"}
                  >
                    <i className="bi bi-pencil" aria-hidden />
                  </Button>
                  {(order.status === "created" || order.status === "paid") && (
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => setCancelling(order)}
                      title={
                        isPaymentWindowOpen(order)
                          ? paymentWindowMessage(order)
                          : order.shipment
                            ? "Remove the courier details before cancelling"
                            : "Cancel this order"
                      }
                      disabled={Boolean(order.shipment) || isPaymentWindowOpen(order)}
                    >
                      <i className="bi bi-x-circle" aria-hidden />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => handleDelete(order)}
                    disabled={!canDeleteOrder(order)}
                    title={
                      canDeleteOrder(order)
                        ? "Delete order permanently"
                        : `Can be deleted ${DELETE_AFTER_DAYS} days after the order — from ${new Date(deletableFrom(order)).toLocaleDateString("en-IN", { dateStyle: "medium" })}. Cancel it instead.`
                    }
                  >
                    <i className="bi bi-trash3" aria-hidden />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <OrderAddressModal
        key={`addr-${editingAddress?.id ?? "closed"}`}
        order={editingAddress}
        onClose={() => setEditingAddress(null)}
        onSaved={(orderId, shipTo: OrderShipTo) => patch(orderId, { shipTo })}
      />

      <OrderFlagModal
        key={`flag-${flagging?.id ?? "closed"}`}
        order={flagging}
        onClose={() => setFlagging(null)}
        onSaved={(orderId, flag: OrderFlag | null) => patch(orderId, { flag })}
      />

      <OrderCancelModal
        key={`cancel-${cancelling?.id ?? "closed"}`}
        order={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={(orderId, change) => patch(orderId, change)}
      />

      <ShipmentModal
        key={shipping?.id ?? "closed"}
        order={shipping}
        onClose={() => setShipping(null)}
        onSaved={handleShipmentSaved}
      />
    </div>
  );
}
