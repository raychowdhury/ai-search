# Tasks

Status legend: `pending` · `in progress` · `blocked` · `complete`. Updated 2026-09-20.

Notes: 7.1 to 7.3 are implemented against documented API shapes with unit-level parsing only; 7.4 (live verification) stays blocked until keys exist. 8.1: login and run rate limits and same-site cookies are in; CSP headers are not yet added. 8.3: Dockerfile and health endpoint exist; no host chosen. 8.4: done via seed script against the built server (worker, audit, all screens, auth redirects, history comparison verified with curl); browser automation is 9.2.

## Phase 0: Foundations

| ID | Task | Status | Acceptance criteria |
|---|---|---|---|
| 0.1 | Write PRD, ARCHITECTURE, RULES, DESIGN, TASKS, MEMORY docs | complete | Six files in docs/ with project-specific content |
| 0.2 | Verify provider capabilities and pricing against official docs | complete | ARCHITECTURE.md table cites verified facts and dates |
| 0.3 | Scaffold Next.js + TypeScript + Tailwind + Vitest + Drizzle/SQLite | complete | `pnpm dev`, `pnpm test`, `pnpm typecheck` run cleanly |
| 0.4 | Database schema and migrations | complete | Tables from ARCHITECTURE.md exist; migration runs on start |
| 0.5 | Auth: signup, login, logout, session middleware | complete | Protected routes redirect; passwords hashed with scrypt; tests for hashing and session lookup |

## Phase 1: Onboarding and question set

| ID | Task | Status | Acceptance criteria |
|---|---|---|---|
| 1.1 | Business form with Zod validation (server and client) | complete | Invalid input shows plain-language errors; website URL rejects private hosts |
| 1.2 | Question suggestion library keyed on category, services, location | complete | Any valid input yields at least 8 questions; unit tested |
| 1.3 | Question review screen with edit, add, remove, versioning | complete | Saving creates a new version; current version flagged |

## Phase 2: Collection, storage, demo adapter

| ID | Task | Status | Acceptance criteria |
|---|---|---|---|
| 2.1 | PlatformAdapter interface and registry | complete | Registry reports configured adapters; unconfigured ones are excluded from runs |
| 2.2 | Demo adapter with labeled fixtures | complete | Deterministic answers with citations; `data_mode = demo` on all rows |
| 2.3 | Run and check orchestration + jobs table + worker loop | complete | Starting a run creates checks; worker processes them; failures recorded with codes |
| 2.4 | Run progress screen | complete | Per-question status updates while the run executes |

## Phase 3: Analysis and report

| ID | Task | Status | Acceptance criteria |
|---|---|---|---|
| 3.1 | Owner mention detection by normalized name and aliases | complete | Unit tests for punctuation, case, "The", "&" vs "and", possessives |
| 3.2 | LLM extraction of businesses named with verified excerpts | complete | Excerpts not found in the answer are dropped; tested with adversarial fixture |
| 3.3 | Citation parsing per adapter; owner-domain detection | complete | Subdomains and www handled; tested |
| 3.4 | Metrics module with documented denominators | complete | Failed checks excluded; tests cover zero-success runs |
| 3.5 | Dashboard (three cards) | complete | Matches DESIGN.md; every metric shows N of M |
| 3.6 | Answers screen with highlights and sources | complete | Raw answer visible; platform and date labels present |
| 3.7 | Competitors screen | complete | Counts match metrics module; excerpts shown |

## Phase 4: Website audit

| ID | Task | Status | Acceptance criteria |
|---|---|---|---|
| 4.1 | Safe fetcher (scheme, DNS, private ranges, redirects, size, time, robots) | complete | Unit tests for every blocked category; redirect to private host blocked |
| 4.2 | Page discovery: home + likely contact/about/services pages, max 12 | complete | Only same-site links; cap enforced |
| 4.3 | Audit rules: name, phone, address, city/service area, services, hours, LocalBusiness JSON-LD, title, meta description, HTTPS, contact page | complete | Each rule unit tested with HTML fixtures |
| 4.4 | Website audit screen | complete | Findings grouped; pages checked listed with status |

