"use client";

import { useEffect } from "react";
import { clearGuestCart } from "@/lib/guest-cart";

// Rendered on a guest's order page once the order is paid — their browser cart
// has served its purpose.
export default function ClearGuestCart() {
  useEffect(() => {
    clearGuestCart();
  }, []);
  return null;
}
