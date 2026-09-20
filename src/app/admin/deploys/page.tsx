import { requireRole } from "@/lib/auth/dal";

// Deploys aren't triggered from this app at all — Firebase App Hosting
// watches ujbhaskar/cyclenetworkgrow-next on GitHub directly and runs the
// build/rollout itself on every push to main (see docs/DEPLOY.md). These are
// just deep links into where that already-running job can be watched.
const FIREBASE_APP_HOSTING_URL = "https://console.firebase.google.com/project/challenge1177/apphosting";
const CLOUD_BUILD_HISTORY_URL = "https://console.cloud.google.com/cloud-build/builds;region=us-east4?project=challenge1177";
const GITHUB_REPO_URL = "https://github.com/ujbhaskar/cyclenetworkgrow-next";
const LIVE_URL = "https://cyclenetworkgrow-next--challenge1177.us-east4.hosted.app";

export default async function AdminDeploysPage() {
  await requireRole("admin");

  return (
    <div>
      <h1 className="h3 mb-1">Deploys</h1>
      <p className="text-muted mb-4">
        This app has no deploy button and no GitHub Actions workflow. Firebase App Hosting is connected straight to
        the <code>main</code> branch of the GitHub repo below — every push that changes app code triggers a Cloud
        Build, which then rolls out to Cloud Run automatically. Pushing is the only way to deploy.
      </p>
      <ul className="mb-0">
        <li className="mb-2">
          <a href={FIREBASE_APP_HOSTING_URL} target="_blank" rel="noopener noreferrer">
            Firebase App Hosting (backend: cyclenetworkgrow-next, region us-east4)
          </a>{" "}
          — rollout history and current status; start here.
        </li>
        <li className="mb-2">
          <a href={CLOUD_BUILD_HISTORY_URL} target="_blank" rel="noopener noreferrer">
            Cloud Build history
          </a>{" "}
          — the actual build logs for each rollout (also reachable via <code>gcloud builds list</code>).
        </li>
        <li className="mb-2">
          <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
            GitHub repo (ujbhaskar/cyclenetworkgrow-next)
          </a>{" "}
          — pushing to <code>main</code> is what kicks off a deploy.
        </li>
        <li>
          <a href={LIVE_URL} target="_blank" rel="noopener noreferrer">
            Live site
          </a>
        </li>
      </ul>
    </div>
  );
}
