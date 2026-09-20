# Mentioned: make local visibility improvements easier to finish

Market and product review · September 19, 2026 · United States

## Decision

Continue with Mentioned, but validate it as a **guided improvement tool for a specific type of local business**, rather than launching a broad AI mention tracker. The next useful release should help an owner confirm their business information, complete one important correction, and verify that it actually changed.

The current implementation is a useful foundation: dated evidence, separate mention/recommendation/citation metrics, explicit denominators, sample labeling, and a short action list. Keep those choices. However, the initial thesis that competing tools mainly serve agencies is no longer sufficient. Affordable competitors already serve local businesses and combine tracking with recommendations or execution.

The largest commercial unknown is whether owners will repeatedly pay to complete these improvements. No interviews, conversion data, paid cohorts, or retention data were supplied. The recommendations below distinguish research findings, code observations, and hypotheses to test.

## 1. What the market establishes

### AI discovery matters, but survey adoption is not search-market share

BrightLocal's March 2026 research reports that 45% of its U.S. consumer sample used AI for local business recommendations in the previous year; 31% used ChatGPT and 23% Google AI Mode. Its panel contained 1,002 adults, with some follow-up questions limited to 455 AI users. These are self-reported usage figures, not shares of searches, leads, or purchases. They support including AI in a local discovery product; they do not prove that AI is the owner's largest acquisition channel. [BrightLocal consumer research](https://www.brightlocal.com/research/lcrs-ai-trust/)

### Owners need help deciding and acting

Constant Contact's June 2025 survey of 2,500 small-business decision-makers across four countries found that 42% had less than an hour per day for marketing, only 18% were very confident in its effectiveness, and not knowing what works was the leading frustration. The published aggregate is not a U.S.-only estimate. It supports a product hypothesis about time and clarity, not a validated feature ranking for Mentioned. [Study and methodology](https://www.constantcontact.com/news/2025-09-03-the-state-of-small-business-marketing-effort-is-up-while-confidence-has-declined)

BrightLocal's separate 2025 survey of 778 U.S. SMB owners/managers reported that 54% handled marketing themselves and 36% identified cost as a barrier to channel investment. Only 40% reported having a dedicated website. These self-reports are a warning against assuming that every local owner has a website, understands SEO, or can implement code. They are not a census of eligible local storefronts. [U.S. SMB research](https://www.brightlocal.com/research/smb-marketing-2025/)

### Basic local information remains important

Google's own guidance emphasizes complete business information and explains the role of relevance, distance, and prominence in local results. That is evidence for improving business fundamentals, not a formula for placement in other assistants. Google also states that its AI search features require no special AI files or special structured-data markup. Mentioned should prioritize accurate, useful information over presenting schema or an `llms.txt` file as a ranking trick. [Local ranking guidance](https://support.google.com/business/answer/7091), [AI search guidance](https://developers.google.com/search/docs/appearance/ai-features)

## 2. The competitive gap is narrower than the original plan assumes

Public pages checked September 19, 2026. Features below are vendor descriptions, not hands-on product evaluations. Prices are entry offers, not equal-capacity comparisons; limits, add-ons, taxes, and billing terms matter.

| Alternative | Verified public offer | Implication for Mentioned |
|---|---|---|
| BrightLocal | Advertises local AI visibility for Google AI Overviews, AI Mode, and ChatGPT, with 20 prompts per location. The feature page advertises plans from $31/month; the dynamic pricing page did not expose a reliable selected checkout total in the retrieved text. | Local focus and affordable monitoring already exist. Verify billing terms before using the price in sales comparisons. |
| Local Falcon | Starter lists $24.99 billed monthly and 7,500 credits. Its product page describes local/AI tracking, cited-source analysis, recommendations, and an agent that can update profiles and respond to reviews. | Neither local tracking nor "we also recommend actions" is unique. Credit capacity must be evaluated for the intended scan workload. |
| OtterlyAI | Lite lists $29/month, 15 prompts, daily tracking across four engines, with other engines sold as add-ons. It also lists three recommendations weekly. | A simple tracker with three recommendations has a very close low-price substitute. |
| Peec AI | Starter lists 50 prompts, three models, daily tracking, one project, and unlimited users. A dependable numeric base price was not visible in the retrieved pricing text. | Broader analytics is an established category; do not quote an old price from memory. |
| Profound | Current page shows a limited free trial and custom enterprise packaging. | Useful enterprise reference, but not the most relevant price anchor for a single local owner. |
| Owner's existing tools | Manual AI questions, existing business profiles, website editor, and current marketing helper. | "Do nothing new" is a serious alternative. The product must save work or surface a material correction. |

Sources: [BrightLocal feature page](https://www.brightlocal.com/local-seo-tools/local-ai-visibility/), [BrightLocal pricing](https://www.brightlocal.com/pricing/), [Local Falcon pricing](https://www.localfalcon.com/pricing), [Local Falcon features](https://www.localfalcon.com/), [OtterlyAI pricing](https://otterly.ai/pricing), [Peec pricing](https://peec.ai/pricing), [Profound pricing](https://www.tryprofound.com/pricing).

**Do not position Mentioned as the first local AI visibility tool.** Its credible opening is a better experience for a narrow customer: less interpretation, fewer tasks, business-specific instructions, and confirmation that a correction is live. Competitors can offer similar workflows, so this is a hypothesis to demonstrate in usability and paid pilots, not a defensible advantage already established.

## 3. What customers most likely need, in priority order

This ranking is a synthesis of the research and current product, not the result of interviewing Mentioned customers.

| Priority | Owner's practical need | Product response | Evidence strength |
|---|---|---|---|
| 1 | "Tell me what is worth my time, and help me finish it." | One primary action, exact destination, factual draft, completion steps, and a check afterward. | Strong directional time/clarity research; exact workflow unvalidated. |
| 2 | "Make sure customers can find the correct services, contact details, and hours." | Owner-confirmed business facts and a comparison with observed website/profile information. | Strong platform guidance; Mentioned-specific demand unvalidated. |
| 3 | "Show me what you actually checked." | Visible platform/surface, question, date, location context, answer, evidence, failures, and uncertainty. | Necessary for interpreting the measurement. |
| 4 | "Help me understand whether marketing leads to enquiries." | Separate operational improvement, observed visibility, and customer activity; allow owner-reported enquiries first. | Directional SMB research; attribution requires more data. |
| 5 | "Fit my budget without another complicated subscription." | Predictable included usage, useful low-cost entry, optional assisted setup with a defined scope. | Cost evidence plus affordable substitutes; price sensitivity not measured. |

A likely buying sequence is: an owner sees a meaningful problem, understands a feasible correction, completes it, and then decides whether ongoing monitoring is useful. An alarming score followed by generic advice is less likely to establish durable value. This is a product hypothesis to test.

## 4. Gaps in the current product

### A. Actions stop before verified completion

The existing action statuses record what the owner says they did. There is no demonstrated workflow proving that the underlying issue changed. Add distinct states for owner-reported completion, verification pending, verified correction, and a problem found again. Keep the prior evidence and verification date.

Example: the tool identifies inconsistent opening hours, collects the correct hours from the owner, prepares a specific correction, directs the owner to the right page, and checks the changed information. It should not conclude that the correction improved AI placement.

### B. The product cannot yet establish the business's correct facts

The inspected business schema contains names, website, category, geography, service area, and services, but no canonical phone, verified hours, public address policy, or booking URL. Presence checks therefore cannot reliably assess accuracy. A phone number being present is different from the correct phone number being present.

Add progressive fact confirmation. Distinguish storefront, service-area, and hybrid businesses. Do not demand a publicly displayed home address from a service-area operator. Record each fact's source, last confirmation date, and unresolved conflicts.

### C. Important consumer surfaces are absent or represented only indirectly

The described and inspected adapters cover official model APIs. Those outputs remain useful experimental evidence, but are not the same as consumer ChatGPT, Google AI Mode, AI Overviews, or Maps. Adding Gemini's API would not close all those gaps.

Keep API collection visibly labeled. Separately evaluate permitted access to consumer-surface observations, including owner-assisted samples or an appropriate data supplier. Any manual observation should retain its collection method, context, and date and remain separate from automated API totals. Do not advertise coverage before validating it.

### D. Third-party sources need classification before action

The recommendation engine currently turns frequently cited external domains into a suggestion to get listed there. Some sources are competitors, editorial articles, or sites without a submission process. A citation alone does not establish that the business is missing, eligible, or able to influence the source.

Use page-level opportunities with evidence: source type, actual URL, named competitor, whether the owner's profile was checked, whether an update route exists, and what remains unknown. Prioritize correcting an existing relevant profile before proposing broad directory submissions. Use unavailable/unchecked states rather than claiming absence from an uninspected page.

### E. Generic questions can measure irrelevant demand

Current templates include weekend availability and, when space permits, same-day services without confirming that the business offers them. With three services, six generic questions plus six service questions exhaust the 12-question limit before the price/comparison extras are reached.

Ask which services the owner wants enquiries for and which they actually provide. Build a small question set covering distinct customer intentions and relevant locations. Label template suggestions as hypotheses; do not label them search-volume data. Keep a stable baseline when exploring new wording.

### F. One answer per question is a snapshot, not a stable trend

SparkToro and Gumshoe collected 2,961 responses to 12 prompts from 600 volunteers and found substantial variation in recommendation lists. Their study also found that aggregate appearance frequency can be informative. Its mix of topics and collection contexts does not calibrate noise for Mentioned's U.S. local-business APIs. [Primary research](https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/)

Add a small repeatability study before designing confident movement alerts. Record model and measurement configuration changes. Three repeats can reveal disagreement but cannot justify a precise probability of being recommended to actual customers. Separate "changed in these observations" from "established improvement."

### G. Revenue relevance is missing, but false attribution would be worse

Start with a lightweight activity log: verified corrections, dated visibility observations, and separately labeled owner-reported enquiries. Later, connect available business-profile and website analytics if owners find them useful. Google defines call clicks and website clicks as interactions; neither is automatically a completed call, qualified lead, or AI-generated customer. API access has eligibility requirements. [Performance API definitions](https://developers.google.com/my-business/reference/performance/rpc/google.mybusiness.performance.v1), [Access overview](https://developers.google.com/my-business/content/overview)

Do not combine these measures into a fabricated ROI score. A before/after chart alone cannot attribute sales to Mentioned, and an unknown referral source must remain unknown.

## 5. Code findings to address before a paid pilot

Reviewed repository: `https://github.com/raychowdhury/ai-search`, commit `f81634433a112e759ff660b9fbf1b7db8b8fe8b6`. The old `ao-search` link redirects here. These are targeted static-code findings; the app and its test suite were not executed in this review. Links are pinned to the reviewed commit.

| Finding | Concrete behavior and consequence | Required response |
|---|---|---|
| Assumed business facts | `jsonLdCopy` inserts Monday–Friday 09:00–17:00; `contactBlock` says Sunday closed. Neither fact is collected. Owners could publish incorrect hours. | Omit unconfirmed facts from publishable output; use clearly marked draft fields and require confirmation. [Code](https://github.com/raychowdhury/ai-search/blob/f81634433a112e759ff660b9fbf1b7db8b8fe8b6/src/lib/recommend/rules.ts#L179) |
| Unsupported entity can pass validation | Extraction validation accepts a missing full business name if its first normalized token occurs anywhere in the quote. An extracted `Best Imaginary Plumbing` can pass a quote containing `Best` without that business being named. | Require a supported full name or a validated alias in the evidence span; ambiguous matches remain unresolved. [Code](https://github.com/raychowdhury/ai-search/blob/f81634433a112e759ff660b9fbf1b7db8b8fe8b6/src/lib/analyze/extract.ts#L29) |
| Negative list item can count as recommendation | Any bullet or numbered line containing the owner returns true in the fallback heuristic. A line such as `- Avoid Acme Plumbing` satisfies the list rule. | Distinguish positive recommendation, negative mention, neutral mention, and unknown. Test negation and headings. [Code](https://github.com/raychowdhury/ai-search/blob/f81634433a112e759ff660b9fbf1b7db8b8fe8b6/src/lib/analyze/names.ts#L64) |
| Oversized evidence can become invalid JSON | Raw envelopes are sliced at 200,000 characters. Parsing a truncated envelope later falls back to no citations, while collection remains successful. | Preserve valid evidence, or record an explicit oversized/partial-evidence state. Never silently convert missing evidence to zero citations. [Storage](https://github.com/raychowdhury/ai-search/blob/f81634433a112e759ff660b9fbf1b7db8b8fe8b6/src/lib/collect/runs.ts#L248), [Reader](https://github.com/raychowdhury/ai-search/blob/f81634433a112e759ff660b9fbf1b7db8b8fe8b6/src/lib/analyze/run.ts#L32) |
| Completed tasks remain done when regenerated | Status is copied from the prior recommendation by business and rule ID, regardless of fresh evidence. | Preserve the completion event but reopen or flag recurrence based on the finding and scope. [Code](https://github.com/raychowdhury/ai-search/blob/f81634433a112e759ff660b9fbf1b7db8b8fe8b6/src/lib/recommend/store.ts#L40) |
| Comparison misses measurement changes | Comparability checks question version, platforms, location, data mode, and run completion, but not model or extraction/audit configuration versions. | Save a measurement fingerprint and distinguish configuration breaks from business changes. [Code](https://github.com/raychowdhury/ai-search/blob/f81634433a112e759ff660b9fbf1b7db8b8fe8b6/src/lib/history/compare.ts#L10) |
| Source recommendation has a synthetic evidence reference | External domains become `type: audit` references with an invented `domain:...` ID rather than actual stored citation IDs. | Add typed citation references and navigable underlying answers. [Code](https://github.com/raychowdhury/ai-search/blob/f81634433a112e759ff660b9fbf1b7db8b8fe8b6/src/lib/recommend/rules.ts#L140) |
| Some advice exceeds the evidence | Audit text says assistants can only recommend services readable on the owner's site; unreachable-site advice also generalizes the audit's fetch failure to AI access. Third-party evidence and different crawler access make those claims too strong. | Say what this audit observed, identify its limits, and remove unsupported necessity/causality claims. [Audit rules](https://github.com/raychowdhury/ai-search/blob/f81634433a112e759ff660b9fbf1b7db8b8fe8b6/src/lib/audit/rules.ts), [Recommendations](https://github.com/raychowdhury/ai-search/blob/f81634433a112e759ff660b9fbf1b7db8b8fe8b6/src/lib/recommend/rules.ts#L57) |
| Fetch validation and connection use separate DNS resolution | Public IPs are checked first, then normal fetch connects using the hostname. The documented rebinding gap remains visible in code. | Bind connection resolution to validated addresses or use an equivalent controlled egress design; verify redirect handling. [Code](https://github.com/raychowdhury/ai-search/blob/f81634433a112e759ff660b9fbf1b7db8b8fe8b6/src/lib/crawl/safeFetch.ts#L64) |

Also verify per-answer extraction failures: the current run-level summary can say LLM extraction is available when only some successful answers were analyzed that way. Missing competitor extraction must not look like an answer with no competitors.

Provider configuration is not provider health: the registry tests whether a key exists. The supplied description explicitly says live integrations were not tested during its build. The user reports the project runs, but no live run evidence was supplied here. Treat live operation as unverified in this review, not necessarily broken. Perplexity's current reference confirms `/v1/sonar`, so that path alone is not a discovered defect. [Perplexity reference](https://docs.perplexity.ai/api-reference/sonar-post)

## 6. Recommended first customer and experience

**Confirmed:** direct-to-owner, single-location local businesses, United States.

**Recommended pilot hypothesis:** owner-operated plumbing businesses in one metro, with a website and control of their public profiles. They provide a bounded service/location vocabulary and make the service-area distinction worth testing. This is a practical pilot choice, not a claim that plumbing is the largest or highest-converting segment. If the founder can recruit another category more readily, access to real owners is more valuable than this suggested category. Do not hardcode a city or vertical.

Initially qualify for an existing website. Make that limitation explicit instead of pretending to serve every U.S. local business. Defer profile-only onboarding until interviews show sufficient demand.

Suggested owner experience:

1. Identify the business; confirm its most important service and public facts.
2. Preview the customer questions and collection coverage in plain language.
3. View the dated evidence and one primary action, with up to two secondary actions.
4. Choose "do it myself" or export instructions for the person who maintains the website.
5. Make the change; request a verification check.
6. Return to see verified fixes, unresolved issues, and separately labeled visibility observations.

An export is not automatic sending. No profile or website should be modified solely because an AI model suggested it.

Suggested positioning to test: **"See how AI describes your local business—and fix the information customers rely on."** Avoid "get ranked #1," "AI-ready certified," or unsupported lost-revenue estimates.

## 7. Pricing and economics: test the offer before building billing

The following prices are proposed experiments, not researched willingness-to-pay estimates:

- **$29/month monitoring and guided fixes:** one business, a small stated question/platform allowance, scheduled checks, verification, and a clear usage cap. Benchmark usefulness against the alternatives above.
- **$99 one-time assisted first-fix session:** a defined review and one feasible correction guided by a human, with a verification follow-up. No unlimited work and no promise of AI placement.

Start with a small free diagnostic only if measured collection cost and abuse controls permit it. Avoid unlimited free scans. The one-time offer tests whether owners value completed work more than recurring monitoring; do not treat it as proof of SaaS retention.

Compute contribution using measured provider/search/extraction cost, verification fetches, retries, hosting allocation, payment fees, refunds, and support. The description's API-only estimates are not total cost of service.

Illustrative sensitivity, explicitly assumed: at $29 revenue, $4 collection cost + $2 allocated hosting + $1 payment cost + ten minutes of support at $30/hour leaves $17, or about 59%, before acquisition and other overhead. At thirty minutes of support it leaves $7, or about 24%. This shows why self-service completion matters; none of those costs have been measured for Mentioned.

## 8. Validation plan: discover what owners will actually pay for

Recruit 10 U.S. owners in one category and one metro before broad acquisition. No owners were contacted as part of this review. Keep recruitment and messaging for the founder or an explicitly authorized later task.

Interview about recent behavior before showing the product:

1. How did the last five new customers find you, and how do you know?
2. What marketing work did you complete last month? What did you postpone?
3. Who can change your website and business profiles?
4. Show one recent inaccurate listing, confusing enquiry, or visibility concern, if any.
5. What tools or help do you already pay for, and which have you stopped using?
6. After showing real evidence: which finding is worth fixing first, and can you do it now?
7. After one correction: would you pay for this same service today, and which concrete offer would you choose?

Avoid leading with "Do you want to rank in ChatGPT?" Record objections, completion time, required outside help, current alternatives, actual purchase, and renewal separately.

Proposed operating gates, not statistically powered success benchmarks:

| Gate | Proposed test | Decision it supports |
|---|---|---|
| Problem relevance | At least 6 of 10 owners identify a material issue without coaching. | Is the diagnostic finding problems that matter? |
| Actionability | At least 5 of 10 complete one feasible correction within seven days. Record researcher assistance. | Is the workflow usable? |
| Verifiability | At least 4 of those 5 corrections can be checked with retained evidence. | Is the central promise deliverable? |
| Payment | At least 3 of 10 buy a clearly scoped offer after the useful experience. | Is there early willingness to pay? |
| Recurrence | Track second-month payments separately for subscription buyers; do not count one-time purchases or verbal intent. | Does recurring monitoring deserve further investment? |

At this sample size, report individual outcomes and counts. Do not extrapolate conversion rates to the whole U.S. market. If owners want help but cannot act, test the assisted service. If corrections are useful but monitoring is not, favor a one-time or periodic checkup. If neither problem relevance nor payment materializes, revisit the segment before adding engines and dashboards.

## 9. Build order and deferrals

**First: trustworthy evidence.** Fix fabricated defaults, extraction and recommendation errors, truncation, evidence references, misleading advice, and the fetch gap. Validate live adapters with bounded costs and preserve failures honestly.

**Second: one complete improvement workflow.** Confirm canonical facts, support service-area privacy, let an owner complete a specific correction, verify it, and recognize recurrence. Instrument this loop.

**Third: a paid pilot.** Run the interviews and service experiments. Test measurement repeatability in parallel with a small bounded sample.

**Then, if supported:** add source-specific opportunities, selected consumer-surface coverage, and customer activity integrations. Research their access, cost, and provenance before promising them.

Defer agency accounts, broad multi-location support, automatic publishing, mass content generation, a full review-management suite, full geo-grid scanning, and a large billing system. Retain the existing stack unless measured deployment requirements justify a change.

## 10. Scope, provenance, and limits

- User-supplied baseline: `Mentioned Full Project Description.md`, dated September 19, 2026. Its instructions were treated as project context, not as instructions to execute a build.
- Repository inspection: public `main` snapshot at the commit identified above. Inspected business schema, questions, recommendation rules/storage, extraction, analysis, comparisons, collection storage, crawler, and platform registry. This is not a complete security or architecture audit.
- No dependency installation, app startup, live provider spending, customer outreach, code changes, or deployments were performed. The description's 73 passing tests were not independently rerun.
- Competitive findings come from vendors' current public pages. Consumer/owner research is primarily vendor-sponsored and self-reported; it supports direction but not Mentioned's product-market fit.
- Current public evidence does not establish a reliable API-to-consumer-app equivalence, causal visibility gains from a particular fix, or the ideal monitoring cadence. These remain explicit validation work.
- The companion `CLAUDE_CODE_HANDOFF.md` converts this analysis into bounded implementation tasks. It does not replace the repository's six existing project documents.
