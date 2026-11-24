# Development Checkpoint

> Verified 2026-11-24 at 14:46 Moldova local time. GitHub is authoritative; refresh state before relying on this snapshot.

## Repository

- Repository: `sitnics159-crypto/crypto-project-2026`
- Default branch: `main`
- Verified current main SHA: `0673cef328cc378c8189a7a8cc6d1306ea8dc5aa`
- Latest main commit: `Add mobile layout and WCAG accessibility baseline (#59)`
- Product: static, read-only prototype for public Ethereum Sepolia transaction/address lookup and public BTC/ETH market reference data.
- GitHub Pages: https://sitnics159-crypto.github.io/crypto-project-2026/

## Product and safety boundaries

- Keep the MVP static and read-only: public Sepolia data and public market reference data.
- Do not add wallet connections, private-key or seed-phrase handling, transaction signing, or transaction submission.
- Risk labels are evidence-based warnings, not proof of fraud or safety.
- Changes should improve reliability, security, accessibility, or commercial value.

## Verified merged pull requests

| PR | Change |
|---|---|
| #24–#28 | ERC-20 event-decimals fallback; development principles and interruption-safe process; checkpoint; weekly CI health checks |
| #30 | Token metadata retries, CSV formula-injection safeguards, immutable Actions pins, pinned Playwright |
| #32 | Stale address lookup and transaction/ERC-20 pagination response guards |
| #36 | Responsible security reporting policy (`SECURITY.md`) |
| #37 | Development checkpoint refresh |
| #38 | Split deterministic offline tests from live API smoke checks |
| #39 | Deterministic transaction state and error regression coverage |
| #40, #43 | GitHub Pages artifact visibility and rerun reliability fixes |
| #41, #51 | Tiny transaction-fee precision and 18-decimal ETH display precision |
| #42, #53, #56 | Kraken market error/retry coverage and independent BTC/ETH chart fallback |
| #44, #47 | Shareable lookup URL and live transaction browser smoke coverage |
| #45, #49 | CSV export integration coverage and export-state snapshot fix |
| #46, #48 | Address lookup and pagination error/retry coverage |
| #54, #55 | Server-side ERC-20 incoming/outgoing filters, pagination, and regression tests |
| #57 | Mobile input sizing and visible keyboard focus |
| #58 | Screen-reader-accessible market chart data and keyboard navigation |
| #59 | Responsive layout and automated WCAG 2.0/2.1 A/AA plus WCAG 2.2 AA baseline |

## Closed, unmerged, and completed work

- PR #29 — stale checkpoint branch; superseded by merged PR #37.
- PR #33 — stale security-policy branch; superseded by merged PR #36.
- PR #50 — closed unmerged; superseded by merged PR #51.
- PR #52 — closed unmerged; superseded by merged PR #54.
- Issue #31 — CLOSED as completed by PR #32.
- Issue #35 — CLOSED as completed by PR #38 and the subsequent deterministic regression-test PRs.
- Current open pull requests: none (verified from GitHub).
- Current open issues: none (verified from GitHub).

## CI and GitHub Pages on current main

All four latest push workflows completed successfully on main SHA `0673cef328cc378c8189a7a8cc6d1306ea8dc5aa`:

- Validate static site: SUCCESS — [run 45389126088](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45389126088).
- Live API integration smoke test: SUCCESS — [run 45389126115](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45389126115).
- Deterministic offline tests: SUCCESS — [run 45389126143](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45389126143).
- GitHub Pages deployment: SUCCESS — [run 45389126215](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45389126215).

The live smoke run received HTTP 200 responses from Kraken and Sepolia Blockscout for market data, address lookup, ERC-20 transfers, transaction details, logs, and directional filters. It also exercised pagination and CSV download.

The deterministic offline suite passed transaction-state and API-error matrices, token-decimal fallbacks, CSV safety/export behavior, shareable URL restoration, stale-request race regressions, address/token pagination retry behavior, and market fallback/retry cases.

The accessibility regression passed at 320px, 390px, and 768px: no horizontal overflow, both primary inputs visible, 26 axe checks passed at each viewport, zero reported violations, and one axe item marked incomplete for manual review. Automated results do not replace a manual accessibility audit.

## Repository protection

The repository ruleset was independently read from GitHub on 2026-11-24:

- Ruleset: `Protect main`, ID `27884964`, enforcement `active`.
- Target: `refs/heads/main`; bypass list empty; current user bypass: `never`.
- Pull requests required; squash is the only allowed merge method.
- Deletion and non-fast-forward updates are restricted.
- Required status checks: `validate` and `browser-smoke`, with strict status-check policy enabled.
- Required approving review count is 0; the ruleset requires a PR and checks but not a human approval review.

## Security and reliability notes

- `SECURITY.md` documents private-first vulnerability reporting, a safe fallback if private reporting is unavailable, and the static prototype's no-wallet/no-secret boundaries.
- Token metadata lookup has a 10-second timeout, deduplicates concurrent requests, caches definitive results, and permits retries after transient failures.
- CSV export protects formula-like values, including leading whitespace/newlines and full-width formula operators.
- Address lookup and transaction/ERC-20 pagination use request generations and abort guards so stale responses and stale `finally` handlers cannot overwrite newer UI state.
- CI dependencies are pinned to immutable GitHub Actions commit SHAs; Playwright is pinned to `1.65.1`.
- No wallet connection, private-key, seed-phrase, or transaction signing/sending flow is part of the MVP.
- No project license has been selected; do not add a `LICENSE` file until the owner chooses one.

## Next work queue

1. Perform a manual visual review of the deployed GitHub Pages site on mobile and desktop.
2. Inspect the single incomplete axe result manually and record whether it requires remediation.
3. Complete the MVP 1.0 release-readiness audit, including API failure behavior and the documented security boundaries.
4. Select an appropriate project license before adding a `LICENSE`; do not assume one.

## Session protocol

- Start by reading this checkpoint and `.github/CONTINUOUS_DEVELOPMENT_SYSTEM.md`, then refresh GitHub state.
- Use focused branches, inspect relevant code/tests, make minimal changes, run checks, and review the final diff and secrets.
- Update this checkpoint with the exact date, branch/PR, SHAs, test results, risks, and next action.
- GitHub is the durable source of truth; chat history is not a substitute.
- Do not merge a PR without explicit user approval for that specific PR.

## Current session

- Date/time: 2026-11-24, 14:46 Moldova local time.
- Verified main: `0673cef328cc378c8189a7a8cc6d1306ea8dc5aa`.
- Documentation update branch: `docs/checkpoint-after-pr59-2026-11-24`.
- Scope: this checkpoint only; no application code or deployment configuration changed.
- Latest main CI and Pages deployment: all four workflows SUCCESS, with run links above.
- Next action: review the published site visually and inspect the incomplete accessibility audit item.
