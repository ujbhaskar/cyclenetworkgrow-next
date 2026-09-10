# Cycle Network Grow — Requirements

## 1. Overview

Cycle Network Grow is a web platform for cyclists to join online (and offline)
cycling events/challenges. Riders connect their Strava account; the platform
pulls their ride activity and ranks participants on a leaderboard. Admins
create and manage events, manage riders, and administer the platform through
a dedicated Admin Panel.

## 2. User Roles

### 2.1 Rider (participant)
- Signs up / logs in.
- Connects their Strava account (OAuth).
- Joins events (individual or as part of a team/group).
- Views their own stats and event leaderboards.
- Views event details (rules, dates, scoring type, participants).

### 2.2 Admin
- Manages the website/content.
- Creates and configures events.
- Manages riders (view, edit, suspend/remove, manually adjust entries).
- Manages teams/groups within an event.
- Manually enters/adjusts results for **offline events** (rides not tracked
  via Strava).
- Can **emulate (impersonate) a rider** to see the platform from their view
  and assist with support/debugging.
- Reviews/moderates leaderboard data (e.g. exclude a flagged activity).

> Open question: is there a role between Rider and Admin (e.g. "Event
> Organizer" who can manage only their own event)? Not required for v1
> unless confirmed.

## 3. Core Features

### 3.1 Authentication

- Platform login via Firebase Auth, supporting multiple sign-in methods
  (user picks any one at login/sign-up time, all tied to the same account
  where identifiers match):
  - Email + OTP (passwordless, one-time code sent to email).
  - Phone number + OTP (SMS-based, via Firebase Phone Auth).
  - Email or phone number + password (traditional credentials).
  - Google sign-in (OAuth via Firebase).
- Account linking: if a rider signs up with one method and later uses
  another with the same verified email/phone, link to the existing account
  rather than creating a duplicate.
- Strava OAuth connection, separate from platform login — a rider logs into
  the platform first, then links Strava from their profile.
- Store and refresh Strava OAuth tokens (access + refresh token, expiry
  handling) securely server-side — never expose tokens to the client.
- Riders can disconnect/reconnect Strava at any time.

### 3.2 Strava Integration
- Pull ride activities for connected riders (via Strava API, using the
  athlete's OAuth token).
- Support both:
  - **Polling/backfill** — periodic sync of recent activities.
  - **Webhooks** — Strava's webhook events API to get near-real-time
    activity updates (recommended over pure polling).
- Filter activities relevant to an event's time window and activity type
  (e.g. "Ride" / "VirtualRide" only, configurable per event).
- Handle Strava rate limits and API errors gracefully (retry/backoff).
- Store the raw metrics needed for scoring: distance, elevation gain, moving
  time, activity date, athlete ID, activity ID (to avoid double-counting).
- **Ride ingestion is gated, not continuous.** A rider's Strava account can
  stay connected long-term, but rides are only pulled/stored while there's
  an active event they're registered to. Outside that (no active event, or
  not registered to one), no activity is fetched or saved for anyone.
- **Global admin sync switch**: a single, platform-wide ON/OFF control (not
  per-event, not per-rider) that connects/disconnects Strava ingestion
  entirely. Admin turns it on when an event is running and off between
  events. When off, nothing arrives from Strava for any rider, full stop.

### 3.3 Events
Admin-created events support:
- **Time-bound challenges** — a defined start and end date/time; only
  activities within that window count.
- **Team/group events** — riders can be grouped into teams; team totals are
  aggregated from member results.
- **Offline events** — in-person events not tracked via Strava, where an
  Admin manually enters/uploads results per rider or team.
- Each event has: name, description, banner/image, start/end date, activity
  type filter, scoring method (see 3.4), team mode on/off, join
  method (open / invite / approval), status (draft / active / completed
  / archived), **mode** (Online — Strava-tracked, or In-person — tied to a
  physical location), and a **target distance** for the event/route. (Strava
  sync itself is controlled by the single global switch in 3.2, not a
  per-event field.)
- Riders can browse and join open events from an events list/detail page.
- Admin can attach one or more **documents** (PDFs, images) to an event —
  e.g. rules/waivers, route maps, permits, event photos. See 3.8.

### 3.4 Leaderboard & Scoring
- Configurable per event, initially supporting:
  - **Total distance** ridden during the event window.
  - **Total elevation gain** during the event window.
  - **Ride count / consistency** (e.g. number of qualifying rides, or a
    streak-based metric).
- Leaderboard views: individual ranking and team ranking (when team mode is
  on).
- Leaderboard updates as new Strava activities sync in (near-real-time via
  webhook, or on a scheduled refresh).
- Admin can exclude/flag a specific activity from scoring (e.g. suspected
  GPS error or rule violation).

> Open question: exact scoring formula when multiple metrics apply (e.g.
> weighted score vs. separate leaderboards per metric) — to be decided
> before implementation. Note this as a v1 blocker to resolve.

### 3.5 Admin Panel
- Dashboard overview (active events, total riders, recent activity sync
  status).
- Event management: create/edit/archive events, configure scoring, manage
  teams.
- Rider management: search/view riders, view their connected Strava status,
  suspend/remove, manually adjust a rider's event entry.
- Offline event result entry (manual data entry per rider/team).
- User emulation ("login as" a rider) for support purposes, with an audit
  trail of when/who used this feature.
- Basic content management for site pages (if needed — TBD scope).
- **Document library**: upload PDFs/images, optionally link each to one or
  more events (3.8).
- **Home page section visibility**: toggle each home page section on/off
  (3.7) without needing a code change.
- **Review moderation**: approve or discard rider-submitted testimonials
  before they can appear on the home page (3.7).
- **Partners management**: add/edit/remove partner logos and reorder the
  home page partner strip (3.7).
- **Ride data cleanup**: browse riders with synced ride data and bulk-delete
  a rider's (or multiple riders') stored activities — a maintenance/reset
  tool distinct from single-activity moderation. *(Carried over from the
  current site's "clean rides" admin tool — not in the original draft.)*
- **Strava-connected riders list**: view everyone who has connected Strava
  (separate from the general rider list), and forcibly disconnect/revoke a
  rider's Strava connection from the admin side (not just the rider's own
  profile toggle in 3.1). *(Carried over from "manage Strava users" — not in
  the original draft.)*
