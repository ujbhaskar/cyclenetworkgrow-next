"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import Button from "react-bootstrap/Button";
import { auth } from "@/lib/firebase/client";

export default function LogoutButton({
  variant = "outline-secondary",
  className,
}: {
  variant?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(auth);
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <Button variant={variant} className={className} onClick={handleLogout} disabled={pending}>
      <i className="bi bi-box-arrow-right me-2" aria-hidden />
      Log out
    </Button>
  );
}
