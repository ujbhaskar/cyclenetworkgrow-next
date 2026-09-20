import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthPageLayout({
  eyebrow,
  heading,
  subtitle,
  children,
  maxWidth = 460,
}: {
  eyebrow: string;
  heading: string;
  subtitle: ReactNode;
  children: ReactNode;
  /** Login's short two-field form and signup's much longer one don't want
   * the same cap — the surrounding .container + mx-auto already keeps this
   * from overflowing on mobile, so widening it here only affects desktop. */
  maxWidth?: number;
}) {
  return (
    <div className="flex-grow-1 d-flex align-items-center py-5" style={{ backgroundColor: "#fafff1" }}>
      <div className="container">
        <div
          className="mx-auto shadow-sm p-4 p-md-5"
          style={{ maxWidth, borderRadius: 24, backgroundColor: "#fffef8" }}
        >
          <span className="text-uppercase small fw-semibold text-muted">{eyebrow}</span>
          <h1 className="h3 fw-bold mb-2 mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            {heading}
          </h1>
          <p className="text-muted mb-4">{subtitle}</p>

          {children}

          <p className="text-center small text-muted mt-4 mb-0">
            Need help? <Link href="/contact">Contact support</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
