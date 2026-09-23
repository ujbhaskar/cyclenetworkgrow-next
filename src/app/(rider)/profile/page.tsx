import { headers } from "next/headers";
import Link from "next/link";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import { verifySession } from "@/lib/auth/dal";
import { getUserProfile } from "@/lib/user-profile";
import { getStravaAuthorizeUrl, getStravaConnectionByPhone } from "@/lib/strava";
import ProfileEditForm from "@/components/rider/ProfileEditForm";
import ChangePasswordForm from "@/components/rider/ChangePasswordForm";
import DisconnectStravaButton from "@/components/rider/DisconnectStravaButton";

const STRAVA_ERROR_MESSAGES: Record<string, string> = {
  no_phone_on_file: "Add a phone number to your profile first, then connect Strava.",
  exchange_failed: "Strava couldn't be reached to finish connecting. Please try again.",
  access_denied: "Strava connection was cancelled.",
  missing_code: "Strava connection was cancelled.",
};

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const { strava_connected, strava_error } = await searchParams;

  const session = await verifySession();
  const profile = await getUserProfile(session.uid);
  const connection = profile?.phone ? await getStravaConnectionByPhone(profile.phone) : null;

  // Built from this request's own host, so it works on whichever domain is
  // currently deployed to — see src/lib/strava.ts.
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  const authorizeUrl = getStravaAuthorizeUrl(`${protocol}://${host}/api/auth/strava/callback`, session.uid);

  const errorMessage =
    typeof strava_error === "string" ? (STRAVA_ERROR_MESSAGES[strava_error] ?? "Couldn't connect Strava.") : null;

  return (
    <Container className="py-3" style={{ maxWidth: 600 }}>
      <Link href="/" className="d-inline-flex align-items-center gap-1 text-decoration-none small mb-3">
        <i className="bi bi-arrow-left" aria-hidden />
        Back to home
      </Link>
      <h1 className="h3 mb-4">Your Profile</h1>

      {profile && <ProfileEditForm profile={profile} />}

      <hr className="my-4" />

      <ChangePasswordForm />

      <hr className="my-4" />

      {strava_connected && (
        <Alert variant="success">Strava connected — your rides will sync automatically.</Alert>
      )}
      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

      <div className="fw-semibold mb-2">Strava</div>

      {connection ? (
        <div className="d-flex align-items-center gap-3 border rounded p-3 mb-3">
          {connection.profileImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- external Strava CDN URL, not worth a next.config remotePatterns entry for this one avatar
            <img
              src={connection.profileImageUrl}
              alt=""
              width={48}
              height={48}
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
          <p className="text-muted small">
            Connect Strava so rides during CNG events sync to the leaderboard automatically.
          </p>
          {/* Strava's brand guidelines require their own button asset (exact
              color/wordmark), not a custom-styled button — see
              https://developers.strava.com/guidelines/. Plain <img>, not
              next/image: the optimizer 404s on this deployment (a Cloud Run
              internal-networking quirk), and these small brand logos don't
              need resizing. */}
          <a href={authorizeUrl} className="d-inline-block mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image's optimizer 404s here, see comment above */}
            <img src="/strava/connect-with-strava.png" alt="Connect with Strava" width={193} height={48} />
          </a>
        </>
      )}

      {/* Required attribution wherever Strava-sourced data/branding appears
          on the page, connected or not — same asset letscng-ui uses. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image's optimizer 404s here, see comment above */}
      <img src="/strava/powered-by-strava.png" alt="Powered by Strava" width={169} height={32} className="mb-4" />

      <div>
        <Link href="/profile/reviews" className="btn btn-outline-success">
          <i className="bi bi-chat-square-quote me-2" aria-hidden />
          Share Your Story
        </Link>
      </div>
    </Container>
  );
}
