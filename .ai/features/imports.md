# Feature: Imports and Categorization

## Purpose

Import bank/card statements and classify transactions with review/issue workflows.

## Supported concerns

- Bank format detection and parsing.
- CSV/PDF/XLSX import processing.
- Categorization rules and uncategorized review.
- Admin import issue tooling.

## Boundaries

- Parsing and persistence should live in API/services or pure import modules.
- Web owns upload/review UX.
- Admin owns operational issue triage.

## Agent notes

- Keep importer detection deterministic and covered by tests where possible.
- Preserve tenant/user scoping for imported rows and issues.
- Do not silently swallow parse errors; surface actionable feedback through the existing UX pattern.
