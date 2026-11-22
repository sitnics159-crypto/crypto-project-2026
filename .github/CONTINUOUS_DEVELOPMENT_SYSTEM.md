# Continuous Development System (CDS)

This document defines a low-cost, interruption-safe workflow for developing Crypto Project 2026 with ChatGPT and GitHub.

## Source of truth

GitHub is the durable source of truth. ChatGPT conversation history and memory are helpful context, but they are not substitutes for repository state.

Before changing code, always re-check:
1. The current default branch and its latest commit SHA.
2. Open pull requests, their head SHAs, merge status, and CI checks.
3. The exact files and lines involved in the task.
4. Whether another branch or PR already addresses the same issue.

Never claim a change, test, deployment, merge, or setting is complete without direct confirmation from GitHub or an executed test.

## Safety and scope

- Every change must improve reliability, security, or commercial value.
- The MVP is a public Ethereum Sepolia transaction/address checker.
- Do not connect wallets, request private keys or seed phrases, or send transactions.
- Treat explorer labels and risk signals as evidence, not proof.
- Keep changes focused; prefer a branch and pull request over direct changes to `main`.
- Do not merge a PR merely because it exists. Review its diff, required checks, and head SHA first.
- Do not enable destructive settings, change repository permissions, or weaken branch protection as a workaround.
- If a GitHub integration returns 403 or another permission error, report it accurately and provide a manual path; do not claim success.

## Session protocol

### Start of every session
- Read this file and `docs/DEVELOPMENT_CHECKPOINT.md`.
- Refresh repository state from GitHub; checkpoint data may be stale.
- Inspect open PRs and CI before selecting the next task.
- Select one small, high-value task and state its acceptance criteria.

### During work
- Work on a dedicated branch.
- Inspect the full relevant code and tests before editing.
- Make the smallest safe change.
- Run the relevant tests and CI; distinguish locally executed tests from GitHub Actions checks.
- Review the final diff for unintended changes and secrets.
- Open/update a PR and wait for checks where appropriate.

### End of every session
Update `docs/DEVELOPMENT_CHECKPOINT.md` with:
- Date/time (Moldova local time) and session summary.
- Default branch SHA and working branch/PR.
- Exact changed files and commit SHA(s).
- Tests run, results, and links to CI runs.
- Open risks, blockers, and permissions errors.
- The single next recommended action.

Commit the checkpoint update when possible. If repository writes are unavailable, provide the complete checkpoint text in the chat so it can be saved manually.

## Interruption and usage-limit recovery

When a chat ends, a new chat starts, or a usage limit is reached:
1. Open the repository and read this file plus the checkpoint.
2. Refresh the live GitHub state; do not trust an old SHA as current.
3. Compare the checkpoint with current branches, PRs, commits, and CI.
4. Resume from the first unfinished action; do not repeat completed work.
5. If facts conflict, live GitHub state wins and the checkpoint is corrected.

## Prioritization

Use this order unless new evidence changes the risk:
1. Resolve existing PRs and CI failures safely.
2. Protect `main` and make CI reliable.
3. Fix correctness/security issues in the Sepolia explorer and public API usage.
4. Add regression tests for each fixed defect.
5. Add missing project governance/security documentation.
6. Improve usability and prepare a verifiable MVP 1.0 release.

## Reusable prompt for a new ChatGPT chat

> Continue Crypto Project 2026 using the Continuous Development System. Repository: sitnics159-crypto/crypto-project-2026. First read .github/CONTINUOUS_DEVELOPMENT_SYSTEM.md and docs/DEVELOPMENT_CHECKPOINT.md from GitHub, then independently refresh the live default branch SHA, open PRs, diffs, and CI. Do not assume old statuses are current. Preserve the MVP constraints: public Ethereum Sepolia lookup only; no wallet connection, private keys, seed phrases, or transaction sending. Every change must improve reliability, security, or commercial value. Resume the highest-priority unfinished task, work on a branch, verify tests, and update the checkpoint before ending.

## Daily working rhythm

- Start: refresh state and choose one acceptance-tested task.
- Work: implement and validate a focused change.
- Finish: update checkpoint and leave one clear next step.
- No automatic background development is implied; work happens when the user starts a session or explicitly schedules a supported task.
