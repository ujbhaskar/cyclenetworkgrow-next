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
      <NavLinksForm links={links} />
    </div>
  );
}
