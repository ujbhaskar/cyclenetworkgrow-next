"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginUrlWithNext } from "@/lib/auth/redirect";
import {
  MAX_QTY_PER_LINE,
  formatPrice,
  priceRange,
  isSoldOut,
  unitPrice,
  type ProductSleeve,
  type VariantChoice,
} from "@/lib/models/product";
import QtyStepper from "./QtyStepper";

type Choice = { color: string; size: string; sleeve: string };

function OptionGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-2">
        <span className="fw-semibold">{label}:</span> <span className="text-muted">{value || "Select"}</span>
      </div>
      <div className="d-flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
            className={`btn btn-sm ${option === value ? "btn-success" : "btn-outline-secondary"}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// Price + color/size/sleeve + quantity + Add to cart / Buy now. Options with
// several values start unselected; a single-value option is pre-selected.
//
// The price follows the chosen sleeve (the admin can price each one). Whether
// it's in stock is only known once every option is picked, since the admin
// marks out-of-stock per combination.
//
// Signed out: either button goes to /login with this product page (plus the
// chosen options and quantity) as the destination, so after login the rider
// lands back here with their selection still in place.
// Signed in: Add to cart puts it in their cart; Buy now does the same and
// opens the cart, where they review everything before paying.
export default function ProductPurchase({
  productId,
  basePrice,
  colors,
  sizes,
  sleeves,
  soldOut,
  isLoggedIn,
  initial,
  initialQty,
}: {
  productId: string;
  basePrice: number;
  colors: string[];
  sizes: string[];
  sleeves: ProductSleeve[];
  soldOut: VariantChoice[];
  isLoggedIn: boolean;
  initial: Partial<Choice>;
  initialQty: number;
}) {
  const router = useRouter();
  // An option with only one value is pre-selected — there's nothing to get
  // wrong. With several, nothing is pre-selected (a default size is an easy
  // way to ship someone the wrong one).
  const only = (list: string[]) => (list.length === 1 ? list[0] : "");
  const [choice, setChoice] = useState<Choice>({
    color: initial.color ?? only(colors),
    size: initial.size ?? only(sizes),
    sleeve: initial.sleeve ?? only(sleeves.map((s) => s.name)),
  });
  const [qty, setQty] = useState(initialQty);
  const [pending, setPending] = useState<"cart" | "buy" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  // Coming back from another page with the Back button can restore this page
  // from the browser's back/forward cache with `pending` still set — the
  // buttons would stay stuck. Reset when that happens.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(null);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const product = { price: basePrice, sleeves, soldOut };
  const range = priceRange(product);
  const complete = (!colors.length || choice.color) && (!sizes.length || choice.size) && (!sleeves.length || choice.sleeve);
  const price = unitPrice(product, choice.sleeve || null);
  const outOfStock = Boolean(complete) && isSoldOut(product, { color: choice.color || null, size: choice.size || null, sleeve: choice.sleeve || null });
  const maxQty = MAX_QTY_PER_LINE;

  function set<K extends keyof Choice>(key: K, value: string) {
    setChoice((current) => ({ ...current, [key]: value }));
    setError(null);
    setAdded(false);
  }

  function changeQty(next: number) {
    setQty(next);
    setAdded(false);
  }

  function missingChoice(): string | null {
    if (colors.length && !choice.color) return "Please choose a color.";
    if (sizes.length && !choice.size) return "Please choose a size.";
    if (sleeves.length && !choice.sleeve) return "Please choose a sleeve type.";
    return null;
  }

  async function submit(mode: "cart" | "buy") {
    const missing = missingChoice();
    if (missing) {
      setError(missing);
      return;
    }

    if (!isLoggedIn) {
      const params = new URLSearchParams();
      (Object.keys(choice) as (keyof Choice)[]).forEach((key) => {
        if (choice[key]) params.set(key, choice[key]);
      });
      params.set("qty", String(qty));
      router.push(loginUrlWithNext(`/shop/${productId}?${params.toString()}`));
      return;
    }

    setPending(mode);
    setError(null);
    setAdded(false);
    try {
      const res = await fetch("/api/shop/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, ...choice, qty }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't add to your cart. Please try again.");

      if (mode === "buy") {
        router.push("/cart"); // leave `pending` on — we're navigating away
        return;
      }
      setAdded(true);
      router.refresh(); // updates the cart count in the header
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add to your cart.");
      setPending(null);
    }
  }

  return (
    <>
      <p className="h4 text-success mb-1">
        {!choice.sleeve && range.min !== range.max ? `From ${formatPrice(range.min)}` : formatPrice(price)}
      </p>
      {!choice.sleeve && range.min !== range.max && (
        <p className="text-muted small mb-3">Price depends on the sleeve you choose.</p>
      )}
      {(choice.sleeve || range.min === range.max) && <div className="mb-3" />}

      {colors.length > 0 && <OptionGroup label="Color" options={colors} value={choice.color} onChange={(v) => set("color", v)} />}
      {sizes.length > 0 && <OptionGroup label="Size" options={sizes} value={choice.size} onChange={(v) => set("size", v)} />}
      {sleeves.length > 0 && (
        <OptionGroup
          label="Sleeve"
          options={sleeves.map((s) => s.name)}
          value={choice.sleeve}
          onChange={(v) => set("sleeve", v)}
        />
      )}

      {outOfStock && <p className="text-danger fw-semibold mb-3">Out of stock for this combination.</p>}

      <div className="mb-3 d-flex align-items-center gap-3">
        <span className="fw-semibold">Quantity:</span>
        <QtyStepper value={Math.min(qty, maxQty)} max={maxQty} onChange={changeQty} disabled={outOfStock} size="md" />
      </div>

      {error && <p className="text-danger small mb-2">{error}</p>}
      {added && (
        <p className="text-success small mb-2">
          <i className="bi bi-check-circle me-1" aria-hidden />
          Added to your cart.{" "}
          <Link href="/cart" className="fw-semibold">
            View cart
          </Link>
        </p>
      )}

      <div className="d-grid gap-2">
        <button type="button" className="btn btn-outline-success btn-lg" onClick={() => submit("cart")} disabled={pending !== null || outOfStock}>
          {pending === "cart" ? "Adding…" : "Add to cart"}
        </button>
        <button type="button" className="btn btn-success btn-lg" onClick={() => submit("buy")} disabled={pending !== null || outOfStock}>
          {pending === "buy" ? "Taking you to your cart…" : "Buy now"}
        </button>
      </div>
      {isLoggedIn ? (
        <p className="small mt-2 mb-0">
          <Link href="/cart">My cart</Link> · <Link href="/my-orders">My orders</Link>
        </p>
      ) : (
        <p className="text-muted small mt-2 mb-0">You&apos;ll be asked to log in first.</p>
      )}
    </>
  );
}
