import "server-only";
import type { EmailEvent } from "@/lib/models/email-activity";

// Reads delivery events from Brevo. Needs BREVO_API_KEY — an *API* key, which
// is not the same thing as the SMTP key used for sending.

/** Brevo's longest look-back, and the most events one call returns. */
const DAYS = 90;
const LIMIT = 5000;

export const brevoConfigured = () => Boolean(process.env.BREVO_API_KEY);

/** The newest transactional email events. Throws if Brevo refuses or is unreachable. */
export async function fetchEmailEvents(): Promise<EmailEvent[]> {
  const url = `https://api.brevo.com/v3/smtp/statistics/events?days=${DAYS}&limit=${LIMIT}&sort=desc`;
  const res = await fetch(url, {
    headers: { "api-key": process.env.BREVO_API_KEY ?? "", accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Brevo returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { events?: Record<string, unknown>[] };
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  return (body.events ?? []).map((e) => ({
    to: text(e.email),
    subject: text(e.subject),
    event: text(e.event),
    date: text(e.date),
    messageId: text(e.messageId),
    reason: text(e.reason) || null,
  }));
}
