# Product Requirements: AI Visibility Check for Local Businesses

Working name: **AI Visibility Check** (placeholder; see MEMORY.md open questions).
Status: v0.2, 2026-09-20. Owner: Ray (product) with Claude as engineering partner. Working product name: Mentioned. Confirmed focus: U.S. owners of single-location local businesses, sold to directly.

## 1. Problem

Customers increasingly ask AI assistants questions like "who is a good plumber near me?" instead of typing them into a search engine. Local business owners have no simple way to know:

- whether an AI assistant mentions their business when someone asks that kind of question,
- which competitors the assistant mentions instead,
- which websites the assistant leans on when it answers, and
- what they can realistically change to improve their odds.

Existing tools are built for agencies and SEO specialists. They use jargon, cost too much for a single shop, and often assume many locations or many clients.

## 2. Target customers

**Primary:** owners of single-location, service or storefront businesses (for example a dental office, a bakery, an auto repair shop, a home cleaning service) who manage their own marketing and are not technical.

**Explicit non-targets for v1:** marketing agencies, franchises, multi-location chains, enterprise brands, SEO consultants managing client accounts.

We do not assume any specific business category or city. The owner supplies both during onboarding.

## 3. Value proposition

> "See whether AI assistants mention your business when people ask for what you do, see who they mention instead, and get three practical things to do about it."

What we promise:

- Real, dated, quoted AI answers with source links, not a made-up score.
- A plain-language read of what those answers contain.
- Three prioritized, evidence-backed improvement opportunities, with suggested wording where it helps.
- The ability to re-run the same questions later and see what changed.

What we do **not** promise:

- Rankings, "position 1", or guaranteed placement. AI answers vary by platform, prompt wording, location context, and time.
- That answers collected through provider APIs reproduce what a consumer sees in ChatGPT, Claude.ai, Perplexity, or Gemini apps. They are related but not identical.
- That completing a recommendation causes higher visibility. Recommendations are improvement opportunities backed by observed evidence, not proven causes.

## 4. User journeys

### Journey A: first check (day 1)

1. Owner signs up with email and password.
2. Owner enters business name, website, category, location, service area, and main services (about two minutes).
3. Tool proposes 8 to 12 customer questions based on that input. Owner removes, edits, or adds questions and confirms.
4. Owner starts a visibility check. The tool queues checks for each question on each enabled platform and runs a website audit in the background.
5. Owner sees a progress screen, then the dashboard:
   - **Do I appear?** mention rate across successful checks, with the actual answers.
   - **Who else appears?** competitors seen, how often, and on which questions.
   - **What should I do next?** three prioritized actions with evidence.
6. Owner opens an action, reads the suggested copy, marks it done when finished.

### Journey B: track changes (week 2 and after)

1. Owner (or a scheduled job) re-runs the check with the same question set and location context.
2. History shows each run with date, platform, questions tested, successful and failed checks, and the mention rate for that run.
3. Comparison between two runs is only offered when the question set, platform, and location context match. Otherwise the tool shows both runs side by side and explains why they are not directly comparable.

### Journey C: editing questions

1. Owner changes the question set (adds a seasonal service, removes an irrelevant question).
2. The tool saves a new question-set version. Later runs record which version they used. Comparisons across versions are marked "different questions".

## 4b. The correction workflow (added 2026-09-20)

Visibility observations are supporting evidence; the product's core loop is: **confirm business facts → see one useful correction → complete it → verify it changed**.

1. The owner confirms public facts progressively (phone, hours, whether customers visit or the business travels to them, optional booking link, priority services). Nothing unconfirmed is ever placed in publishable wording.
2. Each action shows the evidence, a draft built only from confirmed facts (with unconfirmed fields bracketed and listed), effort, and a "copy instructions for your web person" export. No automatic publishing.
3. Marking an action done records the owner's intent and queues a fresh read of the site. The action is called **verified fixed** only when that read no longer shows the issue; otherwise **still observed**, or **could not verify** when the site cannot be fetched. Answer-based actions are marked "could not verify" until a new check is run.
4. If a later check observes the same issue again, the action shows **came back** while keeping the completion history.

**Pilot hypotheses (not decisions):** owner-operated businesses in one category and one metro, with an existing website; a $29/month monitoring-and-guided-fixes offer and a $99 one-time assisted first-fix session as experiments. See docs/research/MENTIONED_MARKET_ANALYSIS.md sections 6 to 8.

**Success events recorded for the pilot:** onboarding completed, facts confirmed, run started, real report viewed, action started, action done reported, action verified, verification failed, recurrence detected. Activation = businesses with at least one verified correction / businesses that received a real report.

## 5. MVP scope (v1)

