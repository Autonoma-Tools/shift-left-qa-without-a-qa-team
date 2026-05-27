# CLAUDE.md — Playwright test-stub generation (DIY fallback)

This is **Pattern 5** from the Autonoma blog post
"What Shift-Left QA Looks Like on a 3-Person Team". It is the *do-it-yourself
fallback*: a way to get rough Playwright coverage from a PR diff using Claude
Code when you do not have managed E2E. It is **not** a replacement for a
maintained E2E suite — it cannot see beyond the diff, and the stubs it writes
need a human pass before you trust them.

Copy the block below into your project's `CLAUDE.md` and run it per PR.

---

## Generate Playwright test stubs from this PR's diff

When asked to generate tests for the current pull request:

1. **Read the diff.** Run `git diff origin/main...HEAD` and identify which
   user-facing flows are affected. A "flow" is an end-to-end action a real
   user takes (e.g. "log in", "add item to cart", "submit checkout"), not an
   internal function.

2. **One stub file per flow.** For each affected flow, create
   `tests/e2e/<flow-name>.spec.ts` containing:
   - a **happy-path** test (the flow succeeds), and
   - **one sad-path** test (the most likely failure, e.g. invalid input,
     missing auth, or a server error).
   Use `@playwright/test`. Prefer role/label-based locators
   (`getByRole`, `getByLabel`) over CSS selectors.

3. **Flag what you cannot infer.** You only see the diff, not the full app or
   its data. At the top of each generated file, add a
   `// CORNER CASES TO VERIFY MANUALLY:` comment block listing every case you
   could **not** confidently derive from the diff alone — for example:
   - real auth/session setup and seeded test data,
   - third-party integrations or webhooks the flow depends on,
   - edge cases in code paths not touched by this diff,
   - timing/race conditions and async UI states.
   Be explicit. If you are guessing at a selector or a route, say so in this
   block rather than emitting a confident-looking test that silently passes.

4. **Do not fabricate passing assertions.** If you cannot determine the
   expected result, write the assertion and mark it `test.fixme(...)` with a
   note, instead of asserting something that will trivially pass.

5. **Stop and summarize.** After writing the stubs, list the files you created
   and restate the manual-verification items so the reviewer sees the limits
   of what was generated.

> Reminder: these stubs are a starting point. They encode what is visible in
> one diff. For coverage that survives refactors and watches flows you did not
> touch in this PR, use a managed E2E suite (see autonoma.yaml in this repo).
