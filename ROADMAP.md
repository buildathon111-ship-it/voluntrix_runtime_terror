# VOLUNTRIX — Roadmap & Checklist

Living document tracking progress from where the project stands now to the
full vision in `vybe-project-analysis.html`. Check items off as they land;
add new ones if scope changes. See `CLAUDE.md` for the *why* behind
decisions — this file is just the *what's left*.

---

## Phase 1 — Core Platform (Accounts & Personas) ✅ COMPLETE

- [x] Separated frontend (Next.js) / backend (Express) architecture
- [x] MongoDB (Atlas) connection
- [x] Auth: register, login, logout, change-password — Bearer token
      (localStorage/sessionStorage, not cookies — cross-origin constraint)
- [x] Role hierarchy: Student (default) → Organizer (promotion-only) →
      Faculty (seeded)
- [x] Faculty dashboard: view all students/organizers, promote, demote
- [x] Student profile: skills/interests via curated picklist, year of
      study, optional avatar upload
- [x] Responsive layout across all pages
- [x] Cross-device/LAN access fixed (`allowedDevOrigins`, reflected CORS)

## Phase 2 — Event Management (Organizer side) ✅ COMPLETE

- [x] `Event` model: title, description, category, eligible branches,
      dates, venue, application deadline, status (draft/published/cancelled)
- [x] `EventRole` model: title, description, responsibilities, required/
      preferred skills, staffing target
- [x] Organizer pages: `/events` (list), `/events/new` (create),
      `/events/[id]` (manage — publish/unpublish/cancel/delete, add/remove
      roles)
- [x] Server-side date validation, ownership scoping

## Phase 3 — Student Discovery & Applications ✅ COMPLETE

- [x] Student-facing "Browse Events" page (`/browse`) — published events
      only, filtered by eligibility (branch match, deadline not passed)
- [x] Event detail view for students (`/browse/[id]`, read-only) with
      per-role eligibility indicator (branch/deadline/role-open/already-
      applied)
- [x] `Application` model: student + event + role, status (submitted →
      under_review → shortlisted/rejected → selected; also withdrawn,
      waitlisted)
- [x] Apply action; one active application per (student, role) enforced
      via a partial unique index
- [x] Student "My Applications" page (`/applications`) — track status,
      withdraw
- [x] Withdraw-application action, re-apply after withdrawal supported

## Phase 4 — Organizer Review & Allocation ✅ MOSTLY COMPLETE

- [x] Organizer "Review Candidates" view per role (`/events/[id]/roles/
      [roleId]/applicants`) — lists applicants with skills-match info and
      live capacity (`filled / target`)
- [x] Shortlist / Reject / Select actions on applications
      (`backend/src/routes/organizerApplications.ts`)
- [x] `Assignment` model (separate from `Application`): pending_
      confirmation / confirmed / declined / cancelled — selection creates
      a *pending* assignment, the student must confirm before it counts
- [x] Capacity enforcement — selecting past `targetVolunteerCount` is
      blocked server-side (tested: 2nd select on a 1-slot role → 400)
- [x] Schedule conflict detection — confirming an assignment that
      overlaps another *confirmed* one is blocked with a message naming
      the conflicting event/role (tested directly)
- [x] Replacement flow — declining frees the slot immediately (capacity
      only counts pending_confirmation/confirmed), organizer can select
      someone else right away (tested)
- [ ] Mandatory eligibility re-check at review time (branch/deadline are
      already enforced at *apply* time; not re-validated again at
      *select* time — low risk since both checks use the same event
      data, but not literally re-run)
- [ ] Ranking baseline — **still not built, still needs a conversation
      with the user first.** Current review view sorts by submission
      order only; it shows skills-match count but doesn't rank/sort by
      it. Don't build a ranking formula without asking.

## Phase 5 — Coordination ⬜ NOT STARTED

- [ ] In-app notifications (status changes, selection, reminders)
- [ ] Organizer dashboard analytics — aggregate view across events
      (applications count, staffing gaps, pending actions) — the current
      `/events` list is per-event only, no cross-event summary yet
- [ ] Attendance tracking (manual check-in; QR is a stretch goal, not a
      requirement)
- [ ] Post-event feedback collection

## Phase 6 — AI Features ⬜ NOT STARTED (lowest priority)

- [ ] AI Event Co-Pilot — role/staffing suggestions for organizers
      (suggestions only; organizer must approve before anything saves)
- [ ] AI Volunteer Guide — personalized event/role recommendations for
      students, with explanations

## Deferred / Explicitly Postponed by the user

- [ ] **Forgot-password flow** — user said "keep it in the end," don't
      build until asked again
- [ ] **USN → faculty/organizer auto-assignment logic** — three options
      were raised (admin allowlist / USN pattern / default-then-promote);
      user said "decide later" — ask before building
- [ ] Admin role features — `admin` exists in the schema, zero UI/logic
      built against it
- [ ] Rate limiting / brute-force protection on login
- [ ] Automated tests (none exist anywhere in the project yet)

---

**Where we are right now:** Phases 1–4 complete and tested end-to-end,
except the ranking formula (deliberately not built — needs a
conversation with the user) and a minor re-validation gap noted above.
Phase 5 (coordination: notifications, dashboard analytics, attendance,
feedback) is next.
