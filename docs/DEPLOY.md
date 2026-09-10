# Deploying `cyclenetworkgrow-next`

## Where it lives

- **Firebase project:** `challenge1177` (LetsCNG) — the *same* project that hosts the
  production `letscng-ui` Angular site. Owner is `cyclenetworkgrow@gmail.com`;
  `ujjal1991@gmail.com` has Editor + Cloud Functions Admin + Cloud Run Admin +
  Service Account User (the last three were needed to deploy an SSR backend).
- **Hosting site:** `cyclenetworkgrow-next` (a *second* site in the project, created with
  `firebase hosting:sites:create`). It is completely independent of the `letscng-ui`
  production site — deploying one never touches the other.
- **Live URL:** https://cyclenetworkgrow-next.web.app
- **SSR backend:** 2nd-gen Cloud Function `ssrcyclenetworkgrownext` in `asia-southeast1`
  (auto-created by the Firebase web-frameworks integration; it runs on Cloud Run).

This is a **review / staging** deployment. It talks to the **real `challenge1177`
Firestore and Auth** — same data as `letscng.com` production. It is a separate *site*,
not a separate *database*.

## How it deploys

**Automatically, via GitHub Actions** — `.github/workflows/deploy-review-site.yml` runs
on every push to `main` (excluding docs-only changes) and can also be triggered manually
from the Actions tab. It authenticates with a service-account key stored as the
`FIREBASE_DEPLOY_KEY` repo secret.

**Manually**, from a working tree:

```bash
cd cyclenetworkgrow-next
FIREBASE_CLI_EXPERIMENTS=webframeworks \
IS_WEBPACK_TEST=1 \
firebase deploy --only hosting --project challenge1177 --force
```

Two non-obvious flags:

- **`IS_WEBPACK_TEST=1`** — forces `next build` to use webpack instead of Turbopack.
  Firebase's web-frameworks integration spawns `next build` directly (it ignores the
  `build` script in `package.json` — do **not** put `--webpack` there, it just triggers
  a "custom build ignored" warning), and Next 16 defaults that build to Turbopack.
  Turbopack's module externalization produces a broken `firebase-admin-<hash>/app`
  import that fails at runtime with `ERR_MODULE_NOT_FOUND`, so every SSR route 500s.
  The webpack build bundles `firebase-admin` correctly. `IS_WEBPACK_TEST=1` is the only
  lever that survives into Firebase's spawned build (see
  `node_modules/next/dist/lib/bundler.js` → `parseBundlerArgs`).
- **`--force`** — lets Firebase auto-configure the Artifact Registry cleanup policy for
  the function's container images without an interactive prompt.
- **`FIREBASE_CLI_EXPERIMENTS=webframeworks`** — needed on any machine that hasn't run
  `firebase experiments:enable webframeworks` (i.e. CI). Locally the enable is persisted,
  so the manual command above still works without it — the var just makes it portable.

## One-time CI setup

The GitHub Actions workflow needs a service-account key in the `FIREBASE_DEPLOY_KEY`
repo secret. To (re)create it:

```bash
gcloud iam service-accounts create github-deployer \
  --project challenge1177 --display-name "GitHub Actions – review site deploy"

SA=github-deployer@challenge1177.iam.gserviceaccount.com

# Role grants REQUIRE the project Owner (cyclenetworkgrow@gmail.com).
# This mirrors the human deployer's proven-working permission set.
for role in roles/editor roles/cloudfunctions.admin roles/run.admin roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding challenge1177 \
    --member "serviceAccount:$SA" --role "$role"
done

gcloud iam service-accounts keys create /tmp/gh-deployer.json --iam-account "$SA"
gh secret set FIREBASE_DEPLOY_KEY --repo ujbhaskar/cyclenetworkgrow-next < /tmp/gh-deployer.json
rm /tmp/gh-deployer.json
```

## Supporting config (committed)

- `firebase.json` → `hosting` block with `"source": "."` and
  `"frameworksBackend": { "region": "asia-southeast1" }`.
- `.npmrc` → `legacy-peer-deps=true`. Firebase injects `firebase-frameworks`, whose
  peer range does not include `firebase-admin@14`; without this the deploy's internal
  `npm install` fails with `ERESOLVE`.
- `.env.production` → the public `NEXT_PUBLIC_FIREBASE_*` config, compiled into the
  build. Not secret (it ships in the client bundle either way). `.env.local` (emulator
  config for `npm run dev`) stays git-ignored.
- `eslint.config.mjs` → ignores `.firebase/**` (the deploy staging dir).

## Known warnings (harmless)

- `Invalid next.config.js options detected: Unrecognized key(s): '__esModule', 'default'`
  — Firebase transpiles `next.config.ts` and wraps the ESM default export. Config is
  effectively empty so it has no effect.
- Sass `@import` / Dart Sass 3.0 deprecation warnings from Bootstrap.
- `outdated version of firebase-functions` — comes from the injected `firebase-frameworks`
  package, not our code.

## If the web-frameworks path breaks on a future Next release

The supported long-term path for Next.js SSR on Firebase is **App Hosting**
(`firebase apphosting:backends:create`), which needs the repo pushed to GitHub and a
one-time GitHub connection. Switch to it if `IS_WEBPACK_TEST=1` stops being enough.
