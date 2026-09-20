import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_RIDE_RULES, type RideRulesConfig } from "@/lib/models/ride-rules";

// This app's own collection (no legacy collision — the old Angular app
// never had a concept of admin-configurable ride rules, these were
// hardcoded per-file). Single document, same "one settings doc" pattern
// as other admin-authored config in this app.
const COLLECTION = "rideRulesConfig";
const DOC_ID = "default";

export async function getRideRulesConfig(): Promise<RideRulesConfig> {
  const doc = await adminDb.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) {
    return DEFAULT_RIDE_RULES;
  }
  const data = doc.data() ?? {};
  return {
    elapsedToMovingRatioMax:
      typeof data.elapsedToMovingRatioMax === "number"
        ? data.elapsedToMovingRatioMax
        : DEFAULT_RIDE_RULES.elapsedToMovingRatioMax,
    minRideDistanceKm:
      typeof data.minRideDistanceKm === "number" ? data.minRideDistanceKm : DEFAULT_RIDE_RULES.minRideDistanceKm,
    maxVirtualRideDistanceKm:
      typeof data.maxVirtualRideDistanceKm === "number"
        ? data.maxVirtualRideDistanceKm
        : DEFAULT_RIDE_RULES.maxVirtualRideDistanceKm,
    missingRidesDefaultAfterDate:
      typeof data.missingRidesDefaultAfterDate === "string" && data.missingRidesDefaultAfterDate
        ? data.missingRidesDefaultAfterDate
        : DEFAULT_RIDE_RULES.missingRidesDefaultAfterDate,
  };
}

export async function updateRideRulesConfig(input: RideRulesConfig, updatedBy: string): Promise<void> {
  await adminDb
    .collection(COLLECTION)
    .doc(DOC_ID)
    .set(
      {
        ...input,
        updatedBy,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
}
