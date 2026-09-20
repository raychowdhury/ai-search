# Architecture

Status: v0.1, 2026-09-19. Updated as implementation decisions change (see MEMORY.md for the decision log).

## 1. Technology stack and reasons

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | One language for UI, API, workers, and tests. Node 24 and pnpm are already installed on the dev machine. |
| Web framework | Next.js (App Router) with React | Server components and route handlers give us a single deployable app with server-side data access. Familiar to most contributors. |
| Styling | Tailwind CSS | Fast to produce a clean, consistent, accessible UI without a design-system dependency. |
| Database | SQLite via Node's built-in `node:sqlite`, plain SQL with versioned migrations in `src/db/migrations.ts` | Zero-ops and zero native builds (better-sqlite3 failed to compile on Node 24, so we use the built-in module). Repositories are small typed functions; a Postgres move means swapping the driver and the handful of SQL strings. |
| Validation | Zod | Shared schemas for forms, API inputs, provider responses, and stored JSON. |
| AI providers | Official SDK or plain HTTPS per provider, behind a `PlatformAdapter` interface | Each provider has a different API. The adapter boundary keeps provider quirks out of the analysis and UI code and makes the demo adapter a drop-in. |
| Web crawling | Node `fetch` with DNS pre-resolution and private-range checks on every hop, manual redirects, size and time caps, robots.txt, plus `cheerio` for HTML parsing | No headless browser in v1. Keeps the audit fast and the attack surface small. Known gap: DNS is resolved before connect, so a DNS rebinding between resolve and connect is not blocked; a custom dispatcher can close this later. |
| Background work | In-process job runner polling a `jobs` table | Good enough for one instance and a handful of businesses. Swappable for a queue (BullMQ, pg-boss) later without changing job payloads. |
| Auth | Email + password with Node `crypto.scrypt`, server-side sessions in SQLite, httpOnly cookie, `proxy.ts` for optimistic redirects | No third-party auth dependency for v1. Magic-link email is an optional upgrade once an email provider is chosen. |
| Testing | Vitest (unit and integration), Playwright (a small smoke suite, later) | Fast unit tests for analysis and safety code; a browser smoke test for the core flow. |
| Deployment | Single Node process (Next.js standalone) with a persistent volume for SQLite, on Fly.io, Railway, or Render | Cheapest way to run one instance with a durable file. Postgres when we outgrow it. |

Assumption: Node 24 is the runtime (`node:sqlite` is still marked experimental by Node but is stable enough for this MVP; it prints a warning on start).

## 2. System components

```
┌──────────────────────────────────────────────────────────────┐
│ Next.js app (one process)                                    │
│                                                              │
│  UI (React server + client components)                       │
│    onboarding · questions · dashboard · report · audit ·     │
│    actions · history · settings                              │
│                                                              │
│  Route handlers / server actions                             │
│    auth · business · questions · runs · tasks                │
│                                                              │
│  Domain modules (src/lib)                                    │
│    questions/   suggestion templates                         │
│    platforms/   PlatformAdapter + adapters (anthropic,        │
│                 openai, perplexity, demo)                     │
│    collect/     run + check orchestration                    │
│    analyze/     mention/recommendation/citation extraction   │
│    crawl/       safe fetcher + page parser                    │
│    audit/       website audit rules                          │
│    recommend/   recommendation engine + copy templates        │
│    metrics/     metric definitions and calculators           │
│    jobs/        job table + worker loop                      │
│    db/          Drizzle schema + migrations                  │
│                                                              │
│  Worker loop (started by instrumentation hook or            │
│  `pnpm worker` as a separate process)                        │
└──────────────────────────────────────────────────────────────┘
          │                         │
          ▼                         ▼
   SQLite file (data/app.db)   Provider APIs (HTTPS, outbound only)
```

### Three distinct pipelines

It is important not to blur these; they have different inputs, trust levels, and failure modes.

