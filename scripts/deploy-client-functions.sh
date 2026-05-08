#!/usr/bin/env bash
# scripts/deploy-client-functions.sh
# Deploys scheduledBillReminders to a client project using clientIndex.js
# as the entry point — avoids shared-project secrets (Stripe, etc.) being
# validated against the client project.
#
# Usage:
#   ./scripts/deploy-client-functions.sh --project PROJECT_ID

set -uo pipefail

PROJECT_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: --project is required" >&2
  exit 1
fi

FUNCTIONS_DIR="$(dirname "$0")/../functions"
PKG="$FUNCTIONS_DIR/package.json"

restore_main() {
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('$PKG'));
    delete p.main;
    fs.writeFileSync('$PKG', JSON.stringify(p, null, 2) + '\n');
  "
}

# Set clientIndex.js as entry point and restore on exit
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('$PKG'));
  p.main = 'clientIndex.js';
  fs.writeFileSync('$PKG', JSON.stringify(p, null, 2) + '\n');
"
trap restore_main EXIT

echo "→ Deploying scheduledBillReminders to $PROJECT_ID..."
firebase deploy --only functions:scheduledBillReminders --project "$PROJECT_ID"
echo "✓ Done."
