# Design

Status: v0.1, 2026-09-19. Audience: owners of single-location businesses who are not technical. Tone: calm, plain, honest.

## 1. Design principles

1. **Answer the three questions first.** Every dashboard visit should answer "Do I appear?", "Who else appears?", and "What should I do next?" above the fold.
2. **Show the evidence.** Every number links to the answers it came from. Every action links to why we suggest it.
3. **Say what we don't know.** Failed checks, unavailable platforms, and sample data are labeled, never hidden.
4. **Everyday language.** "Mentioned", "recommended", "sources", "answers". No "SoV", "SERP", "entity", "LLM".
5. **One thing at a time.** Short forms, one primary button per screen, progressive disclosure for details.

## 2. Information architecture

```
/                      Landing (short explanation, sign in / create account)
/signup, /login
/onboarding            Business form (single page, grouped sections)
/questions             Review and edit customer questions
/dashboard             Latest run: Do I appear? · Who else appears? · What next?
/report/[runId]        Full report for one run
  /report/[runId]/answers      Each question with the actual answers and sources
  /report/[runId]/competitors  Competitor comparison table
  /report/[runId]/website      Website audit findings
/actions               All recommended actions with status tracking
/history               All runs; compare two comparable runs
/settings              Business details, platforms, schedule, account, delete data
```

Primary navigation (left sidebar on desktop, bottom tab bar on mobile): Dashboard, Answers, Competitors, Website, Actions, History, Settings.

## 3. Onboarding

Single page with five short groups and a sticky "Save and continue" button. The fifth group, "Public details", is optional and progressive: phone, opening hours, where customers are served (at my location, at theirs, both, prefer not to say), booking link, and up to five priority services. Copy explains that unconfirmed fields stay out of suggested wording.

1. **Your business**: name, other names customers use (optional), category (free text with suggestions), website.
2. **Where you are**: city, state or region, country, service area in the owner's words ("Within 20 miles of downtown Springfield").
3. **What you offer**: main services as chips (type and press Enter), 1 to 15.
4. **What happens next**: two sentences explaining that we will suggest questions and ask AI assistants through their APIs, and that results vary.

Validation appears inline under the field on blur, in plain language ("Please enter a full web address, like https://example.com").

## 4. Question review

- A list of 8 to 12 suggested questions, each editable inline, with remove and drag handles.
- "Add a question" at the bottom.
- Helper text: "These are the kinds of things customers ask an AI assistant. Keep the ones that match what you want to be known for."
- Primary button: "Run my first check". Secondary: "Save for later".
- If no live platform is configured, a notice above the button: "No AI platforms are connected yet. You can run a sample check to see how the report works. Sample results are not about your business."

## 5. Dashboard layout

Top: business name, last check date and time, platforms checked, data mode badge ("Live" or "Sample data").

Three cards in a row on desktop, stacked on mobile:

| Card | Content |
|---|---|
| **Do I appear?** | Big plain sentence: "Mentioned in 3 of 9 answers". Below: "Recommended in 1 of 9", "Your website cited in 0 of 9". Footnote: "9 successful answers, 1 failed check not counted". Link: "See the answers". |
| **Who else appears?** | Top 5 competitors as horizontal bars with "N of 9 answers". Link: "Compare competitors". |
| **What should I do next?** | Three action rows: title, effort chip, status control. Link: "See all actions". |

Below: "Questions we asked" (compact list with per-question status dots) and "How to read this" (a collapsible explainer covering variability and the API-vs-app difference).

## 6. Report screens

### Answers

For each question: the question text, then one card per platform with platform name and "collected through the [platform] API on [date]", the full answer text (collapsed to 8 lines, expandable), a chip row (Mentioned / Recommended / Website cited / Not mentioned / Failed: reason), and the source list (title, domain, link). The owner's business name is highlighted in the answer where matched.

### Competitors

Table: Business, Mentioned in (N of M), Recommended in, Questions where they appear (chips), Sources that cite them most. Row expands to show excerpts. Empty state when extraction unavailable: "We could not identify competitors for this check because the analysis service was not available."

### Website audit

Grouped by "Services", "Location", "Contact", "Technical". Each finding: status icon (good, needs attention, missing), title, what we found (with page link and excerpt), what to do. A "Pages we checked" list with fetch status.

### Actions

