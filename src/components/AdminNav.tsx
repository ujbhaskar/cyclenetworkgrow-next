"use client";

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

  return (
    <nav
      className="d-flex flex-column flex-shrink-0 text-light"
      style={{ width: 260, backgroundColor: "#12181f" }}
    >
      <Link href="/" className="d-flex align-items-center gap-2 px-3 py-3 text-decoration-none border-bottom border-secondary border-opacity-25">
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
  );
}
