# What Shift-Left QA Looks Like on a 3-Person Team

Companion code for the Autonoma blog post 'What Shift-Left QA Looks Like on a 3-Person Team': husky + lint-staged pre-commit config, a Sentry-to-Slack backfill webhook handler, an autonoma.yaml for a Next.js app, a GitHub Actions job that creates a Neon database branch per PR for Vercel preview environments, and a reusable CLAUDE.md prompt for generating Playwright test stubs from a PR diff.

> Companion code for the Autonoma blog post: **[What Shift-Left QA Looks Like on a 3-Person Team](https://getautonoma.com/blog/shift-left-qa-without-a-qa-team)**

## Requirements

Node 20+. Pattern-specific tools: husky, lint-staged, vitest, Express, @sentry/node, the Neon CLI, and the Vercel CLI.

## Quickstart

```bash
git clone https://github.com/Autonoma-Tools/shift-left-qa-without-a-qa-team.git
cd shift-left-qa-without-a-qa-team
# Each pattern is self-contained in its own directory.
# Start with pre-commit-setup/ then sentry-backfill/.
# To run the Sentry backfill handler locally:
npm install
cp sentry-backfill/.env.example sentry-backfill/.env   # then fill in real values
npx ts-node sentry-backfill/handler.ts
```

## Project structure

```
shift-left-qa-without-a-qa-team/
├── README.md
├── LICENSE
├── .gitignore
├── package.json                         # runtime deps for the sentry-backfill handler
├── autonoma.yaml                        # Pattern 3: Autonoma E2E config for a Next.js/Vercel app
├── CLAUDE.md                            # Pattern 5: Playwright test-stub prompt (DIY fallback)
├── pre-commit-setup/                    # Pattern 1: husky + lint-staged pre-commit gating
│   ├── package.json
│   └── .husky/
│       └── pre-commit
├── sentry-backfill/                     # Pattern 2: Sentry -> Slack -> Autonoma backfill webhook
│   ├── handler.ts
│   └── .env.example
├── examples/
│   └── post-sentry-webhook.sh           # sample signed Sentry webhook POST
└── .github/
    └── workflows/
        └── neon-preview-branch.yml      # Pattern 4: per-PR Neon DB branch for Vercel previews
```

- `src/` — primary source files for the snippets referenced in the blog post.
- `examples/` — runnable examples you can execute as-is.
- `docs/` — extended notes, diagrams, or supporting material (when present).

## About

This repository is maintained by [Autonoma](https://getautonoma.com) as reference material for the linked blog post. Autonoma builds autonomous AI agents that plan, execute, and maintain end-to-end tests directly from your codebase.

If something here is wrong, out of date, or unclear, please [open an issue](https://github.com/Autonoma-Tools/shift-left-qa-without-a-qa-team/issues/new).

## License

Released under the [MIT License](./LICENSE) © 2026 Autonoma Labs.
