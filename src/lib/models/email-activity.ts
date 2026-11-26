// Delivery events for the shop's emails, as reported by Brevo — no server-only
// imports so the admin client components can use these.

export type EmailEvent = {
  /** Recipient address. */
  to: string;
  subject: string;
  /** Brevo's event name, e.g. "requests", "delivered", "opened", "hardBounces". */
  event: string;
  date: string;
  /** Ties together the events of one sent email. */
  messageId: string;
  reason: string | null;
};

export type EmailEventsResponse =
  | { configured: false }
  | { configured: true; byOrder: Record<string, EmailEvent[]> };

export const RESENDABLE_EMAILS = ["confirmation", "shipment", "cancellation"] as const;
export type ResendableEmail = (typeof RESENDABLE_EMAILS)[number];

type Look = { label: string; variant: string; rank: number };

// Higher rank wins when summarising one email: a problem or an open says more
// than "sent".
const LOOKS: Record<string, Look> = {
  requests: { label: "Sent", variant: "secondary", rank: 1 },
  deferred: { label: "Deferred", variant: "warning", rank: 2 },
  softbounces: { label: "Soft bounce", variant: "warning", rank: 3 },
  delivered: { label: "Delivered", variant: "primary", rank: 4 },
  loadedbyproxy: { label: "Loaded by proxy", variant: "info", rank: 5 },
  opened: { label: "Opened", variant: "success", rank: 6 },
  clicks: { label: "Clicked", variant: "success", rank: 7 },
  unsubscribed: { label: "Unsubscribed", variant: "warning", rank: 8 },
  spam: { label: "Marked as spam", variant: "danger", rank: 9 },
  bounces: { label: "Bounced", variant: "danger", rank: 9 },
  hardbounces: { label: "Hard bounce", variant: "danger", rank: 9 },
  blocked: { label: "Blocked", variant: "danger", rank: 9 },
  invalid: { label: "Invalid address", variant: "danger", rank: 9 },
  error: { label: "Error", variant: "danger", rank: 9 },
};

export function emailEventLook(event: string): Look {
  return LOOKS[event.toLowerCase()] ?? { label: event, variant: "secondary", rank: 0 };
}

/** Where the most recent email to this address got to; null if Brevo has nothing for it. */
export function latestEmailStatus(events: EmailEvent[], to: string): EmailEvent | null {
  const mine = events.filter((e) => e.to.toLowerCase() === to.trim().toLowerCase());
  if (!mine.length) return null;
  // The newest email is the one whose first event is latest — an old email
  // being opened today mustn't hide a newer one that bounced.
  const started = new Map<string, number>();
  for (const e of mine) {
    const at = new Date(e.date).getTime();
    started.set(e.messageId, Math.min(at, started.get(e.messageId) ?? at));
  }
  const newest = [...started].sort((a, b) => b[1] - a[1])[0][0];
  return mine
    .filter((e) => e.messageId === newest)
    .sort((a, b) => emailEventLook(b.event).rank - emailEventLook(a.event).rank)[0];
}

export const EMAIL_FILTERS = [
  { value: "all", label: "Any email status" },
  { value: "problem", label: "Not delivered / problem" },
  { value: "requests", label: "Sent" },
  { value: "delivered", label: "Delivered" },
  { value: "loadedbyproxy", label: "Loaded by proxy" },
  { value: "opened", label: "Opened" },
  { value: "clicks", label: "Clicked" },
  { value: "none", label: "No email record" },
] as const;
export type EmailFilter = (typeof EMAIL_FILTERS)[number]["value"];

/** `latest` is latestEmailStatus() for the order's buyer. */
export function matchesEmailFilter(latest: EmailEvent | null, filter: EmailFilter): boolean {
  if (filter === "all") return true;
  if (!latest) return filter === "none";
  if (filter === "problem") return ["warning", "danger"].includes(emailEventLook(latest.event).variant);
  return latest.event.toLowerCase() === filter;
}

/** Which emails make sense to send again, given where the order is now. */
export function resendableEmails(order: { status: string; shipment: unknown }): ResendableEmail[] {
  if (order.status === "cancelled") return ["cancellation"];
  if (order.status !== "paid") return [];
  return order.shipment ? ["confirmation", "shipment"] : ["confirmation"];
}
