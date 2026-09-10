"use client";

import { useState } from "react";

// Falls back to the same placeholder used when an event has no imageUrl at
// all — bikeIcon on a tinted background — when the URL is present but
// fails to load (expired/invalid Firebase Storage link), instead of a
// broken-image icon.
export default function EventBannerImage({
  imageUrl,
  alt,
  height,
  iconSize,
}: {
  imageUrl: string | null;
  alt: string;
  height: number;
  iconSize: number;
}) {
  const [broken, setBroken] = useState(false);

  if (!imageUrl || broken) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ height, backgroundColor: "rgba(var(--bs-success-rgb), 0.12)" }}
      >
        <i className="bi bi-bicycle text-success" style={{ fontSize: iconSize }} aria-hidden />
      </div>
    );
  }

  return (
    <div style={{ height, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- external Firebase Storage URL, not worth a remotePatterns config for one legacy domain */}
      <img
        src={imageUrl}
        className="ujjal"
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
        onError={() => setBroken(true)}
      />
    </div>
  );
}
