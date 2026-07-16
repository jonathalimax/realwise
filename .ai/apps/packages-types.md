# Package: Shared Types

## Purpose

`packages/types` contains shared DTOs/domain types used across apps.

## Rules

- Put types here when both API and browser apps need the contract.
- Avoid browser-only UI types here.
- Keep breaking API contract changes coordinated with all consumers.

## Validation

Run relevant app builds/tests when shared types change because failures often appear in consumers.
