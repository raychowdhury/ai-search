# Claude Code handoff: Mentioned's next release

Prepared September 19, 2026. Read this alongside `MENTIONED_MARKET_ANALYSIS.md` and the existing repository documents. This is a research-backed implementation brief, not a record of changes already applied.

## Context and confirmed direction

The founder first requested six planning files for a local AI visibility product, then built and ran it with Claude. They now want a deep current-market review, customer-need assessment, and handoff for the next development session.

Confirmed audience: **U.S. owners of single-location local businesses, sold to directly.** Agencies and multi-location management remain outside the initial focus. No business category, city, final pricing, or launch date has been confirmed.

Recommended next product increment: help an owner **confirm correct business facts → identify a useful correction → complete it → verify the correction**. Keep AI visibility observations as supporting evidence. Do not promise fixed rankings, guaranteed placement, or causal revenue gains.

The recommended plumbing/one-metro pilot and proposed prices in the analysis are hypotheses. Keep them configurable and do not convert them into confirmed founder decisions.

## Read first

- Companion research: `MENTIONED_MARKET_ANALYSIS.md`. It contains the current competitive comparison, customer research, source links, pricing experiments, pilot design, limitations, and code findings. Use it rather than duplicating it into every project document.
- Supplied baseline: `PROJECT_DESCRIPTION.md` in the handoff package; original local source is `/Users/ray/Downloads/Mentioned Full Project Description.md`.
- Repository: https://github.com/raychowdhury/ai-search. The prior https://github.com/raychowdhury/ao-search URL redirects here.
- Reviewed revision: `f81634433a112e759ff660b9fbf1b7db8b8fe8b6`. Compare current HEAD before assuming findings still apply.
- Existing `AGENTS.md`, then `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/RULES.md`, `docs/DESIGN.md`, `docs/TASKS.md`, and `docs/MEMORY.md`.

Preserve the existing Next.js/TypeScript/SQLite application and user changes. No source files were modified by this research session. A read-only snapshot was inspected; neither tests nor live integrations were run. A running sample app is not evidence that all live adapters work.

Repository `AGENTS.md` calls for reading installed Next.js documentation before coding against this version. Follow that requirement in the actual development environment.

## First session: verify the baseline and repair evidence integrity

Inspect current code and existing tests, reproduce the findings below, then make focused changes. Do not spend the session rebuilding the dashboard or migrating the stack. If paid credentials are unavailable, complete deterministic work and identify the live verification as blocked; never silently substitute sample results.

### M0 — Record the actual baseline

**Inspect:** current HEAD, working-tree changes, package scripts, six docs, current deployment constraints, adapter health, and existing tests.

**Deliver:** an updated task list and a short baseline note recording what was verified locally, what is only documented, and what needs credentials or external access. Run the repository's existing test, typecheck, lint, and build commands when supported. Do not call earlier reported test totals newly verified.

### M1 — Remove invented business facts from suggested content

**Starting points:** `src/lib/recommend/rules.ts` (`contactBlock`, `homepageCopy`, `jsonLdCopy`); `src/lib/business/schema.ts`; related tests.

**Problem:** current suggestions assume weekday hours and Sunday closure; generated text can also imply booking availability without a confirmed booking method.

**Acceptance criteria:**

- No publishable draft invents hours, address, phone, pricing, credentials, availability, or booking support.
- Unconfirmed fields are omitted from valid structured output or displayed as clearly incomplete draft fields that cannot be confused with ready-to-publish content.
- Website text and structured data use the same owner-confirmed facts.
- Regression coverage includes unknown hours, confirmed weekend hours, and a service-area business with a private address.
- Audit/recommendation copy says what the crawler observed. Remove claims that an inaccessible page proves all AI tools cannot access it or that a service must appear on the owner's own site to be recommended.

### M2 — Make entity and recommendation evidence reliable

**Starting points:** `src/lib/analyze/extract.ts`, `names.ts`, `run.ts`, `store.ts`, and metrics/report consumers.

**Reproduction cases:**

- Extracted name `Best Imaginary Plumbing`, quote `Best options are listed below.` The first-token fallback must not accept a business that the evidence does not name.
- `- Avoid Acme Plumbing` must not count as a positive recommendation.
- A neutral directory list, a business name in a URL, two businesses with the same name in different cities, and a quote unrelated to the named entity must not be confidently overclassified.

**Acceptance criteria:**

- A counted entity has a full name or validated alias grounded in its relevant evidence span. Preserve offsets into the original answer when normalization is used.
- Recommendation assessment supports positive, negative, neutral, and unknown states, or a similarly explicit representation. Unknown is not silently treated as a negative observation.
- Keep entity resolution uncertainty separate from name-mention detection; do not claim identity verification solely from matching text.
- Store extraction/assessment status per answer. Partial extraction failure does not become "no competitors." Show appropriate denominators or unavailable states for metrics affected by that failure.
- If a model overrides a heuristic judgment, update all applicable owner records consistently and record the actual assessment method.
- Retain the rule that retrieved content is data, never instructions. Exact substrings are a useful guard but do not prove the semantic correctness of a model's judgment.

