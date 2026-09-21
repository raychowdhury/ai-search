# Project Memory

Living record of decisions, assumptions, open questions, limitations, and status. Never store credentials or secrets here. Updated 2026-09-19.

## Current status

- 2026-09-21 (Gemini live test): a new free-tier Gemini key authenticates and generates text, but every Google Search grounding request on Gemini 3.x (3.1-flash-lite, 3.5-flash-lite, 3.6-flash) returns "You exceeded your current quota", and Gemini 2.5 models are "no longer available to new users". Conclusion: free grounded answers from Gemini are not available to new accounts; the earlier free-tier finding applied to 2.5 models only. Gemini's free tier remains useful for competitor extraction (verified live on a stored answer). Default Gemini model set to gemini-3.6-flash; the adapter reports grounding quota errors as not retryable with a plain explanation.

- 2026-09-21 (free providers): Surveyed free tiers against official pages. Only Google Gemini offers a real free answer platform with web grounding (2.5 models, 500 grounded requests/day, prompts may be used by Google on the free tier, no location parameter so the city is put in the question). OpenAI, Anthropic, and Perplexity have no ongoing free tier (trial credits only). Resend free plan: 3,000 emails/month, 100/day. Hosting: Render free cannot attach a persistent disk; Fly.io has no free tier for new customers; Oracle Always Free (2 OCPU, 12 GB after the June 2026 cut) is the only free option with a disk. Built the Gemini adapter (interactions endpoint, url_citation annotations) plus OpenAI and Gemini competitor extractors with a preference order Claude, OpenAI, Gemini. The OpenAI extractor was verified on the live run; see the later entry for the Gemini live test result.

- 2026-09-21 (email): Resend transport verified live. A test message and a real password-reset email were accepted by Resend (message ids returned) using the test sender `onboarding@resend.dev`, which delivers only to the Resend account owner's address. Real delivery to customers needs a verified sending domain in Resend and `EMAIL_FROM` set to an address on it. Inbox receipt and the reset link are awaiting the owner's confirmation.

- 2026-09-21 (live verification, OpenAI): first live provider run. Smoke test and a full 12-question check for the demo business through the app's worker succeeded on `gpt-5.4-mini` (12 of 12 answers, real citations, audit complete). Findings: `gpt-5-mini` returns 404 "organization must be verified"; `gpt-5.4-mini` and `gpt-5.5` work without verification; web search results count as input tokens (about 8.5k per answer on 5.4-mini, 17k on 5.5). Measured cost: $0.222 for 12 checks at list price ($0.0185 per check), well below the earlier estimate for a mid-tier model. Default OpenAI model changed to `gpt-5.4-mini`. Competitor extraction remains unavailable without an Anthropic key. Evidence files: data/live-smoke-2026-09-21*.json (gitignored).

- 2026-09-21: Seven launch blockers reported and verified in code; six fixed (scheduler controls, cap parsing, backup and restore with a drill script, password reset and email verification with a pluggable mailer, narrowed adapter input type with request-body tests, worker heartbeat, graceful shutdown, structured logs, alert webhook, health 503). Live provider verification stays blocked on a key. Resend email transport is written from its documentation and not exercised live.

- 2026-09-20: Implemented the handoff milestones M0 to M8 from docs/research/CLAUDE_CODE_HANDOFF.md (research supplied 2026-09-19, reviewed commit f81634433a112e759ff660b9fbf1b7db8b8fe8b6). All nine cited code findings were reproduced at the cited lines and fixed with regression tests. 110 tests pass; typecheck, lint, and production build are clean. Migration v2 applied to the existing development database and the earlier runs still render. Live provider verification remains blocked: no API keys in the environment. Pilot category, metro, and pricing remain hypotheses, not decisions.

