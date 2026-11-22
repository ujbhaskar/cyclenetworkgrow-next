// Pure builders for the shop's emails — no I/O, so they're easy to test and
// can't fail halfway through sending. Every value that came from a person
// (names, addresses, reasons, product titles) goes through esc() before it
// lands in HTML. "rider" emails go to the buyer; "admin" emails are the
// matching alert for whoever runs the shop.

import type { ShopOrder } from "@/lib/models/order";

export type EmailContent = { subject: string; html: string; text: string };

const esc = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const rupees = (n: number): string => `₹${n.toLocaleString("en-IN")}`;

const options = (i: { color: string | null; size: string | null; sleeve: string | null }): string =>
  [i.color, i.size, i.sleeve].filter(Boolean).join(" · ");

// Only ever link to an http(s) origin we stored ourselves.
function baseUrl(order: ShopOrder): string | null {
  return /^https?:\/\/[^\s/]+$/.test(order.origin) ? order.origin : null;
}
const riderUrl = (order: ShopOrder) => (baseUrl(order) ? `${baseUrl(order)}/my-orders/${order.id}` : null);
const adminUrl = (order: ShopOrder) => (baseUrl(order) ? `${baseUrl(order)}/admin/shop/orders` : null);

function itemsHtml(order: ShopOrder): string {
  return order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.productTitle)}<br><span style="color:#666;font-size:13px">${esc(options(i))} · ${i.qty} × ${rupees(i.unitPrice)}</span></td><td style="padding:6px 0;text-align:right;white-space:nowrap">${rupees(i.qty * i.unitPrice)}</td></tr>`,
    )
    .join("");
}

function itemsText(order: ShopOrder): string {
  return order.items.map((i) => `- ${i.qty} x ${i.productTitle} (${options(i)}) — ${rupees(i.qty * i.unitPrice)}`).join("\n");
}

function addressLines(order: ShopOrder): string[] {
  const s = order.shipTo;
  return [s.name, s.address, `${[s.city, s.state].filter(Boolean).join(", ")} ${s.pincode}`.trim(), s.phone ? `Phone: ${s.phone}` : ""].filter(Boolean);
}

function layout(title: string, bodyHtml: string, order: ShopOrder, link: { url: string | null; label: string }): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222">
<h2 style="color:#1e7e34;margin-bottom:4px">${esc(title)}</h2>
<p style="color:#666;margin-top:0">Order ${esc(order.orderNumber)}</p>
${bodyHtml}
${link.url ? `<p style="margin-top:24px"><a href="${esc(link.url)}" style="background:#1e7e34;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${esc(link.label)}</a></p>` : ""}
<p style="color:#888;font-size:12px;margin-top:28px">Cycle Network Grow</p>
</div>`;
}

const itemsTable = (order: ShopOrder, totalLabel?: string): string =>
  `<table style="width:100%;border-collapse:collapse;border-top:1px solid #ddd;border-bottom:1px solid #ddd">${itemsHtml(order)}${
    totalLabel
      ? `<tr><td style="padding:8px 0;border-top:1px solid #ddd"><strong>${esc(totalLabel)}</strong></td><td style="padding:8px 0;border-top:1px solid #ddd;text-align:right"><strong>${rupees(order.amount)}</strong></td></tr>`
      : ""
  }</table>`;

// ---------- rider ----------

export function orderPaidEmail(order: ShopOrder): EmailContent {
  const html = layout(
    "Thank you — your order is confirmed",
    `<p>Hi ${esc(order.shipTo.name)}, we've received your payment.</p>
${itemsTable(order, "Total paid")}
<p><strong>Transaction ID:</strong> ${esc(order.razorpayPaymentId ?? "—")}</p>
<p><strong>Delivering to:</strong><br>${addressLines(order).map(esc).join("<br>")}</p>
<p>We'll email you again once your order ships, with the courier and tracking details.</p>`,
    order,
    { url: riderUrl(order), label: "View your order" },
  );
  const url = riderUrl(order);
  const text = `Thank you — your order is confirmed.

Order ${order.orderNumber}
${itemsText(order)}
Total paid: ${rupees(order.amount)}
Transaction ID: ${order.razorpayPaymentId ?? "—"}

Delivering to:
${addressLines(order).join("\n")}

We'll email you again once your order ships.${url ? `\n\nView your order: ${url}` : ""}`;
  return { subject: `Order ${order.orderNumber} confirmed — thank you!`, html, text };
}

