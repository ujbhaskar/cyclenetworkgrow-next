import { requireRole } from "@/lib/auth/dal";
import { listRideSummaries } from "@/lib/admin-rides";
import RidesCleanupPanel from "@/components/admin/RidesCleanupPanel";

export default async function AdminRideCleanupPage() {
  await requireRole("admin");
  const riders = await listRideSummaries();

  return (
    <div>
      <h1 className="h3 mb-1">Ride Cleanup</h1>
      <p className="text-muted mb-4">
        {riders.length} rider{riders.length === 1 ? "" : "s"} with synced rides in the live <code>rides</code>{" "}
        collection.
      </p>
      <RidesCleanupPanel initialRiders={riders} />
    </div>
  );
}
