# B-14 — Final Integration Checkpoint (snapshot develop 917a7b3)

Status: **PREPARED LOCALLY; NOT MERGED, NOT DEPLOYED, NO STAGING E2E PASS**.

## What was directly inspected

- The provided `jejaknalar-develop.zip` is a source snapshot of commit `917a7b3`, without `.git` history.
- `App.tsx` includes the Teacher routes but `/student/join` remains a placeholder.
- `StudentQuestPage` already supports an entirely synthetic Evidence Hunt preview using mock repositories.
- `student-api` has submit 202 `pending_scoring`; the Sprint 1 mock `QuestFlow` only accepts `scored` responses.
- `feat/B-assessment-scoring-worker`, B-12, C-BI8, D-04 through D-07 were **not supplied as Git branch source**. Review and merge of those branches cannot be completed from this zip.

## Changes in B-14

- Public `/demo/play` route loads existing Sprint 1 Evidence Hunt preview using synthetic data only; no backend calls.
- `/demo` now links to that explicit simulation. It is NOT the published BI8 quest.
- Documented student API URL variable in the example frontend env only; it does not wire a live adapter.
- `scripts/B-14-branch-audit.ps1` reports remote branch comparison without merge/deploy.
- `scripts/B-14-local-gates.ps1` runs frontend/contract checks and stops on FAIL.
- `scripts/B-14-source-map-check.sql` returns three local paragraph locators against a specific staging `document_id` for human comparison. It does **not** approve sources or change data.

## Required decisions in project ownership order

1. **A (Product Owner):** choose final demo slice (PRD class VII or BI8 class VIII) and confirm guest / teacher UI smoke. Mock vs live must be labeled.
2. **C:** submit verified public BI8 paragraph text and teacher review decision. `DOC-P-559/596/599` are *local locators*, not guaranteed staging references.
3. **D:** PR and test evidence for real Student UI. Serializer must produce ONE string for official `item_id`, accept partial answers, handle HTTP 202 `pending_scoring` and later result without synthetic score.
4. **B:** review PR diffs, security/DB migrations, correct server secrets, CORS and ID mapping; keep scoring worker fail-closed until evaluator and concurrency gate pass.

## Git integration gates (do NOT skip)

Run `git fetch origin` once in the user's actual Git worktree, then `powershell -ExecutionPolicy Bypass -File scripts/B-14-branch-audit.ps1 -Repo <repo-path>` to inspect branch status. For each candidate: PR -> reviewer -> CI -> smoke; order schema/migrations, C/rules, then A/D UI; verify on `develop`. Branch names alone are not merge evidence. Production release only from verified commit via release PR, not direct push to main.

`npm ci` cannot run in this offline artifact container because a required npm package is missing from its cache. **No lint, typecheck, unit, contract, build, or E2E PASS is claimed for the new changes.** Local static checks and patch-application checks are separate from application tests.

## Safe fallback release

If guest/demo route works but live publish/scoring is not ready: explicitly describe it as **synthetic preview**. Do not make `status: scored`, feedback, or adaptive path appear to be real academic results. Do not change approved Quest or enable B06/scoring production flags without full security and teacher approval gates.