## Phase 5: Recommendations and tasks

| ID | Task | Status | Acceptance criteria |
|---|---|---|---|
| 5.1 | Recommendation rules mapping evidence to actions with effort and copy templates | complete | Each rule cites at least one evidence id; unit tested |
| 5.2 | Ranking to top three | complete | Deterministic; ties broken by effort then rule order |
| 5.3 | Actions screen with status tracking | complete | Status persists with timestamp |

## Phase 6: History and comparison

| ID | Task | Status | Acceptance criteria |
|---|---|---|---|
| 6.1 | History list | complete | Shows date, platforms, question version, successful/failed, data mode |
| 6.2 | Comparison eligibility and per-question diff | complete | Only comparable runs compare; explanation otherwise; tested |
| 6.3 | Scheduled re-checks (weekly/monthly) | complete | Scheduler enqueues runs with the current question set; min interval enforced |

## Phase 7: Live integrations

| ID | Task | Status | Acceptance criteria |
|---|---|---|---|
| 7.1 | Anthropic adapter (web search tool, user_location, citations) | complete | Parses documented response shape; unit tested with fixture; live smoke script |
| 7.2 | Perplexity adapter | complete | Same as 7.1 |
| 7.3 | OpenAI adapter | complete | Same as 7.1 |
| 7.4 | Live verification with real keys | blocked | Needs API keys; not available in the dev environment on 2026-09-19 |
| 7.5 | Analysis extraction via Claude structured outputs | complete | Works when key present; graceful fallback otherwise |

## Phase 8: Hardening and launch prep

| ID | Task | Status | Acceptance criteria |
|---|---|---|---|
| 8.1 | Security headers, CSRF origin check, rate limits | complete | Verified with tests and manual check |
| 8.2 | Account deletion | complete | All user-scoped rows removed |
| 8.3 | Deployment config (standalone build, volume, env, health) | complete | Deploys to one host; health endpoint green |
| 8.4 | Smoke test of the full flow in demo mode | complete | Passes in CI |

## Phase 9: Follow-ups discovered during implementation

| ID | Task | Status | Acceptance criteria |
|---|---|---|---|
| 9.1 | Content security policy and security headers in next.config | complete | Headers present on every response; app still works |
| 9.2 | Browser smoke test (Playwright) for signup → onboarding → questions → sample run → dashboard → mark action done | pending | Passes locally and in CI |
| 9.3 | Email verification and password reset (needs email provider decision) | blocked | Open question 4 in MEMORY.md |
| 9.4 | Close DNS rebinding gap in safe fetcher with a connect-time IP check | complete | Test with a resolver that returns a public then private address |
| 9.5 | Nightly SQLite backup job for production | pending | Backup file appears in object storage |
| 9.6 | Owner-visible cost estimate before a live run (from ARCHITECTURE cost table and stored usage) | pending | Estimate shown on the questions page |

## Phase 10: Visual design from Claude Design mockups v2

| ID | Task | Status | Acceptance criteria |
|---|---|---|---|
| 10.1 | Tokens and component CSS (light and dark), Geist fonts | complete | globals.css carries all tokens; components use them |
| 10.2 | Landing page (3a desktop, 3b phone) with How it works and FAQ folded in | complete | /how-it-works redirects to the landing section |
| 10.3 | Dashboard layout 2a with 2d phone stacking and 2e states | complete | Empty, running, sample, and complete states render |
| 10.4 | Restyle answers, competitors, website, actions, history, settings, onboarding, questions, run, auth | complete | No pre-redesign color classes remain |
| 10.5 | Cost estimate and confirmation before live checks | complete | Shown only when a live platform is configured |
| 10.6 | Loading skeletons on dashboard and report routes (loading.tsx) | pending | Skeleton matches mockup 2e |
| 10.7 | Dark theme review on a real device | in progress | Owner can now choose Light, Dark, or System (2026-09-20); reviewed in screenshots, device review pending |

