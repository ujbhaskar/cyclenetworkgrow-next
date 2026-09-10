import PlaceholderPage from "@/components/PlaceholderPage";

export default async function AdminEventDocumentsPage({
  params,
}: PageProps<"/admin/events/[eventId]/documents">) {
  const { eventId } = await params;

  return (
    <PlaceholderPage
      title={`Documents: ${eventId}`}
      description="Upload/link documents to this event — see docs/REQUIREMENTS.md §3.8."
    />
  );
}
