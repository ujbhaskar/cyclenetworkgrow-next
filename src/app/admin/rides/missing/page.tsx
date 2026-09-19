import { requireRole } from "@/lib/auth/dal";
import { getRideRulesConfig } from "@/lib/ride-rules";
import MissingRidesPanel from "@/components/admin/MissingRidesPanel";

export default async function AdminMissingRidesPage() {
  await requireRole("admin");
  const rideRules = await getRideRulesConfig();

  return (
    <div>
      <h1 className="h3 mb-1">Pull Missing Rides</h1>
      <p className="text-muted mb-4">
        For a rider whose Strava activities didn&apos;t fully sync — fetch their recent qualifying rides directly
        from Strava and add the missing ones to their record.
      </p>
      <MissingRidesPanel rideRules={rideRules} />
    </div>
  );
}
