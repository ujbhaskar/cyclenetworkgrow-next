import PlaceholderPage from "@/components/PlaceholderPage";
import { requireNavAccess } from "@/lib/nav-links";

export default async function BlogPage() {
  await requireNavAccess("/blog");
  return (
    <PlaceholderPage
      title="Blog"
      description="Ride reports, training tips, and community stories."
    />
  );
}
