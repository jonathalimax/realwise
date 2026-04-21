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
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PROJECT_ID" || -z "$CLIENT_EMAIL" ]]; then
  echo "Error: --project and --client-email are required" >&2
  exit 1
fi

# Step 1 — Grant Cloud Functions service account IAM admin (enables web-based transfers later)
ADMIN_SA="moneywise-ad9ec@appspot.gserviceaccount.com"
echo "→ Granting IAM admin to Cloud Functions service account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$ADMIN_SA" \
  --role="roles/resourcemanager.projectIamAdmin" \
  --quiet 2>/dev/null || true
echo "✓ Cloud Functions service account ready."

# Step 2 — Link billing account FIRST (upgrades Spark → Blaze, unlocking CLI owner grants)
if [[ -n "$BILLING_ACCOUNT" ]]; then
  echo "→ Linking billing account $BILLING_ACCOUNT (upgrades to Blaze)..."
  gcloud billing projects link "$PROJECT_ID" \
    --billing-account="$BILLING_ACCOUNT"
  echo "✓ Billing account linked — project is now on Blaze."
fi

# Step 3 — Grant owner
echo "→ Granting roles/owner to $CLIENT_EMAIL on project $PROJECT_ID..."
IAM_OUTPUT=$(gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="user:$CLIENT_EMAIL" \
  --role="roles/owner" \
  --quiet 2>&1) || true

if echo "$IAM_OUTPUT" | grep -q "SOLO_MUST_INVITE_OWNERS"; then
  echo ""
  echo "⚠  Spark plan restriction — owner must be invited via the GCP Console."
  echo "   Tip: re-run with --billing-account to upgrade to Blaze first, then owner grant works."
  echo ""
  echo "   Or complete manually:"
  echo "   1. Open: https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID"
  echo "   2. Click 'Grant Access'"
  echo "   3. Add member: $CLIENT_EMAIL  |  Role: Owner"
  echo "   4. Save — GCP sends an invitation email"
  exit 1
elif echo "$IAM_OUTPUT" | grep -q "ERROR"; then
  echo "$IAM_OUTPUT" >&2
  exit 1
fi

echo "✓ Owner role granted."

# Step 4 — Optionally remove self
if [[ "$REMOVE_SELF" == true ]]; then
  SELF_EMAIL=$(gcloud config get-value account 2>/dev/null)
  if [[ -n "$SELF_EMAIL" && "$SELF_EMAIL" != "(unset)" ]]; then
    echo "→ Removing $SELF_EMAIL from roles/owner..."
    gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
      --member="user:$SELF_EMAIL" \
      --role="roles/owner" \
      --quiet
    echo "✓ Self removed from project."
  else
    echo "⚠ Could not determine current gcloud account. Skipping --remove-self." >&2
  fi
fi

echo ""
echo "✓ Transfer complete for $PROJECT_ID → $CLIENT_EMAIL"
echo ""
echo "  IAM Console: https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID"
