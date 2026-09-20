# Mentioned (AI Visibility Check)

A tool for single-location business owners: see whether AI assistants mention your business when people ask for what you do, who they mention instead, and three practical things to do about it.

Planning documents live in `docs/`: [PRD](docs/PRD.md), [Architecture](docs/ARCHITECTURE.md), [Rules](docs/RULES.md), [Design](docs/DESIGN.md), [Tasks](docs/TASKS.md), [Memory](docs/MEMORY.md).

## Run locally

Requires Node 24 (uses the built-in `node:sqlite`) and pnpm.

```bash
pnpm install
cp .env.example .env.local   # optional: add API keys for live checks
pnpm dev                     # http://localhost:3000
```

Without API keys the app runs in **sample mode**: answers are generated from templates and every screen labels them "Sample data". The website audit always reads the real site you enter.

To connect a live platform, set one or more of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`. `ANTHROPIC_API_KEY` also enables competitor extraction from answers. See `.env.example` for model overrides.

## Checks

```bash
pnpm test        # unit and integration tests (no network)
pnpm typecheck
pnpm lint
pnpm build && pnpm start
pnpm seed:demo   # seeds a demo account and runs a sample check against DATABASE_PATH
pnpm live:smoke  # asks one question through each configured live adapter
```

## How data flows

1. **Collect**: for each question and platform, the adapter asks the provider API with the business city as location context and stores the full response.
2. **Audit**: the safe fetcher reads up to 12 pages of the owner's site (public hosts only, size and time capped) and deterministic rules produce findings.
3. **Analyze**: owner mentions come from name matching; other businesses come from a verified extraction step whose evidence must be an exact excerpt of the stored answer. Metrics are always "N of M successful checks"; failed checks are never counted as absence.
4. **Recommend**: rule-based improvement opportunities, each citing stored evidence, ranked and capped at three.

## Deployment

One Node process serves the app and runs the background worker. Mount a persistent volume and point `DATABASE_PATH` at it. `GET /api/health` reports database reachability and which adapters are configured (names only). See `Dockerfile`.
