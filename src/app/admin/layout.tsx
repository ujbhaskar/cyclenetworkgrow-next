import type { ReactNode } from "react";
import AdminNav, { type AdminNavSection } from "@/components/AdminNav";
import { requireRole } from "@/lib/auth/dal";
import { getUserProfile } from "@/lib/user-profile";

const ADMIN_NAV: AdminNavSection[] = [
  {
    section: "Overview",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: "bi-speedometer2" }],
  },
  {
    section: "Events",
    items: [{ href: "/admin/events", label: "Events", icon: "bi-calendar-event" }],
  },
  {
    section: "Users & Riders",
    items: [
      { href: "/admin/users", label: "Users", icon: "bi-people" },
      { href: "/admin/users/set-password", label: "Set User Password", icon: "bi-key" },
      { href: "/admin/users/strava", label: "Strava-Connected Riders", icon: "bi-bicycle" },
      { href: "/admin/rides/cleanup", label: "Ride Cleanup", icon: "bi-trash3" },
      { href: "/admin/rides/missing", label: "Missing Rides", icon: "bi-cloud-arrow-down" },
      { href: "/admin/rides/flag", label: "Ride Flagging", icon: "bi-flag" },
      { href: "/admin/rides/rules", label: "Ride Rules Configuration", icon: "bi-sliders" },
      { href: "/admin/strava-subscription", label: "Strava Subscription", icon: "bi-rss" },
      { href: "/admin/rides/webhook-events", label: "Strava Webhook Events", icon: "bi-list-ul" },
      { href: "/admin/endurance/riders", label: "Endurance Riders", icon: "bi-person-badge" },
      { href: "/admin/endurance/rules", label: "Endurance Rules", icon: "bi-list-check" },
    ],
  },
  {
    section: "Content",
    items: [
      { href: "/admin/documents", label: "Documents", icon: "bi-folder2" },
      { href: "/admin/content", label: "Content", icon: "bi-file-richtext" },
      { href: "/admin/content/reviews", label: "Review Moderation", icon: "bi-chat-square-quote" },
      { href: "/admin/content/home-sections", label: "Home Sections", icon: "bi-layout-text-window" },
      { href: "/admin/content/instagram", label: "Instagram List", icon: "bi-instagram" },
    ],
  },
  {
    section: "System",
    items: [
      { href: "/admin/audit-log", label: "Audit Log", icon: "bi-journal-text" },
      { href: "/admin/api-docs", label: "API Docs", icon: "bi-code-slash" },
      { href: "/admin/deploys", label: "Deploys", icon: "bi-cloud-arrow-up" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Cheap redirect for UX; the authoritative check happens per-page/action
  // via the same requireRole()/verifySession() call — see docs/ARCHITECTURE.md §4.
  const session = await requireRole("admin");
  const profile = await getUserProfile(session.uid);

  return (
    <div className="d-flex" style={{ minHeight: "100dvh" }}>
      <AdminNav sections={ADMIN_NAV} adminName={profile?.displayName ?? "Admin"} />
      <main className="flex-grow-1 p-4" style={{ backgroundColor: "#f4f6f8" }}>
        {children}
      </main>
    </div>
  );
}