- **Ride flagging/moderation, expanded**: for a chosen rider, browse their
  full synced ride history (not just a single flagged activity) and mark
  individual rides as flagged/cheated or reclassify their type (e.g. trainer
  vs. outdoor vs. virtual) before scoring — a superset of the single-activity
  "exclude" toggle in 3.4. *(Carried over from "flag cheat rides" — the
  original draft only had generic single-activity exclusion.)*
- **Strava webhook subscription status**: admin-visible view of the
  platform's current Strava push-subscription state (the global switch in
  3.2 drives this automatically; this view is for operational visibility —
  confirming the subscription is actually active/inactive — and manual
  create/delete as a fallback if the automatic toggle needs troubleshooting).
  *(Carried over from "Strava subscription" tool — not in the original
  draft, which only specified the automatic switch.)*
- **Manual per-rider backfill**: admin can trigger an on-demand Strava
  activity pull for one specific rider (e.g. to fix a missed webhook or
  onboard a late joiner), independent of the scheduled system-wide backfill
  job in 3.2. *(Carried over from "pull missing rides" — not in the
  original draft.)*
- **Team roster management for team events**: for team-mode events, assign
  riders to teams, enforce a configurable max-members-per-team, and
  bulk-import a roster (e.g. from an uploaded spreadsheet/CSV of
  pre-registered riders) rather than adding riders one at a time.
  *(Carried over from the "AW80D control panel" team tools — generalized
  here since the original only mentioned "manage teams/groups" without this
  detail.)*
- **Instagram content list**: admin maintains an explicit, ordered list of
  Instagram post links shown on the home page (add/remove/reorder) — see
  revised 3.7.6 below; this replaces the "embed widget only" v1 approach
  originally drafted, since the current site already does per-post curation
  and that's part of "the same admin panel."

### 3.6 Rider Profile
- Basic profile info, connected Strava account status.
- History of events joined and past results.
- Personal stats (aggregate distance/elevation across events, optional).

### 3.7 Home Page

Public landing page, built from the following sections top to bottom. Each
section can be **shown or hidden by Admin** independently (e.g. turn off
the shop section before merch is ready, or hide social media if the feed
is down) — this is a display toggle, not a delete; content underneath is
preserved.

1. **Hero section**
   - Headline, subheadline, primary CTA (e.g. "Join an Event" / "Sign Up").
   - Background image/video (cycling-themed).
   - Optional stat strip (e.g. total riders, total events, total distance
     ridden across the platform) — sourced from aggregate platform data.

2. **Motivation / featured riders**
   - Rotating motivational quotes from famous cycling athletes (static,
     admin-managed content).
   - Highlight of notable/well-known riders participating in an **upcoming
     event**, pulled from that event's participant list (admin can mark a
     participant as "featured").

3. **Upcoming events**
   - Carousel/grid of upcoming events (status = active/upcoming, ordered by
     start date), each card showing: name, banner, **start date**, **end
     date**, **event type** (Online, or the location name for an in-person
     event), **distance**, and a "Join" CTA. Sourced from the `events`
     collection (3.3).