export function shipmentEmail(order: ShopOrder): EmailContent | null {
  const s = order.shipment;
  if (!s) return null;
  const link = s.trackingUrl && /^https?:\/\//i.test(s.trackingUrl) ? s.trackingUrl : null;
  const html = layout(
    "Your order is on its way",
    `<p>Hi ${esc(order.shipTo.name)}, your order has been handed to the courier.</p>
<p><strong>Courier:</strong> ${esc(s.courier)}<br><strong>Tracking number:</strong> ${esc(s.trackingNumber)}</p>
${s.note ? `<p>${esc(s.note)}</p>` : ""}
${link ? `<p><a href="${esc(link)}" style="background:#0d6efd;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Track shipment</a></p>` : `<p>Use the tracking number above on ${esc(s.courier)}'s website or app.</p>`}
<p style="color:#666;font-size:13px">Delivering to: ${addressLines(order).map(esc).join(", ")}</p>`,
    order,
    { url: riderUrl(order), label: "View your order" },
  );
  const text = `Your order is on its way.

Order ${order.orderNumber}
Courier: ${s.courier}
Tracking number: ${s.trackingNumber}${s.note ? `\n${s.note}` : ""}${link ? `\nTrack: ${link}` : ""}

Delivering to: ${addressLines(order).join(", ")}`;
  return { subject: `Order ${order.orderNumber} has shipped`, html, text };
}

export function orderCancelledEmail(order: ShopOrder, wasPaid: boolean): EmailContent {
  const reason = order.cancelReason;
  const html = layout(
    "Your order was cancelled",
    `<p>Hi ${esc(order.shipTo.name)}, your order ${esc(order.orderNumber)} has been cancelled.</p>
${reason ? `<p><strong>Reason:</strong> ${esc(reason)}</p>` : ""}
${itemsTable(order)}
${wasPaid ? `<p>You had already paid for this order. If you haven't heard about a refund soon, please contact us with your transaction ID: <strong>${esc(order.razorpayPaymentId ?? "—")}</strong>.</p>` : "<p>You haven't been charged for this order.</p>"}`,
    order,
    { url: riderUrl(order), label: "View your order" },
  );
  const url = riderUrl(order);
  const text = `Your order ${order.orderNumber} was cancelled.${reason ? `\nReason: ${reason}` : ""}

${itemsText(order)}

${wasPaid ? `You had already paid. If you haven't heard about a refund soon, contact us with your transaction ID: ${order.razorpayPaymentId ?? "—"}.` : "You haven't been charged for this order."}${url ? `\n\n${url}` : ""}`;
  return { subject: `Order ${order.orderNumber} was cancelled`, html, text };
}

// ---------- admin ----------

const contactHtml = (order: ShopOrder): string =>
  `<p><strong>Buyer:</strong> ${esc(order.shipTo.name)}<br>${esc(order.shipTo.phone || "no phone")} · ${esc(order.shipTo.email || "no email")}</p>`;
const contactText = (order: ShopOrder): string =>
  `Buyer: ${order.shipTo.name} — ${order.shipTo.phone || "no phone"} · ${order.shipTo.email || "no email"}`;

export function adminNewOrderEmail(order: ShopOrder): EmailContent {
  const html = layout(
    "New paid order",
    `${contactHtml(order)}
${itemsTable(order, "Total paid")}
<p><strong>Transaction ID:</strong> ${esc(order.razorpayPaymentId ?? "—")} (${esc((order.paymentMethod ?? "—").toUpperCase())})</p>
<p><strong>Ship to:</strong><br>${addressLines(order).map(esc).join("<br>")}</p>
<p>Next step: pack it and add the courier details on the Orders page.</p>`,
    order,
    { url: adminUrl(order), label: "Open orders" },
  );
  const url = adminUrl(order);
  const text = `New paid order ${order.orderNumber} — ${rupees(order.amount)}

${contactText(order)}
${itemsText(order)}
Transaction ID: ${order.razorpayPaymentId ?? "—"}

Ship to:
${addressLines(order).join("\n")}

Next: pack it and add courier details.${url ? `\n\nOrders: ${url}` : ""}`;
  return { subject: `New order ${order.orderNumber} — ${rupees(order.amount)} from ${order.shipTo.name}`, html, text };
}

export function adminShipmentEmail(order: ShopOrder): EmailContent | null {
  const s = order.shipment;
  if (!s) return null;
  const html = layout(
    "Courier details recorded",
    `${contactHtml(order)}
<p><strong>Courier:</strong> ${esc(s.courier)}<br><strong>Tracking number:</strong> ${esc(s.trackingNumber)}${s.trackingUrl ? `<br><strong>Tracking link:</strong> ${esc(s.trackingUrl)}` : ""}</p>
<p>The buyer has been emailed these details.</p>`,
    order,
    { url: adminUrl(order), label: "Open orders" },
  );
  const text = `Courier details recorded for ${order.orderNumber}

${contactText(order)}
Courier: ${s.courier}
Tracking number: ${s.trackingNumber}${s.trackingUrl ? `\nTracking link: ${s.trackingUrl}` : ""}

The buyer has been emailed these details.`;
  return { subject: `Shipped: order ${order.orderNumber} (${s.courier} ${s.trackingNumber})`, html, text };
}

export function adminCancelledEmail(order: ShopOrder, wasPaid: boolean): EmailContent {
  const html = layout(
    wasPaid ? "Order cancelled — refund needed" : "Order cancelled",
    `${contactHtml(order)}
${order.cancelReason ? `<p><strong>Reason:</strong> ${esc(order.cancelReason)}</p>` : ""}
${itemsTable(order, wasPaid ? "Paid" : undefined)}
${wasPaid ? `<p style="color:#b02a37"><strong>This order was already paid.</strong> Cancelling does not refund it — refund transaction <strong>${esc(order.razorpayPaymentId ?? "—")}</strong> (${rupees(order.amount)}) in the Razorpay dashboard.</p>` : "<p>It was unpaid — nothing to refund.</p>"}`,
    order,
    { url: adminUrl(order), label: "Open orders" },
  );
  const text = `Order ${order.orderNumber} cancelled${wasPaid ? " — REFUND NEEDED" : ""}

${contactText(order)}${order.cancelReason ? `\nReason: ${order.cancelReason}` : ""}
${itemsText(order)}

${wasPaid ? `Already paid. Refund ${order.razorpayPaymentId ?? "—"} (${rupees(order.amount)}) in the Razorpay dashboard.` : "It was unpaid — nothing to refund."}`;
  return {
    subject: wasPaid ? `REFUND NEEDED: order ${order.orderNumber} cancelled (${rupees(order.amount)})` : `Order ${order.orderNumber} cancelled`,
    html,
    text,
  };
}