### M3 — Preserve usable evidence and make references navigable

**Starting points:** `src/lib/collect/runs.ts:markCheckSuccess`, `src/lib/analyze/run.ts:readEnvelope`, `src/lib/recommend/rules.ts`, report/action rendering, database migrations.

**Problem:** truncating serialized JSON at 200,000 characters can destroy the envelope; analysis then silently returns no citations. A source recommendation also creates synthetic `domain:` references under the audit type.

**Acceptance criteria:**

- Responses above the cap cannot leave an apparently successful, invalid JSON evidence envelope.
- Choose explicit bounded rejection/partial-evidence handling or preserved full raw storage with a documented retention limit. Maintain separate normalized citations as appropriate. Do not relabel discarded content as verbatim retained evidence.
- Distinguish a successful answer with no citations from unavailable or unparseable citation evidence.
- Every displayed evidence reference resolves to an actual stored answer, citation, finding, or audit under the current account's authorization.
- Tests exercise oversized input, malformed historical evidence, valid zero-citation answers, and source references.
- Document historical-data handling: flag damaged prior evidence and offer a re-check; never fabricate reconstruction.

### M4 — Close the fetch gap and verify live collection

**Starting points:** `src/lib/crawl/safeFetch.ts`, `src/lib/url/safety.ts`, platform adapters/registry, `scripts/live-smoke.mts`.

**Acceptance criteria:**

- The connection uses validated public addresses, preserving correct Host/TLS behavior, and validates redirects. Add a regression covering a resolver that changes from a public to a private address.
- Distinguish credentials present, last successful live check, and current failure/unverified status.
- Verify configured endpoint/model/search support against current official provider documentation and a budget-bounded smoke run when credentials exist.
- Smoke evidence covers answer text, citations, model, usage, requested location context, failure handling, and persisted output. Location requested is not proof of exact geographical behavior.
- Missing keys remain a documented blocker for live verification only. Sample mode stays explicitly sample and never enters live metrics.
- Provider documentation reviewed during research confirms Perplexity `/v1/sonar`; do not "fix" that path using stale recollection.

Before a public paid pilot, also close the deployment-specific essentials already identified in the project description: recovery from account lockout, persistent storage and a demonstrated backup restore, appropriate security headers, abuse/cost limits, and worker restart recovery. Record actual blockers; do not expand this into a platform rewrite.

## Next increment: one correction that the owner can finish

### M5 — Establish owner-confirmed business facts

**Starting points:** business schema/repository, onboarding form, audit context, migrations.

**Scope:** public phone, actual hours, storefront/service-area/hybrid type, whether customers visit, approved public address or service area, priority services, optional booking URL, and optional profile URLs. Introduce progressively; do not turn first-run onboarding into a long mandatory form.

For each relevant fact retain its value, provenance, confirmation timestamp, and unresolved conflict state. Imported website/profile data is a suggestion until confirmed. A profile URL supplied by the owner is not proof of ownership or verified content.

**Acceptance criteria:**

- Existing accounts migrate without invented facts or broken old reports.
- A service-area operator is not instructed to publish a private home address.
- Audit results distinguish present, absent within inspected coverage, incorrect against confirmed facts, and unable to verify.
- JS-only, blocked, and partially crawled sites do not receive categorical whole-site absence claims.
- Preview all suggested changes before the owner copies or applies them.

### M6 — Implement completion, verification, and recurrence

**Starting points:** recommendation rules/store, actions page, audit runner, jobs, migrations.

**Design:** preserve owner workflow status separately from verification status. Identify a finding by business + rule + affected field/page or other explicit scope. Keep observations and completion events rather than overwriting history.

**Minimum verification states:** not checked, queued/checking, verified fixed, still observed, unable to verify, and recurred. Exact UI vocabulary may be simpler, but the semantics must remain distinct.

**Acceptance criteria:**

- An owner can see the relevant fact, source, proposed correction, destination, steps, and completion method.
- Marking done records owner intent and can enqueue a bounded re-check; it does not claim verified success.
- A failed fetch leaves verification unknown, not successful.
- A later contradictory observation flags recurrence and retains prior completion history.
- The same generic rule affecting a new page or service is not automatically completed because an older task was done.
- Export instructions as a file or copyable text for a website maintainer; no automatic sending or publishing.
- For the pilot, fully support one correction type before broadening. Recommended first type: a missing or conflicting owner-confirmed phone/hour field on an accessible website page.

### M7 — Improve questions and measurement comparability

**Starting points:** question suggestions/versioning, run creation, checks, history comparisons, platform types, analysis version metadata.

