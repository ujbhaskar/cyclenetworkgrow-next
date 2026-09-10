import Link from "next/link";
import Container from "react-bootstrap/Container";
import { verifySession } from "@/lib/auth/dal";
import { getUserProfile } from "@/lib/user-profile";
import ProfileEditForm from "@/components/rider/ProfileEditForm";

export default async function ProfilePage() {
  const session = await verifySession();
  const profile = await getUserProfile(session.uid);

  return (
    <Container className="py-3" style={{ maxWidth: 600 }}>
      <h1 className="h3 mb-4">Your Profile</h1>

      {profile && <ProfileEditForm profile={profile} />}

      <hr className="my-4" />

      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <div className="fw-semibold">Strava</div>
          <div className="text-muted small">
            {profile?.stravaConnected ? "Connected" : "Not connected"}
          </div>
        </div>
        {profile?.stravaConnected ? (
          <span className="badge bg-success bg-opacity-10 text-success">
            <i className="bi bi-check-circle-fill me-1" aria-hidden />
            Connected
          </span>
        ) : (
          <Link href="/profile/strava" className="btn btn-outline-success btn-sm">
            Connect Strava
          </Link>
        )}
      </div>

      <Link href="/profile/reviews" className="btn btn-outline-success">
        <i className="bi bi-chat-square-quote me-2" aria-hidden />
        Share Your Story
      </Link>
    </Container>
  );
}