1. **Website crawling** (`crawl/`, `audit/`): fetches the owner's own website, parses HTML, and runs deterministic rules. Input is untrusted HTML. No LLM in v1. Output: `audits` and `audit_findings`.
2. **AI answer collection** (`platforms/`, `collect/`): sends a customer question to a provider API with location context and stores the full response verbatim. Output: `checks` with `raw_response`. No interpretation happens here.
3. **Analysis** (`analyze/`, `metrics/`, `recommend/`): reads stored checks and audits, extracts mentions, recommendations, and citations with evidence spans, computes metrics, and produces recommendations. Output: `mentions`, `citations`, `recommendations`. Analysis can be re-run against stored data without re-collecting.

## 3. Data model

All tables have `id` (text, ULID), `created_at`, `updated_at` (ISO 8601 UTC). Times shown to the owner are converted in the UI.

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Owner accounts | email (unique), password_hash, email_verified_at (null in v1) |
| `sessions` | Server-side sessions | user_id, token_hash, expires_at |
| `businesses` | One per owner in v1 | user_id, name, aliases (JSON array), website_url, website_domain, category, city, region, country, service_area (text), services (JSON array), location_context (JSON: city, region, country, timezone) |
| `question_sets` | Versioned question lists | business_id, version (int), questions (JSON array of {id, text, source: suggested or owner}), is_current |
| `runs` | One visibility check batch | business_id, question_set_id, platforms (JSON array), location_context (JSON snapshot), data_mode (`live` or `demo`), status (queued, running, complete, failed), started_at, finished_at, summary (JSON metrics snapshot) |
| `checks` | One question x platform execution | run_id, question_id, question_text, platform, model, location_context (JSON), status (`success` or `failed`), error_code, error_message, requested_at, completed_at, answer_text, raw_response (JSON, verbatim), usage (JSON), data_mode |
| `mentions` | Businesses named in an answer | check_id, name, normalized_name, is_owner (bool), is_recommended (bool), evidence_text (verbatim excerpt), evidence_start, evidence_end, extraction_method (`name_match`, `llm`, `demo`) |
| `citations` | Sources cited by the answer | check_id, url, domain, title, is_owner_domain (bool), position |
| `audits` | One website audit | business_id, run_id (nullable), status, data_mode, started_at, finished_at, pages (JSON: url, status, fetched, bytes, error) |
| `audit_findings` | Individual audit results | audit_id, rule_id, severity (`good`, `warn`, `missing`), title, detail, evidence (JSON: page url, excerpt), page_url |
| `recommendations` | Prioritized actions for a run | run_id, rank, rule_id, title, why (text), evidence (JSON array of {type: check or finding, id, excerpt}), suggested_copy (text, nullable), effort (`low`, `medium`, `high`), status (`pending`, `in_progress`, `done`, `skipped`), status_changed_at |
| `jobs` | Background work | type, payload (JSON), status, attempts, run_after, locked_at, last_error |

Raw provider responses are stored whole so any displayed claim can be traced back. They are the evidence of record.

## 4. Metric definitions (implemented in `metrics/`)

Definitions are the single source of truth; the UI shows numerator and denominator.

- **Successful checks** = checks in the run with status `success`.
- **Failed checks** = checks with status `failed`. Shown, never counted as absence.
- **Mention rate** = successful checks with at least one `mentions` row where `is_owner = true` / successful checks.
- **Recommendation rate** = successful checks with an owner mention where `is_recommended = true` / successful checks.
- **Citation rate** = successful checks with at least one `citations` row where `is_owner_domain = true` / successful checks.
- **Competitor mention count** (per competitor) = successful checks with a non-owner mention of that normalized name. Shown as "N of M successful checks".
- **Top cited domains** = count of successful checks in which each domain appears at least once.

All rates are per run and per platform. Cross-platform totals are shown only with the per-platform breakdown next to them.

## 5. Integration strategy

### Adapter interface

