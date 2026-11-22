"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearGuestCart, readGuestCart } from "@/lib/guest-cart";

// Rendered for signed-in visitors. If they built a cart as a guest and then
// logged in, move those items into their account cart so nothing is lost.
export default function GuestCartMerge() {
  const router = useRouter();

  useEffect(() => {
    const lines = readGuestCart();
    if (lines.length === 0) return;

    let cancelled = false;
    (async () => {
      let moved = 0;
      for (const line of lines) {
        if (cancelled) return;
        const res = await fetch("/api/shop/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(line),
        }).catch(() => null);
        if (res?.ok) moved += 1;
        // A line that can't be added (sold out, removed) is dropped, not retried forever.
      }
      clearGuestCart();
      if (moved > 0) router.refresh(); // updates the header count / cart page
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
