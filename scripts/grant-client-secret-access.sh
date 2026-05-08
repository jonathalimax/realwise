#!/usr/bin/env bash
# scripts/grant-client-secret-access.sh
# Run AFTER first functions deploy to a client project.
# Grants the client's App Engine SA access to shared SMTP secrets.
#
# Usage:
#   ./scripts/grant-client-secret-access.sh --project PROJECT_ID

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

CLIENT_SA="${PROJECT_ID}@appspot.gserviceaccount.com"
echo "→ Granting $CLIENT_SA Secret Manager access on moneywise-ad9ec..."
gcloud projects add-iam-policy-binding moneywise-ad9ec \
  --member="serviceAccount:$CLIENT_SA" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet
echo "✓ Done. $PROJECT_ID functions can now read shared SMTP secrets."
