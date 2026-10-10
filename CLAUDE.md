# VOLUNTRIX — Project Context

This file is auto-loaded by Claude Code when a session starts in this
directory. It exists so a fresh session (or a resumed one) has full context
without re-deriving it from scratch.

## What this is

VOLUNTRIX (originally named VYBE, renamed per user request) is an AI-powered
campus volunteer allocation and event coordination platform — a hackathon
project. Tagline: *"The right people. The right event. The right time."*

Full product analysis (personas, modules, MongoDB schema proposal, MVP scope,
roadmap) was written early on as an artifact — see `vybe-project-analysis.html`
in this folder for the original planning doc. Note: some of its proposals
(e.g. a role selector at signup) were later reversed — this CLAUDE.md
reflects the *current* actual state, which wins over that doc wherever they
conflict.

## Architecture: genuinely split frontend/backend

```
global hack/
├── frontend/   Next.js 16 (App Router, Turbopack), port 3000, UI only
├── backend/    Express + TypeScript, port 4000, all API logic + MongoDB
```

**Why split:** the user asked for this explicitly, wanting to host frontend
and backend separately. Before the split, this was a single Next.js app with
API routes — that actually worked fine for LAN access, but the user believed
(incorrectly, in that specific case) that a frontend/backend split would fix
a separate bug. We proceeded with the split anyway per their explicit choice
after I flagged the tradeoffs.

**Consequence of the split — auth had to change:** cookie-based auth doesn't
survive cross-origin requests without `SameSite=None; Secure`, which requires
HTTPS. Since this runs over plain HTTP on a LAN, we switched auth to
**Bearer tokens** instead of cookies:
- Backend issues a JWT on login/register (`POST /api/auth/*` returns
  `{ token, user }`, not a cookie).
- Frontend stores it in `localStorage` (if "remember me" checked) or
  `sessionStorage` (if unchecked) — see `frontend/src/lib/apiClient.ts`.
- Every authenticated request attaches `Authorization: Bearer <token>` via
  the `apiFetch()` wrapper — always use `apiFetch`, never raw `fetch`, for
  anything that needs auth or needs to reach the backend.
- Backend CORS reflects whatever `Origin` header it sees (not a fixed
  allowlist) since the frontend can be reached from any LAN IP — see
  `backend/src/index.ts`.

**Backend address resolution:** the frontend doesn't hardcode the backend's
IP. `apiClient.ts` derives it as `http://<window.location.hostname>:4000` —
so whatever hostname/IP you used to load the frontend, the backend calls
automatically go to the same host on port 4000. Override via
`NEXT_PUBLIC_API_URL` in `frontend/.env.local` if ever needed (e.g. a real
deployment where frontend/backend are on different hosts).

## Known gotcha: Next.js `allowedDevOrigins`

Next.js 16 silently blocks cross-origin requests to its **dev-only** assets
(HMR, internal chunks) unless the origin is explicitly allowlisted. Without
this, loading the frontend from a LAN IP instead of `localhost` loads the
HTML fine but **all client-side JS silently breaks** (login, password
toggle, everything interactive) — this caused a confusing round of "the UI
looks broken on my other device" reports that were actually this one issue.

Fixed in `frontend/next.config.ts` via `allowedDevOrigins`. **If the LAN IP
changes** (different network, different DHCP lease), add the new IP to that
array and restart the frontend dev server, or nothing will work from that
IP. Current allowlisted IPs there may be stale — check `ipconfig` /
`ifconfig` for the current one if things stop working after a network
change.

## Auth / roles / personas

Hierarchy: **Faculty → Organizer → Student**. Every new self-registered
account defaults to `student` — there is no role picker at signup (removed
per user request; role is meant to be inferred/assigned, not self-selected).

- **Student**: default for everyone who signs up. Has a `VolunteerProfile`
  (skills, interests, year of study) editable at `/profile`.
- **Organizer**: not self-registrable. Currently the *only* path to become
  one is Faculty promoting a Student (see below). No organizer-specific
  features are built yet — that's explicitly pending, the user said they'd
  describe Organizer features later.
- **Faculty**: never self-registered either — **seeded directly into
  MongoDB**. Signing up with a faculty USN correctly fails with "account
  already exists" (same uniqueness check as any duplicate USN).
  - Seed script: `backend/scripts/seedFaculty.js` — edit the
    `FACULTY_ACCOUNTS` array and run `node scripts/seedFaculty.js` from
    `backend/`. Existing accounts (by USN) are left untouched.
  - **Current seeded account: `FACULTY1` / `Faculty@123`** (placeholder
    credentials — the user said to use a hardcoded sample for now; swap in
    real faculty names/passwords via the script when ready).