Ranked list, one primary action first. Each action shows the owner workflow status (Not started, In progress, Done, Skipped) and, separately, the verification state: Checking, Verified fixed, Still observed, Could not verify, Came back. Suggested wording is labeled either "built only from details you confirmed" or "draft, not ready to publish: still needs …". A "Copy instructions for your web person" button exports title, why, evidence, wording, and the standing caveat as plain text. Each action page: title, "Why we suggest this" with quoted evidence linking to answers or findings, "Suggested wording" in a copy-able block, effort estimate, status control (Not started, In progress, Done, Skipped), date of status change. Note under every action: "This is an improvement opportunity based on what we observed. AI answers can change for many reasons."

### History

Table of runs: date, platforms, questions version, successful/failed, mentioned N of M. Select two runs; if comparable, show a comparison with per-question changes; if not, show both summaries and a sentence explaining the difference (different questions, platform, or location context).

## 7. Reusable components

- `MetricSentence`: renders "Mentioned in 3 of 9 answers" from numerator and denominator; never renders without a denominator.
- `DataModeBadge`: "Live" or "Sample data", always visible on data screens.
- `PlatformBadge`: platform label plus "API" suffix, with tooltip on the API-vs-app difference.
- `AnswerCard`: platform, date, text with highlight, chips, sources.
- `EvidenceQuote`: quoted excerpt with link to its answer or finding.
- `ActionRow` and `StatusSelect`.
- `CompetitorBar`: label, count sentence, proportional bar.
- `FindingRow`: status icon, title, detail, evidence.
- `EmptyState`, `ErrorState`, `LoadingSkeleton`, `Notice` (info, warning).
- Form primitives: `TextField`, `ChipsInput`, `SelectField`, `FieldError`.

## 8. Visual style

- Typeface: system UI stack (fast, familiar). Sizes: 16px body, 20px section titles, 28px page titles, 36px metric sentences.
- Color: neutral grays for chrome, one accent (deep blue) for primary actions and links, green/amber/red used only for status and never as the sole indicator (always paired with an icon or label).
- Spacing: 8px grid. Cards with 1px border, 8px radius, no heavy shadows.
- Charts: only simple horizontal bars with the numbers written next to them. No pie charts, no gauges, no "scores".

## 8b. Appearance

Light and Dark are offered as a single icon button (sun or moon showing the theme in effect; a click flips it) in the sidebar (desktop), the compact top bar (phone), and the landing and auth navs, plus two labeled buttons in an Appearance card in Settings. The choice is a per-browser convenience stored in localStorage; until the owner chooses, the app follows the device setting. A pre-paint script applies the saved choice so there is no flash. Both themes are built from the same tokens (docs/ARCHITECTURE.md, globals.css).

## 9. Responsive behavior

- Breakpoints: mobile under 640px, tablet 640 to 1024, desktop above.
- Sidebar becomes a bottom tab bar on mobile. Three dashboard cards stack. Tables become stacked cards with labels.
- Touch targets at least 44px. No horizontal scrolling.

## 10. Accessibility

- Semantic landmarks, one h1 per page, logical heading order.
- All interactive elements keyboard reachable with visible focus rings.
- Color never the only signal. Status chips include text.
- Form fields have labels, described-by error text, and `aria-invalid` when in error.
- Progress states announced with `aria-live="polite"`.
- Contrast at least 4.5:1 for text.

## 11. Loading, empty, and error states

| Screen | Loading | Empty | Error |
|---|---|---|---|
| Dashboard | Skeleton cards | "No checks yet. Run your first check." with button | "We couldn't load your latest check. Try again." |
| Run in progress | Progress list per question with states queued, running, done, failed, with elapsed time | n/a | Per-check failure shown inline with plain reason; run still completes |
| Answers (unreadable evidence) | — | "Source evidence for this answer could not be read, so we cannot say what it cited." | — |
| Answers | Skeleton cards | "No successful answers in this check." with failed reasons listed | Provider error text mapped to plain reasons: "The platform was busy", "Search was not available" |
| Competitors | Skeleton table | "No other businesses were named in these answers." | "Competitor analysis was unavailable for this check." |
| Website audit | Page-by-page progress | "Add your website to get an audit." | "We couldn't reach your website (reason). Check the address and try again." Script-only sites get "we could read very little text" and findings are framed as "in the N pages we read", never as whole-site absence. |
| Actions | Skeleton rows | "Actions appear after your first completed check." | n/a |
| History | Skeleton table | "Your checks will appear here." | "Couldn't load history." |

Every error state has one retry action and never exposes stack traces or provider internals.
