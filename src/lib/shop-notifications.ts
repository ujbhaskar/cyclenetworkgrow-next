import "server-only";
import { getGuestToken } from "@/lib/shop-guest";
import { isSyntheticEmail } from "@/lib/auth/phone";
import type { ShopOrder } from "@/lib/models/order";
import { sendEmail } from "@/lib/email";
import {
  adminCancelledEmail,
  adminNewOrderEmail,
  adminShipmentEmail,
  orderCancelledEmail,
  orderPaidEmail,
  shipmentEmail,
  type EmailContent,
} from "@/lib/shop-email-templates";

// Phone-only signups have a made-up address (…@phone.letscng.internal) that
// goes nowhere — never mail those.
const realEmail = (email: string | null | undefined): string | null => {
  const e = (email ?? "").trim();
  return e && !isSyntheticEmail(e) ? e : null;
};

/** Who gets the admin alerts: ADMIN_NOTIFY_EMAILS (comma-separated) if set,
 * otherwise just the shop mailbox. Individual admin accounts are not mailed. */
const DEFAULT_ADMIN_EMAIL = "cyclenetworkgrow@gmail.com";
async function adminRecipients(): Promise<string[]> {
  const configured = (process.env.ADMIN_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  return configured.length ? configured : [DEFAULT_ADMIN_EMAIL];
}

// One event -> the buyer's email and the admins' email, sent together. An
// admin who is also the buyer (testing) gets only the buyer's copy, so they
// aren't mailed twice.
async function notify(order: ShopOrder, label: string, rider: EmailContent | null, admin: EmailContent | null): Promise<void> {
  const riderTo = realEmail(order.shipTo.email);
  const adminTo = [...new Set(await adminRecipients())].filter((e) => e.toLowerCase() !== riderTo?.toLowerCase());

  const jobs: Promise<boolean>[] = [];
  if (rider && riderTo) jobs.push(sendEmail(riderTo, rider));
  else console.warn(`[shop email] ${label} for ${order.orderNumber}: buyer has no usable email, skipped`);
  if (admin) adminTo.forEach((to) => jobs.push(sendEmail(to, admin)));
  if (admin && adminTo.length === 0) console.warn(`[shop email] ${label} for ${order.orderNumber}: no admin email to notify`);
  await Promise.all(jobs);
}

// Where the buyer opens their order from the email: My orders for a rider; for a
// guest (no login) their private link, which carries the order's secret token.
async function viewUrl(order: ShopOrder): Promise<string | null> {
  if (!/^https?:\/\/[^\s/]+$/.test(order.origin)) return null;
  if (!order.guest) return `${order.origin}/my-orders/${order.id}`;
  const token = await getGuestToken(order.id);
  return token ? `${order.origin}/order/${order.id}?t=${encodeURIComponent(token)}` : null;
}

export const notifyOrderPaid = async (order: ShopOrder) =>
  notify(order, "new order", orderPaidEmail(order, await viewUrl(order)), adminNewOrderEmail(order));
export const notifyShipment = async (order: ShopOrder) =>
  notify(order, "shipment", shipmentEmail(order, await viewUrl(order)), adminShipmentEmail(order));
export const notifyCancelled = async (order: ShopOrder, wasPaid: boolean) =>
  notify(order, "cancellation", orderCancelledEmail(order, wasPaid, await viewUrl(order)), adminCancelledEmail(order, wasPaid));
