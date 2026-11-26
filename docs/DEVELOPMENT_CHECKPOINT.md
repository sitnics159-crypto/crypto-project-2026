# Development Checkpoint

## Verified checkpoint — 2026-11-26

- Published baseline: [`ed0613b195e0efbc88fb0f994f747527c85aa720`](https://github.com/sitnics159-crypto/crypto-project-2026/commit/ed0613b195e0efbc88fb0f994f747527c85aa720). [Validate static site](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45779285428), [Live API integration smoke test](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45779285514), [Deploy static content to Pages](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45779285503), [Deterministic offline tests](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45779285435) succeeded on this commit.
- [PR #89](https://github.com/sitnics159-crypto/crypto-project-2026/pull/89) published the lookup data notice and referrer policy. The live site displayed the notice and opened a known Sepolia transaction and address. [PR #91](https://github.com/sitnics159-crypto/crypto-project-2026/pull/91) made CSV export unavailable while a changed transfer filter loads. The offline suite exercises the transition, and the live API check verifies export.
- [PR #87](https://github.com/sitnics159-crypto/crypto-project-2026/pull/87) recorded the launch criteria, and [PR #90](https://github.com/sitnics159-crypto/crypto-project-2026/pull/90) updated the public README. Use the [release checklist](RELEASE_CHECKLIST.md) to assess the selected release candidate.
- [Draft PR #88](https://github.com/sitnics159-crypto/crypto-project-2026/pull/88) contains the preview without Kraken at `2a91d1d413ed75d420e8ebc6c7415fcaa5733d69`. Its [Chromium run](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45779886791/job/139772494337) verified Sepolia lookup, the lookup notice, a CSV with 50 outgoing ERC-20 transfers, and requests limited to the local preview and Blockscout.
- The December 25 target is subject to the selected release scope, provider permissions, and release-day verification. The reserve preview still depends on Blockscout Sepolia.

## Current checkpoint — 2026-11-25

Verified base on `main`: [`06902b789b026a7c80b3b0115c325c90808d4fa2`](https://github.com/sitnics159-crypto/crypto-project-2026/commit/06902b789b026a7c80b3b0115c325c90808d4fa2). The historical snapshots below are retained for context.

- [PR #69](https://github.com/sitnics159-crypto/crypto-project-2026/pull/69) merged at the previous baseline and added a hash-based meta CSP. [PR #68](https://github.com/sitnics159-crypto/crypto-project-2026/pull/68) added the npm lockfile. Both browser workflows use `npm ci --ignore-scripts` and install Chromium separately.
- [PR #60](https://github.com/sitnics159-crypto/crypto-project-2026/pull/60) and [PR #67](https://github.com/sitnics159-crypto/crypto-project-2026/pull/67) are open documentation-only checkpoint proposals. Both diverged from the pre-#73 baseline and have older checkpoint contents. Use this checkpoint for the current release baseline. Issue #35 was completed by PR #38 as recorded in the prior checkpoint work.
- [Protect main](https://github.com/sitnics159-crypto/crypto-project-2026/rules/27884964) is active for `refs/heads/main`. It requires a PR, squash merge, and strict `validate` and `browser-smoke` status checks. The bypass list is empty.

### Current main CI and deployment

- [Validate static site](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45635614479) — success on push.
- [Deterministic offline tests](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45635614536) — success on push.
- [Live API integration smoke test](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45635614520) — success on push.
- [Deploy static content to Pages](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45635614436) — success on push.

### Published-site audit

- [GitHub Pages](https://sitnics159-crypto.github.io/crypto-project-2026/) returned HTTP 200 over HTTPS. The downloaded body matched the Git blob for `index.html` at the pre-#73 SHA (`0284d5bf851aab17b056a58f3ac9766bcf5f0b1a`, blob `275607153ff527724b407ed6cd2dacfb8825d089`).
- The published HTML contains one inline script. Its recomputed SHA-256 matched the meta CSP value. The policy defaults to denying resources and limits API connections to Blockscout Sepolia and Kraken.
- The observed response included `Strict-Transport-Security: max-age=31556952`. It did not include HTTP `Content-Security-Policy`, `X-Frame-Options`, or `X-Content-Type-Options` headers. The meta policy provides script and resource restrictions. Framing protection would require a response-header control.
- [PR #74](https://github.com/sitnics159-crypto/crypto-project-2026/pull/74) added checks for both rendered USD quotes when the market panel reports success. Scheduled runs fail if quotes are unavailable. PR and push runs emit a warning in that case. The strict scheduled path has yet to run.
- The [browser-smoke log after PR #74](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45622009279/job/139232332218) confirmed both Kraken quotes, five initial ERC-20 rows, token-decimal fallback to 18, local expansion to ten rows, and CSV download. The live workflow exercised local expansion; the separate published-site pass below exercised a second API page.

- On the published site, both Kraken USD quotes and hourly histories loaded. Public Sepolia address and transaction lookups succeeded. The ERC-20 list loaded 100 transfers after requesting a second page, and the CSV contained 100 unique transaction-hash/log-index pairs involving the test address.
- Narrow and wide layout checks found no horizontal overflow. Targeted keyboard checks covered form order, address submission, transaction links, pagination, ERC-20 filters, and CSV export with visible focus outlines.
- [PR #73](https://github.com/sitnics159-crypto/crypto-project-2026/pull/73) improved the two primary submit buttons. The published page was checked after deployment and both buttons used the new gradient. Calculated white-text contrast at the gradient stops is 5.24:1 and 6.84:1.

- [PR #77](https://github.com/sitnics159-crypto/crypto-project-2026/pull/77) restricted the Pages payload to `index.html`. The deployment log listed that as the sole file. After deployment, the site displayed both Kraken quotes and the public Sepolia test address balance. The three sampled former file URLs (npm manifest, offline test, and checkpoint) displayed the Pages 404 page.

- [PR #76](https://github.com/sitnics159-crypto/crypto-project-2026/pull/76) added regression assertions that repeating the lookup restores both activity lists after either simulated Blockscout activity failure. Both cases passed on main.
- [PR #78](https://github.com/sitnics159-crypto/crypto-project-2026/pull/78) added a persistent address lookup status. On the published site, a successful lookup populated the status with «Обзор адреса готов.» and keyboard focus remained in the address field. The browser regression verifies reset and completion, including partial activity failure and retry.

### Release rehearsal

- Used the [release checklist](RELEASE_CHECKLIST.md) on the candidate at `06902b789b026a7c80b3b0115c325c90808d4fa2`. The Pages upload log listed `index.html` as the sole file, and the browser smoke log confirmed both Kraken quotes.
- Opened saved Sepolia transaction and address URLs directly and reloaded both results. Invalid input showed format guidance and kept focus in its field. An unknown transaction produced a clear not-found message, and a known hash worked on retry. For the sampled address without history, Blockscout returned an overview with an unknown balance and zero activity. The live address-not-found branch was not exercised.
- Exported both ERC-20 directions for the public Sepolia test address. The outgoing CSV contained all 50 loaded transfers while five were displayed. The incoming CSV contained both loaded transfers. The event IDs were unique and all rows matched the selected direction and ERC-20 type.

### Remaining release verification

1. Address overview speech check completed on 2026-11-25. The project owner reported hearing «Обзор адреса готов» from Windows Narrator after submitting the public Sepolia test address with Enter on the published site. This was a targeted manual check of the completion announcement.
2. Verify the first strict scheduled market smoke result and keep conditional ERC-20 coverage visible in the workflow logs. The offline suite already exercises timeout, rate-limit, server-error, partial-market, and retry cases.
3. Keep GitHub Pages for the current static, read-only MVP. The latest observed HTTP response did not include framing or MIME-sniffing protections. Revisit hosting if response-header controls become a release requirement or the product adds sensitive or state-changing interactions. The previous header sample is recorded above; headers have yet to be reverified on the current deployment.
4. Keep the MVP static and read-only. The planned commercial launch date of 2026-12-25 remains a target pending release verification.

### GitHub Pages rollback

1. Identify the change responsible for the regression and verify the last known-good Pages deployment. For a regression introduced by [PR #78](https://github.com/sitnics159-crypto/crypto-project-2026/pull/78), the verified pre-change baseline is `5d338fe65bce583b05a01720c54c58a83b5865b0` ([successful deploy](https://github.com/sitnics159-crypto/crypto-project-2026/actions/runs/45627749375)).
2. Create a branch from current `main` and revert the responsible squash commit. Review the diff for unrelated changes. If the revert conflicts with later changes, resolve it on the branch and verify the intended application or deployment behavior.
3. Open a rollback PR. Wait for `validate`, `browser-smoke`, and `offline-tests` on the current PR head and obtain explicit approval for the squash merge under Protect main.
4. After merge, verify CI and Pages deployment on the exact new `main` SHA. Check that the uploaded site contains only `index.html`, then open the published site and confirm a known Sepolia transaction, a known address balance, and both Kraken USD quotes. Record the rollback PR, the post-merge SHA, the deployment run, and any degraded behavior.

---

> Historical checkpoint originally verified 2026-11-24. The section after PR #62 is a later historical snapshot.

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