4. **Community gear (shop teaser)**
   - Showcase of a few featured merchandise/gear items with a link through
     to a full shop page.
   - This introduces a shop/e-commerce feature not previously scoped — needs
     its own requirements pass (see open questions) to decide: custom
     product catalog + checkout vs. linking out to an external store
     (e.g. Shopify). For the home page teaser, only product image, name,
     price, and a link/CTA are needed.

5. **What our riders say**
   - Riders can **submit** a testimonial/review (quote text, optionally a
     photo, optionally which event they participated in) from their
     profile.
   - Submissions start as **pending** and are not public. Admin reviews
     each one in the Admin Panel and either **approves** (goes live on the
     home page) or **discards** it. Only approved testimonials are shown.

6. **Social media (Instagram)**
   - Shows a curated set of Instagram posts on the home page.
   - **Revised v1 approach (matches current site, corrected from the
     original draft):** admin maintains an explicit, ordered list of
     Instagram post links (add/remove/reorder) in the Admin Panel; the home
     page renders that list — not an unmanaged auto-pulled embed. The
     original draft's "embed widget, no curation" plan undersold what
     already exists and would have been a regression.
   - A deeper native API integration (Instagram Graph API, auto-pulling
     recent posts instead of admin pasting links) is a possible future
     upgrade, not needed for v1.

7. **Our Partners**
   - Logo strip of partner/sponsor organizations (e.g. gear brands, event
     sponsors, local cycling clubs).
   - Admin manages the list: logo image, partner name, optional link to the
     partner's website. Order is admin-controlled (e.g. drag to reorder).

> Open question: is the shop a real transactional feature (cart, checkout,
> payment, inventory, shipping) or just a teaser linking to an external
> store? This significantly changes scope and ties into the unresolved
> monetization/payments question (see Open Questions).

### 3.8 Document Library

- Admin can upload documents (PDFs, images) through the Admin Panel — e.g.
  event rules, waivers, route maps, event photo galleries.
- Each document can optionally be **linked to one or more events**;
  unlinked documents are just general library content (e.g. a generic
  waiver template).
- Documents linked to an event are shown on that event's detail page.

### 3.9 Named Endurance Programs (e.g. "East Endurance")

Beyond the generic event model in 3.3, the current site runs at least one
long-running program with its own rider registry and scoring rules,
independent of the generic per-event participant list. This is carried over
from the existing "users-control" / "endurance-control" admin tools, which
had no equivalent in the original draft.

- **Separate rider registry**: a program can maintain its own roster (name,
  PSN/ID, gender, bike type — road/MTB, phone, etc.), distinct from general
  platform `users`, since riders may register for the program without a full
  platform account. Admin can add/edit/remove registry entries.
- **Medal/points rule sets**: admin defines cutoff times (gold/silver/bronze)
  per category (e.g. road vs. MTB, male vs. female) and a points value per
  medal tier; a rule set attaches to a specific event/edition.
- **Result computation**: a rider's result for an event is checked against
  the attached rule set to award a medal tier and points, feeding that
  program's leaderboard — this is a different computation path from the
  generic distance/elevation/consistency scoring in 3.4.
- Open question: is this pattern ("named program" with its own registry +
  rules, layered on top of the generic event model) needed for just this one
  program going forward, or should the Admin Panel support defining new
  named programs generically? Treat as v1 scope = support the existing
  program's data/workflow; a generic "program builder" is not required
  unless confirmed.

### 3.10 Per-Event Bespoke Pages vs. a Generic Template

The current site does not render every event from one generic template —
each named event/edition (AW80D, East Endurance, Rising Star, Chandrayan,
CNG1177) has its own hand-built page with event-specific rules text, rules
tabs, and sometimes its own scoring quirks, selected by matching the event's
slug. New editions of a recurring event have historically meant copying the
previous year's page and wiring in a new slug match, rather than reusing one
parameterized component.

> Open question / decision needed: does the Next.js rebuild (a) keep this
> per-event bespoke-page pattern (with a cleaner slug→component registry
> instead of copy-paste), or (b) invest in generalizing event rendering so a
> new edition only needs data entry, not a new page? Given "same admin
> panel" is the stated goal, default assumption is **(a) keep bespoke pages
> for named events**, since the current admin tools (e.g. AW80D team
> management, East Endurance registry/rules) are themselves tied to
> per-program logic, not a generic model — but confirm before committing to
> a generic template that the admin tools above don't actually need.