### Demo accounts (for presentations)

One fixed account per persona, so a live demo never depends on whatever
real data happens to be in the DB:
- `FACULTY1` / `Faculty@123` (the seed above, reused)
- `DEMOSTU1` / `Demo@123` (student, pre-filled with sample skills/
  interests so the profile doesn't look empty)
- `DEMOORG1` / `Demo@123` (organizer — **seeded directly**, bypassing the
  normal promotion-only path, purely for demo convenience)

Seeded via `backend/scripts/seedDemoAccounts.js` (student + organizer;
faculty comes from `seedFaculty.js`). Credentials are duplicated in
`frontend/src/lib/demoAccounts.ts` for the **Auto-Fill** button on
`/login` — click it and it fills USN+password for whichever role tab is
currently selected. **If you change a password in one place, update the
other** — nothing keeps them in sync automatically. `/register` also has
an Auto-Fill button, but it generates fresh randomized data each click
(`DEMO####` USN + matching email suffix) rather than reusing a fixed
account, since USN/email must be unique — letting a presenter re-run
signup repeatedly without hitting "already exists."
  - Faculty dashboard (`frontend/src/components/FacultyDashboard.tsx`):
    two sections — "Organizer Accounts" and "Student Accounts" — each a
    grid of blocks (USN + name), click → detail modal (branch, gender,
    phone, email, year of study, skills, interests). Students get a
    **"Promote to Organizer"** button; organizers get a **"Remove
    Organizer Access"** button (demote back to student) with a
    confirm-before-acting step. Both directions are fully built and
    tested (`backend/src/routes/faculty.ts`: `/promote` and `/demote`).
  - Auth middleware (`backend/src/middleware/auth.ts`) re-reads `role`
    and `accountStatus` fresh from the DB on every request (not just
    from the JWT payload) — so a promotion/demotion/suspension takes
    effect on the user's very next request, not after their token
    expires.
  - **Deferred, not yet decided:** the actual logic for how the system
    knows a given USN *should* be faculty/organizer at signup time (an
    admin-managed allowlist vs. a USN naming convention vs.
    default-then-promote). Three options were raised to the user; they
    said "decide later." Don't assume one — ask before building it.

**Login now has an explicit role selector** (Student / Organizer /
Faculty tabs) — this reverses an earlier design where role was silently
auto-detected with no picker. If you're reading an old mental model of
"no role selector at login," that's stale; don't revert this without the
user asking. The selector is **not** a privilege grant: the backend
(`backend/src/routes/auth.ts`, `LoginSchema`) requires `role` in the
request and rejects the login with a 403 (*"This account is registered
as X, not Y. Please select the correct role."*) if it doesn't match the
account's actual stored role. The account's real role (from the DB)
still decides everything the token can do — the tab just changes what
error message you get if you pick wrong, it can't be used to escalate
access.

## Data model notes

- `User` (backend/src/models/User.ts): `usn` (unique, uppercased),
  `name`, `gender` (**male/female only** — "other"/"prefer not to say"
  were explicitly removed per user request), `phone`, `email` (unique,
  **sparse** — faculty accounts don't have one), `branch` (**optional** at
  the schema level — only faculty lacks it; students/organizers always
  provide it via the registration form's required fields), `passwordHash`,
  `role` (`student|organizer|faculty|admin`), `profilePictureUrl`.
- `VolunteerProfile`: one per student, created automatically at
  registration. Holds skills, interests, yearOfStudy, developmentGoals,
  availability (availability/experience fields exist in the schema but
  have no UI yet — placeholder for future allocation-engine work from the
  original project plan).
- Avatars: uploaded via multer (memory storage) to
  `backend/public/uploads/avatars/`, served statically by Express at
  `/uploads/avatars/...`. 2MB limit, JPEG/PNG/WebP only. Frontend resolves
  these via `assetUrl()` in `apiClient.ts` (prefixes the backend origin).

## What's built so far

- Registration (USN, name, gender, phone, email, branch, password — no
  role picker), login (USN + password + remember me), logout,
  change-password, `/me`.
- Student profile editing (skills, interests, year of study) + optional
  avatar upload/remove.
- Faculty dashboard: list students and organizers separately, view full
  detail, promote student→organizer, demote organizer→student (with
  confirm step). Role changes apply immediately (middleware re-checks
  DB, not just the JWT).
- Signup (titled **"Student Signup"** — explicit, since Organizer/Faculty
  are never self-registered) collects optional Skills/Interests via
  `TagSearchSelect` (`frontend/src/components/TagSearchSelect.tsx`): click
  the box → see the full curated list (`SKILL_OPTIONS`/`INTEREST_OPTIONS`
  in `frontend/src/lib/volunteerOptions.ts`); type to filter; or type
  something not on the list and click "+ Add '‹text›'" to add a free-text
  custom entry. Backend doesn't enforce an enum on these fields, so
  custom values round-trip fine. Saved straight into the new student's
  `VolunteerProfile` at registration.
- Organizer event creation (events + roles within them) — see dedicated
  section below.
- Student event discovery & applications — see dedicated section below.
- Responsive layout pass done across all pages (mobile overflow issues
  fixed — long text wrapping, stacking flex rows on narrow screens).
- Password field show/hide toggle component (`PasswordInput.tsx`), used
  everywhere a password is entered.
- Server-side redirect on `/` (checks auth token via inline script,
  doesn't depend on React hydration finishing — this was a deliberate
  fix for a "stuck on homepage" bug on a slower/different device).

## Organizer: Event creation (built)

Organizers can create and manage their own events:
- `backend/src/models/Event.ts` / `EventRole.ts` — event fields (title,
  description, category, eligibleBranches, startAt/endAt, venue,
  applicationDeadline, status: draft/published/cancelled) and roles
  within an event (title, description, responsibilities, required/
  preferred skills, targetVolunteerCount, status: active/closed).
- `backend/src/routes/events.ts` — full CRUD for events and their roles,
  scoped so an organizer can only see/edit/delete their *own* events
  (queries filter by `organizerId` directly, not a separate ownership
  check — unauthorized access just 404s rather than 403s, deliberately,
  to avoid confirming an event id exists to someone who doesn't own it).
  Date validation enforced server-side: `endAt > startAt`,
  `applicationDeadline <= startAt`.
- Frontend: `/events` (list, "My Events"), `/events/new` (create form),
  `/events/[id]` (detail — publish/unpublish/cancel/delete, add/remove
  roles with a skill chip-picker reusing `SKILL_OPTIONS`).
  `/events/[id]/page.tsx` is a thin async **Server Component** that
  awaits the `params` Promise and passes `eventId` down to
  `EventDetailClient.tsx` (the actual client component) — this exists
  because Next.js 16's Cache Components feature blocks prerendering a
  client component that calls `useParams()` directly; the fix was to
  move the dynamic param resolution to the server side and pass it as a
  prop instead of fighting the prerenderer with Suspense boundaries.
  Also needed `export const instant = false` in `page.tsx` (only legal
  in a Server Component, not a `"use client"` file).
- `EVENT_CATEGORIES` in `frontend/src/lib/volunteerOptions.ts` reuses the
  same taxonomy as student `INTEREST_OPTIONS` (deliberate — lets event
  categories line up with student-stated interests for future matching).

**Not built yet within events:** allocation engine, attendance/feedback,
no event editing UI beyond status transitions (title/description/dates
can't be edited after creation from the UI — only via a direct API
call).

## Student: Event discovery & applications (built)

- `backend/src/models/Application.ts` — student + event + role, status
  (submitted → under_review → shortlisted/rejected → selected; also
  withdrawn, waitlisted).
- `backend/src/routes/studentEvents.ts` — `GET /api/events/browse`
  (published events only, pre-filtered by branch eligibility and
  deadline), `GET /api/events/browse/:id` (event + roles, each role
  annotated with `eligibility: { branchEligible, deadlinePassed,
  roleOpen, canApply, applicationStatus }`), `POST
  /api/events/browse/:id/roles/:roleId/apply`.
- `backend/src/routes/applications.ts` — `GET /api/applications/mine`,
  `POST /api/applications/:id/withdraw`.
- **Routing order matters**: `studentEventRoutes` is mounted *before*
  `eventRoutes` in `backend/src/index.ts`. Express matches `/:id` against
  any string, so `GET /api/events/browse` would otherwise get swallowed
  by the organizer's catch-all `/:id` route and 404 before ever reaching
  the student routes. If you add more student-facing paths under
  `/api/events/*`, keep them mounted first, or give them a path prefix
  that can't collide with `:id`.
- Frontend: `/browse` (list), `/browse/[id]` (detail + apply — same
  async-Server-Component-wrapping-a-client-component pattern as
  `/events/[id]`, for the same Next.js 16 Cache Components reason),
  `/applications` ("My Applications", withdraw action).

### ⚠️ MongoDB gotcha: partial index filters don't support `$ne`/`$not`

Tried to enforce "one active application per (student, role)" with a
partial unique index filtered on `{ status: { $ne: "withdrawn" } }`.
**This silently fails to build** — MongoDB partial index filter
expressions only support `$eq`, `$exists`, `$gt`/`$gte`/`$lt`/`$lte`,
`$type`, and top-level `$and`. `$ne` (and the `$not` it compiles to) is
not supported, and Mongoose's background `autoIndex` creation swallows
the error instead of surfacing it anywhere you'd notice — the index
just never appears if you don't explicitly check with
`collection.indexes()`. This bug meant duplicate applications were
silently allowed for a while during testing.

**Fix applied:** added an `isWithdrawn: boolean` field to `Application`
(mirrors `status === "withdrawn"`, kept in sync on every status change),
and the partial filter is `{ isWithdrawn: false }` — a plain equality
check, which *is* supported. **If you add another partial unique index
anywhere in this project, don't use `$ne`/`$not` in the filter — add a
boolean mirror field instead, the same way.** Always verify a new index
actually built with `db.collection.indexes()` after a schema change;
don't trust that Mongoose did it silently.

## Organizer: Application review & Assignment lifecycle (built)

- `backend/src/models/Assignment.ts` — separate from `Application`
  deliberately: selecting an applicant does **not** mean they're
  committed. It creates an `Assignment` in `pending_confirmation`, and
  the *student* has to confirm or decline it (same split the original
  plan called for). Status: pending_confirmation → confirmed / declined
  / cancelled. One assignment per application (`applicationId` unique
  index), re-selecting after a decline updates the existing row rather
  than creating a duplicate.
- `backend/src/routes/organizerApplications.ts` — mounted under
  `/api/events` in `index.ts` (ordering matters here too, see below):
  - `GET /:id/roles/:roleId/applications` — list applicants for a role,
    each annotated with `skillsMatch: { matched, total }` (overlap
    between the student's `VolunteerProfile.skills` and the role's
    `requiredSkills`) and the live `capacity: { target, filled }` for
    the whole role (counts `pending_confirmation` + `confirmed`
    assignments).
  - `POST .../applications/:applicationId/status` — organizer sets
    `under_review`/`shortlisted`/`rejected`/`waitlisted`. Deliberately
    **excludes** `selected` — that only happens through `/select` below,
    which has capacity logic the generic status endpoint doesn't.
  - `POST .../applications/:applicationId/select` — capacity-checked
    (counts existing assignments excluding this application's own, so
    re-selecting the same applicant doesn't double-count itself), then
    creates/reuses the `Assignment`. Shift time comes from the role's
    own `shiftStartAt/shiftEndAt` if set, else falls back to the event's
    `startAt/endAt`.
- `backend/src/routes/assignments.ts`, mounted at `/api/assignments` —
  student-only `POST /:id/confirm` and `POST /:id/decline`.
  - **Confirm** is where schedule-conflict enforcement actually lives:
    checks every *other* `confirmed` assignment for the same student for
    a time overlap (`shiftStartAt < theirEnd && shiftEndAt > theirStart`)
    and rejects with a 409 naming the conflicting event/role. Selecting
    someone for two overlapping roles is allowed — the block only fires
    when they try to *confirm* the second one while the first is still
    confirmed. Declining the first clears the way to confirm the second
    (tested).
  - **Decline** just flips status to `declined` — this alone is what
    frees the capacity slot (the `/select` capacity count only looks at
    `pending_confirmation`/`confirmed`), so "replacement flow" needed no
    separate code path: the organizer can immediately `/select` someone
    else once a decline happens.
- Withdrawing an application (`applications.ts`) also cancels its
  `pending_confirmation` assignment if one exists; withdrawing is
  blocked once the assignment is already `confirmed` (use decline
  instead — the error message says so).
- Frontend: `/events/[id]/roles/[roleId]/applicants` (organizer review +
  shortlist/reject/select, same Server-Component-wrapper pattern as
  other dynamic routes), and `/applications` (student side) now shows a
  Confirm/Decline UI whenever `assignment.status === "pending_confirmation"`.
- **Routing note**: `organizerApplicationRoutes` is mounted between
  `studentEventRoutes` and `eventRoutes` in `index.ts`. It doesn't
  actually need to be mounted first — its paths are longer than
  anything `eventRoutes`'s `/:id` catch-all can match — but it's placed
  there for readability, grouped with the other `/api/events/*` mounts.

**Not built in Phase 4:** the ranking formula (still not decided — ask
before building), and eligibility (branch/deadline) isn't literally
re-checked a second time at `/select` — it's enforced once at apply
time using the same event data, so the gap is more theoretical than
practical, but it's not defensive-in-depth.

## What's explicitly NOT built yet

- The allocation ranking formula — **ask the user before building this,
  it's been raised and deferred twice already.**
- The USN→faculty/organizer auto-assignment logic (deferred, see above).
- Notifications, organizer cross-event dashboard analytics, attendance,
  feedback, AI Co-Pilot/Volunteer Guide — rest of the original product
  plan (Phases 5–6). Note: schedule-conflict detection *is* built now
  (Phase 4, see above) — this bullet used to list it as missing, don't
  re-add it.
- No admin role UI (the `admin` role exists in the schema/types but has
  no features built against it).
- Forgot-password — explicitly deferred by the user ("keep it in the
  end, let's focus on the core application"). Don't build this unless
  asked again.

## Running it

```bash
cd backend && npm run dev     # http://localhost:4000 (Express, tsx watch)
cd frontend && npm run dev    # http://localhost:3000 (Next.js, Turbopack)
```

Both bind to `0.0.0.0` so they're reachable from other devices on the LAN
— frontend via `npm run dev -H 0.0.0.0` (baked into its `package.json`
script), backend via `app.listen(PORT, "0.0.0.0", ...)` in
`backend/src/index.ts`.

**Env files** (both gitignored, not committed):
- `backend/.env` — `MONGODB_URI` (Atlas, free tier), `JWT_SECRET`,
  `JWT_EXPIRES_IN`, `PORT`.
- `frontend/.env.local` — optional `NEXT_PUBLIC_API_URL` override only;
  no secrets live here anymore since the API logic moved to the backend.

MongoDB: Atlas free-tier cluster (`cluster0.vsqoegn.mongodb.net`,
database `vybe` — name predates the VOLUNTRIX rename, left as-is to avoid
a pointless migration). Connection string is in `backend/.env` — not
reproduced here to avoid duplicating the credential in a doc that might
get shared more casually than the gitignored env file.

## ⚠️ Real user data now lives in this database

Throughout earlier development, test accounts were freely wiped between
test runs with broad `deleteMany({})` calls on `users` and
`volunteerprofiles`. **Stop doing that.** The user has registered real
accounts on real devices (e.g. USN `4AI24AI048`, `4AI24AI035`) with real
names and uploaded avatars. A careless cleanup already deleted both of
their `VolunteerProfile` documents once by mistake (recovered as empty
profiles, but any skills/interests they'd entered were lost for good —
Atlas free tier has no backups). Going forward: never run an unscoped
`deleteMany` against `users` or `volunteerprofiles`. If a test account is
genuinely needed, delete it by its specific `usn`/`_id`, never by role or
blanket query, and double check the filter before running it.

## Progress tracking

See `ROADMAP.md` in this same folder for the phase-by-phase checklist
from current state to the full planned product. Update it as features
land — check items off, don't leave it stale. It's the authoritative
"what's left" list; this file explains the "why" behind what's already
built.

## Known loose ends / cleanup items

- A `_browser_test/` scratch folder (Playwright experiment, abandoned —
  this sandbox has no network access to download a Chromium binary) may
  still exist at the project root. Safe to delete; a lingering file lock
  blocked `rm -rf` as of this writing — if it's still there, check for a
  stray `node.exe` holding it open before retrying.
- `vybe-project-analysis.html` is the original planning artifact — useful
  for the long-term vision, but treat this CLAUDE.md as authoritative for
  "what's actually built" since several early proposals (role selector,
  gender options, USN label wording) were explicitly reversed later.
- The frontend folder is still named `frontend` but its `package.json`
  `name` field says `"vybe"` — cosmetic, harmless, not worth touching
  unless asked.
