"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GUEST_CART_EVENT, guestCartCount } from "@/lib/guest-cart";

// Header cart icon for visitors who aren't logged in — the count comes from
// their browser's guest cart, and updates as they add or remove things.
export default function GuestCartLink({ light }: { light: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(guestCartCount());
    update();
    window.addEventListener(GUEST_CART_EVENT, update);
    window.addEventListener("storage", update); // another tab changed it
    return () => {
      window.removeEventListener(GUEST_CART_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return (
    <Link
      href="/cart"
      className={`position-relative d-inline-block py-1 text-decoration-none ${light ? "text-light" : "text-dark"}`}
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      <i className="bi bi-cart3 fs-5" aria-hidden />
      {count > 0 && (
        <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success">{count}</span>
      )}
    </Link>
  );
}
