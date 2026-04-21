#!/usr/bin/env bash
# scripts/transfer-client.sh
# Usage:
#   ./scripts/transfer-client.sh \
#     --project PROJECT_ID \
#     --client-email CLIENT_EMAIL \
#     [--billing-account BILLING_ACCOUNT_ID] \
#     [--remove-self]
#
# Requirements: gcloud CLI authenticated as project owner

set -euo pipefail

PROJECT_ID=""
CLIENT_EMAIL=""
BILLING_ACCOUNT=""
REMOVE_SELF=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)         PROJECT_ID="$2";       shift 2 ;;
    --client-email)    CLIENT_EMAIL="$2";     shift 2 ;;
    --billing-account) BILLING_ACCOUNT="$2";  shift 2 ;;
    --remove-self)     REMOVE_SELF=true;      shift   ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [[ -z "$PROJECT_ID" || -z "$CLIENT_EMAIL" ]]; then
  echo "Error: --project and --client-email are required"
  exit 1
fi

echo "→ Granting roles/owner to $CLIENT_EMAIL on project $PROJECT_ID..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="user:$CLIENT_EMAIL" \
  --role="roles/owner" \
  --quiet

echo "✓ Owner role granted."

if [[ -n "$BILLING_ACCOUNT" ]]; then
  echo "→ Linking billing account $BILLING_ACCOUNT to project $PROJECT_ID..."
  gcloud billing projects link "$PROJECT_ID" \
    --billing-account="$BILLING_ACCOUNT"
  echo "✓ Billing account linked."
fi

if [[ "$REMOVE_SELF" == true ]]; then
  SELF_EMAIL=$(gcloud config get-value account 2>/dev/null)
  if [[ -n "$SELF_EMAIL" ]]; then
    echo "→ Removing $SELF_EMAIL from roles/owner..."
    gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
      --member="user:$SELF_EMAIL" \
      --role="roles/owner" \
      --quiet
    echo "✓ Self removed from project."
  else
    echo "⚠ Could not determine current gcloud account. Skipping --remove-self."
  fi
fi

echo ""
echo "✓ Transfer complete for $PROJECT_ID → $CLIENT_EMAIL"
