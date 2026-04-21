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

set -uo pipefail

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
IAM_OUTPUT=$(gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="user:$CLIENT_EMAIL" \
  --role="roles/owner" \
  --quiet 2>&1) || true

if echo "$IAM_OUTPUT" | grep -q "SOLO_MUST_INVITE_OWNERS"; then
  echo ""
  echo "⚠  This project requires an invitation for new owners (Spark plan restriction)."
  echo "   The CLI cannot directly grant roles/owner. Complete the transfer manually:"
  echo ""
  echo "   1. Open: https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID"
  echo "   2. Click 'Grant Access'"
  echo "   3. Add member: $CLIENT_EMAIL"
  echo "   4. Select role: Owner"
  echo "   5. Save — GCP will send an invitation email"
  echo ""
  echo "   Alternatively, upgrade the project to the Blaze plan first, then re-run this script."
  exit 1
elif echo "$IAM_OUTPUT" | grep -q "ERROR"; then
  echo "$IAM_OUTPUT" >&2
  exit 1
fi

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
echo ""
echo "  IAM Console: https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID"
