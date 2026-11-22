"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Navbar from "react-bootstrap/Navbar";
import Nav from "react-bootstrap/Nav";
import Container from "react-bootstrap/Container";
import LogoutButton from "@/components/auth/LogoutButton";
import GuestCartLink from "@/components/shop/GuestCartLink";
import type { Role } from "@/lib/models/user";
import type { NavLink } from "@/lib/models/nav-links";

// Never admin-editable — always shown to admins, regardless of what's
// configured in /admin/content/navigation.
const ADMIN_NAV_LINK = { href: "/admin/dashboard", label: "Admin", adminOnly: false };

// Used only for the "Events" nav-link active-state rule below — event
// detail pages no longer get their own hero banner/overlay header (see
// isHeroOverlayPage), just a plain solid header like every other page.
function isEventDetailPage(pathname: string): boolean {
  return /^\/events\/[^/]+$/.test(pathname);
}

// The only page whose content starts with a full-bleed image right at the
// top — the header overlays it transparently with light text instead of
// sitting in its own bar above it. Every other page keeps the solid header,
// since there's nothing behind it to overlay.
function isHeroOverlayPage(pathname: string): boolean {
  return pathname === "/";
}

// "Events" should read as active on the listing page AND any individual
// event's detail page, not just an exact path match like every other link —
// UNLESS one of the other configured nav links points at this exact event
// (e.g. an admin-added "1177" shortcut to /events/1177-6.0), in which case
// that more specific link should be the only one highlighted.
// "Admin" should read as active anywhere under /admin, not just the
// dashboard page it links to.
function isNavLinkActive(pathname: string, href: string, links: Pick<NavLink, "href">[]): boolean {
  if (href === "/admin/dashboard") {
    return pathname.startsWith("/admin");
  }
  if (href === "/events") {
    if (pathname === "/events") {
      return true;
    }
    if (!isEventDetailPage(pathname)) {
      return false;
    }
    const hasMoreSpecificMatch = links.some((link) => link.href !== "/events" && link.href === pathname);
    return !hasMoreSpecificMatch;
  }
  return pathname === href;
}

export type HeaderUser = { displayName: string | null; role: Role };

export default function Header({
  user,
  navLinks,
  cartCount = null,
  showGuestCart = false,
}: {
  user: HeaderUser | null;
  navLinks: NavLink[];
  /** Items in the rider's cart; null hides the cart icon (signed out, or shop closed to them). */
  cartCount?: number | null;
  /** Show the browser-held cart icon to a visitor who isn't logged in. */
  showGuestCart?: boolean;
}) {
  const pathname = usePathname();
  const overlay = isHeroOverlayPage(pathname);
  const links = user?.role === "admin" ? [...navLinks, ADMIN_NAV_LINK] : navLinks;

  return (
    <Navbar
      expand="lg"
      variant={overlay ? "dark" : "light"}
      className={overlay ? "" : "border-bottom"}
      style={
        overlay
          ? { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: "transparent" }
          : { backgroundColor: "#fbfbf2" }
      }
      sticky={overlay ? undefined : "top"}
    >
      {/* Custom hamburger that morphs into an X on expand (Navbar.Toggle's
          default icon is a static background-image, can't animate it), and
          strips the default button border/focus ring. */}
      <style>{`
        .nav-toggle-btn { border: 0 !important; box-shadow: none !important; background: none !important; padding: 4px !important; }
        .nav-toggle-bar { display: block; width: 24px; height: 2px; background: currentColor; margin: 5px 0; transition: transform 0.25s ease, opacity 0.25s ease; }
        .nav-toggle-btn:not(.collapsed) .nav-toggle-bar:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .nav-toggle-btn:not(.collapsed) .nav-toggle-bar:nth-child(2) { opacity: 0; }
        .nav-toggle-btn:not(.collapsed) .nav-toggle-bar:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
      `}</style>
      {/* Below the `lg` breakpoint, Navbar.Collapse expands into a dropdown
          panel — on overlay pages (transparent/tinted background) it has no
          backdrop of its own, so its content floats unreadably over the
          hero image. Give it a solid panel only in that collapsed state;
          the `lg`+ inline layout already has the navbar's own background. */}
      {overlay && (
        <style>{`
          @media (max-width: 991.98px) {
            #main-nav.show { background-color: rgba(13,21,13,0.95); padding: 1rem; border-radius: 0.5rem; margin-top: 0.5rem; }
          }
        `}</style>
      )}
      <Container>
        <Navbar.Brand as={Link} href="/" className="d-flex align-items-center">
          <Image
            src={overlay ? "/logo_white.png" : "/logo.png"}
            alt="Cycle Network Grow"
            width={160}
            height={48}
            priority
            style={{ height: 60, width: "auto" }}
          />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-nav" className="nav-toggle-btn">
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </Navbar.Toggle>
        <Navbar.Collapse id="main-nav">
          <Nav className="mx-auto">
            {links.map((link) => {
              const isActive = isNavLinkActive(pathname, link.href, links);
              return (
                <Nav.Link
                  key={link.href}
                  as={Link}
                  href={link.href}
                  active={isActive}
                  className={`mx-2 fw-medium ${isActive ? "text-decoration-underline" : ""}`}
                  style={isActive ? { textUnderlineOffset: "6px", textDecorationThickness: "2px" } : undefined}
                >
                  {link.label}
                  {link.adminOnly && (
                    <i className="bi bi-lock-fill ms-1 small" title="Only admins can see this link" aria-label="Admin only" />
                  )}
                </Nav.Link>
              );
            })}
          </Nav>
          {user ? (
            <div
              className={`d-flex flex-column flex-lg-row align-items-start align-items-lg-center gap-3 gap-lg-3 mt-2 mt-lg-0 ${overlay ? "text-light" : ""}`}
            >
              {cartCount !== null && (
                <Link
                  href="/cart"
                  className={`position-relative d-inline-block py-1 text-decoration-none ${overlay ? "text-light" : "text-dark"}`}
                  aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
                >
                  <i className="bi bi-cart3 fs-5" aria-hidden />
                  {cartCount > 0 && (
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success">
                      {cartCount}
                    </span>
                  )}
                </Link>
              )}
              <Link
                href="/profile"
                className={`d-inline-block py-1 fw-medium text-decoration-none ${overlay ? "text-light" : "text-dark"}`}
              >
                <i className="bi bi-person-circle me-1" aria-hidden />
                {user.displayName ?? "Rider"}
              </Link>
              <LogoutButton variant={overlay ? "outline-light" : "outline-secondary"} />
            </div>
          ) : (
 <div className="d-flex align-items-center gap-3">
              {showGuestCart && <GuestCartLink light={overlay} />}
              <Link href="/login" className={`btn ${overlay ? "btn-outline-light" : "btn-outline-success"}`}>
                Log in
              </Link>
              <Link href="/signup" className="btn btn-success">
                Sign up
              </Link>
            </div>
          )}
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
