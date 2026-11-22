# Development Checkpoint

> Live checkpoint refreshed 2026-11-22 after merging PRs #24, #25, and #28. Refresh GitHub state before relying on any SHA or status below.

## Repository
- Repository: `sitnics159-crypto/crypto-project-2026`
- Default branch: `main`
- Main SHA at this checkpoint update: `e642c924d2d4c6db57f0b0a93598383b26f02995`
- Continuous Development System (CDS) is present on main from merged PR #26.
- Product: static prototype for public Ethereum Sepolia transaction/address lookup and reference BTC/ETH market data.

## Product and safety constraints
- MVP scope: public Sepolia transaction/address lookup and public market reference data.
- Never request or handle wallet connections, private keys, seed phrases, or transaction signing/sending.
- Risk labels are evidence-based warnings, not proof of fraud or safety.
- Changes must improve reliability, security, or commercial value.

## Pull request and merge history (verified 2026-11-22)
- PR #24 — **Fix token transfer event decimals fallback** — MERGED.
  - Fixes invalid ERC-20 event decimals fallback to valid token metadata and includes regression coverage.
  - Merge commit: `83079dfc1c844e34e30e300e22c164e7362053ec`
  - `validate` and `browser-smoke` passed on reviewed head `ff0b9c2fe85eb1d54a5a8b754e755aeed0d30346`.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/24
- PR #25 — **Document the continuous evolution principle** — MERGED.
  - Documents the Innovation & Development Center responsibilities and research → development → testing → release → monitoring lifecycle, with safety and rollback expectations.
  - Merge commit: `37a60c0bf255202cb09e46076ea9fda48db0cf11`
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/25
- PR #26 — **Add interruption-safe continuous development system** — MERGED.
  - Added `.github/CONTINUOUS_DEVELOPMENT_SYSTEM.md` and the development checkpoint.
  - Merge commit: `c115264710b57a9ef24da7fe23e889a5e03eee69`
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/26
- PR #27 — **Refresh live development checkpoint** — OPEN while this checkpoint is being updated.
  - This PR updates this file to reflect the verified merges and current main SHA.
  - Its previous head checks (`validate`, `browser-smoke`) both passed on `154b0ac935f30bf1d12c989ca4ba231457ac4cf5`; new checks must be verified on the updated head before merge.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/27
- PR #28 — **Add weekly CI health checks** — MERGED.
  - `validate` scheduled Mondays at 05:17 UTC; `browser-smoke` scheduled Mondays at 05:37 UTC. Existing push, pull-request, and manual triggers remain.
  - Both checks passed on PR head `1fdc5e073c24c2ee0597e694c786b5f76df676b0`.
  - Merge commit: `e642c924d2d4c6db57f0b0a93598383b26f02995`
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/28

## Automation and repository protection
- GitHub Actions workflow files on main include `validate.yml`, `browser-smoke.yml`, and `static.yml`.
- `.github/workflows/static.yml` is not empty; it contains the GitHub Pages deployment workflow, restricted to pushes on `main` and manual dispatch.
- The last confirmed repository inspection reported `main` as unprotected and no repository rulesets. Re-check current settings before making any claim that protection is enabled.
- The connector previously could not read branch-protection details (HTTP 403); do not infer that a ruleset was saved.

## Priority work queue
1. Complete PR #27 only after its updated checkpoint diff and fresh CI checks are verified.
2. Protect `main` with a repository Ruleset: require pull requests and successful validation checks; block force pushes and branch deletion. Verify the saved ruleset in GitHub after creation.
3. Review and pin third-party GitHub Actions to immutable commit SHAs; evaluate Playwright/browser version pinning and reproducibility.
4. Inspect public API rate-limit handling, timeouts, and graceful failure states; add regression tests for any defects found.
5. Verify GitHub Pages deployment and the published site after code changes.
6. Consider moving core tests out of workflow-only logic so they can run locally and in CI; review `SECURITY.md` and an appropriate `LICENSE`.

## Session protocol
- Start: read this file and `.github/CONTINUOUS_DEVELOPMENT_SYSTEM.md`; refresh main SHA, open PRs, diffs, checks, and settings.
- Work: use a focused feature branch, inspect relevant source/tests, make minimal changes, run relevant checks, review diff and secrets.
- Finish: update this checkpoint with date, branch/PR, exact SHAs, tests, risks, and one next action.
- GitHub is the durable source of truth; chat history is not a substitute.
- No background development is implied. Automation runs only through configured GitHub Actions or explicitly scheduled supported tasks.

## Next action
Finish the refreshed PR #27 after verifying its updated head SHA, complete diff, and fresh `validate` and `browser-smoke` results. Then configure and independently verify the `main` protection Ruleset.
