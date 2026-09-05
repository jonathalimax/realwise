# Pipeline Handoff Expectations

The executable ship pipeline is configured at user level. This repo defines expected handoff files only.

## Files

```txt
.pipeline/spec.md
.pipeline/progress.md
.pipeline/changes.md
.pipeline/test-results.md
.pipeline/review.md
```

## `.pipeline/spec.md`

Must include request summary, `.ai/` context files read, affected apps/features, implementation plan, API/data/auth impacts, validation plan, and `OPEN QUESTIONS` only when blocked.

## `.pipeline/progress.md`

Must be created with the spec and updated after each stage/meaningful implementation milestone. Include branch, PR URL, checklist, timeline, and blockers.

## `.pipeline/changes.md`

Must include changed files, behavior changes, docs updated, migration notes, and follow-ups.

## `.pipeline/test-results.md`

Must include commands run, pass/fail status, failures, and commands not run with reason.

## `.pipeline/review.md`

Must include verdict (`SHIP` or not), blocking issues, non-blocking issues, and evidence reviewed.
