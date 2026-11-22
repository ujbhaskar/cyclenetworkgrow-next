// Sends one test email through the SAME SMTP settings the shop uses, so you can
// check the setup without placing an order:
//
//   node scripts/send-test-email.mjs you@example.com
//
// Reads SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM from the
// environment, falling back to .env.local. Nothing is stored or logged apart
// from the result.
import { readFileSync, existsSync } from "node:fs";
import nodemailer from "nodemailer";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const to = process.argv[2];
if (!to || !to.includes("@")) {
  console.error("Usage: node scripts/send-test-email.mjs recipient@example.com");
  process.exit(1);
}

const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASS: pass, MAIL_FROM: from } = process.env;
const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Not configured — missing: ${missing.join(", ")}. Add them to .env.local (see .env.example).`);
  process.exit(1);
}

const port = Number(process.env.SMTP_PORT) || 587;
const mailer = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 12000,
});

try {
  await mailer.verify();
  console.log(`✔ Connected to ${host}:${port} and logged in as ${user}`);
  const info = await mailer.sendMail({
    from,
    to,
    subject: "Cycle Network Grow — test email",
    text: "If you can read this, the shop's email setup works.",
    html: "<p>If you can read this, the shop's email setup works. ✅</p>",
  });
  console.log(`✔ Sent to ${to} (server said: ${info.response})`);
  console.log("  Check the inbox — and the spam folder, especially the first time.");
} catch (err) {
  console.error("✘ Failed:", err.message);
  if (/Invalid login|535|auth/i.test(err.message)) console.error("  Wrong username/password (Gmail needs an App Password, not your normal one).");
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(err.message)) console.error("  Can't reach the SMTP server — check SMTP_HOST and SMTP_PORT.");
  process.exit(1);
}
