import "server-only";
import nodemailer from "nodemailer";

// Plain SMTP, so any provider works (Gmail app password, Brevo, SES, Zoho…).
//   SMTP_HOST, SMTP_PORT (587 for STARTTLS, 465 for SSL), SMTP_USER, SMTP_PASS,
//   MAIL_FROM  e.g.  "Cycle Network Grow <orders@yourdomain.com>"
// Not configured => emails are skipped with a log line; the shop keeps working.

function transport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM;
  if (!host || !user || !pass || !from) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  // Some providers (Brevo, with a free-mail sender like a Gmail address) send
  // from an address of their own, which has no inbox — so point replies at a
  // real mailbox: MAIL_REPLY_TO, or else the address inside MAIL_FROM.
  const replyTo = process.env.MAIL_REPLY_TO || from.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] || from;
  return {
    from,
    replyTo,
    mailer: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      // Don't let a slow mail server hold up a payment redirect.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
    }),
  };
}

/** Sends one email. Never throws — returns whether it was handed to the mail server. */
export async function sendEmail(to: string, content: { subject: string; html: string; text: string }): Promise<boolean> {
  const t = transport();
  if (!t) {
    console.warn(`[email] SMTP isn't configured — skipped "${content.subject}"`);
    return false;
  }
  try {
    await t.mailer.sendMail({ from: t.from, replyTo: t.replyTo, to, subject: content.subject, html: content.html, text: content.text });
    return true;
  } catch (err) {
    console.error(`[email] couldn't send "${content.subject}":`, err);
    return false;
  }
}
