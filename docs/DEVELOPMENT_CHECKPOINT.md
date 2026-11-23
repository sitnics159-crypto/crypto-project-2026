# Development Checkpoint

> Live checkpoint refreshed 2026-11-23 (Moldova local time). GitHub is authoritative; refresh branch, PR, and check states before relying on this checkpoint.

## Repository

- Repository: `sitnics159-crypto/crypto-project-2026`
- Default branch: `main`
- Last verified main SHA: `d54a7e6d2311c4b6ee7b7cdace492489a6a0abfe`
- Product: static prototype for public Ethereum Sepolia transaction/address lookup and reference BTC/ETH market data.
- Continuous Development System (CDS) is present on `main`.

## Product and safety constraints

- MVP scope: public Sepolia transaction/address lookup and public market reference data.
- Never request or handle wallet connections, private keys, seed phrases, transaction signing, or transaction sending.
- Risk labels are evidence-based warnings, not proof of fraud or safety.
- Every change must improve reliability, security, or commercial value.

## Verified merged pull requests

- PR #24 — **Fix token transfer event decimals fallback** — MERGED.
  - Fixes invalid ERC-20 event decimals fallback to valid token metadata and includes regression coverage.
  - Merge commit: `83079dfc1c844e34e30e300e22c164e7362053ec`.
  - `validate` and `browser-smoke` passed on reviewed head `ff0b9c2fe85eb1d54a5a8b754e755aeed0d30346`.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/24
- PR #25 — **Document the continuous evolution principle** — MERGED.
  - Documents Innovation & Development Center responsibilities and the research → development → testing → release → monitoring lifecycle.
  - Merge commit: `37a60c0bf255202cb09e46076ea9fda48db0cf11`.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/25
- PR #26 — **Add interruption-safe continuous development system** — MERGED.
  - Added `.github/CONTINUOUS_DEVELOPMENT_SYSTEM.md` and the development checkpoint.
  - Merge commit: `c115264710b57a9ef24da7fe23e889a5e03eee69`.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/26
- PR #27 — **Refresh live development checkpoint** — MERGED.
  - Merge commit: `d54a7e6d2311c4b6ee7b7cdace492489a6a0abfe`.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/27
- PR #28 — **Add weekly CI health checks** — MERGED.
  - Adds weekly Monday schedules: `validate` at 05:17 UTC and `browser-smoke` at 05:37 UTC.
  - Merge commit: `e642c924d2d4c6db57f0b0a93598383b26f02995`.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/28

## Open pull requests — do not merge without explicit user approval

- PR #29 — **Finalize development checkpoint after PR #27 merge** — OPEN.
  - Updates this checkpoint file.
  - Check the current PR status checks directly before merge; this checkpoint does not store its own head SHA.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/29
- PR #30 — **Harden token metadata retries and pin CI dependencies** — OPEN, not merged.
  - Branch: `fix/token-metadata-retry-and-ci-pins-2026-11-23`.
  - Final verified head SHA: `de464fdecdd2a08883921e7e0db4aba143bdc33f`.
  - Changes: 10-second timeout for Blockscout token metadata requests; transient failures are not permanently cached; CSV formula-injection guard covers leading whitespace/newlines and full-width operators; GitHub Actions pinned to immutable release SHAs; Playwright pinned to `1.65.1`.
  - `validate` passed: run [45135531344](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45135531344).
  - `browser-smoke` passed: run [45135531301](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45135531301).
  - Regression log confirmed metadata retry result `firstAttempt=null, secondAttempt=18, attempts=2`; CSV formula cases for direct, newline-prefixed, and full-width formula operators passed.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/30
- PR #32 — **Prevent stale address and pagination responses** — OPEN, not merged.
  - Branch: `fix/stale-address-request-guards-2026-11-23`.
  - Head SHA: `ded87a68b90f5bda6c8f5f076e24abc8caf508e9`.
  - Adds request-generation and abort guards for address lookup and both pagination flows; includes delayed-response regression coverage.
  - `validate` and `browser-smoke` both passed on this exact head SHA.
  - Closes issue #31 after merge.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/32

## CI and GitHub Pages status

