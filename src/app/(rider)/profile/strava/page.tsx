import { headers } from "next/headers";
import Image from "next/image";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import { verifySession } from "@/lib/auth/dal";
import { getUserProfile } from "@/lib/user-profile";
import { getStravaAuthorizeUrl, getStravaConnectionByPhone } from "@/lib/strava";
import DisconnectStravaButton from "@/components/rider/DisconnectStravaButton";

const STRAVA_ERROR_MESSAGES: Record<string, string> = {
  no_phone_on_file: "Add a phone number to your profile first, then connect Strava.",
  exchange_failed: "Strava couldn't be reached to finish connecting. Please try again.",
  access_denied: "Strava connection was cancelled.",
  missing_code: "Strava connection was cancelled.",
};

export default async function ConnectStravaPage({
  searchParams,
}: PageProps<"/profile/strava">) {
  const { strava_connected, strava_error } = await searchParams;

  const session = await verifySession();
  const profile = await getUserProfile(session.uid);
  const connection = profile?.phone ? await getStravaConnectionByPhone(profile.phone) : null;

  // Built from this request's own host, so it works on whichever domain is
  // currently deployed to — see src/lib/strava.ts.
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  const redirectUri = `${protocol}://${host}/api/auth/strava/callback`;
  const authorizeUrl = getStravaAuthorizeUrl(redirectUri, session.uid);

  const errorMessage =
    typeof strava_error === "string" ? (STRAVA_ERROR_MESSAGES[strava_error] ?? "Couldn't connect Strava.") : null;

  return (
    <Container className="py-3" style={{ maxWidth: 600 }}>
      <h1 className="h3 mb-4">Connect Strava</h1>

      {strava_connected && (
        <Alert variant="success">Strava connected — your rides will sync automatically.</Alert>
      )}
      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

      {connection ? (
        <div className="d-flex align-items-center gap-3 border rounded p-3">
          {connection.profileImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- external Strava CDN URL, not worth a next.config remotePatterns entry for this one avatar
            <img
              src={connection.profileImageUrl}
              alt=""
              width={56}
              height={56}
              className="rounded-circle"
            />
          )}
          <div className="flex-grow-1">
            <div className="fw-semibold">
              {[connection.firstName, connection.lastName].filter(Boolean).join(" ") || "Connected athlete"}
            </div>
            <div className="text-muted small">
              {[connection.city, connection.state].filter(Boolean).join(", ") || "Strava connected"}
            </div>
          </div>
          <DisconnectStravaButton />
        </div>
      ) : (
        <>
          <p className="text-muted">
            Connect your Strava account so rides during CNG events sync to the leaderboard automatically.
          </p>
          {/* Strava's brand guidelines require their own button asset (exact
              color/wordmark), not a custom-styled button — see
              https://developers.strava.com/guidelines/ */}
          <a href={authorizeUrl}>
            <Image src="/strava/connect-with-strava.png" alt="Connect with Strava" width={193} height={48} />
          </a>
        </>
      )}

      {/* Required attribution wherever Strava-sourced data/branding appears
          on the page, connected or not — same asset letscng-ui uses. */}
      <Image
        src="/strava/powered-by-strava.png"
        alt="Powered by Strava"
        width={169}
        height={32}
        className="d-block mx-auto mt-4"
      />
    </Container>
  );
}
