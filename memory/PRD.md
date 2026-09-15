# BITLOGIC — Product Requirements Document

## Original Problem Statement
BITLOGIC (Think. Create. Solve. Code.) — a computer-based student competition platform. Home screen, login portal (students & admins). Admins update points for 3 rounds. Qualification funnel: after Round 1 → top 10 + round winner; after Round 2 → top 5; after Round 3 → 1 overall winner (highest points). Max 10 points per student per round. Until a global start date/time, only a countdown shows. Round 1: embedded Scratch 3 editor. Round 2: MCQ puzzles. Round 3: Java code editor. All rounds graded separately by judges. Fully responsive.

## User Choices
- Auth: Simple JWT username/password
- Round 1: Embed official Scratch editor via iframe (+ open-in-new-tab fallback)
- Round 3: Java editor — write/save, judges review (no live execution)
- Countdown: one global start date/time
- Roles: admin = judge (same role)

## Architecture
- Backend: FastAPI + MongoDB (motor). JWT httpOnly cookies, bcrypt, brute-force lockout keyed by email.
- Frontend: React 19 + React Router, Tailwind + shadcn/ui, framer-motion, react-fast-marquee. Dark neon theme (Unbounded/Outfit/JetBrains Mono).
- Collections: users, competition (single config doc), puzzles, submissions, login_attempts.

## Personas
- Student: registers/logs in, plays qualified+open rounds, submits work, views leaderboard.
- Admin/Judge: sets start date & active round, grades points (0-10/round), creates MCQ puzzles, finalizes rounds, views submissions, resets competition.

## Implemented (2026-09-15)
- JWT auth: register/login/logout/me/refresh; admin seeded (ranveerajimal9@gmail.com); brute-force lockout (5 attempts → 15 min, keyed by email).
- Home: hero, kinetic marquee, countdown gate, rounds format, about.
- Student dashboard: countdown gate before start; score strip; per-round access states (open / locked / not-qualified / finalized).
- Round 1 CodeCraft: embedded Scratch iframe + open-in-new-tab fallback + project link submission.
- Round 2 LogicQuest: MCQ answering with auto correct-count; re-submittable.
- Round 3 CodeMasters: line-numbered Java editor (tab indent), submit for judges.
- Admin panel: competition control (start datetime, active round, finalize R1/R2/R3, reset), students CRUD + per-round scoring + submissions viewer, puzzle CRUD.
- Qualification funnel enforced on finalize (top 10 → top 5 → overall winner) with round-winner marking.
- Public leaderboard sorted by total points with winner/eliminated badges.
- **Sudden-death Tie-Breaker (2026-09-15)**: admin fires a tie-breaker question to selected tied finalists; students answer one-shot (live-polled dashboard card); fastest correct answer highlighted; admin declares winner (overrides prior overall winner); clear rolls back a mistaken declaration. Verified end-to-end (7/7 frontend scenarios).
- Fully responsive, tested backend (20/22 → fixes applied) + frontend critical flows.

## Backlog
- P1: Per-round timers / auto-close at time limit.
- P2: Tie-breaker workflow; password reset email flow; split server.py into routers; password strength rules; live Java execution via Piston/JDoodle.
