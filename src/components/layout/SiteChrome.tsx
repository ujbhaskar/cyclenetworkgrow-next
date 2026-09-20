import type { ReactNode } from "react";
import { getOptionalSession } from "@/lib/auth/dal";
import { getUserProfile } from "@/lib/user-profile";
import { getNavLinks } from "@/lib/nav-links";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";
import Header from "./Header";
import Footer from "./Footer";

export default async function SiteChrome({ children }: { children: ReactNode }) {
  const [session, navLinks] = await Promise.all([getOptionalSession(), getNavLinks()]);
  const profile = session ? await getUserProfile(session.uid) : null;

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
          navLinks={navLinks}
        />
        <main className="flex-grow-1 d-flex flex-column">{children}</main>
      </div>
      <Footer />
    </>
  );
}
