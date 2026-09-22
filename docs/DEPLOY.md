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

### Webhook (`/api/strava/webhook`) and `stravaWebhookEvents`

Strava allows only **one push subscription per Client ID, globally** — same sharing
caveat as everything else Strava-related here (see the admin Strava Subscription page).
Only `aspect_type: "create"` events get an audit doc in `stravaWebhookEvents` — "update"
events and non-activity events (athlete deauthorization, etc.) are still processed but
not logged, since they made up most of this collection's write/storage volume for
little audit value; "delete" events still remove the ride from `rides`, just without a
doc of their own. That collection has a **Firestore TTL policy on its `expiresAt`
field** (2 days after `receivedAt`, set by the route itself), so it doesn't grow
forever — this is debug/audit data, not ride data (`rides/{phone}` is untouched by the
TTL and never expires). An admin can also clear the whole collection on demand from the
Strava Webhook Events admin page. Created with:

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=stravaWebhookEvents --enable-ttl --project=challenge1177
```

TTL deletion isn't instant (up to 24h after `expiresAt` passes) and only applies where
the field is an actual Timestamp — the ~5,900 events recorded before this was added
stored `receivedAt` as a string, so those predate `expiresAt` and won't be swept.

## Razorpay (registration payment sync)

Replaces the old portal's flow (Razorpay export → pasted into a Google Sheet → admin
clicks "Sync users from registrations", which reads that sheet via the Sheets API) with
a webhook straight from Razorpay — see `src/lib/razorpay.ts` and
`src/app/api/webhooks/razorpay/route.ts`. **Stage 1 only** (verifies the signature and
records the raw event to the `razorpayWebhookEvents` collection) — turning a captured
payment into a rider on the right event isn't built yet; that needs a real
`payment.captured` event's actual shape first (Razorpay's docs don't fully specify where
a Payment Page's custom fields — full name/gender/city/state — land in the payload).

- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — not used by stage 1 yet, but needed for the
  Orders/Payments API lookup stage 2 will add. Both stored as App Hosting secrets (not
  split public/secret like Strava's CLIENT_ID) since it's not yet confirmed KEY_ID needs
  to be client-exposed here.
- `RAZORPAY_WEBHOOK_SECRET` — configured in the Razorpay dashboard (Settings → Webhooks)
  when creating the webhook; used to verify `x-razorpay-signature`.
- Set each with:
  ```bash
  firebase apphosting:secrets:set RAZORPAY_KEY_ID --project challenge1177 --force
  firebase apphosting:secrets:set RAZORPAY_KEY_SECRET --project challenge1177 --force
  firebase apphosting:secrets:set RAZORPAY_WEBHOOK_SECRET --project challenge1177 --force
  firebase apphosting:secrets:grantaccess RAZORPAY_KEY_ID \
    --backend cyclenetworkgrow-next --location us-east4 --project challenge1177
  firebase apphosting:secrets:grantaccess RAZORPAY_KEY_SECRET \
    --backend cyclenetworkgrow-next --location us-east4 --project challenge1177
  firebase apphosting:secrets:grantaccess RAZORPAY_WEBHOOK_SECRET \
    --backend cyclenetworkgrow-next --location us-east4 --project challenge1177
  ```
- In the Razorpay dashboard: Settings → Webhooks → Add New Webhook, URL
  `https://cyclenetworkgrow-next--challenge1177.us-east4.hosted.app/api/webhooks/razorpay`,
  select at least `payment.captured`, and set the same secret used above. Razorpay's
  "Send Test Webhook" button there can be used to confirm the endpoint responds `200`,
  though a synthetic test event won't include a real Payment Page's actual custom-field
  notes — check a real captured payment's logged document in `razorpayWebhookEvents` for
  that.

## Google Sheets (legacy event registration sync)

Decided against the Razorpay-webhook approach above for now — reverted to matching the
legacy Angular admin's existing workflow instead: admin pastes each event's Razorpay
Payment Page export into a tab of a shared Google Sheet, then triggers a sync from
`/admin/legacy-events/<id>` (see `src/lib/googleSheets.ts`,
`src/lib/legacy-registrations.ts`). The Razorpay webhook code above is left in place
(stage 1 only, unused by this flow) in case direct integration is revisited later.

- `GOOGLE_SHEETS_CREDENTIALS_JSON` — the full service-account key JSON, one line. Reuses
  the **same** service account the legacy backend already uses
  (`cng-google-sheet@challenge1177.iam.gserviceaccount.com`,
  `letscng-api/functions/credentials.json`), which is already granted read access to the
  shared registrations spreadsheet — no new Google Cloud/sharing setup needed, just copy
  the existing key into Secret Manager:
  ```bash
  jq -c . ../letscng-api/functions/credentials.json \
    | firebase apphosting:secrets:set GOOGLE_SHEETS_CREDENTIALS_JSON --project challenge1177 --force --data-file -
  firebase apphosting:secrets:grantaccess GOOGLE_SHEETS_CREDENTIALS_JSON \
    --backend cyclenetworkgrow-next --location us-east4 --project challenge1177
  ```
- The spreadsheet id is hardcoded in `src/lib/googleSheets.ts` (same one the legacy admin
  panel reads) — one tab per event edition, tab name = that event's
  `registeredGoogleDataXLS` field on its `events/{id}` doc.
- **This is the one deliberate exception to `src/lib/events.ts`'s "never write to the
  legacy `events` collection" rule.** The admin flow is preview-then-confirm, not the
  legacy admin's one-click full replace: `previewNewRiderRegistrations` diffs the sheet
  against the event's current `riders` map (read-only) and returns just the new phones;
  `addNewRiderRegistrations` merges only those confirmed phones in, leaving every already-
  registered rider's entry untouched — including manual corrections made from the
  registrations page's edit modal (`updateEventRiderByAdmin`), which a full-replace sync
  would otherwise wipe out on the next run. See the comments on both in
  `src/lib/legacy-registrations.ts` before changing either.

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