- On main SHA `d54a7e6d2311c4b6ee7b7cdace492489a6a0abfe`, scheduled `validate` passed in run [45124053522](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45124053522).
- On the same main SHA, scheduled `browser-smoke` passed in run [45126152708](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45126152708).
- Main push checks also passed: [validate](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45046638943), [browser-smoke](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45046638898), and [GitHub Pages deployment](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45046638888).
- An earlier Pages deployment on SHA `e642c924d2d4c6db57f0b0a93598383b26f02995` failed after artifact upload because the deploy action could not find artifact metadata. A subsequent Pages deployment on `d54a7e6d2311c4b6ee7b7cdace492489a6a0abfe` succeeded; no current deployment failure is confirmed.
- PR #30 checks are green on its exact final head SHA. Its Pages workflow is not run on pull requests; verify deployment after an approved merge.

## Repository protection

- `Protect main` is configured and Active for target branch `main`.
- Bypass list is empty; GitHub reports `current_user_can_bypass: never`.
- Enabled rules: branch deletion restriction, non-fast-forward/force-push restriction, pull-request requirement, and required status checks.
- Required checks: `validate` and `browser-smoke`; strict required-status-check policy is enabled.
- Direct GitHub API verification on 2026-11-23 confirmed the saved ruleset. Do not describe `main` as unprotected.

## Security and API audit

### Completed in PR #30 (pending merge)

- Token metadata lookup previously had no explicit timeout and cached transient failures as `null` for the entire page session. It now times out after 10 seconds, shares concurrent requests, caches definitive 404/valid responses, and allows retry after network/5xx/429/timeout failures.
- CSV formula-injection handling now prefixes cells beginning with formula operators, whitespace/control whitespace, BOM, and full-width formula operators.
- GitHub Actions now use immutable release commit SHAs:
  - `actions/checkout` v7.0.1 — `3d3c42e5aac5ba805825da76410c181273ba90b1`
  - `actions/setup-node` v7.1.0 — `949feb2413d6458794dcd2491c4babbbce0c15c1`
  - `actions/configure-pages` v6.0.0 — `45bfe0192ca1faeb007ade9deae92b16b8254a0d`
  - `actions/upload-pages-artifact` v5.0.0 — `fc324d3547104276b827a68afc52ff2a11cc49c9`
  - `actions/deploy-pages` v5.0.1 — `368f82528645a54fb793d4d04e342629a3f51346`
- Playwright is pinned to `1.65.1`.
- These releases address the Node 20 Actions runtime removal; the updated JavaScript actions declare Node 24 where applicable.

### Static review of current main

- No `innerHTML`, `outerHTML`, `document.write`, `eval`, or `new Function` use was found in `index.html`.
- All three links with `target="_blank"` also use `rel="noopener noreferrer"`.
- Dynamic API-derived content is inserted with DOM element creation and `textContent`; explorer URLs use fixed HTTPS hosts and encoded identifiers.
- Transaction, address, pagination, market, and token-metadata requests use explicit abort timeouts.
- No wallet connection, secret phrase, private key, or transaction signing/sending path is present in the current MVP.

### Remaining audit work

- Issue #31 tracks stale-response races and is addressed by open PR #32. The fix adds request-generation guards and aborts superseded address and pagination requests; delayed-response regression coverage is included. Issue #31 remains open until PR #32 is merged. URL: https://github.com/sitnics159-crypto/crypto-project-2026/issues/31.
- Consider separating deterministic unit tests from live-API smoke tests so upstream API outages do not obscure application regressions.
- Review CSP/security headers appropriate for a static GitHub Pages deployment.
- Add a `SECURITY.md` with a verified reporting route.
- Choose an appropriate project license before adding a `LICENSE`; do not assume one.

## Priority work queue

1. Review PRs #29, #30, and #32; do not merge without explicit user approval.
2. Verify GitHub Pages deployment after an approved merge.
3. Continue the API/security audit: review CSP/security headers, add a verified `SECURITY.md` reporting route, and assess separation of deterministic tests from live-API smoke tests.
4. Choose an appropriate project license before adding a `LICENSE`; do not assume one.
5. Complete a measurable MVP 1.0 release checklist.

## Session protocol

- Start: read this file and `.github/CONTINUOUS_DEVELOPMENT_SYSTEM.md`; refresh main SHA, open PRs, diffs, checks, and settings.
- Work: use a focused branch, inspect relevant code/tests, make minimal changes, run checks, review the final diff and secrets.
- Finish: update this checkpoint with date, branch/PR, exact SHAs, test results, risks, and one next action.
- GitHub is the durable source of truth; chat history is not a substitute.
- No background development is implied beyond explicitly configured GitHub Actions or supported scheduled tasks.

## Next action

Review the open PRs and their current checks; wait for explicit approval before merging any PR.
