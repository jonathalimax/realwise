# Feature: Planner

## Purpose

Planning tools for income, allocation, portfolio/carteira, and related projections.

## Known areas

- Renda tab handles salary input and deductions.
- Pure calculation helpers should stay outside React components and be covered by tests.
- Feature flags may control advanced planner behaviors such as salary breakdown.

## Agent notes

- Keep calculations deterministic and testable.
- Prefer updating existing pure helpers over embedding math in components.
- Run focused Vitest tests for changed calculation modules.
