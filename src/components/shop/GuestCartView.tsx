"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { INDIAN_STATES_AND_UTS } from "@/lib/models/india-states";
import { formatPrice } from "@/lib/models/product";
import type { ResolvedCart } from "@/lib/models/cart";
import { loginUrlWithNext } from "@/lib/auth/redirect";
import { readGuestCart, setGuestLineQty } from "@/lib/guest-cart";
import CartLines from "./CartLines";

type Details = { name: string; phone: string; email: string; address: string; city: string; state: string; pincode: string };
const EMPTY: Details = { name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "" };

// Checkout for a visitor with no account: the cart (kept in their browser),
// a form for the details we need to deliver and send a receipt, then Razorpay.
export default function GuestCartView() {
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState<ResolvedCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [form, setForm] = useState<Details>(EMPTY);
  const [website, setWebsite] = useState(""); // honeypot — real people never see or fill it
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Price the browser's cart against the live catalog.
  const refresh = useCallback(async () => {
    const lines = readGuestCart();
    if (lines.length === 0) {
      setCart({ lines: [], subtotal: 0, itemCount: 0, hasProblems: false });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/shop/cart/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (!res.ok) throw new Error();
      setCart((await res.json()) as ResolvedCart);
      setError(null);
    } catch {
      setError("Couldn't load your cart. Please refresh the page.");
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  // Initial load. Deferred a tick so the state updates happen outside the effect body.
  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  // Back from Razorpay can restore this page from the back/forward cache with
  // `paying` still set; reset it when that happens.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPaying(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  async function change(key: string, qty: number) {
    setBusyKey(key);
    setGuestLineQty(key, qty);
    await refresh();
    setBusyKey(null);
  }

  const set = (field: keyof Details, value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!cart || cart.lines.length === 0 || cart.hasProblems) return;
    setError(null);
    setPaying(true);
    try {
      const res = await fetch("/api/shop/guest-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: readGuestCart(), details: form, website }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't start the payment. Please try again.");
      window.location.href = body.url; // leave `paying` on — the page is navigating away
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the payment.");
      setPaying(false);
    }
  }

  if (!ready) {
    return <p className="text-muted">Loading your cart…</p>;
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <p className="text-muted">
        Your cart is empty. <Link href="/shop">Continue shopping</Link>
      </p>
    );
  }

  const field = (id: keyof Details, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="mb-2">
      <label htmlFor={`g-${id}`} className="form-label small mb-1">
        {label} <span className="text-danger">*</span>
      </label>
      <input
        id={`g-${id}`}
        className="form-control"
        required
        value={form[id]}
        onChange={(e) => set(id, e.target.value)}
        {...props}
      />
    </div>
  );

  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <CartLines lines={cart.lines} busyKey={busyKey} dimmed={loading} onQty={change} onRemove={(key) => change(key, 0)} />
        <p className="mt-3 mb-0">
          <Link href="/shop" className="text-decoration-none">
            <i className="bi bi-arrow-left me-1" aria-hidden />
            Continue shopping
          </Link>
        </p>
      </div>

      <div className="col-lg-5">
        <form className="bg-white border rounded p-3 mb-3" onSubmit={pay}>
          <h2 className="h6 fw-bold mb-1">Your details</h2>
          <p className="text-muted small">
            No account needed.{" "}
            <Link href={loginUrlWithNext("/cart")}>Log in</Link> instead if you have one.
          </p>

          {field("name", "Full name", { autoComplete: "name", maxLength: 100 })}
          <div className="row g-2">
            <div className="col-sm-6">
              {field("phone", "Phone", { type: "tel", inputMode: "numeric", autoComplete: "tel-national", placeholder: "10 digits", maxLength: 14 })}
            </div>
            <div className="col-sm-6">
              {field("email", "Email", { type: "email", autoComplete: "email", maxLength: 120 })}
            </div>
          </div>
          <div className="mb-2">
            <label htmlFor="g-address" className="form-label small mb-1">
              Address <span className="text-danger">*</span>
            </label>
            <textarea
              id="g-address"
              className="form-control"
              rows={3}
              required
              maxLength={500}
              autoComplete="street-address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
          <div className="row g-2">
            <div className="col-sm-5">{field("city", "City", { autoComplete: "address-level2", maxLength: 80 })}</div>
            <div className="col-sm-7">
              <div className="mb-2">
                <label htmlFor="g-state" className="form-label small mb-1">
                  State <span className="text-danger">*</span>
                </label>
                <select id="g-state" className="form-select" required value={form.state} onChange={(e) => set("state", e.target.value)}>
                  <option value="">— Select —</option>
                  {INDIAN_STATES_AND_UTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div style={{ maxWidth: 180 }}>
            {field("pincode", "Pincode", { inputMode: "numeric", autoComplete: "postal-code", maxLength: 6 })}
          </div>

          {/* Honeypot — hidden from people and from assistive tech; bots fill every field. */}
          <div aria-hidden style={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }}>
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>

          <div className="border-top pt-3 mt-3">
            <div className="d-flex justify-content-between mb-1">
              <span className="text-muted">Items ({cart.itemCount})</span>
              <span>{formatPrice(cart.subtotal)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <strong>Total</strong>
              <strong>{formatPrice(cart.subtotal)}</strong>
            </div>
          </div>

          {cart.hasProblems && <p className="text-danger small mt-3 mb-0">Fix or remove the items marked on the left to continue.</p>}
          {error && <p className="text-danger small mt-3 mb-0">{error}</p>}

          <button type="submit" className="btn btn-success btn-lg w-100 mt-3" disabled={paying || loading || cart.hasProblems || cart.subtotal < 1}>
            {paying ? "Taking you to payment…" : `Proceed to payment · ${formatPrice(cart.subtotal)}`}
          </button>
          <p className="text-muted small mt-2 mb-0">
            You&apos;ll pay securely on Razorpay&apos;s page, then see your order details here. We&apos;ll email you a receipt.
          </p>
        </form>
      </div>
    </div>
  );
}
