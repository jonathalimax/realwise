# Feature: Customer Finance Core

## Purpose

Core customer workflows for transactions, income, expenses, categories, cards, bills, budgets, goals, and dashboard summaries.

## Boundaries

- Web owns customer UX and local UI state.
- API owns persistence, authorization, tenant scoping, and business rules.
- Shared DTOs belong in `packages/types` when reused.

## Data patterns

- Shared accounts use `ownerId` from access/session context where applicable.
- Credit card payment date logic should stay centralized rather than duplicated across UI screens.
- Category and transaction transformations should be tested as pure functions when possible.

## Agent notes

Check existing contexts/hooks before adding new state containers. Avoid moving business rules into React components.
