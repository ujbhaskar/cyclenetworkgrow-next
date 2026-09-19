import "server-only";
import { google } from "googleapis";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

// Same physical Google Sheet the legacy Angular admin panel already reads
// (letscng-api/functions/services/sheetService.js) — one tab per event
// edition, tab name = that event's `registeredGoogleDataXLS` field. Admin
// manually pastes each event's Razorpay Payment Page export into its tab;
// this is read-only, nothing here ever writes to the sheet.
const REGISTRATIONS_SPREADSHEET_ID = "1tvDsC55MTkxBSrwUAeWDaqv7TXrAvxmyJ3WTeJ_-tN4";

/**
 * Reads one tab of the shared registrations spreadsheet and returns it as
 * header-mapped row objects (row[0] of the range is the header row) — same
 * shape the legacy backend's getSheetData returns. `GOOGLE_SHEETS_CREDENTIALS_JSON`
 * is the full service-account key JSON (same account — cng-google-sheet@challenge1177.iam.gserviceaccount.com
 * — already granted access to this sheet, no new sharing needed), stored as
 * an App Hosting secret (see docs/DEPLOY.md).
 */
export async function getSheetRows(sheetName: string): Promise<Record<string, string>[]> {
  const credentials = JSON.parse(requireEnv("GOOGLE_SHEETS_CREDENTIALS_JSON"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client as never });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: REGISTRATIONS_SPREADSHEET_ID,
    range: `${sheetName}!A1:Z`,
  });

  const [header, ...rows] = response.data.values ?? [];
  if (!header) {
    return [];
  }
  return rows.map((row) => {
    const item: Record<string, string> = {};
    header.forEach((key: string, i: number) => {
      item[key] = row[i] ?? "";
    });
    return item;
  });
}
