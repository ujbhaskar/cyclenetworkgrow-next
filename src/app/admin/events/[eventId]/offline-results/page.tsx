import PlaceholderPage from "@/components/PlaceholderPage";

export default async function AdminOfflineResultsPage({
  params,
}: PageProps<"/admin/events/[eventId]/offline-results">) {
  const { eventId } = await params;

  return (
    <PlaceholderPage
      title={`Offline Results: ${eventId}`}
      description="Manual result entry per rider/team for in-person events — see docs/REQUIREMENTS.md §3.3."
    />
  );
}
