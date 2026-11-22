# Development Checkpoint

> Historical checkpoint created 2026-11-22. Refresh all GitHub facts before relying on them.

## Repository
- Repository: `sitnics159-crypto/crypto-project-2026`
- Default branch: `main`
- Last confirmed main SHA at checkpoint creation: `2ee6e7ecb593e63d11844d38b47518cd9a7168c9`
- Project: static prototype for public Ethereum Sepolia transaction/address lookup and reference BTC/ETH market data.

## Product and safety constraints
- MVP scope: public Sepolia transaction/address lookup.
- No wallet connection, private keys, seed phrases, or transaction submission.
- Risk labels are warnings based on explorer data, not proof of fraud or safety.
- Every change must improve reliability, security, or commercial value.

## Open pull requests confirmed 2026-11-22
- PR #24 — **Fix token transfer event decimals fallback** — open, not merged.
  - Scope: validate event-level ERC-20 decimals; fall back to valid token metadata; regression coverage for invalid event decimals.
  - Previous session recorded successful Validate and Browser smoke checks at head SHA `ff0b9c2fe85eb1d54a5a` (verify the full current head SHA and checks again before merge).
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/24
- PR #25 — **Document the continuous evolution principle** — open, not merged.
  - Scope: development lifecycle, Innovation & Development Center responsibilities, safety, traceability, review, and rollback expectations.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/25
- PR #26 — **Add interruption-safe continuous development system** — open, not merged.
  - Branch: `docs/continuous-development-system`
  - Head SHA: `48c125e02ded982da5e588aacb5191fac262b311`
  - Adds this checkpoint and `.github/CONTINUOUS_DEVELOPMENT_SYSTEM.md`; documentation only.
  - URL: https://github.com/sitnics159-crypto/crypto-project-2026/pull/26

## Known work queue (revalidate before acting)
1. Review PR #24 diff, current head SHA, and required CI checks; merge only when all required checks and review criteria pass.
2. Review PR #25 and PR #26; avoid duplicating their documentation and merge only after review.
3. Finish protecting `main` with a ruleset. Previous attempt to configure the ruleset was interrupted; do not assume it was saved or active.
4. Pin GitHub Actions to reviewed immutable commit SHAs and pin Playwright/browser versions.
5. Move core tests out of workflow-only logic so they can be run locally and in CI.
6. Add/verify `SECURITY.md` and an appropriate `LICENSE`.
7. Continue API/security audit, including public API rate limits and failure handling.
8. Expand regression tests and verify the published GitHub Pages site.

## Known historical blocker
- A previous GitHub integration write to `.github/workflows/static.yml` returned HTTP 403. Do not assume that attempted edit was committed. Re-fetch the file and verify current content before changing it.

## This CDS documentation branch
- Branch: `docs/continuous-development-system`
- Added: `.github/CONTINUOUS_DEVELOPMENT_SYSTEM.md`
- Added: `docs/DEVELOPMENT_CHECKPOINT.md`
- PR #26 is open; these documentation changes are not yet merged into `main`.

## Next action
Refresh live GitHub state, then inspect PR #24's full diff, head SHA, and latest Validate/Browser smoke runs. Do not merge automatically. After that, review PR #25 and PR #26, then proceed to the main-branch ruleset only after confirming the current GitHub settings state.
