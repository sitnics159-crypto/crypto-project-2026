# Development Checkpoint

> Verified 2026-11-24 (Moldova local time). GitHub is authoritative; refresh PRs, branches, checks, and repository settings before relying on this snapshot.

## Repository

- Repository: `sitnics159-crypto/crypto-project-2026`
- Default branch: `main`
- Current main SHA: `82a5bf3093f4fc555e20e1547730653bd09f45ee`
- Product: static prototype for public Ethereum Sepolia transaction/address lookup and public BTC/ETH market reference data.
- GitHub Pages: https://sitnics159-crypto.github.io/crypto-project-2026/

## Product and safety boundaries

- Keep the MVP static and read-only: public Sepolia data and public market reference data.
- Do not add wallet connections, private-key or seed-phrase handling, transaction signing, or transaction submission.
- Risk labels are evidence-based warnings, not proof of fraud or safety.
- Changes should improve reliability, security, or commercial value.

## Verified merged pull requests

| PR | Change | Merge commit |
|---|---|---|
| #24 | ERC-20 event-decimals fallback | `83079dfc1c844e34e30e300e22c164e7362053ec` |
| #25 | Continuous evolution principle | `37a60c0bf255202cb09e46076ea9fda48db0cf11` |
| #26 | Interruption-safe continuous development system | `c115264710b57a9ef24da7fe23e889a5e03eee69` |
| #27 | Earlier development checkpoint refresh | `d54a7e6d2311c4b6ee7b7cdace492489a6a0abfe` |
| #28 | Weekly CI health checks | `e642c924d2d4c6db57f0b0a93598383b26f02995` |
| #30 | Token metadata retries, CSV formula-injection safeguards, immutable Actions pins, Playwright pin | `c158099304812bd96874771d2d82bcf364727915` |
| #32 | Stale address lookup and pagination response guards | `7b860772d4acedb360c50b3925c38ef08f4a8f33` |
| #36 | Responsible security reporting policy (`SECURITY.md`) | `82a5bf3093f4fc555e20e1547730653bd09f45ee` |

## Current pull requests and issues

- PR #29 — earlier checkpoint refresh — OPEN but stale and diverged from current `main`; this replacement checkpoint PR supersedes it. Do not merge #29.
- PR #33 — old security-policy branch — CLOSED; superseded by merged PR #36.
- PR #36 — security policy — MERGED.
- Issue #31 — stale address/pagination response race — CLOSED as completed by PR #32.
- Issue #35 — separate deterministic offline tests from live API smoke tests — OPEN and remains the next engineering task.

## CI and GitHub Pages on current main

All results below are for main SHA `82a5bf3093f4fc555e20e1547730653bd09f45ee`:

- Validate static site: SUCCESS — [run 45346728309](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45346728309).
- Browser smoke test: SUCCESS — [run 45346728411](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45346728411).
- GitHub Pages deployment: SUCCESS on attempt 2 — [run 45346728428](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45346728428). Attempt 1 uploaded the Pages artifact but the deploy action temporarily reported that artifact metadata was unavailable; retry succeeded.
- Workflow success confirms deployment action completion; it is not a substitute for a separate visual browser review of the published site.

## Repository protection

The repository ruleset was independently read from GitHub on 2026-11-24:

- Ruleset: `Protect main`, ID `27884964`, enforcement `active`.
- Target: `refs/heads/main`; bypass list empty; current user bypass: `never`.
- Pull requests required; squash is the only allowed merge method.
- Deletion and non-fast-forward updates are restricted.
- Required status checks: `validate` and `browser-smoke`, with strict status-check policy enabled.
- Required approving review count is 0; this ruleset requires a PR and checks but does not require a human approval review.

## Security and reliability notes

- `SECURITY.md` documents private-first vulnerability reporting, a safe fallback if private reporting is unavailable, and the static prototype's no-wallet/no-secret boundaries.
- Token metadata lookup has a 10-second timeout, deduplicates concurrent requests, caches definitive results, and permits retries after transient failures.
- CSV export protects formula-like values, including leading whitespace/newlines and full-width formula operators.
- Address lookup and transaction/ERC-20 pagination use request generations and abort guards so stale responses and stale `finally` handlers cannot overwrite newer UI state.
- CI dependencies are pinned to immutable GitHub Actions commit SHAs; Playwright is pinned to `1.65.1`.
- No Content-Security-Policy meta element is present. GitHub Pages does not provide repository-level arbitrary response-header configuration; a meta CSP is not equivalent to an HTTP response header. Revisit hosting only if stronger response-header controls become a release requirement.
- No wallet connection, private-key, seed-phrase, or transaction signing/sending flow is part of the MVP.

## Next work queue

1. Issue #35: separate deterministic, network-free application tests from live Blockscout/Kraken integration smoke checks. Add fixtures for transaction parsing, token decimals, CSV safety, pagination/filtering, stale requests, and timeout/429/5xx handling.
2. Keep deterministic tests independent of upstream availability; report offline and live integration layers separately in CI.
3. Continue final repository and deployment audit after the test split.
4. Select an appropriate project license before adding a `LICENSE`; do not assume one.

## Session protocol

- Start by reading this checkpoint and `.github/CONTINUOUS_DEVELOPMENT_SYSTEM.md`, then refresh GitHub state.
- Use focused branches, inspect relevant code/tests, make minimal changes, run checks, and review the final diff and secrets.
- Update this checkpoint with the exact date, branch/PR, SHAs, test results, risks, and next action.
- GitHub is the durable source of truth; chat history is not a substitute.
- Do not merge a PR without explicit user approval for that specific PR.

## Next action

Implement Issue #35 as a focused test-infrastructure change, preserving the static MVP and no-wallet/no-secret boundaries.
