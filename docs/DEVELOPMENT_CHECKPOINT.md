# Development Checkpoint

> Historical checkpoint originally verified 2026-11-24. The authoritative post-PR #62 state is recorded in the final section below; it supersedes conflicting earlier snapshot details.

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

- PR #29 — earlier checkpoint refresh — CLOSED as stale and diverged from current `main`; superseded by replacement PR #37.
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


---

## Authoritative state refresh — 2026-11-24, after PR #62

This section supersedes earlier snapshot statements in this document wherever they conflict. GitHub live state was refreshed after PR #62 merged.

### Current repository state

- Current `main` SHA: `66515185728186c80ad4227faf02066967a0ebf2`.
- Latest main commit: `Test inert rendering of untrusted Blockscout data (#62)`.
- Published site: https://sitnics159-crypto.github.io/crypto-project-2026/
- Only open pull request found: PR #60, `Refresh development checkpoint after PR #59`. It is based on an older main SHA (`0673cef328cc378c8189a7a8cc6d1306ea8dc5aa`) and its content is now stale after PRs #61 and #62. Leave it open and unmodified until its disposition is explicitly decided; this refreshed checkpoint is prepared from current main.
- PR #61, `Report details for incomplete axe accessibility checks`, is MERGED (merge commit `2a44e1658a43b89c9c3544b61db923e6766568f4`).
- PR #62, `Test inert rendering of untrusted Blockscout data`, is MERGED (merge commit `66515185728186c80ad4227faf02066967a0ebf2`).
- Issue #35, `Separate deterministic application tests from live API smoke tests`, is CLOSED as completed. The separation and its regression coverage are already present on main; do not reopen or repeat this work.

### Main CI and deployment verification

All four push checks completed successfully on the exact current main SHA `66515185728186c80ad4227faf02066967a0ebf2`:

- Validate static site — SUCCESS: https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45417808385
- Deterministic offline tests — SUCCESS: https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45417808414
- Live API integration smoke test — SUCCESS: https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45417808594
- GitHub Pages deployment — SUCCESS: https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45417808675

These results confirm the corresponding CI jobs and deployment action succeeded. They do not constitute a separate manual visual review of the published site or a full security/penetration test.

### Accessibility and untrusted API data

- PR #61 added detailed diagnostics for axe incomplete results and expanded accessibility checks for transaction/address error states and loading/result/pagination states. Automated checks reported zero confirmed axe violations in the audited states.
- One axe `color-contrast` item remains `incomplete` because the page uses gradient backgrounds; this is not a confirmed violation. Targeted manual contrast calculations for reported header/intro text passed the 4.5:1 threshold, but this is not a complete manual accessibility audit.
- PR #62 added a deterministic offline regression for HTML/script-like strings in untrusted Blockscout sender, decoded-method, and token-name fields. The test verifies values render as literal text and injected elements/handlers do not execute. This is targeted regression coverage, not proof of complete XSS immunity.

### Next release-readiness work

1. Perform a manual visual review of the deployed site at desktop and mobile widths, including transaction lookup, address lookup, ERC-20 filters/pagination/CSV, and market panels.
2. Review API failure and recovery states against Blockscout and Kraken behavior, including timeout, rate limiting, server errors, and partial market-data failure.
3. Complete a focused security review of external links, DOM sinks, API-derived content, dependency/workflow permissions, and hosting headers. Do not describe this as a penetration test unless one is actually performed.
4. Keep the MVP static and read-only: no wallet connection, private keys, seed phrases, signing, or transaction submission.
5. Select a project license only after the owner chooses one; do not add a license by assumption.

### Session record

- Date: 2026-11-24.
- Base main SHA: `66515185728186c80ad4227faf02066967a0ebf2`.
- Documentation-only branch: `docs/checkpoint-post-pr62-2026-11-24`.
- Scope: refresh this checkpoint from verified GitHub state; no application code, workflows, or deployment settings changed.
- Next action: continue the MVP 1.0 release-readiness audit, beginning with manual review of the deployed experience and its failure/recovery states.

---

## Authoritative state refresh — 2026-11-24, after PR #66

This section supersedes earlier checkpoint snapshots wherever they conflict. GitHub state was refreshed from the live repository after PR #66 merged.

### Current repository state

- Current `main` SHA: `05e54389ab1b1796e65e2797b6c84f6578a6cffb`.
- Latest main commit: `Keep address results available when activity endpoints fail (#66)`.
- Published site: https://sitnics159-crypto.github.io/crypto-project-2026/
- PR #60, `Refresh development checkpoint after PR #59`, remains open and intentionally untouched. Its branch `docs/checkpoint-after-pr59-2026-11-24` is now diverged from current main: 2 commits ahead and 6 commits behind. Its content is superseded by later checkpoint refreshes; do not merge it as-is.
- PR #61, `Report details for incomplete axe accessibility checks`, MERGED — `2a44e1658a43b89c9c3544b61db923e6766568f4`.
- PR #62, `Test inert rendering of untrusted Blockscout data`, MERGED — `66515185728186c80ad4227faf02066967a0ebf2`.
- PR #63, `Refresh development checkpoint after PR #62`, MERGED — `3b3bbad1dc725cbbfd3441a2b9c32c218f446493`.
- PR #64, `Test address lookup recovery after API failures`, MERGED — `138462532a8101a2dab34493f95e1ca293fa3f51`.
- PR #65, `Identify stale market values after refresh failures`, MERGED — `c9b169118369fc3e9c330786281f7e230e940718`.
- PR #66, `Keep address results available when activity endpoints fail`, MERGED — `05e54389ab1b1796e65e2797b6c84f6578a6cffb`.
- Issue #35 remains CLOSED; deterministic offline tests and live integration smoke checks are already separated. Do not repeat or reopen this task.