- 2026-09-19 (morning): Project started from an empty directory. Six planning docs written. Provider capabilities verified against official docs. No API keys are available in the development environment, so the MVP is built with replaceable adapters and a labeled demo adapter.
- 2026-09-19 (evening): Design system and all screens restyled from the Claude Design mockups v2 (see decisions below). Typecheck, lint, and build clean.
- 2026-09-19 (end of day): MVP implemented on Next.js 16.3 / React 19 / TypeScript / Tailwind 4 / node:sqlite. 73 unit and integration tests pass, typecheck and lint are clean, production build succeeds. Working in sample mode: signup, onboarding, question editing with versioning, sample run through the background worker, dashboard, answers, competitors, website audit (live fetch of the real site), three actions with status tracking, history with comparability rules, settings with schedule and account deletion. Live adapters (Anthropic, OpenAI, Perplexity) and Claude-based competitor extraction are implemented but unverified because no keys exist here.

## Confirmed decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-19 | TypeScript + Next.js 16 (App Router) + Tailwind 4 + SQLite via built-in `node:sqlite` with hand-written SQL + Vitest | One language, one process, zero-ops storage for an MVP. better-sqlite3 failed its native build on Node 24, and Drizzle has no node:sqlite driver, so the ORM was dropped in favour of small typed repository functions. |
| 2026-09-19 | Provider access only through official APIs (Anthropic Messages API web search, OpenAI Responses web search, Perplexity Sonar). No scraping of consumer apps. | Terms compliance and stability. Product copy states that API answers are not identical to consumer app answers. |
| 2026-09-19 | Every stored run, check, and audit carries `data_mode` (live or demo); demo never mixes with live. | Requirement; prevents misleading owners. |
| 2026-09-19 | Failed checks are stored, displayed, and excluded from every denominator. | Requirement; avoids counting outages as absence. |
| 2026-09-19 | Three separate categories: mention (named), explicit recommendation (presented as an option), citation (owner's domain in sources). | Requirement; they answer different owner questions. |
| 2026-09-19 | Raw provider responses stored verbatim as evidence. | Traceability for every displayed claim. |
| 2026-09-19 | Extraction excerpts must be exact substrings of the stored answer or they are discarded. | Structural defense against fabrication and prompt injection. |
| 2026-09-19 | Website audit is deterministic rules over fetched HTML; no LLM in v1. | Cheaper, testable, and avoids treating page text as instructions. |
| 2026-09-19 | Recommendations are rule-based with evidence links and effort estimates; shown as "improvement opportunities". | Honest framing; no causal claims. |
| 2026-09-19 | Analysis and default answer model: `claude-opus-5` (configurable via `ANALYSIS_MODEL` / `ANTHROPIC_ANSWER_MODEL`). | Default from Anthropic guidance; cost table in ARCHITECTURE.md shows the Sonnet 5 option for owners who prefer lower cost. |
| 2026-09-19 | Auth is email + password with scrypt and server-side sessions. | No email provider chosen yet; simplest safe option. |
| 2026-09-19 | Demo answers are templated from the owner's real details (name, city, category, services) and clearly labeled, rather than being about an unrelated fictional business. | Lets owners see their own name highlighted and understand the report; every source uses the reserved `.example` TLD so nothing points at a real site; ~1 in 10 sample checks simulates an outage to show failed-check handling. |
| 2026-09-19 | The website audit always runs live against the real site, even during a sample check, and is labeled as live. | The site is the owner's own public property; auditing it is safe and useful even without AI keys. |
| 2026-09-19 | Live adapters never receive the business name; only the question and location context are sent. | Prevents biasing the assistant toward the business being measured. |
| 2026-09-19 | Recommendation status carries forward across runs for the same rule id. | An owner who marked "add structured data" done should not see it reset after the next check. |
| 2026-09-19 | Anthropic answer calls use the beta server-side `fallbacks: "default"` parameter. | Follows current Anthropic guidance so a policy refusal is retried on a fallback model inside the same request; harmless for ordinary local-business questions. |

| 2026-09-19 | Visual design implemented from the Claude Design project "AI Visibility Check Mockups v2" (monochrome precision): Geist type, ink-on-white tokens with a dark variant via prefers-color-scheme, 1px borders, 6px controls and 10px cards, one blue reserved for links, ink-filled primary button, status colors always paired with an icon or word, dashed amber "Sample data" badge. | The mockups were reviewed and chosen by the product owner; tokens live in src/app/globals.css and map to Tailwind via @theme inline. |
| 2026-09-19 | Dashboard uses mockup layout 2a ("By the book": sidebar, three cards in a row) with 2d phone stacking and the 2e states. Layouts 2b (statement) and 2c (ledger) are not implemented. | 2d and 2e were built on 2a in the mockups, so it was the complete option. |
| 2026-09-19 | Working product name is "Mentioned" (from the mockups); the repo and docs keep "AI Visibility Check" as the project name. | The mockup decision; wordmark is plain text. |
| 2026-09-19 | Live checks show an estimated API cost beside the button and require a one-step confirmation; sample checks do not. How it works is folded into the landing page and /how-it-works redirects there. Tablet uses the bottom tab bar; the sidebar appears only above 1024px. Model names appear only in answer-card meta text. | Decisions recorded in the mockups' notes. |

| 2026-09-20 | Adopted the research's "confirm facts → correct → verify" loop as the product's core; visibility observations are supporting evidence. | Research finding that affordable local AI-visibility trackers already exist; the differentiator to test is completed, verified corrections. |
| 2026-09-20 | Suggested wording never invents facts; JSON-LD omits unconfirmed fields and lists them; drafts carry a "still needs" list. | Owners could otherwise publish wrong hours or phone numbers. |
| 2026-09-20 | Extraction requires the full business name inside the evidence span; stance replaces the boolean recommendation; per-answer analysis method stored. | Closes the first-token overlap and negative-list-item defects. |
| 2026-09-20 | Oversized provider bodies are dropped, not truncated; citations kept; unreadable evidence is an explicit state excluded from the citation denominator. | Truncated JSON silently became "no citations". |
| 2026-09-20 | Completion status carries across runs only for the same scope; recurrence is flagged, not hidden. | A done task was staying done regardless of fresh evidence. |
| 2026-09-20 | Runs record a measurement fingerprint; comparisons treat model or analysis changes as measurement breaks. | Configuration changes must not read as business changes. |
| 2026-09-20 | Fetch connections are pinned to the validated IP through undici's connector lookup. | Closes the DNS rebinding gap between validation and connect. |
| 2026-09-20 | Questions carry intents; weekend and same-day questions appear only when confirmed hours or an emergency service support them; priority services first. | Stop measuring demand for things the business does not offer. |
| 2026-09-20 | Source recommendations reference real citation rows and say we have not checked the owner's presence there. | Synthetic domain references were not navigable evidence. |

| 2026-09-20 | Appearance: light and dark only, chosen with a single sun/moon icon button (labeled buttons in Settings); saved per browser; device setting used until the owner chooses. | Owner asked for a simple icon and two modes; a third "system" state added words and confusion. |

| 2026-09-21 | Per-provider monthly request caps, Gemini default 5,000 (answers plus extraction), enforced before run creation, per check in the worker, in extractor selection, and in the scheduler. | Owner asked to block Gemini after the 5,000 free grounding requests on a billed project so usage never turns into a bill. |

## Hypotheses from the research (not decisions)

- Pilot: owner-operated plumbing businesses in one U.S. metro with an existing website (any category with reachable owners is acceptable).
- Offers to test: $29/month monitoring and guided fixes; $99 one-time assisted first-fix session.
- Positioning to test: "See how AI describes your local business, and fix the information customers rely on."
- Operating gates for a 10-owner pilot: 6 identify a material issue, 5 complete a correction in 7 days, 4 verifiable, 3 buy.

## Assumptions (reversible, chosen without confirmation)

- Owners run one business per account in v1.
- Default question count is 10 (range 8 to 12) and default platform set is whichever adapters are configured, demo when none.
- Location context sent to providers is the business city, region, country, and timezone; service area is used only for question wording.
- Weekly is the default re-check cadence when scheduling is turned on; it is off by default.
- Raw responses are retained 12 months.
- Country list is ISO 3166-1 alpha-2; the UI defaults to nothing and requires a choice.
- Gemini's grounding has no location parameter; localisation relies on the city in the question text and is unverified until a key is available.

## Open questions

1. Product name. "AI Visibility Check" is a placeholder.
2. Pricing model and whether v1 needs billing at all.
3. Which platforms should be enabled by default for a paying customer, given per-run cost.
4. Email provider for verification, password reset, and "your check finished" notifications.
5. Hosting choice (Fly.io, Railway, Render) and backup destination.
6. Whether to offer a Sonnet 5 "lower cost" toggle in settings or keep model choice internal.
7. Should owners see provider model names, or only platform names? (Current plan: platform name plus model in a tooltip.)

## Known gaps in the current build (updated 2026-09-21)

- Email sending works through Resend with the test sender; a verified sending domain is still needed before customers can receive email.
- Alerting is a generic JSON webhook plus a 503 health endpoint; no pager or Slack integration is configured.

## Superseded gaps (2026-09-20 list)

- OpenAI adapter verified live 2026-09-21; Anthropic and Perplexity adapters remain unverified (no keys).
- No browser-level automated test of the correction workflow; verified with a script against a database copy.
- Password reset and email verification still need an email provider (account lockout recovery).
- Backup restore has not been drilled.
- Consumer-app surfaces (ChatGPT app, Google AI Mode, AI Overviews) are not observed; only official APIs.
- The repeatability experiment has not run.

## Superseded gaps

- Live adapters are unverified (no keys). Perplexity endpoint path `/v1/sonar` and OpenAI default model `gpt-5-mini` with web search must be confirmed on first live run.
- No content security policy headers yet. Server actions rely on Next's built-in origin checks and same-site cookies.
- No email verification or password reset.
- Safe fetcher resolves DNS before connecting; a DNS rebinding attack between the two steps is not blocked.
- The recommendation heuristic for "explicit recommendation" without an analysis model uses list-item and cue-word detection, which is imperfect; the UI notes the extraction method.
- No browser-level automated test; the flow was exercised with a seed script plus rendered-page checks.

## Limitations (to state in the product)

- API answers with web search do not reproduce consumer app answers. Different prompts, personalization, and retrieval.
- Answers vary with wording, location context, and time. Two runs minutes apart can differ.
- Location context is approximate and provider-dependent.
- Competitor extraction depends on an analysis model; when unavailable, only the owner's business is detected.
- Website audit covers up to 12 pages fetched as plain HTML; JavaScript-rendered content may be missed.
- Comparisons are only meaningful across runs with the same question set version, platforms, and location context.
- No claim of causation between completed actions and later visibility changes.

## Provider facts verified 2026-09-19 (official docs)

- Anthropic web search: tool types `web_search_20250305`, `web_search_20260209`, `web_search_20260318`; `user_location` {type approximate, city, region, country, timezone}; citations `web_search_result_location` with url, title, cited_text; errors inside 200 as `web_search_tool_result_error`; $10 per 1,000 searches plus tokens; `pause_turn` possible.
- OpenAI Responses web search: `{type: "web_search"}` tool; `url_citation` annotations; `user_location` same shape; $10 per 1,000 calls plus tokens at model rates; GPT-5.5 $5/$30 per MTok, GPT-5 mini $0.25/$2.
- Perplexity Sonar: `POST https://api.perplexity.ai/v1/sonar`; models sonar, sonar-pro; response `citations` and `search_results`; `web_search_options.user_location` and `search_context_size`; sonar $5 to $12 per 1,000 requests plus $1/$1 per MTok; sonar-pro $6 to $14 plus $3/$15.
- OpenAI live (2026-09-21): Responses API `web_search` tool returns `url_citation` annotations with url and title; `user_location` accepted; `gpt-5.4-mini` list price $0.75 in / $4.50 out per MTok, `gpt-5.5` $5 / $30, `gpt-5.4` $2.50 / $15; web search $10 per 1,000 calls plus search content tokens at model rates; `gpt-5-mini` requires organization verification.
- Gemini: `google_search` tool; $14 per 1,000 requests on 3.x with 5,000 free per month; location control unverified.