```ts
interface PlatformAdapter {
  id: PlatformId;                 // "anthropic" | "openai" | "perplexity" | "gemini" | "demo"
  label: string;                  // "Claude (API with web search)"
  dataMode: "live" | "demo";
  isConfigured(): boolean;        // credentials present
  ask(input: {
    question: string;
    location: LocationContext;    // city, region, country, timezone
    signal?: AbortSignal;
  }): Promise<PlatformAnswer>;    // { answerText, citations[], raw, model, usage }
}
```

Adapters never interpret the answer. They return text plus the provider's own citation list plus the raw response.

### Providers verified against official docs on 2026-09-19

| Provider | Integration | Location context | Citations returned | Cost (list price) | Credential |
|---|---|---|---|---|---|
| Anthropic Claude API | Messages API with server-side `web_search` tool (`web_search_20260209` on Opus 5 / Sonnet 5; basic `web_search_20250305` also available) | `user_location` {city, region, country, timezone} | Yes: `web_search_result_location` citations with url, title, cited_text; plus `web_search_tool_result` blocks | $10 per 1,000 searches plus tokens (Opus 5: $5 in / $25 out per MTok; Sonnet 5: $2 / $10) | `ANTHROPIC_API_KEY` |
| OpenAI Responses API | `tools: [{type: "web_search"}]` | `user_location` {type: approximate, city, region, country, timezone} | Yes: `url_citation` annotations on message output | $10 per 1,000 calls plus tokens at model rates (GPT-5.5: $5 / $30; GPT-5 mini: $0.25 / $2) | `OPENAI_API_KEY` |
| Perplexity Sonar | `POST https://api.perplexity.ai/v1/sonar` (chat-style), models `sonar`, `sonar-pro` | `web_search_options.user_location` {city, region, country} | Yes: `citations` (URLs) and `search_results` (title, url, date, snippet) | Per request $5 to $12 per 1,000 (sonar, by context size) plus $1 / $1 per MTok; sonar-pro $6 to $14 per 1,000 plus $3 / $15 | `PERPLEXITY_API_KEY` |
| Google Gemini API | `google_search` tool | Not verified for city-level control; treat as unsupported for now | Yes: url_citation annotations (per current docs) | $14 per 1,000 requests on Gemini 3.x (5,000 free per month); Flash tokens $0.75 / $3.75 per MTok through 2026 | `GEMINI_API_KEY` |

Important caveats we surface in the product:

- API answers with web search are **not** the same as the consumer apps (ChatGPT, Claude.ai, Perplexity app, Gemini app). Different system prompts, personalization, and retrieval. We label every result "collected through the [provider] API".
- Provider web search can return errors inside a 200 response (Anthropic: `web_search_tool_result_error`). The adapter maps these to a failed check with the error code.
- Location context is approximate. We record exactly what we sent.

### Which adapters ship in v1

- `demo`: fixture-backed, always available, clearly labeled. Ships first.
- `anthropic`: implemented with the official SDK. Enabled automatically when `ANTHROPIC_API_KEY` is set.
- `perplexity` and `openai`: implemented with plain HTTPS against the documented request and response shapes. Enabled when their keys are set. Marked "implemented, not yet verified live" in MEMORY.md until a key is available.
- `gemini`: interface stub only, disabled. Location control unverified.

### Analysis LLM

Mention and recommendation extraction uses deterministic name matching for the owner's business (name and aliases, normalized) plus an LLM extraction step (Claude, structured output) that lists businesses named in the answer with verbatim evidence excerpts. Every excerpt is verified as a substring of the stored answer before it is saved; excerpts that do not match are discarded and logged. If no analysis key is configured, only name matching runs and the UI says "competitor extraction unavailable".

### Expected operating cost per business

Assumptions: 10 questions, one platform, roughly 2 searches per question, about 8k input and 800 output tokens per check, plus one extraction call per check (about 3k in / 300 out).

