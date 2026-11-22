import PlaceholderPage from "@/components/PlaceholderPage";
import { requireNavAccess } from "@/lib/nav-links";

export default async function ContactPage() {
  await requireNavAccess("/contact");
  return (
    <PlaceholderPage
      title="Contact Us"
      description="Get in touch with the Cycle Network Grow team."
    />
  );
}
