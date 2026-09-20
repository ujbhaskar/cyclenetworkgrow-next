"use client";

import { useState } from "react";
import type { AnnouncementVariant } from "@/lib/models/site-announcement";

// Brand-matched gradients — blue/green lifted straight from globals.scss's
// $cng-blue-color/$cng-brand-green, warning/danger picked to sit in the
// same saturation/lightness range so all four feel like one family rather
// than stock Bootstrap alert colors.
const THEME: Record<AnnouncementVariant, { gradient: string; icon: string; glow: string }> = {
  info: { gradient: "linear-gradient(90deg, #0d4a85, #1f7fd1)", icon: "bi-megaphone-fill", glow: "#8ecbff" },
  warning: { gradient: "linear-gradient(90deg, #9a6b06, #e0a815)", icon: "bi-exclamation-triangle-fill", glow: "#ffe58a" },
  success: { gradient: "linear-gradient(90deg, #256b3d, #4caf6d)", icon: "bi-check-circle-fill", glow: "#b6f2c9" },
  danger: { gradient: "linear-gradient(90deg, #8c2620, #d9483c)", icon: "bi-exclamation-octagon-fill", glow: "#ffb3ae" },
};

export default function AnnouncementBar({
  message,
  variant,
}: {
  message: string;
  variant: AnnouncementVariant;
}) {
  const [dismissed, setDismissed] = useState(false);
  const theme = THEME[variant];

  if (dismissed) {
    return null;
  }

  return (
    <div className="cng-announcement" style={{ background: theme.gradient }} role="status">
      <style>{`
        .cng-announcement {
          position: relative;
          overflow: hidden;
          color: #fff;
          animation: cng-announcement-in 0.35s ease-out;
        }
        .cng-announcement::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.22) 45%, transparent 62%);
          background-size: 220% 100%;
          animation: cng-announcement-shine 5s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes cng-announcement-shine {
          0% { background-position: 160% 0; }
          55%, 100% { background-position: -60% 0; }
        }
        @keyframes cng-announcement-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cng-announcement-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${theme.glow};
          box-shadow: 0 0 0 0 ${theme.glow};
          animation: cng-announcement-pulse 1.8s ease-out infinite;
        }
        @keyframes cng-announcement-pulse {
          0% { box-shadow: 0 0 0 0 ${theme.glow}aa; }
          70% { box-shadow: 0 0 0 9px ${theme.glow}00; }
          100% { box-shadow: 0 0 0 0 ${theme.glow}00; }
        }
        .cng-announcement-close {
          background: transparent;
          border: 0;
          color: rgba(255,255,255,0.8);
          line-height: 1;
          transition: color 0.15s ease, transform 0.15s ease;
        }
        .cng-announcement-close:hover {
          color: #fff;
          transform: scale(1.1);
        }
      `}</style>
      <div className="position-relative px-4 py-2" style={{ zIndex: 1 }}>
        <div
          className="d-flex align-items-center justify-content-center gap-2 text-center flex-wrap mx-auto"
          style={{ maxWidth: "calc(100% - 40px)" }}
        >
          <span className="cng-announcement-dot flex-shrink-0" aria-hidden />
          <i className={`bi ${theme.icon} flex-shrink-0`} aria-hidden />
          <span className="fw-semibold" style={{ letterSpacing: 0.15 }}>
            {message}
          </span>
        </div>
        <button
          type="button"
          className="cng-announcement-close position-absolute top-50 end-0 translate-middle-y me-3"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss announcement"
        >
          <i className="bi bi-x-lg" aria-hidden />
        </button>
      </div>
    </div>
  );
}
