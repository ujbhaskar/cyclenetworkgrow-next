import type { ReactNode } from "react";
import { getOptionalSession } from "@/lib/auth/dal";
import { getUserProfile } from "@/lib/user-profile";
import { canAccessPath, getNavLinks } from "@/lib/nav-links";
import { getCartCount } from "@/lib/shop-cart";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";
import Header from "./Header";
import Footer from "./Footer";

export default async function SiteChrome({ children }: { children: ReactNode }) {
  const [session, navLinks] = await Promise.all([getOptionalSession(), getNavLinks()]);
  const isAdmin = session?.role === "admin";
  const visibleLinks = navLinks.filter((link) => isAdmin || !link.adminOnly);
  const profile = session ? await getUserProfile(session.uid) : null;
  // Cart icon only for signed-in visitors who can actually use the shop.
  const cartCount = session && (await canAccessPath("/shop")) ? await getCartCount(session.uid).catch(() => null) : null;

  return (
    <>
      {session?.impersonatedBy && <ImpersonationBanner riderName={profile?.displayName ?? "this rider"} />}
      {/* Positioned ancestor for Header's overlay mode (`position: absolute;
          top: 0`) — without it, that top:0 anchors to the very top of the
          page instead of just below the banner above, and the banner ends
          up covering the nav. Sticky Header is unaffected since it sticks
          to the viewport regardless of this wrapper. */}
      <div className="d-flex flex-column flex-grow-1" style={{ position: "relative" }}>
        <Header
          user={session ? { displayName: profile?.displayName ?? null, role: session.role } : null}
          navLinks={visibleLinks}
          cartCount={cartCount}
        />
        <main className="flex-grow-1 d-flex flex-column">{children}</main>
      </div>
      <Footer />
    </>
  );
}
