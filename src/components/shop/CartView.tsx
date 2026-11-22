"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/models/product";
import type { ResolvedCart } from "@/lib/models/cart";
import { orderItemOptions } from "@/lib/models/order";
import QtyStepper from "./QtyStepper";

type Delivery = { name: string; phone: string; email: string; address: string; city: string; state: string; pincode: string };

// The order preview: every item with its options, quantity and price, plus
// the delivery details that will go on the order, all visible before the
// rider is sent to Razorpay.
export default function CartView({ cart, delivery }: { cart: ResolvedCart; delivery: Delivery }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addressComplete = Boolean(delivery.address && delivery.city && delivery.state && delivery.pincode);
  const emailOk = Boolean(delivery.email);
  const canPay = cart.lines.length > 0 && !cart.hasProblems && addressComplete && emailOk && cart.subtotal >= 1;

  async function change(key: string, request: () => Promise<Response>) {
    setError(null);
    setBusyKey(key);
    try {
      const res = await request();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't update your cart.");
      }
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your cart.");
    } finally {
      setBusyKey(null);
    }
  }

  const setQty = (key: string, qty: number) =>
    change(key, () =>
      fetch("/api/shop/cart", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, qty }) }),
    );
  const remove = (key: string) =>
    change(key, () =>
      fetch("/api/shop/cart", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) }),
    );

  async function pay() {
    setError(null);
    setPaying(true);
    try {
      const res = await fetch("/api/shop/checkout", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't start the payment. Please try again.");
      window.location.href = body.url; // leave `paying` on — the page is navigating away
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the payment.");
      setPaying(false);
    }
  }

  // Back from Razorpay can restore this page from the back/forward cache with
  // `paying` still set; reset it when that happens.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPaying(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (cart.lines.length === 0) {
    return (
      <p className="text-muted">
        Your cart is empty. <Link href="/shop">Continue shopping</Link>
      </p>
    );
  }

  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <div className="d-flex flex-column gap-3" style={{ opacity: refreshing ? 0.6 : 1 }}>
          {cart.lines.map((line) => (
            <div key={line.key} className={`bg-white border rounded p-3 ${line.available ? "" : "border-danger"}`}>
              <div className="d-flex gap-3">
                {line.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external Firebase Storage URL
                  <img src={line.image} alt="" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 8 }} />
                ) : (
                  <div className="bg-light rounded" style={{ width: 88, height: 88 }} />
                )}
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between gap-2">
                    <Link href={`/shop/${line.productId}`} className="fw-semibold text-decoration-none text-reset">
                      {line.title}
                    </Link>
                    <span className="fw-bold text-nowrap">{formatPrice(line.lineTotal)}</span>
                  </div>
                  <div className="text-muted small">{orderItemOptions(line)}</div>
                  <div className="text-muted small">{formatPrice(line.unitPrice)} each</div>
                  {line.issue && <div className="text-danger small fw-semibold mt-1">{line.issue}</div>}
                  <div className="d-flex align-items-center gap-3 mt-2">
                    <QtyStepper
                      value={Math.min(line.qty, line.maxQty)}
                      max={line.maxQty}
                      disabled={busyKey === line.key}
                      onChange={(qty) => setQty(line.key, qty)}
                    />
                    <button type="button" className="btn btn-link btn-sm text-danger p-0" disabled={busyKey === line.key} onClick={() => remove(line.key)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 mb-0">
          <Link href="/shop" className="text-decoration-none">
            <i className="bi bi-arrow-left me-1" aria-hidden />
            Continue shopping
          </Link>
        </p>
      </div>

      <div className="col-lg-5">
        <div className="bg-white border rounded p-3 mb-3">
          <h2 className="h6 fw-bold mb-3">Delivery details</h2>
          <p className="mb-2" style={{ whiteSpace: "pre-line" }}>
            <strong>{delivery.name || "—"}</strong>
            {"\n"}
            {addressComplete ? (
              <>
                {delivery.address}
                {"\n"}
                {[delivery.city, delivery.state].filter(Boolean).join(", ")} {delivery.pincode}
              </>
            ) : (
              <span className="text-danger">No complete delivery address on your profile.</span>
            )}
          </p>
          <div className="small text-muted">
            <div>
              <i className="bi bi-telephone me-1" aria-hidden />
              {delivery.phone || "—"}
            </div>
            <div>
              <i className="bi bi-envelope me-1" aria-hidden />
              {delivery.email || <span className="text-danger">No email on your profile</span>}
            </div>
          </div>
          <Link href="/profile" className="small d-inline-block mt-2">
            {addressComplete && emailOk
              ? "Change in my profile"
              : `Add my ${!addressComplete && !emailOk ? "address and email" : !addressComplete ? "address" : "email"} in my profile`}
          </Link>
        </div>

        <div className="bg-white border rounded p-3">
          <h2 className="h6 fw-bold mb-3">Order total</h2>
          <div className="d-flex justify-content-between mb-1">
            <span className="text-muted">
              Items ({cart.itemCount})
            </span>
            <span>{formatPrice(cart.subtotal)}</span>
          </div>
          <div className="d-flex justify-content-between border-top pt-2 mt-2">
            <strong>Total</strong>
            <strong>{formatPrice(cart.subtotal)}</strong>
          </div>

          {cart.hasProblems && <p className="text-danger small mt-3 mb-0">Fix or remove the items marked above to continue.</p>}
          {error && <p className="text-danger small mt-3 mb-0">{error}</p>}

          <button type="button" className="btn btn-success btn-lg w-100 mt-3" disabled={!canPay || paying} onClick={pay}>
            {paying ? "Taking you to payment…" : `Proceed to payment · ${formatPrice(cart.subtotal)}`}
          </button>
          <p className="text-muted small mt-2 mb-0">You&apos;ll pay securely on Razorpay&apos;s page, then come back here for your receipt.</p>
        </div>
      </div>
    </div>
  );
}
