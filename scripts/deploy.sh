#!/usr/bin/env bash
set -euo pipefail

# ── Arguments ────────────────────────────────────────────────────────────────
ENV="${1:-}"      # prod | dev
TARGET="${2:-}"   # all | hosting | functions | redirect

if [[ -z "$ENV" || -z "$TARGET" ]]; then
  echo "Usage: deploy.sh <env> <target>"
  echo "  env:    prod | dev"
  echo "  target: all | hosting | functions | redirect"
  exit 1
fi

if [[ "$ENV" != "prod" && "$ENV" != "dev" ]]; then
  echo "❌  Unknown env: $ENV (must be prod or dev)"
  exit 1
fi

if [[ "$TARGET" != "all" && "$TARGET" != "hosting" && "$TARGET" != "functions" && "$TARGET" != "redirect" ]]; then
  echo "❌  Unknown target: $TARGET (must be all | hosting | functions | redirect)"
  exit 1
fi

if [[ "$TARGET" == "redirect" && "$ENV" != "prod" ]]; then
  echo "❌  redirect target only makes sense for prod"
  exit 1
fi

echo "✅  Args valid: env=$ENV target=$TARGET"
