# App: Root Workspace

## Purpose

Coordinates the pnpm workspace, shared scripts, CI workflows, docs, and infrastructure.

## Important files

| File | Purpose |
|---|---|
| `package.json` | Root workspace commands |
| `pnpm-workspace.yaml` | Workspace package list |
| `.github/workflows/` | CI/CD workflows |
| `.ai/` | Canonical AI project context |
| `docs/archive/` | Historical plans/specs |

## Agent notes

- Avoid committing unrelated generated folders such as `.pnpm-store/`, `node_modules/`, `dist/`, or worktrees.
- Use workspace filters for focused commands.