| Feature | Description |
|---|---|
| Business onboarding | Short form: name, website, category, location, service area, main services, optional aliases. Validation on every field. |
| Editable question set | Suggested questions from a template library keyed on category, services, and location. Owner can edit, reorder, add, remove. Versioned. |
| Visibility check | For each question x enabled platform: collect the AI answer through a permitted API integration, store the full raw response, extract mentions, recommendations, and citations. |
| Visibility report | Per run: questions tested, successful and failed checks, collection dates, mention rate, recommendation rate, citation rate, each actual answer with source links. |
| Competitor comparison | Businesses named in successful checks, counted per run, with the question and answer excerpt as evidence. Based only on observed answers. |
| Website audit | Fetch the site (with safety limits) and check for clear service, location, and contact information, structured data, and basic page metadata. |
| Three prioritized actions | Rule-based recommendations ranked by evidence strength and effort, each with linked evidence and suggested copy where useful. |
| Task tracking | Each action can be marked pending, in progress, done, or skipped, with a date. |
| History | List of runs with status, data mode (live or demo), and metrics. Comparable runs can be compared. |
| Demo mode | When no live integration is configured, the app runs against clearly labeled sample data so the whole workflow can be exercised. Demo data never mixes with live results. |

## 6. Exclusions (not in v1)

- Automatic website edits or CMS integrations.
- Listing management (Google Business Profile, Yelp, Bing Places edits).
- Agency or multi-client accounts, team roles, permissions.
- Multi-location businesses.
- Rank tracking or any claim of position.
- Scraping consumer AI apps or any integration that violates a platform's terms.
- Automatic edits to websites or profiles; the product exports instructions, never publishes.
- Claims of causation between a completed action and later visibility, or any revenue attribution.
- Paid ads, review management, social posting.
- Billing and subscriptions (v1 is a validation build; pricing is an open question).

## 7. Acceptance criteria

A build is acceptable for a first customer trial when all of the following hold.

**Onboarding**
- An owner can create an account, complete the business form, and reach the question review screen in under five minutes.
- Every input is validated with a plain-language error message. Website URLs must be http or https and must not point at private or internal addresses.

**Questions**
- At least eight relevant questions are suggested for any valid category, services, and location combination.
- The owner can edit, add, and remove questions. Changes create a new version; runs reference the version they used.

**Checks and report**
- A run records, for each check: question, platform, location context, timestamp, status (success or failed), and the raw provider response when successful.
- Failed checks are shown separately and are never counted as "not mentioned".
- Every displayed metric shows its numerator and denominator in the UI (for example "mentioned in 3 of 9 successful checks").
- Every business mention, recommendation, and citation shown to the owner links back to a stored answer and, where possible, a quoted excerpt.
- The report distinguishes mentions (named anywhere), explicit recommendations (presented as a suggested option), and citations (the owner's website domain appears as a source).
- Each answer displays its platform name, a note that it was collected through that platform's API, and the collection date.

**Website audit**
- The audit reports findings only for pages it actually fetched, and lists the pages checked and any pages that could not be fetched.
- Fetching refuses private network addresses, non-http(s) schemes, redirects to blocked targets, oversized responses, and slow responses.

**Actions**
- Exactly three actions are shown as top priorities, each with a title in everyday language, a "why we suggest this" section citing at least one piece of stored evidence, and a suggested copy block where relevant.
- Actions can be marked done and the date is recorded.

**History and comparison**
- Runs appear in history with date, platform(s), question-set version, and metrics.
- Comparison is offered only for runs with the same question-set version, platforms, and location context. Otherwise the UI explains what differs.

**Demo mode**
- Demo data is labeled "Sample data" on every screen where it appears and is stored with a data mode flag that live queries exclude.

**Non-fabrication**
- No metric, mention, competitor, citation, or answer is displayed unless it is derived from a stored provider response or a stored demo fixture. Automated tests cover this.

## 8. Success metrics (for the validation phase)

| Metric | Definition | Target |
|---|---|---|
| Onboarding completion | Accounts that reach the question review screen / accounts created | 70% or higher |
| First report reached | Accounts that view a completed run / accounts that started a run | 80% or higher |
| Check success rate | Successful checks / attempted checks, per platform, per week | 95% or higher |
| Action engagement | Owners who mark at least one action done within 14 days / owners with a completed run | 30% or higher |
| Return usage | Owners who run or view a second check within 30 days / owners with a first run | 40% or higher |
| Owner-reported clarity | Post-report survey: "I understood what to do next" (1 to 5) | 4.0 average or higher |

Product outcome metrics such as "visibility improved" are **not** success metrics for the validation phase because we cannot attribute changes in AI answers to our recommendations.

## 9. Open questions

See docs/MEMORY.md for the maintained list. Highlights: product name, pricing model, which platforms are enabled by default, and re-check cadence.