## 4. Non-Functional Requirements
- **Security**: Strava tokens encrypted at rest; admin impersonation actions
  logged/audited; standard OWASP protections (input validation, auth checks
  on every admin route). **This is a fix, not a carry-over**: the current
  backend (`letscng-api/functions`) has no server-side authorization at
  all — admin gating is a client-side phone-number check in the Angular app,
  and every Cloud Function/Express route is reachable directly by anyone who
  knows the URL. The rebuild's server-verified custom-claim role check (see
  ARCHITECTURE.md §4) must be enforced on every admin/rider-scoped route
  from day one, not treated as a nice-to-have. Also carry over: the current
  Angular app ships the Strava API client secret in client-side JS
  (`environment.ts`, used by the "Strava subscription" admin tool to call
  Strava directly from the browser) — in the rebuild, all Strava API calls
  that need the client secret must move server-side (Route Handler/Cloud
  Function); no secret may ship in client JS.
- **Scalability**: activity sync must handle growth in rider count without
  hitting Strava API rate limits — webhook-first design preferred over
  polling all users.
- **Reliability**: sync failures for one rider must not block leaderboard
  updates for others.
- **Data privacy**: only pull/store the Strava data fields needed for
  scoring; provide a way for riders to disconnect Strava and have their
  data removed on request.

## 5. Tech Stack (initial direction)
- **Framework**: Next.js (App Router).
- **Hosting**: Firebase App Hosting — single Firebase project for the app
  and all backend services (client already has Firebase billing set up;
  see docs/ARCHITECTURE.md §1 for the reasoning).
- **Backend/Infra**: Firebase — Firebase Auth (platform login), Firestore
  (data store), Firebase Storage (uploaded documents/images), Cloud
  Functions (Strava webhook receiver, token refresh, scheduled sync jobs).
- **Strava integration**: Strava API v3 + Strava Webhook Events API.
- Exact structure (Firestore collections, Cloud Functions layout) to be
  designed at implementation time — see docs/ARCHITECTURE.md.

## 6. Rough Data Model (for planning, not final)
- `users` — platform account, role (rider/admin), Strava connection status.
- `stravaTokens` — access/refresh token, expiry, athlete ID (server-side
  only).
- `events` — config described in 3.3.
- `teams` — belongs to an event, list of member user IDs.
- `eventParticipants` — join of user ↔ event (+ team ID if applicable).
- `activities` — synced Strava activities linked to a user + event, with
  distance/elevation/time metrics and an "excluded" flag for admin
  moderation.
- `offlineResults` — manually entered results for offline events.
- `auditLog` — admin actions (impersonation, manual adjustments, exclusions).
- `quotes` — motivational quotes for the home page (text, athlete name,
  active flag).
- `testimonials` — rider-submitted testimonials for the home page (quote,
  rider name/photo, related event, submittedBy, status: pending/approved/
  discarded, reviewedBy).
- `products` — gear/merch items shown in the home page shop teaser (name,
  image, price, link) — scope depends on shop decision below.
- `partners` — logo strip entries for the home page (logo image, name,
  optional link, display order).
- `documents` — uploaded PDFs/images (file reference, name, type,
  uploadedBy, optional linked event IDs).
- `siteConfig` — home page section visibility toggles (hero, motivation,
  upcoming events, shop, social media, testimonials, partners).
- `instagramPosts` — admin-curated, ordered list of Instagram post
  links/embeds shown on the home page (3.7.6).
- `enduranceRiders` — a named program's own rider registry (name, PSN/ID,
  gender, bike type, phone), separate from `users` (3.9).
- `enduranceRules` — medal-tier cutoff times and points per category,
  attached to an event (3.9).
- `teams` (extended) — add a `maxMembers` config per event's team mode, to
  support the existing per-team cap behavior (3.5).

## 7. Open Questions / To Decide Before Build
1. Exact leaderboard scoring formula when multiple metrics are enabled for
   one event.
2. Monetization — not decided yet (free for now); revisit if paid event
   entry is needed (would require payment integration, e.g. Stripe).
3. Whether an "Event Organizer" role (below Admin) is needed.
4. Notification needs (email/push on event join, leaderboard changes, event
   start/end) — not scoped yet.
5. Shop scope for "Community gear" — teaser linking to an external store, or
   a full in-platform catalog + cart + checkout (ties into monetization,
   item 2).
6. Whether the "named program" pattern (3.9 — own rider registry + rule
   sets, currently only East Endurance) needs to be admin-configurable for
   future programs, or stays a one-off.
7. Per-event bespoke pages vs. generic template (3.10) — confirm the default
   assumption (keep bespoke pages) before building event rendering.

## 8. Out of Scope (v1)
- Payments/subscriptions (until monetization is decided).
- Mobile native app (web-first, responsive).
- Integrations with fitness platforms other than Strava.