### Changes delivered by PRs #64–#66

- PR #64 added deterministic regression coverage for address lookup recovery after HTTP 5xx responses. It verifies that loading state clears, the submit button is restored, and a successful retry replaces the error state.
- PR #65 preserves the last successful BTC/ETH market snapshot after refresh failures and clearly labels the displayed values as potentially stale, including the last successful timestamp. Regression coverage includes HTTP 429, HTTP 5xx, and timeout failures.
- PR #66 keeps the address overview available when transaction activity or ERC-20 activity endpoints fail independently. A successfully loaded activity section remains visible while the failed section shows a localized status; the UI does not present partial activity as complete.
- These changes improve resilience but do not replace a full manual review of API failure/recovery behavior.

### CI and GitHub Pages on current main

All four latest push checks completed successfully on exact main SHA `05e54389ab1b1796e65e2797b6c84f6578a6cffb`:

- Validate static site — SUCCESS: https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45426840485
- Deterministic offline tests — SUCCESS: https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45426840666
- Browser smoke test — SUCCESS: https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45426840629
- GitHub Pages deployment — SUCCESS: https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45426840440

These results verify the listed automated jobs and deployment action. They do not establish that a human has visually reviewed the live site or completed a full security assessment.

### Current open work and release-readiness queue

1. Manually review the deployed site at mobile width 390px and desktop widths. Inspect transaction/address lookup, address activity sections, ERC-20 filters/pagination/CSV, and BTC/ETH market panels.
2. Verify the visible stale-market notice and partial-address-activity error states in the browser, including recovery after retry.
3. Complete focused keyboard and assistive-technology review; axe has one `color-contrast` incomplete item caused by gradient backgrounds. This is not a confirmed violation. Previously calculated contrast ratios for the reported header/intro text passed 4.5:1, but that targeted calculation is not a complete manual accessibility audit.
4. Continue the focused security review of external links, DOM sinks, API-derived content, dependency/workflow permissions, and hosting headers. Do not describe this as a penetration test unless one is actually performed.
5. Preserve the static, read-only MVP boundary: no wallet connection, private keys, seed phrases, signing, or transaction submission.
6. Select a project license only after the owner chooses one; do not add a license by assumption.

### Session record — post PR #66

- Date: 2026-11-24.
- Verified base main SHA: `05e54389ab1b1796e65e2797b6c84f6578a6cffb`.
- Documentation-only branch: `docs/checkpoint-post-pr66-2026-11-24`.
- Scope: update this checkpoint with merged PRs #63–#66, current main SHA, CI results, and remaining release-readiness work. No application code, workflow configuration, deployment settings, or main-branch changes are included.
- PR #60 was not modified or closed; its disposition remains separate.
- Next action: complete the manual mobile/desktop visual review and verify the new API failure/recovery UI states.


### Focused source and CI security review — 2026-11-24

Reviewed the current `main` source at `05e54389ab1b1796e65e2797b6c84f6578a6cffb`, including `index.html`, the four GitHub Actions workflows, `SECURITY.md`, and the deterministic regression tests.

Confirmed in the inspected source:

- No occurrences of `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval()`, or `new Function()` were found in `index.html`.
- API-derived labels, hashes, token names, method strings, status messages, and rendered values are inserted through `textContent` or created as DOM nodes; the code does not use API-provided strings as HTML markup.
- External links opened in a new tab use `rel="noopener noreferrer"`. Dynamic Blockscout links use fixed HTTPS origins and URL-encoded identifiers; the CSV download uses a locally created Blob URL.
- Browser data requests in the inspected application code target the fixed Blockscout Sepolia and Kraken public API origins. No wallet connection, signing, transaction submission, private-key, or seed-phrase flow was found in the inspected page.
- The three test workflows declare `contents: read`; the separate Pages deployment workflow has the additional Pages/id-token permissions required for deployment. Actions are pinned to full commit SHAs in the inspected workflows.
- The offline regression suite contains a malicious-markup fixture for Blockscout-provided transaction, method, and token strings and asserts that no injected elements or script execution occur. This is targeted regression evidence, not proof of complete XSS immunity.

Remaining security limitations and follow-up:

- This was a focused static source/configuration review, not a penetration test, dependency audit, or independent security assessment.
- GitHub Pages response headers and any effective Content-Security-Policy/security headers have not yet been verified from the deployed response. Treat hosting-header review as open.
- Dependency reproducibility and transitive dependency risk were not fully assessed; the CI workflows install pinned direct Playwright/axe versions without a committed lockfile.
- Continue manual review of deployed behavior and hosting configuration before declaring release readiness.

Scope of this checkpoint update: documentation only. No application code, workflow, Pages configuration, repository settings, or `main` changes.
