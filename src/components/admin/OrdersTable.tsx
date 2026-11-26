"use client";

import { useCallback, useEffect, useState } from "react";
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
import OrderEmailModal from "./OrderEmailModal";
import { EMAIL_FILTERS, emailEventLook, latestEmailStatus, matchesEmailFilter, type EmailEventsResponse, type EmailFilter } from "@/lib/models/email-activity";

type Filter = "all" | "paid" | "created" | "cancelled" | "expired" | "flagged" | "pinned";

export default function OrdersTable({
  orders: initialOrders,
  links,
}: {
  orders: ShopOrder[];
  /** Order id -> the buyer's order page; null when one can't be built. */
  links: Record<string, string | null>;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  async function copyLink(order: ShopOrder) {
    const link = links[order.id];
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(order.id);
      setTimeout(() => setCopiedId((id) => (id === order.id ? null : id)), 2000);
    } catch {
      // Clipboard blocked (e.g. plain http) — show it so it can be copied by hand.
      prompt(`Order link for ${order.orderNumber}`, link);
    }
  }
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
  const [emailing, setEmailing] = useState<ShopOrder | null>(null);
  // Delivery status comes from Brevo after the page loads, so a slow or
  // failing Brevo never holds up the order list.
  const [emailData, setEmailData] = useState<EmailEventsResponse | "failed" | null>(null);
  const [refreshingEmails, setRefreshingEmails] = useState(false);
  const fetchEmailData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders/email-events", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setEmailData(await res.json());
    } catch {
      setEmailData("failed");
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request returns
    fetchEmailData();
  }, [fetchEmailData]);
  async function refreshEmails() {
    setRefreshingEmails(true);
    await fetchEmailData();
    setRefreshingEmails(false);
  }
  const emailNote =
    emailData === null
      ? "Loading delivery status…"
      : emailData === "failed"
        ? "Couldn't read delivery status from Brevo."
        : !emailData.configured
          ? "Delivery status isn't set up yet — BREVO_API_KEY is missing."
          : null;
  const emailEvents = (order: ShopOrder) =>
    emailData && emailData !== "failed" && emailData.configured ? (emailData.byOrder[order.orderNumber] ?? []) : [];
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("all");

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
    // Ignored until delivery status has loaded — otherwise every order would look like it has none.
    .filter((order) => emailNote !== null || matchesEmailFilter(latestEmailStatus(emailEvents(order), order.shipTo.email), emailFilter))
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
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="h3 mb-0">Shop orders</h1>
        <span className="text-muted small">
          {orders.filter((o) => o.status === "paid").length} paid · {formatPrice(paidTotal)} collected
        </span>
      </div>
      <a href="/api/admin/orders/export" className="btn btn-sm btn-outline-success mb-3" download>
        <i className="bi bi-file-earmark-excel me-1" aria-hidden />
        Download Excel
      </a>

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
        <Form.Select
          size="sm"
          style={{ width: 220 }}
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value as EmailFilter)}
          disabled={emailNote !== null}
          title={emailNote ?? "Filter by the latest email to the buyer"}
          aria-label="Filter by email status"
        >
          {EMAIL_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Form.Select>
        <span className="text-muted small ms-auto align-self-center">
          {visible.length} of {orders.length}
        </span>
      </div>

      <Table responsive hover className="table table-striped align-middle">
        <thead>
          <tr>
            <th className="text-nowrap">Sl No</th>
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
            <th className="text-nowrap">Email delivery</th>
            <th className="text-nowrap">Send email</th>
            <th className="text-nowrap">Order link</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={16} className="text-muted text-center py-4">
                No orders to show.
              </td>
            </tr>
          )}
          {visible.map((order, position) => (
            <tr
              key={order.id}
              className={order.flag ? "table-danger" : order.pinned ? "table-warning" : ""}
              style={order.status === "cancelled" || order.status === "expired" ? { opacity: 0.65 } : undefined}
            >
              <td>{position + 1}</td>
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
              <td className="text-nowrap small">
                {(() => {
                  const latest = latestEmailStatus(emailEvents(order), order.shipTo.email);
                  const look = latest && emailEventLook(latest.event);
                  return (
                    <span title={emailNote ?? "Latest email to the buyer"}>
                      {look ? <Badge bg={look.variant}>{look.label}</Badge> : <span className="text-muted">—</span>}
                    </span>
                  );
                })()}
              </td>
              <td className="text-nowrap">
                <Button size="sm" variant="primary" onClick={() => setEmailing(order)}>
                  <i className="bi bi-envelope me-1" aria-hidden />
                  Send email
                </Button>
              </td>
              <td className="text-nowrap">
                <Button
                  size="sm"
                  variant={copiedId === order.id ? "success" : "outline-success"}
                  onClick={() => copyLink(order)}
                  disabled={!links[order.id]}
                  title={
                    !links[order.id]
                      ? "No link available for this order"
                      : order.guest
                        ? "Anyone with this link can open the order, so send it only to the buyer"
                        : "The rider has to sign in to open this link"
                  }
                >
                  <i className={`bi ${copiedId === order.id ? "bi-check-lg" : "bi-link-45deg"} me-1`} aria-hidden />
                  {copiedId === order.id ? "Copied" : "Copy link"}
                </Button>
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

      <OrderEmailModal
        key={`email-${emailing?.id ?? "closed"}`}
        // The live row, so an email address corrected meanwhile is what's shown.
        order={orders.find((o) => o.id === emailing?.id) ?? null}
        events={emailing ? emailEvents(emailing) : []}
        statusNote={emailNote}
        refreshing={refreshingEmails}
        onRefresh={refreshEmails}
        onClose={() => setEmailing(null)}
      />

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
