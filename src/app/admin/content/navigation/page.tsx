import { requireRole } from "@/lib/auth/dal";
import { getNavLinks } from "@/lib/nav-links";
import NavLinksForm from "@/components/admin/NavLinksForm";

export default async function AdminNavigationPage() {
  await requireRole("admin");
  const links = await getNavLinks();

  return (
    <div>
      <h1 className="h3 mb-1">Navigation Menu</h1>
      <p className="text-muted mb-4">
        The links shown in the main site&apos;s header, in order. Add, remove, reorder, and rename
        any of them. This doesn&apos;t affect the &quot;Admin&quot; link, which only ever shows to
        signed-in admins, or the Log in / Sign up buttons.
      </p>
      <p className="text-muted mb-4">
        <i className="bi bi-lock-fill me-1" aria-hidden />
        <strong>Admin only</strong> hides a link from everyone except admins <em>and</em> locks the page
        behind it — handy for building a page before it goes public. Turn it off to open it to all. Admins
        see locked links with a lock icon.
      </p>
      <NavLinksForm links={links} />
    </div>
  );
}