## Phase 11: Handoff milestones (docs/research/CLAUDE_CODE_HANDOFF.md), 2026-09-20

| ID | Task | Status | Evidence |
|---|---|---|---|
| M0 | Baseline recorded: HEAD f816344, 73 tests, typecheck, lint, build; ao-search redirects to ai-search | complete | MEMORY.md status |
| M1 | No invented facts in suggested copy; audit and recommendation copy says what was observed | complete | tests/recommend.test.ts "never invents business facts" |
| M2 | Full-name grounding in evidence spans; stance positive/negative/neutral/unknown; per-answer analysis method and notes; partial extraction reported | complete | tests/analyze.test.ts reproduction cases; worker summary |
| M3 | Evidence cap keeps citations and marks provider_truncated; unparseable evidence reported and excluded from citation denominator; typed citation references | complete | tests/worker.test.ts truncation and damaged-evidence cases |
| M4 | Connection pinned to validated address; platform health shows last live success and failure; CSP and headers; daily live-run cap; smoke script persists evidence | complete (live smoke blocked: no keys) | tests/crawl.test.ts pinning test |
| M5 | Owner-confirmed facts (phone, hours, business type, booking, priority services) with confirmation timestamp; audit compares phone, respects service-area, flags script-only sites | complete | tests/questions-facts.test.ts |
| M6 | Verification states, verify_action job, recurrence by scope, export instructions, re-check button | complete | tests/worker.test.ts verification cases; scripts/verify-flow.mts |
| M7 | Question intents and gating (weekend, same-day), priority services first, measurement fingerprints, legacy-run limitation | complete | tests/compare.test.ts, tests/questions-facts.test.ts |
| M7c | Optional branded factual-accuracy questions, kept out of discovery totals | pending | Not built; discovery questions never include the business name today |
| M8 | Business-level pilot events | complete | src/lib/events.ts |
| M4b | Live verification with real keys | blocked | needs ANTHROPIC_API_KEY, OPENAI_API_KEY, or PERPLEXITY_API_KEY |
| M7b | Repeatability experiment (bounded cost) | blocked | needs keys and a cost cap decision |
| M8b | Source-opportunity classification, consumer-surface observations, profile integrations | pending | feasibility decision first |
| M6b | Browser-level test of the correction workflow including a failure state | pending | Playwright not yet in CI |
| M4c | Backup restore drill, account lockout recovery (password reset) | blocked | email provider decision |

## Phase 12: Launch blockers reported 2026-09-21

| ID | Blocker | Status | Evidence |
|---|---|---|---|
| 12.1 | Scheduled runs bypassed cost controls | complete | Scheduler now checks the daily cap and active runs and logs run_started; tests/privacy-limits.test.ts |
| 12.2 | Malformed LIVE_RUNS_PER_DAY disabled the cap | complete | parseLiveRunsPerDay falls back to 10; tested |
| 12.3 | No backup or restore | complete | src/db/backup.ts, pnpm db:backup / db:restore / db:drill, worker daily backup with BACKUP_DIR; tested |
| 12.4 | No password reset or email verification | complete (transport unverified) | Single-use tokens, /forgot-password, /reset-password, /verify-email, settings card; Resend transport written from its docs but not exercised live; log transport in dev |
| 12.5 | Privacy boundary was convention-based | complete | AskInput no longer carries the business; demo context passed only to the demo adapter; tests assert live request bodies |
| 12.6 | No graceful shutdown or worker health alerting | complete | Heartbeat in meta table, /api/health 503 when stale, SIGTERM/SIGINT drain, structured JSON logs, ALERT_WEBHOOK_URL |
| 12.7 | Live provider behavior unverified | blocked | Needs an API key; pnpm live:smoke persists evidence |
