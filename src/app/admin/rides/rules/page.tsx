import { requireRole } from "@/lib/auth/dal";
import { getRideRulesConfig } from "@/lib/ride-rules";
import RideRulesForm from "@/components/admin/RideRulesForm";

export default async function AdminRideRulesPage() {
  await requireRole("admin");
  const config = await getRideRulesConfig();

  return (
    <div>
      <h1 className="h3 mb-1">Ride Rules Configuration</h1>
      <p className="text-muted mb-4">
        Thresholds used by the ride-review tools (Missing Rides, Ride Flagging) — editable here instead of a code
        change.
      </p>
      <RideRulesForm initialConfig={config} />
    </div>
  );
}
