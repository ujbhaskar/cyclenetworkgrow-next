import PlaceholderPage from "@/components/PlaceholderPage";
import { requireNavAccess } from "@/lib/nav-links";

export default async function AboutPage() {
  await requireNavAccess("/about");
  return (
    <PlaceholderPage
      title="About Cycle Network Grow"
      description="Our story, mission, and the team behind the community."
    />
  );
}
