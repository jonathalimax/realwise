#!/usr/bin/env bash
set -euo pipefail

# ── Arguments ────────────────────────────────────────────────────────────────
ENV="${1:-}"
TARGET="${2:-}"

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

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Build summary lines ───────────────────────────────────────────────────────
LINES=()

needs_build=false
if [[ "$ENV" == "prod" ]]; then
  ICON="🔴"
  LABEL="${RED}${BOLD}DEPLOYING TO PRODUCTION${RESET}"
else
  ICON="🟢"
  LABEL="${GREEN}${BOLD}DEPLOYING TO DEV${RESET}"
fi

if [[ "$TARGET" == "all" || "$TARGET" == "hosting" ]]; then
  needs_build=true
  LINES+=("  Build:     npm run build")
fi

if [[ "$TARGET" == "all" || "$TARGET" == "hosting" ]]; then
  if [[ "$ENV" == "prod" ]]; then
    LINES+=("  Hosting:   mymoneywise (realwise.com.br)")
    LINES+=("  Rules:     firestore.rules")
  else
    LINES+=("  Hosting:   realwise-dev")
  fi
fi

if [[ "$TARGET" == "all" || "$TARGET" == "functions" ]]; then
  if [[ "$ENV" == "prod" ]]; then
    LINES+=("  Functions: moneywise-ad9ec (prod)")
  else
    LINES+=("  Functions: realwise-dev (dev)")
  fi
fi

if [[ "$TARGET" == "redirect" ]]; then
  needs_build=false
  LINES+=("  Hosting:   realwise-redirect (short URL domain)")
fi

# ── Print box ────────────────────────────────────────────────────────────────
echo ""
echo -e "╔══════════════════════════════════════╗"
echo -e "║  $ICON  $LABEL"
echo -e "╠══════════════════════════════════════╣"
for line in "${LINES[@]}"; do
  echo -e "║$line"
done
echo -e "╚══════════════════════════════════════╝"
echo ""

# ── Dirty tree warning (prod only) ───────────────────────────────────────────
if [[ "$ENV" == "prod" ]]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${YELLOW}⚠️  Warning: you have uncommitted changes. Proceeding anyway.${RESET}"
    echo ""
  fi
fi

# ── Confirm ──────────────────────────────────────────────────────────────────
read -r -p 'Type "y" to continue, anything else aborts: ' answer
if [[ "$answer" != "y" ]]; then
  echo "Aborted."
  exit 0
fi


# ── Build ────────────────────────────────────────────────────────────────────
if [[ "$needs_build" == true ]]; then
  echo "📦  Building..."
  npm run build
  echo ""
fi

# ── Deploy ───────────────────────────────────────────────────────────────────
if [[ "$TARGET" == "all" || "$TARGET" == "hosting" ]]; then
  if [[ "$ENV" == "prod" ]]; then
    echo "🚀  Deploying hosting + rules to prod..."
    firebase deploy --only hosting:mymoneywise,firestore:rules
  else
    echo "🚀  Deploying hosting to dev..."
    firebase deploy --only hosting:realwise-dev --project realwise-dev
  fi
  echo ""
fi

if [[ "$TARGET" == "all" || "$TARGET" == "functions" ]]; then
  if [[ "$ENV" == "prod" ]]; then
    echo "⚡  Deploying functions to prod..."
    firebase deploy --only functions
  else
    echo "⚡  Deploying functions to dev..."
    firebase deploy --only functions --project realwise-dev
  fi
  echo ""
fi

if [[ "$TARGET" == "redirect" ]]; then
  echo "🔀  Deploying redirect site..."
  firebase deploy --only hosting:realwise-redirect
  echo ""
fi

echo "✅  Deploy complete."
