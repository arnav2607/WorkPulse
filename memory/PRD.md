# WorkPulse — PRD

## Original Problem Statement
Build a complete production-ready SaaS product called **WorkPulse** — an internal Employee Task & Activity Management System for small businesses with a single Admin and multiple Employees. Modules: Auth, Employee Management, Task Management, Daily Activity Sheet, Leave Management, Notifications, Dashboards, Reports.

## Tech Stack (adapted from spec, user-approved)
- Backend: **FastAPI + MongoDB (Motor)** instead of Node + Postgres
- Auth: JWT (8h), bcrypt
- Cron: APScheduler (mark-missed-sheets at 23:59)
- Frontend: React 19, React Router v6, Tailwind, shadcn/ui, Recharts, Sonner toasts
- Design: Forest-green (#14532d) on cream (#fdfbf7); fonts Outfit / Manrope

## User Personas
- **Admin** (single super user) — Arnav Goel — full control over team, tasks, templates, sheets, leaves, reports.
- **Employees** — only their own tasks/sheets/leaves; cannot edit templates.

## Implemented (Iteration 1 — May 2026)
- Auth: JWT login + me, role guards on every route. Single seeded admin: arnavpgoel@gmail.com / arnav2607.
- Employee CRUD with soft-delete + auto leave-balance creation.
- Tasks: full CRUD, priority/deadline, status updates by employees only (pending → in_progress → done → blocked), admin review (approved / needs_rework / closed), remarks timeline, in-app notifications on every transition.
- Activity Templates (admin-only): name + description + is_required + soft delete.
- Daily Activity Sheet: get/create today's sheet, save draft, submit-once-locked, required-items enforced, auto on_leave on approved leave, missed-sheet cron at 23:59.
- Leaves: apply (casual/sick/half_day/wfh), approve/reject with comment, balance auto-decrement, cancel pending; approval cascades to mark sheets in date range as on_leave.
- Notifications: on task assign / status update / remark / leave events / approval+rejection. Polled every 60 s on the topbar bell with unread badge + mark-all-read.
- Admin Dashboard: 5 metric cards, weekly bar chart, sheet-rate line chart, status pie chart, recent activity feed, quick actions.
- Employee Dashboard: today-sheet status card with CTA, leave balances, pending tasks, upcoming deadlines (7 days), recent admin remarks.
- Reports: per-employee productivity score (completion × compliance), monthly comparison table, CSV export.
- Logout flow: confirms when employee has not submitted today's sheet (and not on approved leave), redirects to sheet.
- Visual: warm cream background, forest-green primary, Outfit/Manrope typography, calendar view of approved leaves, status badges with semantic colours, glass topbar.
- Tested: 38/38 backend pytest tests pass; full Playwright run of admin + employee flows passes.

## Backlog
- **P1**: Email/SMS notifications (currently in-app only); admin can adjust per-employee leave totals via a dedicated UI (API endpoint exists at `/api/employees/:id/balance`).
- **P2**: Bulk-import employees via CSV; per-task time tracking; sheet history for employees.
- **P2**: Export to PDF for monthly reports; attendance heat-map.
- **P3**: Two-factor authentication; password reset flow.
- **P3**: Multi-tenant support and SSO.

## v1.1 — May 2026 enhancements (delivered)
- **Per-employee activity sheets** — admin assigns a custom set of activity templates per team member (`assigned_template_ids`); the daily sheet auto-filters server-side. "All (auto-includes new)" mode preserves backward-compat.
- **Role promotion** — admin can promote any employee to admin (and demote back) via row toggle or edit form.
- **Initial-password mechanism** — admin enters or auto-generates a temporary password during employee creation; credentials are revealed once via a copy-modal; new accounts get `must_change_password=true` and are forced to set a new password on first login.
- **Self-service password change** — "Change password" link in the user dropdown for everyone (admin & employees).
- **Total leaves taken** — calculated YTD across all types (casual / sick / half-day / WFH); shown on the employee Leaves page (gradient card with by-type breakdown), the admin Leaves page (balances grid), and the Employees table (new "Leaves taken" column).



## v1.2 — Email notifications + branding (delivered)
- **Email notifications via Resend** — `email_service.py` with non-blocking fire-and-forget sends. Triggered automatically on:
  - Employee submits daily activity sheet → emails admin
  - Employee applies for leave → emails admin
  - Admin approves / rejects leave → emails the employee (with admin comment if any)
  - Admin assigns a new task → emails the assignee (with task details + deep link)
- All emails use a clean WorkPulse-branded HTML template (forest-green header, key/value table, CTA button).
- Default sender `WorkPulse <onboarding@resend.dev>` (works without DNS). For production-grade delivery to ANY recipient, verify a domain at https://resend.com/domains and update `SENDER_EMAIL` in backend `.env`.
- **"Made with Emergent" badge removed** from `frontend/public/index.html`.
