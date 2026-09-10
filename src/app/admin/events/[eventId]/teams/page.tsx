import PlaceholderPage from "@/components/PlaceholderPage";

export default async function AdminEventTeamsPage({
  params,
}: PageProps<"/admin/events/[eventId]/teams">) {
  const { eventId } = await params;

  return (
    <PlaceholderPage
      title={`Teams: ${eventId}`}
      description="Team roster management, CSV/sheet import, max-members cap — see docs/ARCHITECTURE.md §7.2."
    />
  );
}
