import "server-only";
import { adminDb } from "@/lib/firebase/admin";
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
 * otherwise every admin account's own email. */
async function adminRecipients(): Promise<string[]> {
  const configured = (process.env.ADMIN_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (configured.length) return configured;

  try {
    const snapshot = await adminDb.collection("users").where("role", "==", "admin").get();
    return snapshot.docs.map((doc) => realEmail(doc.data().email)).filter((e): e is string => Boolean(e));
  } catch (err) {
    console.error("[shop email] couldn't look up admin emails:", err);
    return [];
  }
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

export const notifyOrderPaid = (order: ShopOrder) =>
  notify(order, "new order", orderPaidEmail(order), adminNewOrderEmail(order));
export const notifyShipment = (order: ShopOrder) =>
  notify(order, "shipment", shipmentEmail(order), adminShipmentEmail(order));
export const notifyCancelled = (order: ShopOrder, wasPaid: boolean) =>
  notify(order, "cancellation", orderCancelledEmail(order, wasPaid), adminCancelledEmail(order, wasPaid));
