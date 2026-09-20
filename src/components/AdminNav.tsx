"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";

export type AdminNavItem = { href: string; label: string; icon: string };
export type AdminNavSection = { section: string; items: AdminNavItem[] };

export default function AdminNav({
  sections,
  adminName,
}: {
  sections: AdminNavSection[];
  adminName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile drawer automatically once a link is followed — without
  // this it'd stay open over the new page underneath it. Adjusting state
  // during render (React's documented pattern for "reset state when a prop
  // changes") rather than in an effect, which would cause an extra render.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      <style>{`
        .admin-nav-toggle {
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 1060;
          border: 0;
          background: #12181f;
          color: #fff;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .admin-nav-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1050;
        }
        .admin-nav {
          position: fixed;
          top: 0;
          left: 0;
          height: 100dvh;
          z-index: 1055;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
        }
        .admin-nav.admin-nav-open {
          transform: translateX(0);
        }
        @media (min-width: 992px) {
          .admin-nav-toggle,
          .admin-nav-backdrop {
            display: none;
          }
          .admin-nav {
            position: static;
            height: auto;
            transform: none;
            transition: none;
          }
        }
      `}</style>

      <button
        type="button"
        className="admin-nav-toggle d-lg-none"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        aria-expanded={open}
      >
        <i className="bi bi-list" style={{ fontSize: 22 }} aria-hidden />
      </button>

      {open && (
        <div
          className="admin-nav-backdrop d-lg-none"
          onClick={() => setOpen(false)}
          role="presentation"
        />
      )}

      <nav
        className={`admin-nav d-flex flex-column flex-shrink-0 text-light ${open ? "admin-nav-open" : ""}`}
        style={{ width: 260, backgroundColor: "#12181f" }}
      >
      <div className="d-flex align-items-center border-bottom border-secondary border-opacity-25">
        <Link href="/" className="d-flex align-items-center gap-2 px-3 py-3 text-decoration-none flex-grow-1">
          <Image
            src="/logo.png"
            alt="Cycle Network Grow"
            width={32}
            height={32}
            style={{ height: 28, width: "auto", filter: "brightness(0) invert(1)" }}
          />
          <div>
            <div className="fw-semibold text-light small">Admin Panel</div>
            <div className="text-light text-opacity-50" style={{ fontSize: 11 }}>
              {adminName}
            </div>
          </div>
        </Link>
        <button
          type="button"
          className="btn-close btn-close-white d-lg-none me-3"
          onClick={() => setOpen(false)}
          aria-label="Close admin menu"
        />
      </div>

      <div className="flex-grow-1 overflow-auto py-2">
        {sections.map((section) => (
          <div key={section.section} className="mb-2">
            <div
              className="text-uppercase text-light text-opacity-50 px-3 pt-2 pb-1"
              style={{ fontSize: 11, letterSpacing: "0.05em" }}
            >
              {section.section}
            </div>
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
                  style={{
                    color: isActive ? "#fff" : "rgba(255,255,255,0.75)",
                    backgroundColor: isActive ? "var(--bs-primary)" : "transparent",
                    fontSize: 14,
                  }}
                >
                  <i className={`bi ${item.icon}`} style={{ fontSize: 15, width: 18 }} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="px-3 py-3 border-top border-secondary border-opacity-25 d-flex flex-column gap-2">
        <Link
          href="/"
          className="btn btn-outline-light w-100 d-flex align-items-center justify-content-center gap-2"
        >
          <i className="bi bi-box-arrow-up-right" aria-hidden />
          View Website
        </Link>
        <LogoutButton
          variant="outline-light"
          className="w-100 d-flex align-items-center justify-content-center gap-2"
        />
      </div>
      </nav>
    </>
  );
}