**Acceptance criteria:**

- Owner chooses priority services; unsupported weekend/same-day claims do not enter the default question set.
- Questions have intent tags and provenance such as template, owner-provided, or observed customer question. Do not invent search volumes.
- Separate unbranded discovery questions from optional branded factual-accuracy questions. Branded questions may include the business name intentionally but must never enter discovery visibility totals.
- Record measurement fingerprints: surface/collection method, provider/model identifier, relevant tool/settings, location context, language, prompt template, question version, extraction version, and repetition policy. Record unavailable details as unknown.
- Existing runs with missing metadata are legacy observations with explicit comparison limitations.
- Show changes as observations; do not claim a trend from one changed response. Preserve existing failure-versus-absence distinctions.
- Run an initial repeatability experiment only with credentials and a stated cost cap. Proposed design: five businesses × six questions × two configured API adapters × three repeats × two dates = 360 answers. These are proposed study parameters, not a proven adequate sample size.
- Inspect variation within each business/question/provider. Do not treat every answer as an independent sample from U.S. consumers or manufacture statistical certainty from pooled prompts.

## After the first correction workflow works

### M8 — Pilot instrumentation and optional source opportunities

Track business-level events sufficient for the analysis's pilot: onboarding completed, real report viewed, action started, correction owner-reported, correction verified, verification failed, recurrence, offer presented, paid, and renewal/cancellation when those events actually exist. Avoid collecting unnecessary enquiry/customer details.

Definitions:

- Activation: a business with at least one verified correction / eligible pilot businesses that received a real report, within the stated window.
- Time to value: elapsed time from first real report to first verified correction; report assisted and unassisted cases separately.
- Offer conversion: actual purchasers / owners actually offered that same package, excluding fictional/sample accounts.
- Renewal: actual renewals / subscription customers whose first renewal became due. One-time service purchases are not subscriptions.

If the pilot validates demand, expand third-party source opportunities. Store exact cited page, source classification, supporting checks, owner-presence status, eligibility, available correction path, verification status, and reason for priority. A competitor website is not a directory opportunity; an inaccessible listing remains unchecked. Do not recommend buying links or publishing unsupported claims.

Consumer-surface integrations and Google Business Profile connections need a separate feasibility decision covering permitted access, attribution/display requirements, authorization, cost, granularity, and failure states. A Gemini API adapter is not a substitute for observing AI Mode or AI Overviews. Keep any manual consumer observations separate from official API observations.

## Update the six existing files as the work progresses

| File | Required update |
|---|---|
| `docs/PRD.md` | Confirm U.S./direct-owner focus; define the correction-and-verification workflow, success events, pilot hypotheses, and exclusions. |
| `docs/ARCHITECTURE.md` | Facts/provenance, evidence storage, typed references, verification jobs, event/history model, measurement fingerprints, and deployment constraints. |
| `docs/RULES.md` | No invented business facts; no semantic certainty from substring checks; separate sample/live/manual surfaces; unknown is not zero; verification is not causation. |
| `docs/DESIGN.md` | One primary action, progressive fact confirmation, publishable versus incomplete drafts, verification/recurrence/unknown states, and plain-language coverage labels. |
| `docs/TASKS.md` | Add the milestones above with dependencies, acceptance criteria, current status, and blocked external requirements. Reconcile with existing work instead of duplicating it. |
| `docs/MEMORY.md` | Record confirmed decisions separately from hypotheses, reference research date and reviewed commit, and log actual test/live verification results. |

Do not replace these documents with generic templates. Put the market research in a dedicated referenced file if added to the repository.

## Validation and delivery expectations

- Reproduce defects first and add regression tests that challenge the failure, rather than mirroring implementation.
- Test migrations on existing data and a new database; preserve stored answers and completed-task history.
- Run relevant unit/integration checks, existing typecheck/lint/build, and one browser-level owner workflow through correction verification, including a failure state.
- Preserve tenant authorization when adding evidence links and exports.
- Use source-grounded fixtures for deterministic tests; do not describe synthetic fixtures as live verification.
- End each milestone with what changed, evidence/tests, limitations, and the next unfinished task. Do not claim live support without live evidence.
- Do not implement billing, automatic external edits, agency tooling, or broad platform coverage just because the analysis mentions future possibilities.

## Suggested skills

Use available equivalents rather than assuming skill names or local paths exist in Claude Code:

- **Repository diagnosis and regression testing** for M1–M4. Reproduce concrete failures before fixes.
- **Product discovery/customer interviewing** for the founder's pilot; no outreach was authorized or performed in this research session.
- **Data-quality and measurement review** for incomplete evidence, denominators, entity uncertainty, repeated observations, and comparison rules.
- **Frontend/accessibility review** for M5–M6 and the complete mobile owner journey.

No subagents are required by this handoff. No secrets are included. Verify any installed skill instructions before using them.
