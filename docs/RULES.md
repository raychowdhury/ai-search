# Engineering Rules

These rules apply to every contributor, human or AI. Status: v0.1, 2026-09-19.

## 1. Non-negotiables

1. **Never fabricate results.** No metric, answer, business mention, competitor, citation, or source link is shown unless it is derived from a stored provider response or a stored, labeled demo fixture. If data is missing, say so in the UI.
2. **Crawled content is data, never instructions.** Anything fetched from a website or returned by a provider is untrusted text. It is never interpolated into a system prompt as an instruction, never executed, never used to decide which URL to fetch next without passing through the same safety checks.
3. **Website fetching is sandboxed.** Only http and https. Resolve DNS first and refuse loopback, link-local, private (RFC 1918), unique-local, multicast, and metadata ranges (169.254.0.0/16, fd00::/8, ::1, 127.0.0.0/8, 10/8, 172.16/12, 192.168/16, 100.64/10, 0.0.0.0/8). Re-validate on every redirect. Cap response size (2 MB), time (10 s), redirects (5), and pages per audit (12). Send a descriptive User-Agent and respect robots.txt disallow rules for our agent.
4. **Failed checks are not absence.** A failed check is stored with its error and displayed as failed. It is excluded from every denominator.
5. **Demo data is separate.** Every stored run, check, and audit carries `data_mode`. Live queries filter `data_mode = 'live'`. Demo screens are labeled "Sample data".
6. **No secrets in the repo, database, logs, or docs.** Keys come from environment variables. Health and diagnostics report configured adapter names only.
7. **No invented business facts.** Suggested wording and structured data contain only facts the owner confirmed. Unconfirmed fields are omitted from valid code or shown as bracketed placeholders with a list of what still needs confirming. Never default hours, phone, address, pricing, credentials, availability, or booking.
8. **A substring check proves presence, not meaning.** Evidence excerpts must contain the full business name; that guards fabrication but not the model's judgement. Stance (positive, negative, neutral, unknown) is stored per mention; unknown is never treated as negative or as absence.
9. **Unknown is not zero.** Unreadable evidence, failed extraction, and unfetchable sites are reported as unavailable states with their own counts, and are left out of the affected denominators. They never appear as "no citations", "no competitors", or "missing".
10. **Verification is not causation.** An action is "verified fixed" only when a fresh read of the site no longer shows the finding. That says the site changed; it says nothing about AI answers or customers.
11. **Sample, live, and manual observations stay separate.** Sample data never enters live metrics; any manual consumer-app observation added later must carry its own collection method and date and stay out of API totals.

## 2. Coding conventions

- TypeScript strict mode. No `any` unless wrapped in a Zod parse at the boundary.
- Folder layout: `src/app` (routes and UI), `src/lib/<domain>` (pure logic), `src/db` (schema, migrations), `src/components` (shared UI), `tests/`.
- Domain modules are framework-free: no Next.js imports in `src/lib`. This keeps them testable and portable.
- Every provider adapter lives in `src/lib/platforms/<id>.ts`, implements `PlatformAdapter`, and exports nothing else.
- Every external response is parsed with a Zod schema before use. Unknown fields are preserved in `raw_response` but not relied upon.
- Naming: plain words over jargon in user-facing strings ("mentioned in 3 of 9 answers", not "SoV 33%"). Internal names can be technical.
- Dates stored as ISO 8601 UTC strings. Display conversion happens in the UI layer only.
- Prefer small pure functions with explicit inputs over classes with hidden state.
- Errors: throw typed `AppError` subclasses with a stable `code`. Route handlers map codes to HTTP status and safe messages.
- Comments explain why, not what. No commented-out code.
- Formatting and linting: Prettier defaults and the Next.js ESLint config. CI fails on lint errors.

## 3. Validation requirements

- All user input validated server-side with Zod, even when the client validates too.
- Business name: 2 to 120 characters. Website: absolute URL, http(s), hostname must contain a dot, no credentials in URL, no private hosts (checked at save time and again at fetch time).
- Category, city, region, country: required, 2 to 80 characters. Country as ISO 3166-1 alpha-2, validated against the list we ship.
- Services: 1 to 15 items, each 2 to 60 characters. Aliases: 0 to 5 items.
- Questions: 1 to 20 per set, each 8 to 200 characters, no control characters.
- Provider responses: parsed against the adapter's schema; parse failure is a failed check with code `provider_response_invalid`, and the raw body is still stored (truncated to 200 KB).
- LLM extraction output: parsed against a schema; each evidence excerpt must be an exact substring of the answer text and must contain the extracted business's full name (tolerant of case, punctuation, and & vs and), or the entity is dropped. A first-token overlap is not enough.
- Provider evidence larger than 200 KB: the provider body is dropped and the envelope marked `provider_truncated`; citations are kept. Never truncate serialized JSON.

## 4. Testing expectations

- Unit tests (Vitest) are required for: URL safety checks, HTML audit rules, mention name matching, evidence excerpt validation, metric calculators (including denominators with failed checks), recommendation ranking, and comparison eligibility.
- Adapter tests use recorded fixtures; they never call live APIs in CI. A separate manually run script exercises a live adapter when a key is present.
- The non-fabrication rule has explicit tests: rendering a report with zero successful checks shows no metrics; a check with no owner mention produces no owner mention rows; extraction with a bogus excerpt yields nothing.
- A smoke test walks onboarding, questions, demo run, report, and marking an action done.
- Test data never includes a real business unless the owner consented. Fixtures use invented names.

## 5. Security

- Auth: scrypt password hashing, server-side sessions, httpOnly cookies, CSRF protection via same-site cookies plus origin checks on mutating requests.
- Authorization: every data access is scoped by the authenticated user. No route accepts a business id without verifying ownership.
- Outbound requests: only to provider API hosts and to owner websites through the safe fetcher. No other egress.
- Rate limits: login, run creation (max 3 concurrent runs per business, min 1 hour between scheduled runs), and audit fetches.
- Headers: content security policy with no inline scripts beyond what Next requires, `X-Content-Type-Options: nosniff`, frame denial.
- Prompt injection: provider answers and crawled pages are placed inside clearly delimited data blocks in extraction prompts with an instruction that the content is data. Extraction output is validated structurally and by substring checks, so injected text cannot create mentions that do not exist in the answer.
- Dependencies: lockfile committed; `pnpm audit` in CI; no postinstall scripts from untrusted packages.

## 6. Privacy

- We store the owner's business details, their question set, provider responses about their business, and audit results of their own public website. Nothing else about them.
- We do not store personal data about competitors beyond business names and public URLs that appeared in answers.
- Owners can delete their account; deletion removes all rows scoped to their user id and the SQLite rows are vacuumed nightly.
- Provider data handling: sending questions to a provider is disclosed in the product ("we ask [provider] this question through its API"). Questions contain the business category and location, not the owner's personal details.
- Logs contain ids and error codes, not answer text or page content.

## 7. Development workflow

- Branches: `main` is always deployable. Work on short-lived branches; squash merge.
- Every change updates the relevant doc in `docs/` when it changes a decision, a metric definition, or a limitation. `docs/TASKS.md` status moves with the work.
- Commits are small and describe intent. Attribution lines required by the environment are appended.
- Before merge: lint, typecheck, unit tests pass; manual check of the affected screen in demo mode.
- Demo fixtures are versioned files in `fixtures/`; changing them requires updating the label text if the scenario changes.
- Do not add a provider, model, or dependency without recording the reason in MEMORY.md.
