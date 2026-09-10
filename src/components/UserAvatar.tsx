"use client";

import { useState, type ReactNode } from "react";

// Falls back to a generic person icon (or a custom `fallback`, e.g.
// initials) when there's no photo URL, or when one is present but fails to
// load — several riders' Strava/Google-hosted avatar URLs have expired or
// gone 403, which would otherwise show a broken-image icon instead of
// silently falling back.
export default function UserAvatar({
  photoUrl,
  size = 32,
  fallback,
  className,
}: {
  photoUrl: string | null;
  size?: number;
  fallback?: ReactNode;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!photoUrl || broken) {
    return (
      <div
        className={`d-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 text-success flex-shrink-0 ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        {fallback ?? <i className="bi bi-person-fill" aria-hidden />}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external Strava/Google-hosted avatar URLs from many domains
    <img
      src={photoUrl}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: "50%", objectFit: "cover" }}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