| Platform | Per check | Per run (10 questions) | Monthly, weekly runs |
|---|---|---|---|
| Anthropic, Opus 5 | ~$0.02 search + ~$0.06 tokens + ~$0.02 extraction ≈ $0.10 | ≈ $1.00 | ≈ $4.30 |
| Anthropic, Sonnet 5 | ~$0.02 + ~$0.024 + ~$0.01 ≈ $0.05 | ≈ $0.55 | ≈ $2.40 |
| OpenAI, GPT-5 mini | ~$0.01 + ~$0.004 + extraction on Claude ~$0.02 ≈ $0.035 | ≈ $0.35 | ≈ $1.50 |
| Perplexity sonar, low context | ~$0.005 + ~$0.01 + extraction ~$0.02 ≈ $0.035 | ≈ $0.35 | ≈ $1.50 |

These are estimates from list prices; the app records real `usage` per check so we can replace estimates with measured cost.

## 6. Background checks

- Starting a run inserts one `runs` row, one `checks` row per (question x platform) with status `queued`, and one `jobs` row of type `run_checks`; a second job of type `website_audit` is enqueued.
- The worker loop claims jobs with an atomic `UPDATE ... WHERE locked_at IS NULL`, processes checks sequentially per platform with a small concurrency cap (2) to respect rate limits, retries transient errors up to 3 times with backoff, and marks a check `failed` with an error code otherwise.
- After all checks finish, an `analyze_run` job runs extraction, metrics, and recommendations, then marks the run `complete`. Partial success is still `complete`; failed checks remain visible.
- Scheduled re-checks: a `schedule` field on the business (off, weekly, monthly). A `scheduler` tick (cron endpoint or worker timer) enqueues runs using the current question set and stored location context. Comparison rules are enforced at read time.

## 7. Storage

- SQLite file at `DATA_DIR/app.db`, WAL mode. Raw provider responses are stored as JSON text in the `checks` table; typical size is 5 to 50 KB per check.
- Retention: raw responses are kept for 12 months by default (assumption), then compacted to answer text plus citations. Owners can delete their business and all data at any time.
- Backups: nightly copy of the SQLite file to object storage in production (deployment task).
- Secrets live only in environment variables. Nothing secret is written to the database or logs.

## 8. Authentication

- Email + password. Passwords hashed with `crypto.scrypt` (N=2^15, r=8, p=1, 32-byte salt). Minimum length 10.
- Session token: 32 random bytes; SHA-256 hash stored; 30-day expiry; httpOnly, secure (in production), sameSite=lax cookie.
- Rate limit login attempts per email and per IP (in-memory in v1).
- All business data is scoped by `user_id`; every query goes through helpers that require the current user.
- Email verification and password reset are planned (needs an email provider; open question).

## 9. Deployment

- Build: `next build` in standalone mode. Run: one Node process serving the app and running the worker loop (or two processes: `web` and `worker`, sharing the same volume).
- Environment: `DATABASE_PATH`, `SESSION_SECRET`, `APP_URL`, provider keys, `DEFAULT_PLATFORMS`, `ANALYSIS_MODEL`.
- Health endpoint `/api/health` reports DB reachability and which adapters are configured (names only, never key values).
- Migrations run on start.

## 10. Failure handling

| Failure | Handling |
|---|---|
| Provider rate limit or 5xx | Retry with exponential backoff (3 attempts). Then check `failed` with code `provider_unavailable`. Run continues. |
| Provider search error inside 200 | Check `failed` with the provider error code. |
| Provider returns no citations | Check `success`; citation rate for that check is 0 with a note "no sources returned". |
| Extraction excerpt not found in answer | Discard that mention, log a warning with check id. |
| Analysis LLM unavailable | Owner mention via name match only; competitor list marked unavailable for that run. |
| Website unreachable | Audit status `failed_fetch`; findings limited to "we could not reach your site". Recommendations that need audit data are skipped and the report says so. |
| Website fetch blocked (private IP, redirect to blocked host, too large, too slow) | Audit records the block reason. Never retried automatically. |
| Worker crash mid-run | Jobs are re-claimable after a lock timeout (10 minutes). Checks are idempotent per check id. |
| Missing keys | Adapters report unconfigured; UI offers demo mode with a clear label. |
