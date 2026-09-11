# Deploying `cyclenetworkgrow-next`

## Where it lives

- **Firebase project:** `challenge1177` (LetsCNG) — the *same* project that hosts the
  production `letscng-ui` Angular site. Owner is `cyclenetworkgrow@gmail.com`.
- **Hosting:** [Firebase App Hosting](https://firebase.google.com/docs/app-hosting),
  backend `cyclenetworkgrow-next`, region `us-east4`. It runs a real Next.js server on
  Cloud Run (service `cyclenetworkgrow-next` in `us-east4`) — not the classic Hosting +
  Cloud Functions "web frameworks" integration this project used at first (see
  [History](#history) below for why that was abandoned).
- **Live URL:** https://cyclenetworkgrow-next--challenge1177.us-east4.hosted.app
- **Repo connection:** `ujbhaskar/cyclenetworkgrow-next` on GitHub, branch `main`, root
  directory `/`. Every push to `main` (that changes app code) triggers a new Cloud Build
  → Cloud Run rollout automatically — no manual deploy step, no GitHub Actions workflow.

This is a **review / staging** deployment. It talks to the **real `challenge1177`
Firestore and Auth** — same data as `letscng.com` production. It's a separate *backend*,
not a separate *database*.

## Deploying

Just push to `main`. Watch progress either in the Firebase Console
(**App Hosting → cyclenetworkgrow-next → View**) or directly in Cloud Build:

```bash
# find the latest build for this backend
gcloud builds list --project=challenge1177 --region=us-east4 --limit=5

# stream its logs
gcloud builds log <BUILD_ID> --project=challenge1177 --region=us-east4 --stream
```

To trigger a rebuild without a real code change, push a small no-op diff (e.g. a comment
tweak) — `git commit --allow-empty` does **not** trigger the GitHub webhook here, and
`firebase apphosting:rollouts:create` needs `developerconnect.gitRepositoryLinks.fetchReadToken`,
which isn't included in `firebaseapphosting.admin` (same "Editor + piecemeal admin roles"
pattern as everything else in this project — ask the Owner if it's ever actually needed).

## Strava (rider profile connect/disconnect)

`src/lib/strava.ts` does the OAuth token exchange server-side (unlike letscng-ui, which
puts the client secret in the browser — see the History section) and reads/writes the
same `athelete_tokens` collection the legacy app and this app's `rider-metrics.ts` already
use, keyed by the legacy bare-digit phone format.

- `STRAVA_CLIENT_ID` — not secret (already public in letscng-ui's bundle), lives in
  `.env.production`.
- `STRAVA_CLIENT_SECRET` — an App Hosting secret (Secret Manager), referenced in
  `apphosting.yaml`, never committed. Set it with:
  ```bash
  sed -n "s/.*clientSecret:'\([^']*\)'.*/\1/p" ../letscng-ui/src/environments/environment.prod.ts \
    | tr -d "\n" \
    | firebase apphosting:secrets:set STRAVA_CLIENT_SECRET --project challenge1177 --force --data-file -
  firebase apphosting:secrets:grantaccess STRAVA_CLIENT_SECRET \
    --backend cyclenetworkgrow-next --location us-east4 --project challenge1177
  ```
  The `grantaccess` step needs **Secret Manager Admin** on top of the usual roles — same
  IAM-gap pattern as everything else here.
- Strava's OAuth app has (historically, at least) a single **Authorization Callback
  Domain** at strava.com/settings/api — check before adding a new domain there, since it
  may replace whatever's already registered for production `letscng.com` rather than
  adding alongside it.

## Supporting config (committed)

- `apphosting.yaml` — runtime config (memory, CPU, instance scaling) for the backend.
- `.env.production` — the public `NEXT_PUBLIC_FIREBASE_*` config, compiled into the
  build by Next.js itself. Not secret (it ships in the client bundle either way).
  `.env.local` (emulator config for `npm run dev`) stays git-ignored.

## Auth: authorized domains

Firebase Auth's **Authentication → Settings → Authorized domains** list needs this
backend's domain (`cyclenetworkgrow-next--challenge1177.us-east4.hosted.app`) added, or
**Google sign-in specifically** (`signInWithPopup`) fails with `auth/unauthorized-domain`.
Plain email/password login isn't domain-restricted the same way. If the backend's URL
ever changes (recreating it, moving regions), re-add the new domain.

## IAM

Managing App Hosting backends (creating/deleting, not just viewing) needs the
**Firebase App Hosting Admin** (`roles/firebaseapphosting.admin`) role, which is not
included in `roles/editor`. Grant it via the Owner:

```bash
gcloud projects add-iam-policy-binding challenge1177 \
  --member="user:<you>@gmail.com" --role="roles/firebaseapphosting.admin"
```

The **GitHub connection** (Console → App Hosting → Create/manage backend → import repo)
is a one-time interactive step — it opens a GitHub OAuth window to install/authorize the
"Firebase App Hosting" GitHub App on the repo. If that step hangs, the popup was likely
blocked by the browser; check `github.com/settings/installations` to see whether the app
is actually installed, allow popups for `console.firebase.google.com`, and retry.

## History

The first attempt at deploying this app used classic Firebase Hosting's "web frameworks"
integration (`firebase experiments:enable webframeworks`, a `hosting` block in
`firebase.json` with `frameworksBackend`) — an early-preview feature that wraps the
Next.js app in a Cloud Functions (2nd gen) handler. It hit two real bugs:

1. **Turbopack build breaks `firebase-admin` at runtime.** Next 16 defaults `next build`
   to Turbopack; the integration spawns `next build` directly (ignoring any build script),
   and Turbopack's module externalization produced a broken `firebase-admin-<hash>/app`
   import (`ERR_MODULE_NOT_FOUND`) — every SSR route 500'd. Worked around at the time with
   `IS_WEBPACK_TEST=1` to force a webpack build (see `node_modules/next/dist/lib/bundler.js`
   → `parseBundlerArgs`).
2. **The Cookie header never reached the app.** Confirmed at two independent layers —
   `proxy.ts` middleware (reads cookies straight off the raw request) and
   `next/headers`' `cookies()` in Server Components — both saw zero cookies on requests
   the browser demonstrably sent one on (verified via DevTools: cookie present,
   `HttpOnly`/`Secure`/`SameSite=Lax`, correct domain). Login "worked" (Firebase Auth
   succeeded, the session cookie was set) but every subsequent page silently rendered as
   logged out, and any protected route bounced back to `/login`. Not fixable from
   application code — a platform-adapter bug in that early-preview integration.

Given both were platform bugs in an explicitly best-effort integration ("known to work
with Next.js 12–16.0"), and the app is on Next 16.3.4, the project moved to App Hosting —
a real Next.js server on Cloud Run — instead of chasing further workarounds. The old
Hosting site and Cloud Function were deleted; `firebase.json` no longer has a `hosting`
block.
