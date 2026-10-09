import "server-only";
import ExcelJS from "exceljs";
import { adminDb } from "@/lib/firebase/admin";
import { EVENTS_COLLECTION, getEventRegisteredRiders, mapEventCard } from "@/lib/events";
import type { EventDoc } from "@/lib/models/event";
import { getRegistrationAddressesByPhone } from "@/lib/razorpay-registrations";
import { getEventLeaderboard, MILESTONES_KM } from "@/lib/rider-metrics";
import { cleanPhone, normalizeCity } from "@/lib/registration-normalize";
import { normalizeIndianState } from "@/lib/india-states";

type ProfileAddress = { address: string; city: string; state: string; pincode: string };

// A profile address this short is usually just a locality/area name
// ("Koduvai"), not a postable address — prefer the fuller registration one
// when it's longer.
const SHORT_ADDRESS_CHARS = 15;

function pickAddress(profile: string | undefined, registration: string | undefined): string {
  const fromProfile = profile?.trim() ?? "";
  const fromRegistration = registration?.trim() ?? "";
  if (!fromProfile) return fromRegistration;
  if (fromProfile.length < SHORT_ADDRESS_CHARS && fromRegistration.length > fromProfile.length) {
    return fromRegistration;
  }
  return fromProfile;
}

/**
 * Admin-only Excel report of an event's final standings: rank, name,
 * address (rider's profile first, then whatever their event registration
 * captured), points, km and qualified status. Registration (Razorpay /
 * sheet) doesn't store street address/pin on the event's riders map, so
 * those come from the Razorpay payment notes; city/state fall back to the
 * stored registration.
 */
export async function buildEventReportXlsx(eventId: string): Promise<{ buffer: Buffer; fileName: string } | null> {
  const doc = await adminDb.collection(EVENTS_COLLECTION).doc(eventId).get();
  if (!doc.exists) {
    return null;
  }
  const event = mapEventCard(doc.id, doc.data() as EventDoc);

  const [leaderboard, registered, usersSnapshot, registrationAddresses] = await Promise.all([
    getEventLeaderboard(event, 100000),
    getEventRegisteredRiders(eventId),
    adminDb.collection("users").get(),
    getRegistrationAddressesByPhone(eventId),
  ]);

  const profileByPhone = new Map<string, ProfileAddress>();
  usersSnapshot.docs.forEach((userDoc) => {
    const data = userDoc.data() as {
      phone?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | null;
    };
    if (!data.phone) return;
    profileByPhone.set(cleanPhone(data.phone), {
      address: data.address?.trim() ?? "",
      city: data.city ? normalizeCity(data.city) : "",
      state: normalizeIndianState(data.state) ?? "",
      pincode: data.pincode?.trim() ?? "",
    });
  });
  const registeredByPhone = new Map(registered.map((rider) => [rider.phone, rider]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  sheet.columns = [
    { header: "Rank", key: "rank", width: 7 },
    { header: "Name", key: "name", width: 28 },
    { header: "Gender", key: "gender", width: 9 },
    { header: "Address", key: "address", width: 40 },
    { header: "City", key: "city", width: 18 },
    { header: "State", key: "state", width: 18 },
    { header: "Pin", key: "pin", width: 10 },
    ...MILESTONES_KM.map((milestone) => ({ header: `${milestone}KM`, key: `m${milestone}`, width: 8 })),
    { header: "Total Points", key: "points", width: 13 },
    { header: "Total Kilometer", key: "km", width: 16 },
    { header: "Qualified", key: "qualified", width: 10 },
    { header: "Phone", key: "phone", width: 15 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  leaderboard.riders.forEach((rider, index) => {
    const profile = profileByPhone.get(rider.phone);
    const reg = registeredByPhone.get(rider.phone);
    sheet.addRow({
      rank: index + 1,
      name: rider.name,
      gender: reg?.gender ?? "",
      address: pickAddress(profile?.address, registrationAddresses.get(rider.phone)?.address),
      city: profile?.city || (reg?.city ? normalizeCity(reg.city) : "") || rider.city || "",
      state: profile?.state || normalizeIndianState(reg?.state) || rider.state || "",
      pin: profile?.pincode || registrationAddresses.get(rider.phone)?.pincode || "",
      ...Object.fromEntries(MILESTONES_KM.map((milestone) => [`m${milestone}`, rider.milestoneCounts[milestone]])),
      points: rider.totalPoints,
      km: Math.round(rider.totalDistanceKm * 100) / 100,
      qualified: rider.isFinisher ? "Yes" : "No",
      phone: rider.phone,
    });
  });
  // Phone/pin as text so Excel doesn't drop leading zeros or go scientific.
  sheet.getColumn("phone").numFmt = "@";
  sheet.getColumn("pin").numFmt = "@";

  const safeName = (event.name || "event").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), fileName: `${safeName}-report.xlsx` };
}
