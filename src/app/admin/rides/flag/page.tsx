import { requireRole } from "@/lib/auth/dal";
import { getRideRulesConfig } from "@/lib/ride-rules";
import RideFlaggingPanel from "@/components/admin/RideFlaggingPanel";

export default async function AdminRideFlagPage() {
  await requireRole("admin");
  const rideRules = await getRideRulesConfig();

  return (
    <div>
      <h1 className="h3 mb-1">Ride Flagging</h1>
      <p className="text-muted mb-4">
        Pick a rider, then flag, retype (Ride/VirtualRide/Trainer), edit elevation, or remove any of their synced
        activities.
      </p>
      <RideFlaggingPanel rideRules={rideRules} />
    </div>
  );
}
